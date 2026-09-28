# CLAUDE.md — maintainer notes for dev-spec-driven

Context for anyone (human or Claude) working on this plugin. Read this before changing the engine.

## What this is
A Claude Code **plugin** that unifies four spec-driven skills into one **track-based** skill, plus
a bundled **local, zero-dependency MCP server**. Hard constraints set by the owner:
- **No GitHub Actions / no paid CI / no pull requests.** All automation is local (hooks + the MCP
  server). Never add a `.github/workflows/` for this project, never open PRs — merge locally and push.
  No user-facing text may steer users toward PRs or CI (a test scans the prose; CHANGELOG is exempt).
- **Zero runtime dependencies.** The MCP server and all scripts use only Node core (`fs`, `path`, `os`,
  `readline`, `string_decoder`, `child_process`, `crypto`, built-in `fetch`). No `npm install` required. Keep it that way.
- Specs always live in `.specs/` (no alternate directory detection).

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
mcp/lib/spec.js                ALL domain logic (classify, scaffold, lint, trace, doctor, gates, state, impact, catalog, drift, upgrade,
                               import, scan, templates, export, changelog, roles, forecasts, evidence, stop gate, decisions, flows)
mcp/lib/i18n.js                ALL localized content (artifact + steering builders, tool/CLI/hook messages) — EN/PT/ES + pt-BR
mcp/lib/prompts-resources.js   MCP prompts (one per commands/*.md, read at runtime) + specs:// resources (read-only, confined)
mcp/evals/run-evals.js         local eval harness (uses ANTHROPIC_API_KEY; --dry-run offline)
mcp/test.js                    smoke test — `node mcp/test.js`
cli/dev-spec.js                universal CLI over mcp/lib/spec.js (cross-tool; also prints MCP configs, rule files and prompts)
cli/test-cli.js                smoke test for the CLI — `node cli/test-cli.js` (never a top-level bin/, see below)
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

## Never ship a top-level `bin/`
Claude Desktop / claude.ai does not clone the repo: it validates it on a remote Anthropic service
that **rejects** any plugin shipping a top-level `bin/` (those files land on PATH in the CLI but are
invisible on the admin approval surface). The sync fails with `status=failed_content` and the UI
shows only "Marketplace sync failed. Check the repository URL" — which points nowhere near the cause.
The local CLI (`/plugin marketplace add`) uses `git clone` and does **not** apply this rule, so it
passes even when Desktop refuses; it is not a valid pre-check. Executable entry points go in `cli/`,
`hooks/`, `commands/` or `mcpServers`.

## Three surfaces over ONE engine
`mcp/lib/spec.js` is the single source of truth. It is exposed three ways: (1) the MCP server for
MCP clients (its tools; the prompts are the command files and the resources read `.specs/` through the engine's
resolver), (2) the `dev-spec` CLI for any tool/terminal, (3) Claude Code skill+commands+hooks.
When you add an operation, add it to `spec.js` first, then wire it into server.js (tool) AND
cli/dev-spec.js (subcommand) AND mcp/test.js (assertion). Keep the CLI and MCP behavior identical —
both call the same engine function with the same defaults (e.g. `roadmapReport()` backs `spec_roadmap`
and `dev-spec roadmap`; `approvePhase()` has one default approver, `$USER`/`$USERNAME`/`user`).
Any user-facing string the operation GENERATES or RETURNS goes through `mcp/lib/i18n.js` (EN/PT/ES),
never hardcoded in spec.js — see the Trilingual section. The CLI's human output is localized too
(`cliText(lang)` over `i18n.msg(lang).cliOutput`: the feature's language for feature commands, the
project's otherwise). `--json` prints the same structured result the MCP tool returns: keys and stable
codes (`step`, `code`, `unverifiedReason`, check ids) never change, while message fields (`recommendation`,
`note`, `error`, doctor `detail`, finish `blockers`/`warnings`…) are in the feature's language, as on MCP.
`cliText` only localizes the human-readable CLI output.

## The track model
`core` is always on. `+tdd`, `+saas`, `+ai`, `+sec`, `+privacy` (the last two since 1.14) are independent and
composable, chosen in Phase 0 by `spec_classify` (keyword heuristic with negation + confidence) and confirmed by the
human. The track set drives which artifacts/sections/loops apply. See `references/classification-matrix.md`
(GDPR / RGPD / LGPD / CCPA / HIPAA are +privacy signals, not +saas).
- **Tracks are data-driven registries — never a hard-coded `saas`/`ai` list.** `VALID_TRACKS` → `OPTIONAL_TRACKS`
  (everything but core: the classifier's, add_track's and every per-track loop's list); `TRACK_MARKER` (`[SaaS]` `[AI]`
  `[SEC]` `[PRIVACY]` → `MARKER_TRACKS`, the tracks with mandatory design sections); `TRACK_SECTIONS` (`SAAS_SECTIONS` /
  `AI_SECTIONS` / `SEC_SECTIONS` / `PRIVACY_SECTIONS` — the ONE table doctor `<track>-sections`, the design gate, status,
  the roadmap and the design-save hook read); `TRACK_STEERING` (the steering files a track brings). **Adding a track:**
  `VALID_TRACKS` + its `SIGNALS` (strong / weak / optional `context`, EN/PT/ES); a marker track also needs `TRACK_MARKER`,
  a sections table in `TRACK_SECTIONS` (EN/PT/ES synonyms), `TRACK_STEERING`, and its i18n builders (requirements
  criteria under `#### [Marker]`, the design block with the `> **TODO**` sentinel, template tasks, test rows, checklist
  items, steering stub) and its marker in `RE_STABLE_BRACKET`; the `RE_TRACK_RUN` / heading-lead regexes build themselves
  from the registries; update the MCP descriptions and CLI help by hand. `templateCorpus()` renders every set of at
  most two optional tracks plus all of them (quadratic beyond three tracks — verified equal to the full power set's
  placeholder reports). A TEAM's own track needs none of this: it is a track pack (see Project-defined tracks, 1.15).
- **Readers go through the accessors (1.15), never the constants.** The constants above are the BUILT-IN tables;
  `allTracks()` (VALID_TRACKS + the project's valid packs, in name order after the built-in ones), `optionalTracks()`,
  `markerTracks()`, `trackMarker(tr)`, `trackSectionTable(tr)`, `trackSteeringFiles(tr)`, `trackSignalTable(tr)` add the
  track packs of the project the current engine call works in. The regexes built from the registries have pack-aware
  twins (`trackRunRe()`, `headingLeadRe()` — cached per marker set; names / tokens are validated `[a-z0-9]` / `[A-Z0-9]`,
  regex-safe). Deliberately built-in only: `templateCorpus()` / `templateTaskSet()` (process-wide caches — the packs'
  blocks join the per-call corpus instead, `packCorpusSets()`) and the built-in rows of `spec_tracks list`. The exported
  `VALID_TRACKS` / `OPTIONAL_TRACKS` / `TRACK_MARKER` / `trackSections` / `trackSignals` stay built-in (the CLI's classify
  line reads the result's `confidence` keys instead).
- **SEC / PRIVACY section tables.** `SEC_SECTIONS` never lists a bare "security" synonym (the core design's own
  "Security Considerations" is not a `[SEC]` section). `PRIVACY_SECTIONS` entries may carry `loose: [...]` — the synonyms
  that are ordinary design words (Processors, Retention, Conservação, Data inventory, Avaliação de impacto…):
  `extractSection(md, syn, marker, loose)` accepts them only on a heading carrying `[PRIVACY]` or on an unmarked heading
  nested under one (`inTrackContext`) — a core `## Processors and queues` must never satisfy a deleted `[PRIVACY]`
  section. The strict synonyms keep the unmarked fallback anywhere (hand-written and marker-less PT/ES designs).
- **Markers are case-sensitive tokens** everywhere (`headingHasMarker`, `inactiveMarkerLines`, `trackAcIds`,
  `extractSection`, the brief): `### Timeout [sec]` is prose, never +sec. `RE_STABLE_BRACKET` lists `SEC` / `PRIVACY`.
- **Signal tiers** (`SIGNALS[track]`): `strong` (turns a track on alone), `weak` (score 1 — two weak ones, or a strong
  one, turn it on; a lone weak one is only "possible"), and `context` (corroborating-only, e.g. `permission` for +sec:
  weak evidence ONLY beside another non-negated signal of that track; alone it is no signal, no "possible" note, no
  "kept off" note — "file permission bits"). A keyword written with capitals (`STRIDE`) is an acronym matched
  case-sensitively on the original text; lower-case `stride` is no signal. A WEAK signal inside a longer STRONG signal of
  another track is shadowed (`model` in "threat model", `security` in "row-level security"). Generic privacy words
  (`consent`, `retention period` / `retention policy` and twins) are weak; encryption in transit and security testing
  are strong in EN/PT/ES alike — keep the three languages aligned when you add a signal. `keywordLiteral()` is a literal
  precheck (a keyword pluralize() leaves alone is its own whole literal) so a text without it never compiles its regex.
- **Tracks are persisted in `.state.json` `tracks`** (create / add_track / add_track --remove write them)
  and `detectTracks()` reads them first. Only features without a saved list (pre-1.13) fall back to
  their files, and there a `[SaaS]`/`[AI]` marker counts only on a real markdown heading (a Mermaid node
  `X[AI]` or prose used to switch +ai on). A saved name shaped like a pack's (`^[a-z][a-z0-9]{1,19}$`) the project lacks
  now is kept in the list and dropped from the active tracks (1.15 — `track-pack-missing`).
- **Track input goes through `parseTracks()`**: arrays or strings split on space/comma/`+`
  (`'tdd,saas'`, `'+saas +ai'`), case-insensitive; an unknown token is a localized error with a
  did-you-mean. That is why the MCP `tracks` schemas carry **no enum on purpose** — an enum would refuse
  `'tdd,saas'` before the engine could split it or suggest a fix.
- **Removal is non-destructive** (`spec_add_track {remove:true}` / `add-track --remove`): files stay, the
  result lists them as inactive, and doctor/status/next_action/roadmap stop requiring them (`activeTasks()`
  drops a removed track's task section). `core` can't be removed; a bugfix keeps +tdd.

## Languages (EN / PT-PT / PT-BR / ES) — the system both READS and WRITES them
**All localized content lives in `mcp/lib/i18n.js`** (artifact builders, steering stubs, tool
messages, CLI and hook output — one set per language). `spec.js` keeps the logic and delegates: each
template function is a one-line call into `i18n.<builder>(args, lang)`. EN is the canonical reference;
PT and ES mirror its structure (same sections, IDs, markers and slots). **pt-BR (1.14) is a DERIVED locale**
(`lang: "pt-BR"`; `pt_BR` / `pt-br` / `ptbr` fold to it via `canonicalLang()`, `pt` / `pt-PT` stay European): every
pt-BR string is `toPtBr(<the pt string>)` — protected tokens (code spans, `_Marker:_`s, paths, the caller's arguments),
then `PTBR_OVERRIDES`, the progressive (`está a correr` → `está rodando`), `PTBR_PHRASES`, the second person (`tens` →
`você tem`), clause-start imperatives (`corre` → `execute`) and `PTBR_WORDS` (vocabulary + spelling) — built lazily per
table group (`defineDerivedLocale`), so it inherits every key, ID, marker and synonym of the PT set and a PT edit
reaches pt-BR with nothing else to change. **When you add or edit a PT string, read its twin once**
(`node -e "console.log(require('./mcp/lib/i18n.js').toPtBr('…'))"`): a clause-start 3rd person read as an order goes
into `RE_PTBR_NOT_IMPERATIVE`, a missed word into `PTBR_WORDS` / `PTBR_PHRASES`, anything else into `PTBR_OVERRIDES`;
`mcp/test.js` (pD1) lints every pt-BR string (no European-only vocabulary, English-stable tokens byte-identical,
idempotent). Readers that match PT headings/keywords match pt-BR too (`baseLang()`); the classifier's language guess
counts Brazilian markers but still answers `pt`. Project templates for it live in `.specs/templates/pt-BR/`.
The EN templates are **not** frozen: 1.13 changed them on purpose (every template AC planned + tasked, track ACs under
`[SaaS]`/`[AI]` headings, the test plan's Kind column…). When you change a template, change EN / PT / ES together
(and pt-BR where it overrides that text) and keep the tests that round-trip a PT and an ES scaffold through doctor green.
- **Language resolution (single source of truth + per-feature override).** The PROJECT language lives
  in `.specs/roadmap.json` `meta.lang`, seeded by `spec_init {lang}` (read via `projectLang()`). Each
  FEATURE may override it; the resolved feature language is persisted in `.specs/<feature>/.state.json`
  `lang` (read via `featureLang()`). `spec_create {lang}` resolves `explicit > project default > en`,
  writes the state file, and generates every artifact in that language; every feature operation, the
  CLI and the hooks read `featureLang()` so messages match the spec.
- **English-STABLE tokens (the tooling matches them literally — never translate, in any language):**
  AC/SC/test IDs (`US-1.AC-1`, `SC-001`, `T-01`, `EC-1`, `NFR-1`), decision IDs `D-n`, section markers
  `[SaaS]`/`[AI]`/`[SEC]`/`[PRIVACY]` (case-sensitive), story/parallel tags `[US1]`/`[US2]`/`[shared]`/`[P]`, the
  unfilled sentinel `> **TODO**`, `[NEEDS CLARIFICATION]`, annotation tags `_Requirements:_`/`_Makes green:_`/
  `_Affects evals:_`/`_Emits metrics:_`/`_Implements:_`/`_Verify:_`/`_Expect:_`/`_Size:_`/`_Supersedes:_`, the
  decision-log markers `_Kind:_`/`_Date:_`/`_Affects:_` and the spike's `_Outcome:_` (values `go`/`no-go`/`pivot`),
  `**Checkpoint:**`, the test plan's Kind values `example`/`property`, the steering front-matter keys and values
  (`inclusion: always|fileMatch|manual`, `fileMatchPattern`), template variables `{{name}}`…`{{date}}`, evidence reason
  codes and every other stable code (check ids, `step`, forecast reasons, suite statuses), the
  ` ```mermaid `/` ```typescript ` fences, and the eval-harness headings `## System` / `## User Template`.
- **TRANSLATED, but matched by synonyms** so generated PT/ES specs still pass `doctor`/`clarify`: EARS
  keywords (QUANDO/CUANDO, O SISTEMA DEVE/EL SISTEMA DEBE, SE…ENTÃO/SI…ENTONCES — recognized by
  `earsValidate`), and section headings (matched by the `TRACK_SECTIONS` synonym tables, the
  `RE_*` matchers, and `RE_TESTABILITY` for the +tdd block). The decision log's Context / Decision / Discovery /
  Consequences labels (`DECISION_LABELS`) and spike.md's headings are read in any EN/PT/ES spelling. The Kind column
  header (Kind/Tipo) and the converge heading (`Phase: Convergence` / `Fase: Convergência` / `Fase: Convergencia`)
  are localized too.
  **When you add/rename a translated heading, add the matching synonym** or `doctor` will think the
  section is missing.
- **Terminology** mirrors the existing `ROADMAP_I18N` per language (PT keeps the "Feature/Tasks/Tracks"
  anglicisms; ES translates to Función/Tareas). Eval sample JSON (`golden.json`/`adversarial.json`) is
  data and stays as-is; its surrounding prose (README, prompt stub) is localized.
- **Adding a language:** a regional variant of an existing one derives from it, as pt-BR does from pt-PT (only the
  overrides). A new language adds a block to `BUILD`/`STEERING`/`MSG`/`EVALS_README` in `i18n.js`, adds it to `LANGS`,
  extends the classifier `SIGNALS`, `ROADMAP_I18N`, the `TRACK_SECTIONS` synonyms (all four tables), the stop gate's
  `stopGate.claims` / `negators` / `admissions`, the `RE_*` matchers and the `lang` enums of the MCP schemas, then adds
  a test asserting a localized scaffold round-trips.

## MCP tools (in `mcp/lib/spec.js`, dispatched by `mcp/server.js`)
`spec_init` · `spec_classify` · `spec_create` · `spec_list` · `spec_status` · `spec_next_task` ·
`spec_complete_task` · `ears_validate` · `trace_check` · `spec_doctor` · `spec_approve` ·
`steering_scaffold` · `spec_roadmap` · `spec_backlog` · `spec_depend` · `spec_scan` ·
`spec_coverage` · `spec_clarify` · `spec_next_action` · `spec_add_track` · `spec_feature` ·
`spec_task_brief` · `spec_finish` · `spec_import` · `spec_append_tasks` · `spec_impact` ·
`spec_metrics` · `spec_catalog` · `spec_drift` · `spec_upgrade` · `spec_templates` · `spec_export` ·
`spec_changelog` · `spec_decide` · `spec_tracks` · `spec_stop_check` · `spec_log` · `spec_milestone` (**38 total**; `mcp/test.js` asserts the exact count —
verify with an `initialize` + `tools/list` handshake against `mcp/server.js`). All tools are pure-local file ops on
`.specs/` (or a read-only codebase scan for brownfield / `trace --code` / import); none hit the network, run a command or
call git. Scaffolders never overwrite an existing file; mutators edit only what they own (checkboxes, appended tasks and
track sections, appended `decisions.md` entries, `.state.json` / `roadmap.json`, generated `ROADMAP.*` / `SPECS.md` /
`UPGRADE.md` / `RELEASE-NOTES.md` / `.specs/exports/*`, templates `init` copies) and never rewrite spec prose. The
observed-run log (`.execution/observed.jsonl`, F1) is written only by `hooks/observe-hook.js` through `observeRun()` —
no tool writes it, and no tool accepts an `observed` stamp from its caller.
Roadmap/deps persist in `.specs/roadmap.json`; cross-feature deps are cycle-checked and must name existing features.

**Capabilities (1.14 — no longer tools-only).** `initialize` advertises `tools {listChanged: false}`, `prompts
{listChanged: false}`, `resources {listChanged: false, subscribe: false}` and (1.16) `completions {}`; the logic lives in
`mcp/lib/prompts-resources.js`, server.js only maps it onto JSON-RPC. `SPEC_MCP_PROMPTS=off|0|false|no` drops the
prompts capability (and `prompts/*` answers -32601): `mcp/servers.json` sets it for the Claude Code plugin, whose own
slash commands are the same files — without it Claude Code lists every command twice (`/mcp__…__spec-impact`).
- **Prompts** = `commands/*.md`, read at runtime (never a hardcoded list — a new command is a new prompt): name = file
  name without `.md`, description = front-matter `description`, one optional `args` argument described from
  `argument-hint` (front matter parsed by hand: BOM/CRLF, quoted values, block scalars). `prompts/get` renders the body
  with `$ARGUMENTS` ← args (split/join — `$&` stays literal) and `${CLAUDE_PLUGIN_ROOT}` resolved to this clone, after a
  one-line localized preamble for agents without the skill (follow AGENTS.md; where references/ lives). CLI parity:
  `dev-spec prompts [name] [--args "…"]`.
- **Resources**: `specs://roadmap` (ROADMAP.md, else rendered in memory from roadmap.json), `specs://catalog`
  (SPECS.md), `specs://steering/<file>`, `specs://feature/<slug>/<artifact>` for the allowlisted artifacts of each
  ACTIVE feature (classification, requirements, design, test-plan, eval-plan, load-test, tasks, bug, quickstart,
  checklist, integration-plan, retro, spike, decisions — `RESOURCE_ARTIFACTS`: add a new artifact there);
  `resources/templates/list` gives the two templates. The list is capped (`RESOURCE_CAP` = 500,
  `_meta {truncated, total, cap, note}`). `resources/read` parses the URI segment by segment (percent-decoded; `..`, separators, `:` and control characters refused — never a URL
  parser, which would resolve `feature/../x`), resolves features through `resolveFeature`/`existingFeature`, reads
  allowlisted names only and never follows a symlink/junction out of `.specs/` (lstat + realpath).
- **Error codes**: an unknown prompt or bad prompt arguments, and an invalid / refused URI → `-32602` (Invalid params);
  a well-formed URI naming nothing → `-32002` (Resource not found); a `resources/read` error carries `data.uri`
  (JSON-RPC `error()` takes an optional `data`). Prompts and resources use the default project (SPEC_PROJECT_DIR /
  CLAUDE_PROJECT_DIR / cwd) — neither request carries a projectDir — and speak its language.

**Argument validation (server.js).** Before dispatch, `tools/call` arguments are checked against the
tool's advertised `inputSchema`: required keys (`missingArgs`), then types (`invalidArgs` — `integer` means
a *safe* integer, so `1.9` / `1e21` never become task 1), `enum`, `minimum`, array `items` and nested
object properties. It iterates the SCHEMA's keys, never the caller's (`__proto__` arguments are ignored);
an absent or `null` value means "not given". `arguments` that isn't an object, a relative `..` in
`projectDir`, or a network `projectDir` (`isNetworkPath`: UNC `\\host\share`, `//host/share`, `\\?\UNC\…`,
`\\.\UNC\…` and other device paths — refused before ANY fs call, argument errors included, so a tool call can't make
the server open an SMB connection to a host it names or hang on an unreachable one; `\\?\C:\…` and WSL's `\\wsl$` /
`\\wsl.localhost` are local) is refused. The default projectDir (cwd / env) and the CLI are not restricted.
Messages are localized in the project language (`msg(lang).args`). The engine
still validates what schemas can't express (track names, AC IDs, paths). String enums the engine case-folds
(`phase`, `lang`, `kind`, `action`) are trimmed + lowercased first (`foldEnumArgs`) — the CLI passes `Design` / `PT`
straight to the engine and the 1.12 MCP accepted them; `spec_import`'s `tool` stays exact on both surfaces
(`EXACT_ENUMS`). The engine and the CLI fold `backlog`'s action too (`ADD` adds on every surface).
A schema `type` is always ONE string, never a list (`["string", "boolean"]` — not every MCP client handles list-valued
types): `spec_init`'s `guard` is a plain string enum `on | off | scope`, and `foldEnumArgs` turns a boolean into
`"on"` / `"off"` for any string enum holding both (the pre-1.14 `guard: true` keeps working).

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

## Subagent-driven execution (Phase 6, opt-in — v1.11)
`spec_task_brief` (engine) builds a self-contained brief per task: task block (via `taskBlocks()`, which
keeps sub-lines, phase heading and closing `**Checkpoint:**`), AC IDs resolved to their full EARS text
(`acIndex()` over `criterionBlocks()`, exact-ID keys so AC-1 never hits AC-10), T-IDs resolved to their
test-plan row (keyed by the FIRST table cell), design sections that mention the task (bounded by
`BRIEF_DESIGN_BUDGET`), the task's `_Verify:_`, Global Constraints, the steering it needs (see Scoped
steering), for a bugfix bug.md's Reproduction + Root Cause (and `gated`/`gateError` when the bugfix gate
would refuse the task), and the loop's definition of done. Labels/rules live in `i18n.js` `BRIEF` +
`renderBrief()`. `write:true` writes `.specs/<f>/.execution/` — a self-ignoring folder (`.gitignore` = `*`),
the brief is regenerated, `ledger.md` is created once and only ever appended by the controller; its result
keeps paths + identifiers (`refs`, `loop`, `inlineOnly`, `verify`, gate) and drops the spec text the brief
quotes unless `includeBrief`. The PostToolUse hook exits early for `/.execution/` paths. The protocol is prose in
`references/subagent-execution.md` + `agents/spec-implementer.md` / `agents/spec-reviewer.md`; the engine
never dispatches anything (keeps it cross-tool). Adapted from obra/superpowers (MIT). 1.14 adds to the brief:
`verifyPipes` (the `_Verify:_` commands that pipe), `expect: "fail"` for an `_Expect: fail_` task, `projectChecks`
(meta.checks, in the definition of done), `decisions` (the current decisions.md entries citing the task's ACs / T-IDs,
bounded: 5 entries / 2000 characters) and, for a task proving a `[SEC]` / `[PRIVACY]` criterion, that track's design
sections. An `_Expect: fail_` task's brief is a RED task's: its own tests heading (`BRIEF.testsRed` — the tests it writes
must fail first) and definition of done (`redRules` in place of the loop's green-making rules; the project-checks item is
`projectChecks.briefDodRed` — only the task's new red tests may fail). 1.14 F3: the default task is `taskSchedule()`'s
next (its `_Depends:_` all done), and the brief carries `dependsOn` [{number, status}] (see Task dependencies).

## Gates (1.13) — an approval is a gate, not a stamp
- **Placeholders — a lookup, never a guess from the shape.** `placeholderReport()` reports a bracket only when
  its normalized text (`placeholderKey()`: case, spacing and `…`/`...` ignored) is one a scaffold actually writes —
  `templateSets()`, built lazily once per process from `templateCorpus()` (every i18n builder, EN/PT/ES, every track
  combination and kind, the track/import task slots `acPlaceholder` / `taskAcPlaceholder`, the steering and custom
  stubs, init's `[fill me in]`) **plus** `LEGACY_TEMPLATE_PLACEHOLDERS` (the 1.12.1 templates' bracket texts, a static
  list extracted once from `main:mcp/lib/i18n.js` — a 1.12 spec still holds them) **plus** `isGenericSlot()` (TODO
  upper-case only — "todo" is a PT/ES word —, TBD, TBC, FIXME, `...`, `…`, a/por definir) **plus** the project's own
  templates' slots (1.14 — see Project templates) — and the `> **TODO**`
  sentinel. Everything else in brackets is the user's content: `[free: 60, pro: 600]`, `[admin, billing-manager, read
  only]`, `[10 MB, 25 MB for pro]` (1.13's shape heuristics refused those and blocked upgraded, finished 1.12 specs).
  `scanBrackets()` walks outermost first and descends into a non-placeholder group, so a half-edited template sentence
  still reports the `[N]` left inside it. Syntax is skipped whole (links, reference links, footnotes, callouts, wiki
  links, glued indexing `x[0]`, checkboxes) and so are stable tags/IDs, `[NEEDS CLARIFICATION]` and the legacy
  `[none beyond core]`; code spans are opaque except a template's own code-span slot (`` `[path]` ``, `templateSets().code`);
  comments and fences are skipped. **When you add or reword a template bracket, nothing else is needed** (the corpus
  renders it); a NEW builder or artifact-writing message must be added to `templateCorpus()` — the test "every fresh
  scaffold artifact reads 'placeholder'" catches a miss. `artifactState()` = missing / placeholder / filled.
  **bug.md is evidence** (`bugPlaceholders()`, used by `artifactReport` and `bugSectionFilled()`): its Reproduction /
  Root Cause quote `[object Object]`, `[WARN]`, `[A-Z]`, `[Error: …]` — a template text there counts only when it IS one
  of the bug report's own slots (`bugTemplateSlots()`) or its section holds no prose outside brackets
  (`hasProseOutsideBrackets()` — also required by `bugSectionFilled()`: a root cause written as nothing but
  `[the cause, with evidence]` is not written). Every regex here must stay linear: `RE_STABLE_BRACKET`'s list
  separator is `\s*(?:[,;/]\s*)?` — the old `\s*[,;/]?\s*` backtracked 2^k on a failing ID list.
  `detectPhase()`: `complete` / `executing` once tasks are ticked, `tasks-ready` once a real (non-placeholder)
  task exists; otherwise the earliest still-template chain artifact — so a fresh scaffold is phase `requirements`.
  Doctor's `placeholders` check fails for the current and earlier phases, warns for later ones;
  `ears_validate` reports code `placeholder`; the requirements.md hook never says "all clean" while any remain.
  Doctor's `traceability` follows the same split: the gap kinds that read a LATER phase's still-template
  tasks.md / test-plan.md (`TRACE_TASK_KINDS` / `TRACE_PLAN_KINDS`) are deferred — a warn, "not traced yet" — so the
  template's `_Requirements: US-1.AC-3…_` rows are no "typos?" at the requirements / design gate. Only
  `TRACE_VERDICT_KINDS` fail (testsNotMappedToTasks is listed, never failing — trace_check's verdict rule).
- **Approve gate.** `approvePhase()` runs `approvalChecks()` for that phase and refuses (`refused`, `failing`,
  `checks`) while any fails. `force:true` (CLI `--force`) records it anyway with `forced: true` + the failing
  ids — doctor's `approval-gates` and the roadmap keep flagging it; a clean re-approval replaces it. A phase
  with no artifact (eval-plan without +ai, test-plan without +tdd, `tests` on a core-only feature, a missing file) is an
  error even with force. `tests` and `execution` have checks too (see Pending gates below). **Phase order:** approving a
  phase while an EARLIER one is in `pendingGateList()` (doctor's pending gates — only phases with an artifact, so a
  missing file never blocks forever) adds the failing check `phase-order` (`gates.phaseOrder`, EN/PT/ES) — refused
  unless force (recorded as forced with it). Not for `execution`: its gate (finish's blockers) already names them.
- **next_action step order — phase by phase:** `re-review` (an artifact changed since ITS approval and re-approvable
  now — one of a phase after the first pending gate waits for it, approve would refuse it on `phase-order`; `impact`
  when a snapshot exists; when that phase's gate would refuse it, `refusedGate` {phase, failing} and the check ids are
  named — never an approval that would be refused) → the FIRST phase of `gateWalk()` not approved yet (PHASES order, `execution` apart; `tests` only
  when `testsGateDue()`; classification only when classification.md exists): `fill` (one of its `gateArtifacts()` is
  missing / a template; `file`) → `fix` (its `approvalChecks()` fail — `refusedGate`, so it never recommends an
  approval that would be refused) → `approve`; the next phase only after that approval (1.13 filled the whole chain
  first and asked for the approvals at the end — "fill design.md" while the requirements were unapproved) → `fix`
  (every phase approved, but doctor fails for the current or an earlier phase via `CHECK_PHASE` — a forced approval)
  → `implement` →
  `verify` (all ticked, but `verificationStatus()` lists an unverified task — spec_finish and the execution gate refuse
  it; it looped "close the feature" / "finished — nothing left" → refused → the same) → `finish` (or `tasks` when
  there are none). Doctor surfaces the same gate as `nextGate`. Once `state.finished`
  exists (finish `{write}` recorded it), `finish` becomes `finished` (asks for the `execution` sign-off while it is
  missing — with execution roles configured it names the missing ones, `missingRoles`, `--role <next>`; project checks
  without a passing run turn it into `verify` with `suite` [{name, status}] and `finish --run`) or `drift` (`baselineDrift()` of the recorded files; `drift` {finishedAt, files, changed, missing,
  nowPresent, drifted}) — it looped on "close the feature with /spec-finish" and a re-finish replaced a drifted
  baseline silently; `recordFinishBaseline()` now returns `replaced` for the drift it accepts. A baseline is STALE
  (`staleFinish()`) once a change request or a re-approval of another phase is newer than `finished.at`, or an active
  task's `_Implements:_` file isn't in it: then the step stays `finish` (re-run spec_finish `{write}`) with
  `staleBaseline` {finishedAt, since, newFiles} — it said "finished — nothing left to do" on the old baseline — and an
  execution sign-off older than such a change is asked for again (`executionSignOffStale()`). The recorded files are
  hashed even then: a stale baseline with drift answers `drift` (+ `staleBaseline`, `nx.driftedStale`) — the decision
  before any re-baseline.
- **finish blockers:** doctor fails, changed since approval (shared `changedSinceApproval()`), placeholders
  anywhere in the chain, bugfix Root Cause, no tasks, open tasks, unverified tasks, pending gates (a phase still
  missing a role's sign-off is pending), and — with `meta.checks` set (1.14) — `suite-evidence`.
  `warnings` (EC/NFR/SC, planned-not-in-code, legacy approvals missing a role, a T-ID planned outside test code whose
  artifact is still the scaffold — `outside-code-artifacts`) never block.
- **Bugfix execution gate (`bugfixGate()`):** while bug.md → Root Cause is unfilled, no task after the one
  that writes it (names bug.md + a Root Cause synonym, carries no `_Makes green:_`/`_Verify:_`) can be ticked
  or given evidence; `done --run` refuses before running anything. The root-cause task itself can be ticked
  (`rootCauseTaskIndex()`), but then returns `rootCausePending: true` + a note; once it is ticked the refusal of a
  later task is `bugGateTicked` ("the section is still empty"), never "do task N first".

## Evidence (v1.12, gate tightened in 1.13)
- **`_Verify: <command>_`** is an English-stable task marker; `taskMarkers()` keeps its value whole (commas
  belong to the command), drops wrapping backticks and ignores a `[placeholder]`. ONE reader, `taskMarkerSpans()`, serves
  every task marker (taskMarkers, trace_check, implementsRefs, `_Size:_`, the templates check): a value ends at the
  closing `_` — or `*`: `*Verify: …*` is the same marker — followed by whitespace, the end of the line, or closing
  punctuation (`.,;:!?)]`) then whitespace / end, so `(_Verify: npm test_)` and `_Implements: a.ts_;` are markers (they
  were silently dropped: nothing to verify, a verified tick) — but a plain closer (followed by whitespace / the end) before
  the next marker opener, else the end of the line, wins over a punctuation one: `_Verify: python -c "import a_; print(1)"_`
  keeps its whole command. Doctor warns `malformed-markers` for text on a task line that
  looks like a marker but yields none (`**Verify:**`, a bare `Verify:`). The MCP server never
  executes commands — the agent runs them and reports; only the CLI's explicit `done --run` executes a task's
  `_Verify:_` (the user's own tasks.md; `--shell bash|<path>` or `DEV_SPEC_SHELL`). The shell is `resolveRunShell()`'s
  (engine, pure — the CLI passes `git --exec-path`'s output): the platform default (cmd.exe / `/bin/sh`) or the one
  named; on Windows a bare `bash` (flag or env) is Git Bash — `<git --exec-path>/../../../bin/bash.exe` (then
  `…/usr/bin/bash.exe`), `%ProgramFiles%` / `%ProgramW6432%` / `%ProgramFiles(x86)%` / `%LOCALAPPDATA%\Programs` +
  `\Git\bin\bash.exe`, then the first bash.exe on PATH that isn't WSL's. WSL's launcher (`isWslLauncher()`: a bash.exe /
  wsl.exe in System32, SysWOW64, Sysnative or WindowsApps — it runs the command inside a Linux distribution, or fails every
  command with exit 1) is never what a bare `bash` resolves to (none found → `no-git-bash`); named by its path (`--shell
  C:\Windows\System32\bash.exe`) it is the user's choice (1.15 — 1.14 refused it as `wsl-bash`): used as given, flagged `wsl`,
  with a one-line note (`runGate.wslBash`), and a run WSL's relay fails is could-not-run `wsl` (nothing recorded).
  `wsl.exe` (named or bare) is no shell — Node runs `<shell> -c "<cmd>"` and wsl.exe rejects `-c` (exit 4294967295: a
  bogus failed run or red proof) — refused before anything runs (`couldNotRun: "wsl-exe"`, `runGate.wslExe`); a quoted
  path loses its quotes (spawn would miss the file).
  On Windows with the default
  shell (cmd.exe) a command in POSIX syntax (`posixShellSyntax()`: a single-quoted string outside double quotes, `$VAR` /
  `${…}` / `$(…)`) is refused before anything runs — cmd.exe has no single quotes, so `node -e 'process.exit(1)'` exits 0
  and was recorded as a passing run. `--shell bash` runs it; `--shell cmd` runs it under cmd.exe anyway. After a failed
  run the `taskDone.shellHint` (retry with `--shell bash`) is printed only when `windowsShellFailure(output, code)` says
  cmd.exe itself failed (exit 9009, "is not recognized as an internal or external command", its syntax errors, "cannot
  find the path specified" — EN/PT/ES wording) — never for a check that ran and failed.
- **A run that could not happen is never evidence** (CLI `b5Exec()`, `done --run` and `finish --run`): it is refused with
  `{ok: false, couldNotRun}` + a localized `runGate` message and NOTHING is recorded (it used to be recorded as exit 1 —
  a passing check stored as failed, a red run that never happened). Stable `couldNotRun` codes: `shell-not-started` (spawn
  error ENOENT / EACCES / ENOEXEC / EPERM / EISDIR / ENOTDIR / UNKNOWN) · `run-error` (any other spawn error) · `signal` (no
  exit status — killed; a CRASH of the check itself, SIGSEGV / SIGABRT / SIGBUS / SIGFPE / SIGILL, is a failed run with exit
  128 + the signal number instead, and on an `_Expect: fail_` task no red test) · `output-too-large` (over the 64 MB buffer) · `timeout` (`--timeout <seconds>`, an integer ≥ 1 validated
  before anything runs) · `wsl` (a non-zero run whose output is WSL's relay — `couldNotRunOutput()` kind `wsl`) — plus, on
  an `_Expect: fail_` task only, `cmd` (cmd.exe itself failed the line, `windowsShellFailure()`, any exit but 9009 —
  whenever cmd.exe is the shell: the default or `--shell cmd`) and `output` (the output shows the test never ran — see
  `_Expect: fail_` below); the shell resolution adds `no-git-bash`. `finish --run` stays all-or-nothing: one
  check that could not run records none.
- **Red-phase tasks** (`redPhaseTask()`: "watch it fail", "failing test", "fails for the right reason", PT/ES
  equivalents — `RE_RED_PHASE_TASK`, markers excluded) can never pass a must-pass `_Verify:_`. `redPhaseHint()` appends
  `evidenceGate.redPhaseVerify` (1.14: mark it `_Expect: fail_`, or move the command to the fix task) to the
  failed-run refusal, the failed-run / note-only / no-evidence note and next_action's `verify` step, with the stable
  field `redPhaseVerify: true` — never for a task that already carries `_Expect: fail_`. The bugfix template scaffolds
  task 3 with `_Verify: [command that runs T-01]_` + `_Expect: fail_` (its red run is the proof) and keeps guard test T-02
  out of every `_Makes green:_` (green before and after the fix — doctor's `red-green` asks no red run for it) (EN/PT/ES).
- **The gate (`evidenceIssue()`):** a task whose `_Verify:_` is runnable is verified ONLY by
  `{command, exitCode: 0}`; a note ticks it but leaves it unverified. `{exitCode}` alone and a command
  without its exit code are rejected; "exit 0" without a command is kept as a note. A non-zero run refuses
  the tick and is recorded — a failed re-check of a ticked task makes it unverified until a later pass.
- **Reason codes** (stable): `no-evidence` · `failed-run` · `manual-note-on-runnable-verify` ·
  `duplicate-number` · `stale-evidence` · `unexpected-pass` (1.14, `_Expect: fail_`) · `unobserved` (1.14 F1, only
  with `meta.evidence: "observed"` — see Harness-observed evidence). They are RETURNED in
  `spec_complete_task`'s `unverifiedReason` (set
  exactly when `verified` is false) and in `spec_impact`'s per-task `evidence` (`impacted[].tasks[]`,
  `affectedTasks[]`: a code, or `verified`) — both public surfaces; callers branch on these, never on the
  localized note. Internally `verificationStatus().unverifiedDetail` holds them; doctor and `spec_finish` render
  it through `unverifiedLabel()` (localized labels, none for `no-evidence`), and so does the ROADMAP.md/.html
  "needs attention" line (`roadmapData()` keeps each row's `unverifiedDetail`; the labels follow the roadmap
  chrome language): `2 task(s) ticked without verification evidence: #1 (latest run failed), #3`.
- **One verdict: `taskVerification()`** → `{reason, nothingToVerify}` is the ONLY rule behind every `verified`
  (`spec_complete_task`, `spec_status` tasks, `spec_impact` tasks) and every unverified list (doctor, finish,
  ROADMAP.md). A task with no runnable `_Verify:_` and nothing recorded for it (or a record that proves nothing) is
  verified, with `nothingToVerify: true` so no surface calls it a check (`done` prints no "(verified)", impact says
  "nothing to verify"); `no-evidence` is only ever a runnable `_Verify:_` without a run. Never compute a second
  opinion from `taskEvidenceIssue()` directly — `spec_complete_task` used to answer `verified: false` with no reason
  for such a task while doctor, finish and the roadmap passed it.
- **Record shape** (`.state.json → evidence[<n>]`): the latest run `{command, exitCode, summary, at}` plus
  `history` (last `EVIDENCE_HISTORY` = 5 runs, for pass-rate metrics), stamps `task` (text) and `verify`
  (the command) — an edited `_Verify:_` makes the old run `stale-evidence`; a record made while the number
  was duplicated carries `shared` and only counts for its own task; other tasks' records under that number
  are kept in `others`. A note after a run is attached as `note`, never overwrites it (a v1.12 bare
  `{exitCode: 0}` is a claim, not a run: a note replaces it as the summary). `stale: true` is set by
  `spec_impact --reopen`; only a new run (or, without a runnable `_Verify:_`, a new note) clears it. 1.14 F1: every run
  (the latest and each `history` entry) carries `observed: true | false | "cli"` (`runOf()` keeps it; older records have
  none).
- **Without a runnable `_Verify:_`** a task is outside the run gate: no record passes, a bare legacy
  `{exitCode: 0}` or a summary verifies, and `verificationStatus()` skips a `no-evidence` record there —
  only `failed-run` / `stale-evidence` / `duplicate-number` count against it.
- **Fenced code under a task is the brief's, never the task's.** `scanTaskBlocks()` keeps fenced lines in
  `body` (the brief shows them) and flags their indices in `bodyCode`; `taskProse()` (text + non-code body)
  is what `taskMarkers()`, the bugfix gate and the secondary trace read, and `tasksProseText()` (the
  scanner's comment/fence-free view) is what `trace_check` and `implementsRefs()` read — so a fenced
  `_Verify:_` example is never run by `done --run`. `spec_task_brief` reads its AC / T-IDs (loop, stories, design
  needles) from `taskProse()` too; only the rendered task block shows the whole body.
- `verificationStatus()` feeds doctor (`verification`), `ROADMAP.md` attention and `spec_finish` blockers.

**1.14 additions** (engine: the `B5` block of spec.js; the engine still never runs a command or git):
- **`_Expect: fail_`** — an English-stable marker, value kept whole like `_Verify:_`; only `fail` (any case, backticks
  dropped) sets it (`expectsFail()`). On such a task a RED run `{command, exitCode ≠ 0}` is the proof: stored with
  `expected: "fail"`, it ticks and verifies (`redRecorded: true`). A pass with no red run of the SAME `_Verify:_` on
  record is refused and recorded (`unexpectedPass: true`, reason `unexpected-pass`; a ticked task becomes unverified);
  a pass after a red run is the fix going green — the red run is kept as `red` and stays the proof (`redProof()`; a
  `stale` record proves nothing). Exit 126 / 127 / 9009 (`CANT_RUN_EXIT`: not executable, not found, cmd.exe "not
  recognized") is never a red test — refused and recorded like a failed (re-)check (`recorded: true`; a ticked task turns
  unverified, while a red run already on record is kept, so the pass after the fix still counts as green) — `couldNotRun:
  "exit-code"`. Nor is a failing run whose output shows the test never ran: `couldNotRunOutput()` (`CANT_RUN_OUTPUT`,
  literal runner phrases, linear, NULs dropped — kind `test`: node's "Could not find '…'", "Cannot find module",
  ERR_MODULE_NOT_FOUND, python "can't open file" / ModuleNotFoundError, pytest "file or directory not found" / "no tests
  ran", jest "No tests found", vitest / mocha "No test files found", npm "Missing script" / ENOENT, make "No rule to make
  target"; kinds `wsl` / `spawn`: WSL's relay, a Node spawn error; the `test` kind never applies to output that shows an
  assertion failed — `RE_ASSERTION_RAN`: "not ok N", AssertionError, pytest "E   assert", expect(…), "Expected:" — a red run
  whose message quotes "Cannot find module" is still red) — `spec_complete_task` refuses and records a run whose
  `summary` shows it (`couldNotRun: "output"`), `done --run` refuses it with nothing recorded, and `cantRunRecord()` keeps
  an older record of either kind from being a red proof (`isRedRun()`). On an `_Expect: fail_` task under `done --run`, a
  line cmd.exe itself could not run (`windowsShellFailure()`, any exit but 9009) is refused with nothing recorded whenever
  cmd.exe is the shell (`--shell cmd` too). Every result for
  such a task carries `expected: "fail"`. Doctor `red-green` (warn, +tdd): T-IDs DONE tasks make green with no recorded
  red run of an `_Expect: fail_` task citing them. Metrics count a red run as a pass and an unexpected pass as a failure.
- **Project checks** — `roadmap.json → meta.checks` `{name: command}` (`spec_init {checks}` / `init --check name="cmd"`,
  repeatable, `name=` or an empty command removes one; names `^[A-Za-z0-9][A-Za-z0-9._:-]{0,39}$`, never a prototype key,
  ≤ 20 checks, a command one line ≤ 500 chars — validated before any write, under the roadmap lock; spec_init's result
  always reports them). Briefs list them (`projectChecks`). `spec_finish {evidence: [{name, command, exitCode,
  summary}]}` records runs in `.state.json → finishChecks[name]` (all-or-nothing, under the feature lock, BEFORE
  readiness is computed; stamped `check` = the configured command, so an edited command reads `changed`, and `code` =
  `suiteCodeStamp()` — one sha1 over the feature's ACTIVE tasks' `_Implements:_` set as the finish baseline records it
  (`baselineFiles()` + each file's `fileHash()`), no stamp when that walk hit its cap; a failed run is recorded too).
  `completeTask` stamps `lastTickAt`; `lastTaskActivity()` = the latest of it and every recorded task run, a stamp more
  than 5 minutes in the future ignored (as `stopActivity()`). `suiteStatus(projectDir, state, dir)` (dir: the feature
  folder the stamp is compared with) → blocker `suite-evidence` (finish + the execution gate), doctor warn `suite-evidence`
  (once every task is done) and the stop gate: a check without a passing run since the last task activity on the code as
  it is now. `suiteChecks` status codes (stable): `pass` · `no-run` · `failed` · `changed` · `before-last-tick` ·
  `code-changed` (a passing run whose `code` stamp no longer matches — code edited after the checks ran; an unstamped run
  keeps the older rules) · `unobserved` (1.14 F1, only with `meta.evidence: "observed"`: a passing run whose `observed` is
  neither `true` nor `"cli"`; each item also carries the run's `observed`). next_action's `finish` / `drift` steps name `dev-spec finish <f> --run` / `spec_finish
  {evidence}` while a check is missing (`projectChecks.naFinish`). Without meta.checks nothing changes. CLI `finish <f>
  --run` executes them (explicit flag only; `--shell` / `DEV_SPEC_SHELL`, `--timeout`, the POSIX refusal under cmd.exe,
  the pipe hint, a check that could not run records nothing). The merge summary labels an `_Expect: fail_` task's red run
  as the expected one (`redGreen.prRed`) and a pass after it with the red run it keeps (`prRedKept`).
- **Git-linked evidence** (CLI only, read-only git): `done --run` / `finish --run` record `{commit, dirty}` (`dirty`
  ignores `.specs/`; silently skipped without git; a malformed value is dropped, never an error — `gitEvidence()`); the
  merge summary tags a run `@sha` / `@sha-dirty`. `parseGitLog()` + `taskCommits()` work on git log TEXT (so the MCP
  server stays exec-free); `dev-spec log <feature> [--max N] [-]` feeds them `git log` (or stdin). Conventions (what
  /spec-commit writes): a message cites task N when it names the feature (its slug as a word — `.specs/<slug>/`,
  `feat(<slug>):`) AND "task #N" / "task N" / "#N" (PT "tarefa N", ES "tarea N"); it cites every task whose text / markers
  name one of its T-IDs (`T-01` = `T-1`) or AC IDs — unless the message names another feature and not this one. +tdd
  red-first: a task with `_Makes green: T-xx_` whose first citing commit is older than the first commit touching a test
  file naming T-xx gets a warning; a full `--max` window makes an unknowable order `outside-window`.
- **Pipes** — `verifyPipeMasked()` runs over a small shell lexer: an unquoted single `|` (also `|&`, inside a subshell,
  and inside `bash -c` / `sh -c` / `pwsh -Command` / `cmd /c` scripts) is flagged; never `||`, a quoted `'|'` / `"|"`,
  `\|` / `^|`, `>|`, a pipe inside `$(…)` or backticks, and only `set -o pipefail` run BEFORE the pipe (or a shell's
  `-o pipefail`) silences it; a Windows path ending in `\` before its closing quote doesn't hide a pipe. Surfaces: the
  brief's `verifyPipes` + a note, `done --run`'s hint line (stderr under `--json`; it still runs), doctor `verify-pipes`
  (warn), and `spec_complete_task`'s `pipeMasked: true` + note on a passing piped run — the verification rules are
  unchanged.

## Task dependencies and execution waves (1.14 F3)
- **`_Depends: 3, 5_`** — an English-stable task marker (the task line or a sub-line, never fenced code — `taskMarkers()`
  reads it like every marker: `taskMarkers(b).depends`). Tokens split on commas, semicolons or spaces; `#3` = `3`; a value
  wholly in `[brackets]` is a template slot (nothing declared). `taskDependsSpec(block)` → `{declared, numbers (unique, as
  written), invalid (tokens that are no task number)}` — with a fast path: no "depends" on the task's lines, nothing parsed.
  The numbers name tasks of the SAME tasks.md. Every reader works on ONE view, the ACTIVE tasks (`activeTasks()`), with
  resolveTask's duplicate rule: a dependency on n is done once EVERY task numbered n is done; a number no active task
  carries never is. **A tasks.md without `_Depends:_` behaves exactly as before** (same next task, no new fields).
- **`taskSchedule(blocks)` is THE next-task rule** → `{next, skipped, blocked, graph}`: the first open task in tasks order
  (parseTasks' — by number, stable; only the task resolveTask answers for its number is a candidate) whose dependencies are
  all done. `skipped` `[{number, waitsOn}]` = open tasks passed over because they wait; `blocked` `[{number, waitsOn}]` =
  open tasks that can never start as things stand (Kahn's walk, `stuckTasks()`: a cycle, a dependency no task carries, or
  waiting on such a task — only computed when some task declares `_Depends:_`; a task without one is never blocked).
  Consumers: `spec_next_task` / `next`, next_action's implement step (open tasks, none startable → step `fix` with
  `blocked` and `taskDepsBlockedNote()` — never "finish"), `spec_task_brief`'s default task (none startable → `task: null`
  + `blocked`/`skipped` + the note, never "all done"), `next --batch` (`parallelBatch()`: a [P] task waiting on an open
  dependency — one in the batch included — ends the batch), `spec_status`'s `next`, the roadmap's next task (open tasks none of which can start → the feature reads `blocked` in
  ROADMAP.md / .html, never "ready", with a `taskDeps.roadmapBlocked` attention line), complete_task's
  `next` (+ `blocked` and the note when none can start), the spike's investigate step and the scope guard's likely task.
  **Never compute "next" with `find(!done)`** again.
- **`taskWaves(blocks, tracks)`** (`spec_next_task {waves: true}` / `next --waves`) → `{waves: [[numbers…]…], cycles,
  blocked}` over the open tasks. A task WITH `_Depends:_` waits for exactly those tasks (an explicit list replaces the
  implicit order); a task WITHOUT one keeps tasks.md order among the undeclared tasks — it waits for the open ones before
  it, and a run of consecutive `[P]` tasks of one section (phase + checkpoint) waits together (join node) and is waited
  for as a whole. A wave is filled greedily in tasks order with the batch's limits: never two tasks sharing an
  `_Implements:_` file (`implementsKey`; a folder overlaps its files), and a task with no `_Implements:_` (its files can't
  be proven disjoint) or an +ai prompt task (`isPromptTask`, inline only) is a wave of its own. `cycles` =
  `dependencyCycles(g, true)` (iterative Tarjan over the OPEN tasks). Only a task's own `_Depends:_` can take it ahead of
  an earlier section's checkpoint — the controller still stops at each checkpoint (`references/subagent-execution.md`). All
  walks are linear and iterative (no recursion on a long chain).
- **complete_task never refuses on dependencies** (a tick records what happened): ticking a task whose `_Depends:_` are
  open (`openDependenciesOf()`) returns `waitsOn` [numbers] + `taskDeps.tickedEarly`. The bugfix gate keeps its
  precedence (the only refusal).
- **Doctor `task-deps`** (fail, `CHECK_PHASE` 5 = the tasks phase; in the feature doctor and `spikeDoctor`) — only when
  some active task declares `_Depends:_` (`taskDepsCheck()` → null otherwise): an invalid token, a number no active task
  carries, a self-dependency, a cycle (`dependencyCycles(g, false)` — the whole plan, done tasks included). The tasks
  approval refuses on it (`approvalChecks` tasks → `task-deps`). Doctor's `malformed-markers` reads "depends:" as a marker
  look-alike only before a task number (`**Depends:** 1`) — "(depends: the schema from task 1)" is prose.
- **The brief** carries `dependsOn` `[{number, status: done | open | missing}]` (kept with `write: true`: identifiers only)
  and renders a "Depends on" section (`taskDeps.briefHeading`) with a NEEDS_CONTEXT note while one is still open.
- **`spec_append_tasks {tasks: [{depends}]}`** / `append-tasks --depends 3,5` (repeatable): every number names an ACTIVE
  task or a task of this same call (by the number it gets here — the error names them), never the task itself, and may
  not close a new cycle (a pre-existing cycle is doctor's); all-or-nothing like every other field; stored as a
  `_Depends: 3, 5_` sub-line and read back through `taskDependsSpec()` before anything is written.

## Change history (1.13)
- **Approval history.** `approvals[phase]` stays the latest approval (with its content `fingerprint`);
  every approval is ALSO appended to `.state.json → approvalHistory` `{phase, at, by, fingerprint, forced?,
  failing?, snapshot, file?, designSnapshot?}` and the approved artifact is saved to
  `.specs/<f>/.history/<phase>@<n>.md` (tasks with checkboxes normalized; never overwrites an existing
  snapshot). `.history/` is **not** self-ignored — it is meant to be committed with the spec. Approvals made
  before the history are seeded as `legacy` records on the next approval.
- A bugfix's design approval signs off **bug.md** (`phaseFile()`, recorded as `file`), plus a
  `designFingerprint` and a `<phase>@<n>.design.md` snapshot when a design.md exists (it holds the
  bugfix's track sections); `spec_impact --phase design` diffs both files.
- **`spec_impact`** diffs the current artifact with the latest snapshot (requirements: by stable ID, incl.
  SC/EC/NFR; design and eval-plan: by `##` section; test-plan: by T-ID row — `plannedTestEntries()`, a row keyed by its first
  cell and compared cell by cell, reaching the tasks that make it green; tasks: by number — `IMPACT_PHASES`, so next_action's
  hint names the right `--phase` for every changed file). `reopen` (all but tasks) unticks the affected DONE tasks, marks their
  evidence `stale`, and appends the change request to `.state.json → changes` (idempotent per snapshot via
  digests). It never edits requirements.md or design.md. An approval without a snapshot → `fingerprint-only`; one
  without even a fingerprint (≤1.10, or a 1.12 bugfix design approval) → `none`, `changed: null` (unknown).
  A REMOVED requirement is never redone: reopen skips the tasks only it reaches (and a design section's IDs that
  requirements.md no longer defines); requirements' `retire` `[{id, tasks, tests}]` lists what still cites it — test-plan's
  too for a REMOVED T-ID (its tasks' `_Makes green:_`, `impact.retireTests` wording).
  `trace_check`'s informational `removedAcs` `[{id, changeRequest}]` (from `changes[].removed`) makes
  `traceGapLines()` name the change request instead of "(typos?)" — the phantom stays a gap.
- **Test-plan scaffold:** `scaffoldTestPlan()` writes the template rows only while requirements.md holds exactly the
  template's AC IDs (`i18n.templateAcIds()`); on written requirements (add_track tdd, create +tdd on an existing
  feature) one generic row per real AC — a template row would plan a test for a criterion the feature lacks; written
  requirements with NO AC get one generic row whose Covers cell is a slot (`acSlot`) — never the template's rows (an
  ID-less import used to fail traceability on phantoms). spec_import warns when it found no criterion (`wNoCriteriaAtAll`).
  `spec_import` re-plans after writing the imported requirements (createFeature scaffolded from the template ones) and
  fits a kept scaffold tasks.md with `fitTemplateTasks()` (known ACs only, `_Makes green:_` = the tests covering them).
  A +saas / +ai track block (there and in `trackTaskBlock()`, spec_add_track) keeps an ID only when `trackAcIds()` finds it
  defined AS that track's criterion (under a `[SaaS]`/`[AI]` heading or carrying the marker) — the template's
  US-1.AC-5…9 are its own track criteria; kept by number, they bound tenant isolation / load test / the prompt task to
  an import's unrelated AC-5…8 and trace_check passed with those criteria implemented by nothing.
- **A file date is never a finish blocker** (`changedSinceApproval(…, {detail: true})` → `{changed, byDate,
  untracked}`): a clone, checkout, copy or unzip resets every mtime. A pre-1.11 approval (no fingerprint) still shows a
  newer phase file in next_action / doctor / roadmap (1.12 parity), but spec_finish only warns about it. A 1.12 bugfix
  design approval (no fingerprint, no `file`) never tracked bug.md: `untracked` — no change anywhere, a finish warning
  to re-approve; a design.md that exists now was created after it (1.12 fingerprinted an existing design.md) — a change.
- `readState()` refuses a non-list `approvalHistory` / `changes` (they are appended to).
- **`spec_metrics`** derives everything from `.state.json`, `.history/` and the artifacts (`createdAt` is
  stored by createFeature; older features get an approximate one). `write` creates `retro.md` (writeIfAbsent).
- **`spec_append_tasks`** (converge) appends only: numbers after every number in use (tasks.md + leftover
  evidence records and tick times — a new task never inherits a removed one's run or completion time), all-or-nothing validation (phantom AC IDs, non-relative paths, bad story, multi-line markers,
  inactive-track / Global Constraints headings), a read-back check that existing tasks didn't change, and
  CRLF / BOM / missing final newline preserved. An approved task list → `needsReapproval`. Per task, besides `requirements`
  / `implements` / `verify` / `story` / `parallel`: `makesGreen` (T-IDs — `T-1`, `t-01`, `T01` accepted —, each planned in
  test-plan.md as `planIdText()` reads it, else `phantomTests` / `noTestPlan` and nothing written; stored as the plan
  spells it, so trace_check matches), `expectFail` (`_Expect: fail_`) and `size` (XS…XL, case-insensitive, stored
  upper-case — `badSize`); every marker must read back as given (`unstorable`), and the result's `appended` carries them.
  CLI `--makes-green` (repeatable, comma lists), `--expect-fail`, `--size`.

## Catalog, drift, restore, guard, steering (1.13)
- **`SPECS.md` is AUTO-GENERATED** like the roadmap: `spec_catalog {write}` and `maybeRefreshCatalog()` use
  the same `RE_AUTOGEN` / `isGeneratedOrAbsent()` guard, so a hand-written `.specs/SPECS.md` is never
  overwritten; once it exists, every roadmap refresh refreshes it too.
- **`_Supersedes: <feature>/US-n.AC-m[, …]_`** on a criterion (same line, a sub-line or its table row) marks
  the older AC as replaced. `stripSupersedes()` runs before own-AC extraction (trace, acIndex), so the foreign
  ID is never one of this feature's ACs; unresolvable references are `phantomSupersedes` (never a gap). **Only a
  SHIPPED declaring feature retires the older AC** (1.15 — `featureShipped()`: a finish recorded, or the execution signed
  off: the release notes' rule) in the catalog, the export and the matrix: a draft's declaration keeps `supersededBy` but
  adds `supersedePending: true` — rendered "to be superseded by … (not shipped yet)" (catalog, export, the matrix's
  markdown / CSV cell / `trace --matrix` notes), never struck, still current; `totals` {current, superseded (retired),
  pending — a subset of current: "N current (P to be superseded), S superseded"}; the matrix `counts.supersedePending`. A
  retired AC names its SHIPPED declarers only (never a draft that also plans it). A shipped feature counts only the
  declarations it shipped with: `shippedSupersedeKeys()` — when requirements.md changed since the requirements snapshot
  approved at or before the latest ship (a finish / an execution sign-off), a declaration that snapshot lacks (a change
  request's edit) is pending until the feature ships again; no such snapshot (pre-1.13) → every declaration trusted. A
  feature archived without ever shipping (abandoned) declares nothing, and its own ACs are not counted as current.
  `supersededByIndex()` (the matrix: `.live`, `.liveBy`) and `catalogData()` (`supLiveBy`) apply the same rule.
- **Drift baseline:** `spec_finish {write}` on a READY feature records `.state.json → finished`
  `{at, files: {rel: sha1|null}}` (CRLF-normalized, `_Implements:_` files, folders expanded, inside the project
  only). `spec_drift` hashes only those files (never walks the tree); a baselined feature with open tasks is
  `reopened`, one changed since its finish (`staleFinish()`) is `stale` (verdict `stale`, CLI exit 1 — finish it
  again; the catalog calls it `complete`) but its recorded files are STILL hashed: one that drifted puts it in
  `features` (`stale: true`) and `drifted` (verdict `drift`) — a stale baseline must never hide a changed file
  (a new file under an implemented folder used to make another file's drift vanish, and the re-finish accepted it).
  An unreadable state is verdict `error` — never "clean". The catalog's `finished` is next_action's / finish's: it also
  needs every tick verified (`verificationStatus`), no artifact changed since its approval BY CONTENT
  (`changedSinceApproval` minus `byDate`, as finish) and no new `_Implements:_` file (the walk runs last, only for a
  feature still finished; `baselineFiles(…, known)` skips the realpath check for files the baseline already has — it
  was the whole cost). An ARCHIVED feature is never walked for new files (drift and catalog): it can't be finished
  where it is; the CLI stale line for an archived one says restore → finish → archive again, and `existingFeature`'s
  not-found error names an archived folder of that name (`err.archivedHint`).
  SessionStart adds one line per drifted ACTIVE feature, bounded by `DRIFT_MAX_FILES`.
- **Archive → restore:** archive records `archived: {at, entry, dependents}` in the archived `.state.json`
  BEFORE pruning roadmap.json; restore moves the folder back, re-adds the entry and the dependents' `dependsOn`
  in their old position (only for features that still exist; a now-circular edge is skipped and reported). An edge to a
  feature that is ARCHIVED too is handed to that feature's own archive record (reason `archived`), so its restore puts it
  back — in either order (it was dropped as "gone" for good). The
  archive result names what the prune did — `dependentsPruned` (always), plus `incompleteDependency: true` and a
  warning `note` when the archived feature wasn't complete (its dependents now read as unblocked; the roadmap
  meets a dep at 100%). `rename` rewrites archived records too (`renamePlan()`), so restore finds the new slug.
- **Guard mode:** `roadmap.json → meta.guard` (`spec_init {guard}` / `init --guard on|off`, with or without
  tracks). `hooks/guard-hook.js` (PreToolUse, `Write|Edit|MultiEdit|NotebookEdit`) is **silent unless the
  guard is on** — guard off costs one small raw JSON read, the engine is loaded only for guarded projects —
  and `guardCheck()` reads roadmap.json + each feature's `.state.json` / tasks.md, never a repo walk. "Code" is
  `GUARD_CODE_EXT` — the scanner's `CODE_EXT` + `TEST_EXTRA_EXT` + `.ipynb` + the source languages the scanner
  doesn't inventory (`.mts`/`.cts`, `.cc`/`.hpp`, `.sh`/`.ps1`, Windows `.bat`/`.cmd`, `.sql`, `.kts`, CUDA,
  Fortran, HDL, shaders, code-bearing templates like `.erb`/`.razor`…); never reuse `CODE_EXT` alone there (it
  waved those through as "not-code"). It is an allow-list, so the docs say "a broad list of languages", never "any
  source file"; add a language there (and to the guard test) rather than rewording. Docs, config, data, markup and
  styles stay silent. A code
  edit outside `.specs/` with no non-archived feature holding approved, unfinished tasks gets
  `permissionDecision: "ask"` with a localized reason (a forced tasks approval still counts, with a note). Two exceptions,
  at both levels: a TEST file while some non-archived feature has an approved test plan and is unfinished (why
  `tests-phase` — Phase 4 writes the failing tests before tasks can be approved), and any code edit while an ACTIVE spike
  (undecided, or with open tasks, its timebox not passed) exists (why `spike`, field `spikes` — prototype work; a spike has
  no tasks gate, so it is never listed as "awaiting approval"; at the `scope` level a spike never overrides the approved
  features' plan). A
  tasks approval whose `fingerprint` no longer matches tasks.md (tasks appended/edited after it; ticks are
  normalized) is `stale` — it covers nothing and the reason names it; an approval without a fingerprint counts.
  Inside / outside the project is decided on real paths too (`insideDirAlias()`: an 8.3 short name, a junction or a
  symlink to the project is inside — read only when the text comparison says outside; errors fall back to it).
  **It never blocks on its own errors:** a malformed payload, a broken roadmap.json or any exception exits 0.
  1.14 adds the stricter `"scope"` level (see End-of-turn evidence gate and scope guard); a phase still waiting for a
  role's sign-off is not an approved tasks phase.
- **Scoped steering:** `steeringFrontMatter()` reads Kiro-compatible front matter — `inclusion: always |
  fileMatch | manual` + `fileMatchPattern` (string or list). No front matter → the brief's default files
  (constitution/tech/structure + the active tracks' files) count as `always`, others stay out; front matter
  without `inclusion` → `always`; an unknown mode (Kiro `auto`) → `manual`. `briefSteering()` quotes a
  matching `fileMatch` file's body (front matter and guidance comments stripped, `BRIEF_STEERING_BUDGET`) and
  lists `manual` ones. `steeringGlobMatch()` is a linear matcher with capped brace expansion — never a
  backtracking regex. Custom names (`steering_scaffold`) must match `^[a-z0-9][a-z0-9-]{0,62}\.md$` and not be
  a Windows device name or a prototype key. Doctor's `steering` check warns about files still templates.

## Upgrade (1.13) — `meta.specVersion` and `spec_upgrade`
- **The engine's version** is `engineVersion()`: `package.json` two levels above `spec.js`, read once; not readable or not
  x.y.z → `null`, and then nothing is stamped and no notice is shown (never a guessed version). Versions are compared by
  `compareSemver()` — numerically (1.9.0 < 1.13.0), a pre-release before its release; never a string compare.
- **`roadmap.json → meta.specVersion`** = the dev-spec version that last upgraded or created the project (`stampOf()`: a
  string that parses, else absent). `stampSpecVersion()` writes it under the roadmap lock, never lowers it and never writes
  over a broken roadmap.json. Three writers only: `spec_init` and `spec_create` when the project had NO feature before the
  call (`featureDirs()` — active or archived — counted BEFORE anything is written; best-effort), and `spec_upgrade {apply}`
  (last, and only once every feature migrated — a busy or broken feature keeps the notice until a retry). A brand-new
  project must never get the upgrade notice; a legacy project must never be stamped by creating one feature or re-running init.
- **SessionStart** adds ONE line (`msg.upgrade.hookLine`) while `specVersionStatus().behind` (no stamp, or an older one) —
  roadmap.json is already read for the language; wrapped in try/catch. The PostToolUse hook treats `.specs/UPGRADE.md` as a
  generated file (no roadmap refresh on its edits).
- **The audit** (`specUpgrade`, default, read-only) reuses the engine's verdicts per ACTIVE feature (archived ones are counted
  in `archived`): `specDoctor` once (`nextAction(…, {doctor})` reuses it — never run twice), `verificationStatus`,
  `changedSinceApproval` (via next_action), the finish baseline (`baselineDrift`, `staleFinish` state-only). One test-code walk
  for the whole call: `traceTestCode()` accepts a function for `scan`, called only when a feature needs it. Stable codes (never
  localized): `status` not-started · planning · executing · complete · finished (= phase complete + a finish baseline),
  `review` critic (no task ticked) · converge (some done, some open) · none, `group` blocked (doctor fail) · attention · ok,
  `attention` codes, history skip `reason`s. `lines` (and UPGRADE.md) are rendered in the PROJECT language by
  `upgradeLines()` / `renderUpgradeMd()` over one item list (`upgradeItems()`); next_action's recommendation stays in the
  feature's language, as everywhere.
- **The migrations** (`apply: true`) never edit an artifact, approve, tick, untick or delete. Per feature, under its lock,
  `upgradePlan()` → `applyUpgradePlan()` writes `.state.json` once: `tracks` only when absent (`undefined` or `[]` — a
  malformed list is left alone), the approvals whose latest version isn't in `approvalHistory` as `legacy` records
  (`legacyRecord()`, the builder `approvePhase` seeds with), and for an approval WITHOUT a snapshot whose recorded fingerprint
  still matches its artifact (`fingerprintMatches`) that artifact saved through `writeSnapshot()` (next free
  `.history/<phase>@<n>.md`, never a renumber; a bugfix design approval's design.md too when its `designFingerprint` matches)
  on that very record, stamped `seededAt`. Skipped with a stable reason: `no-fingerprint` (date-only), `changed`, `missing`,
  `untracked` (a 1.12 bugfix design approval — `file` absent, so any fingerprint is design.md's), `snapshot-missing`. Then
  `.specs/.gitignore` (`missingIgnoreLines()` computed BEFORE any lock — every lock ensures it), the stamp, a roadmap refresh,
  the audit of the result and `.specs/UPGRADE.md` (the `RE_AUTOGEN` marker family, `isGeneratedOrAbsent` — a hand-written one
  is reported, never overwritten). **Idempotent:** UPGRADE.md is written only when something migrated, and it carries no
  date, so a second apply writes nothing at all and says so (`migrations.changed: false`).
- CLI `dev-spec upgrade [--apply] [--json]` prints `lines`; exit 0 with a report, 1 on an error (no .specs/, a broken
  roadmap.json, a feature that couldn't be migrated).

## Project templates (1.14) — `.specs/templates/`
- **Resolution:** `.specs/templates/<lang>/<artifact>.md` wins over `.specs/templates/<artifact>.md`, which wins over the
  built-in i18n builder (`templateOverride()`); a pt-BR feature reads `pt-BR/`, then `pt/` (`templateLangChain()`). Only allowlisted names are ever read — `TEMPLATE_ARTIFACTS`
  (classification, requirements, design, tasks, test-plan, eval-plan, load-test, quickstart, checklist, integration-plan,
  bug, bug-requirements, bug-test-plan, bug-tasks, spike, spike-tasks) plus `steering/<file>.md` (a known stub, or a name
  steering_scaffold accepts). Every path is built from the allowlist and `LANGS`, never from a caller's string; at most
  three levels; dot files are not listed; a linked folder is never entered, a file whose real path is outside the project
  is ignored, and `init` refuses to write through a link. Files are read BOM-stripped with LF line ends; a
  whitespace-only file is ignored.
- **Who uses them:** `createFeature` (so `spec_import` too), `applyTracks` (spec_add_track), `initProject` and
  `scaffoldSteeringFile` — still create-only (`writeIfAbsent`); results name the templates used (`templates`).
- **Variables** (case-insensitive, spaces allowed inside the braces): `{{name}}` `{{slug}}` `{{summary}}` `{{tracks}}`
  `{{lang}}` `{{date}}`; an unknown `{{x}}` is left as is; no summary → the language's generic slot (`[TBD]` /
  `[a definir]` / `[por definir]`) so the scaffold still reads 'placeholder'. For steering, `{{name}}` / `{{slug}}` are the
  project folder's name and `{{tracks}}` the tracks init was given. For a spike, `{{summary}}` is its question.
- **Track-block rule — ONE rule for an overridden design / requirements / tasks / test-plan:** every active track still
  gets what the built-in template would hold for it, appended at the end as spec_add_track appends it
  (`trackDesignBlock`, `trackRequirementsBlock` — renumbered after the template's own US-1 ACs when an ID would collide —,
  `trackTaskBlock`, `trackTestRowsBlock` — T-IDs after the template's), citing the IDs requirements.md defines for the
  track (`trackIdMap`) — UNLESS the template already carries that track (its marker on a real heading, the localized
  Testability Notes, the track's task-block heading; for the test plan: it cites the track's criteria). The bugfix /
  spike variants and every other artifact are written as the template says.
- **Placeholder corpus from the project:** `projectTemplateSets()` adds the bracket texts, code-span slots and task lines
  of the project's templates to the corpus, so an untouched custom scaffold reads 'placeholder' for doctor / approve /
  next_action (and bug.md's own slots join `bugTemplateSlots()` — the root-cause gate holds). Scoped to the `.specs/`
  folder the current engine call works in (`TEMPLATE_SCOPE_ROOT`, set by `specsRoot()`), memoized per call, dropped when
  the engine writes under `templates/` (`forgetCached`), each file's parse cached by content (`TEMPLATE_PARSE_CACHE`). A
  slot holding a variable (`[Describe {{name}}]`) matches whatever the variable became through a LINEAR wildcard match
  (`templateWildcard`) — never a regex built from template text.
- **Reserved slugs:** `RESERVED_SLUGS` = `steering`, `exports`, `templates`, `tracks` (1.15) (`resolveFeature` refuses them for new
  features). **Legacy exception** (`reservedSlug(name, root)`): a `templates/` or `exports/` folder holding a
  `.state.json` is a feature created before 1.14 — it stays a feature (listed, reachable, renameable) and is never read as
  templates (`templateFileList()` returns nothing; every `spec_templates` action refuses with `legacyFeature: true`). The
  PostToolUse hook and the pre-commit check skip `.specs/templates/` with the same exception.
- **`check`** validates against the current rules (a design template with some of a track's marker headings but not all
  its sections, a track section without its `> **TODO**`, EARS / AC-ID problems, phantom AC and `_Makes green:_` T-IDs
  across the trio, bug.md without a real Root Cause slot, unknown `{{variables}}`, chain templates with no slot at all,
  empty files, non-template names) → `{file, line?, code, severity, message}` + verdict pass | warn | fail; CLI exit 1 on
  an error.

## Project-defined tracks (1.15) — `.specs/tracks/<name>/` track packs
- **What a pack is:** `track.json` (JSON with `//` / `/* */` comments — `stripJsonComments()`, one linear pass) + optional
  fragments `requirements.md` · `tasks.md` · `test-plan.md` · `checklist.md` · `steering.md` (`PACK_FRAGMENTS`), a `<lang>/`
  subfolder's winning over the root's (`packFragment()`: lang → its family → root). A VALID pack is a MARKER track: every
  registry reader sees it through the accessors (The track model). Guide: `references/project-tracks.md`.
- **Loading:** `packRegistry()` → `loadTrackPacks(root)` for `TEMPLATE_SCOPE_ROOT` (specsRoot's per-call project; detectTracks
  also calls `useTemplateScopeOf(dir)`), memoized in `PACK_MEMO`, dropped by `forgetCached` under `.specs/tracks/` (tracks
  init), `invalidateReadCache` and every read-cache scope's start / end. No scope → no packs (a direct engine call outside
  an exported function sees the built-in tracks only). `PACK_LOADING` makes every registry reader answer built-in-only
  while the packs load (never a half-built registry). Registry: `{packs, names, byName, byToken, problems, entries, legacy,
  corpus}` — packs in folder-name order; problems are `{file, severity, code, args, line?, pack?}`, localized only when
  shown (`localizePackProblem`, `msg.trackPacks.problems[code]`), so the memo is language-neutral. **Cross-call caches**
  (F4 review R9 — 20 packs × 4 languages cost ~100 ms per call): `packScan()` lists a pack's folder + `<lang>/` folders and
  lstats each allowlisted file → `sig` (size / mtime / ctime / inode per entry); `PACK_CACHE` (per pack folder, bounded 64)
  returns the validated result while the sig is unchanged — an edit is picked up by the next call; the pack folder's
  realpath is checked every call. `PACK_CORPUS_CACHE` (bounded 16) keys the placeholder corpus by every valid pack's
  name / token / sig. A project without `.specs/tracks/` pays one existsCached.
- **Validation (`loadPack`) — any error ignores the pack as a whole:** name = folder, `RE_PACK_NAME` `^[a-z][a-z0-9]{1,19}$`,
  never `packReservedName()` (VALID_TRACKS, TRACK_ALIASES keys, `PACK_RESERVED_WORDS`, Windows device names, PROTO_KEYS);
  marker `RE_PACK_MARKER` `^[A-Z][A-Z0-9]{1,11}$` (bare or `[X]`), never `RE_PACK_MARKER_RESERVED` (built-in markers, US\d /
  P\d / SHARED, TODO / TBD / TBC / FIXME…, AC / SC / EC / NFR / T prefixes), unique (the first pack by name keeps it —
  `marker-duplicate` on the other); title / section names / syn: `packTextOk()` (2–80, one line, no `[ ] < >` or backtick —
  they land in headings); section names never a PROTO_KEYS word (they key `sectionNames` lookups); guidance
  `packGuidanceOk()` (one line, no `<!--`/`-->`, never a heading or fence); keywords `RE_PACK_KEYWORD` (letters / digits,
  inner space - ' . ’, 2–60) — a regex-looking keyword is `signal-invalid`, and a valid one still reaches the classifier
  only through `keywordRe` (escaped); steering: `RE_CUSTOM_STEERING` minus device / proto names. Bounds `PACK_LIMITS`
  (20 packs, 32 KB track.json and per fragment — size read by lstat BEFORE the content, 20 sections / 20 syn / 50 keywords
  per tier / 20 fragment items). Files: `packScan()` — lstat, a regular file (never a link), in a folder chain checked once
  per pack (`.specs/tracks/` no link, the pack folder's realpath inside the real `.specs/`, a `<lang>/` Dirent no link — no
  per-file realpath: it adds nothing for a regular file and was the loader's biggest cost); `readPackItem()` reads it after
  the lstat size check; the pack folder itself is refused when it is a link (Dirent `isSymbolicLink`, which a Windows
  junction is) or resolves outside. Sections: every name / synonym is keyed by `packSectionKey()` — lower-case, the
  RE_HEADING_LEAD lead stripped (numbering, `Section N`, an emoji, a dash — what `headingMatches` strips from the heading;
  F4 review R4; nothing left → `field-invalid`, a lead stripped → warn `section-name-lead`), and every synonym is
  MARKER-BOUND (`loose` = all of them — F4 review R7: a core `## Architecture` never satisfies a pack's Architecture; a
  name equal to a core design heading, `coreDesignHeadingKeys()` over the EN / PT / ES design, warns `section-core-name`).
  Fragments: `packListItems()` (top-level item = at most one space before the bullet; lines
  indented ≥ 2 are its continuation), `packTableRows()` (six cells, header + separator skipped; else `fragment-row`);
  `{{acN}}` / `{{tN}}` beyond what the pack scaffolds in that language context → `fragment-ref` (its args name the context
  and the file the count comes from — F4 review R10). Warnings only:
  unknown keys / files / variables, an empty fragment (the default is used), a steering name a built-in track also uses.
  Stable codes are in the guide and in `spec_tracks`' description.
- **Rendering (EN / PT / ES / pt-BR — `msg.trackPacks`):** `packDesignBlock` (`## [MARKER] <name>` + `todoLine` +
  guidance — `packSubstBasic()` fills its `{{title}}` / `{{marker}}` / `{{name}}` / `{{slug}}`; `trackDesignBlock(tr, lang,
  vars)`), `packRequirementsBlock` (`#### [MARKER] <title> — Acceptance Criteria (EARS)`, numbered after the highest
  US-1 AC of the text it joins; `insertPackRequirements()` puts it before the first REAL `#`/`##`/`###` heading after the
  last US-1 criterion — `commentLines()`: never one inside an HTML comment or fence, F4 review R3 — else at the end), `packTaskBlock` (`## Story US-1 — [MARKER] <title>`, numbered after the last task;
  `_Requirements:_` added when a task has none — the pack's AC IDs per `trackAcIds`, else the track's `acPlaceholder`;
  the DEFAULT task also gets `_Makes green:_` from `packPlanRows()`; a fragment line whose `{{tN}}` / `{{tests}}` names no
  planned test is dropped), `packTestRowsBlock` (`## [MARKER] <Traceability Matrix>` + the built-in header, T-IDs after
  the plan's own; null when the plan already cites a pack AC or requirements.md defines none), `packChecklistBlock`
  (`- [ ] TOKEN: …`; given requirements.md, so `{{acN}}` resolves), `packSteeringStub`. `packSubst()` resolves `{{ac1}}…` `{{acs}}` `{{t1}}…` `{{tests}}` `{{title}}`
  `{{marker}}` `{{name}}` `{{slug}}` with `RE_TEMPLATE_VAR` (linear).
- **Where the blocks go:** `scaffoldText()` — a built-in scaffold gets ONLY its pack tracks' blocks (`withTrackBlocks(…,
  {only})`; a feature without packs is byte-identical to 1.14); a project template gets every missing block (the 1.14
  rule, packs included; checklist: packs only). createFeature also writes each pack's steering file (built-in tracks'
  steering stays spec_init / add_track's). applyTracks (add_track): design sections, steering, task block — never
  requirements (as the built-in tracks). `scaffoldTestPlan` leaves the pack's ACs out of its "fresh template?" comparison
  and of its generic rows (the pack's own rows plan them). classification.md lists pack signals (i18n `signalTracks()`).
  importSpec (F4 review R8): after writing the imported requirements.md it re-inserts each pack's criteria
  (`insertPackRequirements`), adds the pack rows to the re-planned test plan (`withTrackBlocks(…, {only: packs})`) and
  appends the pack task block (`withPackTasks` — imported tasks, or the kept scaffold with its stale pack block cut out).
- **Gates & readers:** `activeSectionTracks()` (doctor `<name>-sections`, the design approval, design-save check,
  roadmap attention), `statusFeature` `packSections {name: {marker, title, sections}}` + `missingPacks`, `checkPhaseIndex`
  (a `-sections` id is a design check), the brief's and the RTM's track design sections (`["sec", "privacy",
  ...packTracks()]`), import's design blocks, `fitTemplateTasks`, append_tasks' inactive-heading refusal, templates check.
  A pack's task block is found by its MARKER in a tasks.md heading (`trackTaskHeadingIs()` — the built-in tracks keep
  their template headings, cached in `TASK_HEADINGS`). Placeholders: `[MARKER]` is stable (`isPackMarkerBracket()` in
  `scanBrackets`, the exact case-sensitive token — a lower-case `[role]` slot stays a slot beside a ROLE pack — and never
  while the process-wide built-in corpus is built, `BUILTIN_CORPUS_BUILD`); the packs' texts in every language join the
  corpus (`packCorpusSets()` → `projectTemplateHas` brackets / code / tasks — incl. the track's `acPlaceholder`), read
  from their SOURCES (guidance, fragment items / rows, the i18n defaults — never whole rendered blocks) with `{{title}}` /
  `{{marker}}` filled and the feature's `{{name}}` `{{slug}}` `{{acN}}` `{{acs}}` `{{tN}}` `{{tests}}` kept: such a key is a
  linear wildcard (`RE_PACK_WILD_VAR` split → `wildcardMatch`, ≥ 3 literal characters — F4 review R2).
- **Missing packs:** createFeature / applyTracks record `.state.json → packMarkers {name: "[TOKEN]"}` (`packMarkersFor`). A
  saved non-built-in track is a pack name only when `savedPackName()` says so — a valid pack now, or in packMarkers, never a
  `packReservedName` (F4 review R6: any other word — a typo, `security`, `gdpr` — makes the list unreadable → the files
  decide, as in 1.14); such a missing one is kept by `savedTracks()` (normalizeTracks drops it; applyTracks / removeTracks
  re-append `missingPackTracks()`). `detectTracks()` → `noteGhostPacks()` registers EVERY packMarkers entry that is no
  valid pack now — whether or not the feature still lists it (F4 review R1: a pack turned off, then deleted, came back to
  life) — in the per-call `GHOST_MARKERS`; `inactiveMarkerLines` / `inactiveTaskLines` drop those sections like a removed
  track's — no gate, no placeholder — and `trackAcIds` keeps only the lines whose owner IS the asked track (F4 review R5:
  ghost sections joined another track's criteria). Doctor warns `track-pack-missing` (absent vs invalid + its error codes). trace_check
  reads whole files (as for a removed built-in track), so the pack's criteria and tasks still pair up there.
- **`spec_tracks` / `dev-spec tracks`** (`trackPacks()`): list (built-in rows + every pack entry, valid or not), init
  (`initTrackPack` — six files from `msg.trackPacks.init*`, create-only, the `inside()` link refusal of templates init;
  the marker = the name in capitals, `TRACK`-suffixed when reserved, numbered when taken), check (the loader's problems +
  EARS no-modal / vague on each fragment criterion; verdict; CLI exit 1 on an error). `tracks` is a RESERVED slug; a
  `.specs/tracks/` holding a `.state.json` is a pre-1.15 feature (`reg.legacy`, every action refuses `legacyFeature`); the
  PostToolUse hook and the pre-commit check skip `.specs/tracks/` (same exception).
- **Known limits:** a pack's classifier keywords share `KW_RE` / `KW_LITERAL` with the built-in ones (bounded:
  `KW_CACHE_MAX`); a slot or task line holding a variable is a wildcard (`[the {{name}} screens]` also recognises
  `[the checkout screens]`); editing `.specs/tracks/*` does not refresh ROADMAP.md (the save hook skips pack files); a hook
  is a fresh process — it pays one read of the packs (20 packs × 4 language folders ≈ 60 ms); ghost markers are per call and project-wide (a marker of a missing pack drops that heading in any
  feature of the call — correct, since the pack is gone for the whole project); section names are localized per language
  but `sectionState` reports the English name.

## Stakeholder export and release notes (1.14)
- **`spec_export`** writes (with `write`) `.specs/exports/<slug>.<html|md>` (1.14 F5: `format: "csv"` → `<slug>.rtm.csv`,
  the traceability matrix — see below) — the project: `project.<fmt>`, a feature
  slugged `project`: `project.feature.<fmt>` — with the `RE_AUTOGEN` marker family; `isGeneratedOrAbsent()` means never
  over a hand-written file (an error). A feature renders in its language, the project in the project language. The HTML
  is offline by construction: a zero-dep markdown renderer (`expInline` and friends) escapes EVERY text run (`htmlEsc` —
  a `<script>` in a criterion is shown as text), keeps link targets only for http(s) / mailto, turns an image into its alt
  text, and loads no font, script or stylesheet URL (a test asserts it); roadmap palette, system light/dark + toggle,
  print rules. Approvals are flagged "changed since" by content fingerprint only — a file date is no evidence (as in
  finish). A story written as its own `## US-n` section appears once, under the stories.
- **`spec_changelog`** reads the spec data only (no model, no git log). Added = features that shipped since `since`
  (finish `{write}` recorded their baseline, or their execution sign-off was approved) with their user-story ACs (template
  criteria left out); Changed = ACs superseded by a feature shipped since then + change requests (`changes`) recorded since
  then, with the current AC text (folded into the entry of a feature new in these notes); Fixed = bugfixes shipped + the
  root-cause one-liner. A feature shipped before `since` is never Added again (a role's `partial` execution sign-off is no shipment — only the
  completing one); a spike is never listed. `since`: an ISO
  date (`YYYY-MM-DD` = 00:00 UTC) or timestamp, `last` (default — `meta.changelogAt`; everything while unset) or `all`.
  `write` → `.specs/RELEASE-NOTES.md` (AUTO-GENERATED, never over a hand-written one) and stamps `meta.changelogAt`, both
  under the roadmap lock; nothing to report → nothing written or stamped (`note`).

## Requirements traceability matrix (1.14 F5)
- **`buildTraceMatrix(projectDir, {slug, dir}, {code?, scan?, supBy?})`** (`traceMatrix(projectDir, name, opts)` resolves
  the name) REUSES the readers — never a second verdict, nothing new recorded. Rows = trace_check's AC set
  (`requirementAcIds`, document order) then the secondary IDs (`secondaryDefinitions`: EC, NFR, SC — kind order) over the
  ACTIVE requirements (`activeDesign`: a removed track's criteria are out). Per row: `text` (`acOneLine`, ≤ 1000 chars),
  `template` (`placeholderReport`; a secondary ID trace doesn't count as defined), `design` (the design.md `##` sections
  naming the ID — a bugfix: `bug.md: …` + `design.md: …`, spec_impact's keys — plus, for a `[SEC]` / `[PRIVACY]`
  criterion, that track's sections), `tasks` (the ACTIVE tasks whose PROSE — `taskProse`, never a fenced example — cites
  the ID or one of its planned T-IDs: `{number, text, done, verified, reason, nothingToVerify?, cites, evidence}` —
  `taskVerification()` in the project's evidence mode (F1: `unobserved` under `"observed"`), `rtmEvidence()` = the latest
  record's command / exitCode / at / expected / observed / commit / dirty, or its note, `stale`), `tests` (+tdd: the T-IDs of
  the test-plan entries citing it — `planIdText`; with `code` the files naming each, `outsideCode` for a T-ID run outside
  test code; one `scanTestCode()` walk shared with trace's `code`), `decisions` (current decisions.md entries whose
  `_Affects:_` name it), `supersedes` / `supersededBy` (`supersededByIndex()`, built once per call — the project export
  passes it to every feature), `approval` `{at, by, forced, changed}` — the requirements approval and whether THIS row's
  text changed since the approved snapshot (`latestSnapshot`); a fingerprint-only approval knows only whether the file
  changed (`changed: null` when it did — unknown which row); none → `null`. Plus `approval` (with `baseline: snapshot |
  fingerprint-only | none`), `counts` {rows, verified, implemented, planned, untraced, template, superseded}, `lang`,
  `kind`, `tracks`.
- **Stable codes.** `status` (`RTM_STATUSES`): `untraced` (a trace gap names it) · `planned` (traced; a linked task still
  open, or none linked yet) · `implemented` (every linked task done, one not verified) · `verified` (every linked task
  done and verified — nothingToVerify counts). `gaps`: `no-task` (an AC no task cites) · `no-test` (+tdd: an AC no test-plan
  line covers) · `no-coverage` (EC / NFR: no task or planned test; SC: no test-plan row or quickstart.md line — never for a
  scaffold's untouched EC / NFR / SC row, `template: true`, which trace_check doesn't warn about either) — exactly
  trace_check's gaps and secondary warnings for that ID. Labels are localized (`i18n.msg(lang).rtm`, EN/PT/ES).
- **Surfaces.** `trace_check {matrix: true}` → `matrix` (informational — never the verdict; with `code` both share ONE
  walk); `dev-spec trace <f> --matrix` (a table, `printMatrix`) and `--csv` (the data alone on stdout — no BOM, no marker
  record — exit code still = trace gaps; under `--json` the JSON result); `spec_export {format: "csv"}` / `export [f] --csv
  [--write]` (one of `--md` / `--html` / `--csv`) → `.specs/exports/<slug>.rtm.csv` (the project: `project.rtm.csv`, every
  active feature's rows; a feature slugged `project`: `project.feature.rtm.csv`), `isGeneratedOrAbsent()` like every export;
  the HTML / md FEATURE export gains a "Traceability matrix" section (`rtmMarkdown` — not for a spike; cells through
  `rtmCell`, a `<!--` opener neutralized so a cell can't swallow the next ones) and the PROJECT export each feature's counts
  by status (`rtmProjectMarkdown`).
- **CSV** (`matrixCsv(matrices, lang, {document?})`): RFC 4180 — CRLF records, a field holding `,` `"` CR or LF quoted
  (quotes doubled); localized header row; a Test files column only when some matrix was built with `code`; formula guard
  (`RE_CSV_FORMULA`): a cell starting with `=` `+` `-` `@`, a tab or a CR gets a leading apostrophe. `{document: true}`
  (spec_export) adds a UTF-8 BOM (Excel reads a BOM-less CSV in the ANSI code page) and a LAST record carrying `#
  AUTO-GENERATED by dev-spec …` in its first cell, the other cells empty — the header stays row 1, the table rectangular,
  and `isGeneratedOrAbsent` finds the marker in the file's tail.

## Team governance — approvals by role and fast-forward (1.14)
- **`roadmap.json → meta.approvalRoles`** `{<phase>: [roles]}` — PHASES order, lower-cased, a role matches
  `^[\p{L}\p{N}][\p{L}\p{N}_.-]{0,39}$`; `{}` / `--roles none` clears it. CLI text form `requirements=product,design=tech+security`
  (`+` or a bare word after a comma adds a role to the previous phase). Without it nothing changes (a `role` given is only
  recorded).
- **Sign-offs:** a listed phase needs `role` (`roleRequired` / `roleNotListed` refusals). Each sign-off runs that phase's
  gate like any approval (force records it forced) and is appended to `approvalHistory` with its `role`; until the last
  role signs it waits in `.state.json → signoffs[<phase>][<role>]` (its history record `partial: true`, no snapshot). The
  completing sign-off writes `approvals[<phase>]` (with `roles` `{<role>: {by, at, fingerprint…}}`) and the snapshot
  exactly like a single approval — so every reader of `approvals[<phase>]` (doctor approval-gates / `nextGate.missingRoles`
  / `pendingRoles`, next_action's "missing role", finish, ROADMAP.md attention, the guard hook, metrics) sees the phase
  approved only then. A sign-off of OLDER content no longer counts (`phaseContent()` fingerprints; a phase with no file —
  tests, execution — keeps its sign-offs until approved). readState refuses a non-object `signoffs`.
- `spec_impact` returns `missingRoles` when the changed phase needs roles, and its "→ re-approve" line carries
  `--role <first>`; a fast-forward stopped by a role error says what it approved before (`ffWhyRole`).
- **Legacy rule:** a phase approved WITHOUT the roles now required (approved before roles were configured, or before a
  role was added) stays approved — by an unknown role, never retroactively pending; doctor / finish warn and ask each
  role to re-sign.
- **Fast-forward** (`through`, `approve --through`, /spec-ff): approves the active phases IN ORDER (the flow's order) from
  the first unapproved one up to `through` (never `execution`), each through its own gate — snapshot + history record
  flagged `batch: true` (`metrics.batchApprovals`). It stops at the first refused gate (`ok: false`, `refused`,
  `stoppedAt`, `failing`, `checks`; the phases before it stay approved, listed in `approved`) or at a phase still waiting
  for another role (`ok: true`, `complete: false`). `phase` is optional only with `through`. next_action suggests it
  when every planning artifact through tasks is filled and passes its gate.

## Forecasts and cross-feature overlap (1.14)
- **Sizes:** `_Size: XS|S|M|L|XL_` (English-stable; its line or a sub-line, never fenced code) = 1/2/3/5/8 points
  (`SIZE_POINTS`); an unsized task counts as its feature's median sized task, else M.
- **Ticks:** `spec_complete_task` records `.state.json → ticks[n]` = ISO, written BEFORE the tick (`recordTick`; a
  non-object `ticks` is left alone). A task ticked before 1.14 falls back to its first passing evidence run, else the
  record's time (`taskCompletedAt`); a box ticked by hand has no time and is not counted.
- **Velocity** = points per WORKING day (Mon–Fri, UTC days) over the last `FORECAST_WINDOW_DAYS` = 28 calendar days,
  counted from the day of the window's first completion through today — project-wide, and per feature once it has
  `FORECAST_MIN_TASKS` = 3 completions of its own in the window. **ETA** = open points ÷ velocity, in working days from
  today or from the working day after each unfinished dependency's ETA, with a ±`FORECAST_SPREAD` (25%) range (low/high
  chain off the dependencies' low/high). No ETA → `eta: null` + a stable `reason`: `not-enough-data` (< 3 completions in
  the window) · `no-tasks` · `dependency` · `cycle` · `done`. Surfaces: `spec_roadmap` (`velocity`, each feature's
  `forecast`), the ROADMAP.md / .html ETA column ('—' without one) + velocity line, `spec_metrics.velocity`, the CLI
  roadmap. Pure reads of tasks.md + .state.json.
- **Overlaps** (`featureOverlaps()`): two ACTIVE features whose OPEN tasks plan the same files (`implementsKey`; a folder
  covers the files under it, a glob what it matches and its literal folder), or an active feature planning a file a
  FINISHED feature recorded in its drift baseline. Not an overlap: features ordered by a dependency (either way,
  transitively — a finished pair included) or one declaring `_Supersedes:_` of the other's criteria. Bounded (`OVERLAP_MAX_KEYS` 500,
  `OVERLAP_MAX_GLOB_CHECKS`, `OVERLAP_MAX_PAIRS` 50), text reads only — nothing hashed, since SessionStart runs it.
  Surfaces: ROADMAP.md "Needs attention" (each pair once), doctor warn `cross-feature-overlap` (fix with spec_depend or
  `_Supersedes:_`), one SessionStart line.

## End-of-turn evidence gate and scope guard (1.14)
- **`stopCheck(projectDir, {message, agent, stopHookActive})`** (engine; `hooks/stop-hook.js` and `dev-spec stop-check`
  print the same decision) sends a turn back (`block: true`, `reason`) ONLY when (a) the closing message CLAIMS the work
  is done or verified and (b) a non-archived feature active in the last `STOP_RECENT_HOURS` = 4 h (lastTickAt, ticks,
  evidence `at` / `noteAt` / history — only what the engine recorded, never a file date (a fresh clone stamps tasks.md
  "now"), and a stamp in the future is ignored; at most 50 features) has ticked tasks `verificationStatus()`
  reports unverified — or, every active task done, project checks without a passing run since the last task activity
  (`suiteStatus().missing` — any status but `pass`, `code-changed` included).
  Stable `why` codes: `stop-hook-active` · `no-specs` · `off` · `no-claim` · `admitted` · `verified` · `no-recent` ·
  `unverified` (+ the implementer's `not-done` · `no-task` · `nothing-to-verify` · `report-ok` · `implementer-evidence`).
  The reason is localized in the project language (an implementer's in its feature's). An unreadable `.state.json` is
  skipped — the gate never blocks on its own trouble.
- **Claims** (`stopClaims()`): the patterns are i18n `stopGate.claims` / `negators` / `admissions` of EVERY language,
  compiled together (unicode word boundaries — JS `\b` never matched "concluído"), over the message's last 20 000
  characters minus fenced code, inline code, HTML comments and quoted (`>`) lines. A claim doesn't count when a negator or
  condition sits up to 3 words before it in its sentence ("not done", "once the tests pass", words ending in `n't` /
  `'ll`, or the claim's own first word — "Nothing is done"), nor when its sentence is a question. An ADMISSION anywhere
  ("task 3 is not verified", "2 failing", "2 are failing") means the honest answer is never sent back — unless a `fixed`
  word — a fixing verb or "previously", never an auxiliary ("was", "had", PT "havia", ES "había": "2 tests failed and I
  was unable to fix them" is an honest admission) — sits within 4 words of it in its clause with no negator anywhere in
  that window (`stopPastFailure()`: "I fixed the 2 failing tests", "previously 4 failed"; "I haven't fixed the 2 failing
  tests", "the 3 failing tests were not fixed" stay admissions). The look-back and the question tail are bounded
  (`STOP_CLAUSE_SPAN`) — slicing the whole text per hit was quadratic. A noun + done claim ("Feature complete") must end
  its clause ("the implementation done so far" claims nothing). The negator window is cut at
  `:` and dashes; "no" and "se" are read by language (`stopNegates()`: "no" negates in EN, in ES only before a verb or
  clitic, never in guessed-PT text — em+o; "se" — PT "if" — only for a PT claim, never in guessed-ES text nor before a
  Spanish auxiliary or preterite). Claims include "All tasks
  done", "All green", ranges ("Tasks 1-3 done"), "Feature complete" and an emoji ✅ ✓ ✔ around done. A spike is never
  held to the project checks here; a reason listing only checks has its own head line (`headSuite`). When you add a
  language, add its four lists (claims, negators, admissions, fixed).
- **spec-implementer (SubagentStop):** it never ticks tasks, so its gate is its REPORT: a DONE / DONE_WITH_CONCERNS for a
  task whose `_Verify:_` is runnable needs `.specs/<f>/.execution/task-N-report.md` (the path named in its reply) to carry
  every one of those commands (backticks / whitespace flattened) and the exit code the task needs ("exit 0", "exit code:
  1", "exited with code 0", "exit status 2", PT "código de saída", ES "código de salida"): an exit 0 for a must-pass
  `_Verify:_` (`notPassing` — "DONE … exit code: 1" was allowed), a non-zero exit for an `_Expect: fail_` task
  (`notFailing`); any matching code in the report counts, so a report showing the red run and then the green one passes.
  STATUS BLOCKED / NEEDS_CONTEXT, no report path, or no runnable `_Verify:_` → allowed.
- **The hook** (`hooks/stop-hook.js`): registered in hooks.json for **Stop** (no matcher) and **SubagentStop** with matcher
  `^(dev-spec-driven:)?spec-implementer$` — plugin subagents IGNORE a `hooks` block in their own frontmatter, so it must
  live in the plugin's hooks.json. It reads `last_assistant_message` (a bounded transcript tail for older payloads),
  honours `stop_hook_active` (never sends the same stop back twice in a row), answers `{"decision": "block", "reason"}`,
  is silent when there is nothing to say, when `.specs/` isn't dev-spec's, or when `roadmap.json → meta.stopCheck` is
  exactly `false` (on by default — `spec_init {stopCheck}` / `init --stop-check on|off`; the result always reports it), and
  exits 0 on any error. CLI: `dev-spec stop-check [--message "<text>"|-] [--agent <type>]` (exit 1 = would send it back).
- **Scope guard:** `meta.guard` is `false | true | "scope"` (`guardLevel()`; the hook reads the same raw value;
  `guardInput()`: true / "on" → true, false / "off" → false, "scope" → "scope", strings case-insensitive). `scope` adds,
  once some feature holds approved (or forced) tasks with open ones, `scopeGuardDecision()`: a code file is allowed when
  an OPEN task of such a feature names it in `_Implements:_` (the file via `implementsKey`, a folder above it, or a glob
  matching it) or when it is a test file (tests are planned by T-ID); otherwise ask, naming the likely task (a planned
  file in the same folder, else the longest shared folder prefix, else the `taskSchedule()` next task of the first covering
  feature that has one — 1.14 F3 —, else the first open task) or `/spec-converge`. Text reads only; `guard: true` is unchanged.

## Harness-observed evidence (1.14 F1)
- **The log.** `hooks/observe-hook.js` (hooks.json **PostToolUse** and **PostToolUseFailure**, matcher `^(Bash|PowerShell)$` —
  a PowerShell run only with an EXPLICIT exit code, its response shape being undocumented) logs a run of a task's runnable `_Verify:_` command (or the ` && ` join of
  a task's several commands — `verifyCommandSet()`, how `done --run` reports them) or of a `meta.checks` command.
  `spec.observeRun()` appends ONE JSON line `{command, exitCode, at, event, session}` (command flattened by `flatCommand()`:
  backticks dropped, whitespace runs folded — the implementer gate's rule) to `.specs/<feature>/.execution/observed.jsonl`
  for each non-archived feature whose tasks.md holds that `_Verify:_`, and to `.specs/.execution/observed.jsonl` for a
  project check (a dot folder is never a feature; each `.execution/` gets its self-ignoring `.gitignore` `*`). It never
  creates a feature folder. Bounded: past `OBSERVED_MAX_BYTES` (64 KB) the log keeps its newest lines up to half of that
  (replaced atomically; a concurrent append can lose one line — that run then reads unobserved and is run again); a
  command over `OBSERVED_MAX_COMMAND` (4000) is never logged; at most `OBSERVED_MAX_FEATURES` (200) feature folders.
- **The hook** exits 0 at once unless the tool is `Bash` / `PowerShell` on one of the two events and a project is found —
  EVERY distinct dev-spec one (`isDevSpecProject`) among the nearest folder holding `.specs/` at or above the payload's `cwd`
  and `CLAUDE_PROJECT_DIR` / `SPEC_PROJECT_DIR`: a subagent working in a git worktree of the project runs in the worktree's
  copy, whose git-ignored log is never merged back, so the run is logged in the main project too. Exit code: `tool_response.exit_code` / `exitCode` / `code` / `returnCode` (or
  the payload's own), else a response text starting `Exit code N`; else (never for PowerShell — no code, no run) 0 on PostToolUse (1 when the response says
  `is_error`), and on PostToolUseFailure the code named in `error` ("… exit code 1"), else 1 — a failure is never 0. An
  interrupted run (`is_interrupt`, `interrupted`), a backgrounded one (`run_in_background`, `backgroundTaskId`,
  `backgroundedByUser`) and a run with no explicit code but a `returnCodeInterpretation` (a non-zero exit the Bash tool read
  as no error — grep's "No matches found") are no run. A leading `cd <project root> &&` (or `;`) is stripped (Git Bash
  `/c/…` paths read as `C:/…`); any other folder keeps the whole command, which then matches nothing. The engine is loaded
  only after a plain-text pre-filter (the flattened command — or each part of a ` && ` join — appears in some feature's tasks.md — ≤ 2 MB each, dot / `_`
  folders skipped — or equals a meta.checks command); it prints nothing, reads stdin asynchronously (≤ 4 MB, else
  ignored), and exits 0 on any error.
- **The stamp.** `observedRun(projectDir, slug | null, command, exitCode)` → `{observed, at?}`: true when the LATEST
  logged run of the same flattened command within `OBSERVED_WINDOW_MS` (24 h; a stamp more than 5 min in the future
  ignored) exited with the same code — a report of exit 0 after an observed exit 1 is not what the harness saw
  (`latestExitCode`); a reported `a && b` with exit 0 also counts when each part's latest logged run passed.
  `observedStamp()`: every run `{command, exitCode}` that `spec_complete_task` / `done` and `spec_finish {evidence}` record
  is stamped `observed: true | false`; `done --run` / `finish --run` pass `ranBy: "cli"` → `observed: "cli"` (the CLI ran it
  itself; counts as observed). The MCP server never passes `ranBy`, and `normalizeEvidence()` keeps no caller-given
  `observed`. Every `spec_complete_task` result carries `observed` when a run was given (stable); `suiteChecks[]` items carry
  their run's `observed`, and so do the matrix's task evidence records (F5, `rtmEvidence()` — JSON only; the CSV / table /
  export words don't print it). The brief and the merge summary don't show it.
- **The mode.** `roadmap.json → meta.evidence` = `"reported"` (default — absent is reported: the 1.14 verdict, the stamp is
  context only) | `"observed"` (opt-in; switching to it stamps `meta.evidenceSince`, switching back removes it).
  `evidenceMode()` fails CLOSED: an unparseable roadmap.json whose raw text says `"evidence": "observed"` stays observed
  (one stray byte switched the rule off). `spec_init {evidence}` / `init --evidence reported|observed` (case-insensitive;
  anything else is an error before any write; under the roadmap lock, no write when the effective mode doesn't change);
  the result always reports the current `evidence` (+ `evidenceNote` when given). `evidenceRule(projectDir)` (`{mode, since}`) is read by
  `taskVerification(evidence, block, dup, rule)` (a bare mode string is accepted) — under `"observed"`, a runnable `_Verify:_` is verified only when the run
  that proves it (the latest passing run; an `_Expect: fail_` task's red proof, `redProof()`) is stamped `true` or `"cli"`
  (`observedProof()` — an `_Expect: fail_` red proof recorded BEFORE `evidenceSince` also counts once the fix's passing run
  is observed / CLI-made: re-making it would mean breaking the fixed code), else reason **`unobserved`** — so every surface of the one verdict follows (complete_task, status,
  impact, doctor, finish, ROADMAP.md, the stop gate, the matrix). A task without a runnable `_Verify:_` is unaffected.
  `suiteStatus()` → **`unobserved`** for a passing project-check run that isn't observed (a finish blocker like any status
  but `pass`). complete_task's note (`observed.unobservedNote`; `observed.unobservedRedNote` for an `_Expect: fail_` task — re-make the
  red run observed, never a `--run` of the green test) adds `observed.neverObserved` when no run was ever logged in
  the project (`observedAny()` — an MCP-only client has no hook); next_action's `verify` step adds `observed.naHint`.
- **Not a security boundary:** an agent with a shell could write the log itself. It raises the bar on a hallucinated or
  paraphrased report — the run has to have happened in the harness. MCP-only clients have no hook: under `"observed"` they
  record runs with `dev-spec done <f> <n> --run` (or switch back to `"reported"`).

## Human approval guard (1.14 F2)
- **`roadmap.json → meta.approvalGuard`** = `off` (default; absent = off) | `ask` | `deny` (`APPROVAL_GUARD_LEVELS`, in
  order — a later one is stricter). `spec_init {approvalGuard}` — a plain string enum in the schema — / `init
  --approval-guard off|ask|deny` (anything else: a localized CLI error; `approvalGuardInput()` → undefined leaves it
  unchanged in the engine); written under the roadmap lock, no write when unchanged; the result always reports the
  current `approvalGuard` (+ `approvalGuardNote` when given).
- **The hook** `hooks/approval-hook.js` (PreToolUse, anchored matcher `^(Bash|PowerShell|(mcp__.+__)?(spec_approve|spec_feature|spec_init))$`)
  is silent unless the guard is on: a tool call that can't be an approval (a Bash / PowerShell command not containing
  `dev-spec`) exits before any file read; otherwise ONE raw read of roadmap.json per candidate project — the project the
  call names (MCP `projectDir`, CLI `--project` in the command), the payload `cwd`, `CLAUDE_PROJECT_DIR`,
  `SPEC_PROJECT_DIR` (at most 8; `${VAR}` unexpanded and network paths — `\\host\share`, `//host/share`, `\\?\UNC\…` —
  refused, `\\?\C:\…` is local); the STRICTEST level wins. The engine is loaded only then; it answers
  `{hookSpecificOutput: {permissionDecision, permissionDecisionReason}}` (+ `systemMessage` for deny). It never blocks on
  its own trouble: a malformed payload, a broken roadmap.json or any exception exits 0 silently.
- **`approvalGuardDecision(payload, level, {lang, cli?})`** — PURE (reads nothing) → `{decision: allow | ask | deny, why,
  level, …}`; `why` (stable): `off` · `no-payload` · `not-pre-tool-use` · `not-an-approval` · `approval`. On an approval:
  `actions` `[{kind: approve | remove | guard-down, source: mcp | cli, feature, phase, through, role, by, force, from, to,
  project}]`, `force`, `command` (what the human runs, `!`-prefixed), `reason` (localized, `approvalGuard.ask` /
  `approvalGuard.deny`) and, for deny, `userNote`. What counts: `spec_approve` under ANY MCP server prefix (or bare);
  `spec_feature {action: "remove", confirm: true}` (a preview isn't); `spec_init {approvalGuard}` LOWERING the level
  (raising is always fine); through the Bash / PowerShell tool, `dev-spec approve …` (phase or `--through`, `--role`,
  `--by`, `--force`), `dev-spec feature remove … --yes` and `dev-spec init --approval-guard <lower>` — `--help` runs nothing.
- **The shell lexer** (`shellCommandWords()`, one linear pass, nothing evaluated): separators outside quotes are newline
  `;` `&` `|` `(` `)` `{` `}` backtick and `$(`; single quotes are literal; inside double quotes a backslash escapes only
  `"` `\` `$` `` ` ``; outside quotes it stays (a Windows path). `devSpecWordAt()`: the CLI's script (`dev-spec`,
  `dev-spec.js` / `.cjs` / `.mjs` / `.cmd` / `.ps1` / `.exe`, any path) counts only in PROGRAM position — after launchers
  and shell keywords (`APPROVAL_WRAPPERS`: node, npx, bun, deno, sudo, env, time, `!`, if/then/do…), env assignments,
  options and a timeout — never as another program's argument (`echo dev-spec approve x`, `git commit -m "…"`).
  `cliApprovalAction()` reads the words after it with `CLI_SWITCHES` (a `--flag` that is no switch takes the next word),
  then again with every flag as a switch. A word holding whitespace and `dev-spec` after an `APPROVAL_SHELLS` program
  (bash, sh, zsh, cmd, powershell, pwsh, eval, iex, Invoke-Expression, Start-Process, wsl, su, watch…) is lexed as a script
  in turn, up to `APPROVAL_SHELL_DEPTH` = 3; at most `APPROVAL_COMMAND_MAX` (64 K) characters are read.
- **ask** → `permissionDecision: "ask"`: the user confirms or declines; the reason names the feature, phase(s), role, the
  `by` and, loudly, `--force`. Claude Code's auto / bypass permission modes may skip the prompt. **deny** →
  `permissionDecision: "deny"` (holds in every mode): the reason tells the agent approvals are the human's (stop and ask);
  the user sees `systemMessage` with the command to run — `! node "<clone>/cli/dev-spec.js" approve <f> <phase> [--role r]
  [--force] [--project "…"]` (`approvalCommand()`: a value from the agent's call goes in only when it is plainly safe to
  paste into bash / PowerShell, else a `<placeholder>`; the `!` line run by the agent itself is still an approval).
- **A guardrail on the approve paths, not a sandbox:** an agent editing `.state.json` or running `node -e` isn't caught.
  `spec.CLI_SWITCHES` is the ONE list of CLI boolean switches (see Conventions): a CLI-only switch would make this lexer
  read the next word as its value.
- **The lexer (review fixes).** `shellCommandWords(cmd, mode)` lexes by the tool's shell: `bash` (`\x`, `\⏎`, `$'…'`,
  `$( )` / backticks also inside "…"; `raw` keeps backslashes for Windows paths), `ps` (the backtick is PowerShell's escape
  and line continuation, `@'…'@` / `@"…"@`, `#`, `<# #>`), `cmd` (`^`). Recursive, bounded by `APPROVAL_LEX_DEPTH` (32),
  linear. Redirections go to `redirs`, never words. Heredoc bodies are data: skipped when the delimiter is quoted, only
  `$( )` / backticks read when unquoted, read as a script when fed to a shell (`bash <<EOF`, `sh <<<`); `<<` inside `(( ))`
  is a shift. `programAt()` skips launchers and their value options (`APPROVAL_OPTION_VALUES`: `sudo -u`, `exec -a`,
  `node -r` …) and counts npm / pnpm / yarn / bun / deno only through a real run subcommand (`APPROVAL_SUBCOMMANDS`).
- **Guard-down actions** (`kind: "guard-down"`, `setting`: approvalGuard · evidence · roles · check · stopCheck · guard ·
  roadmap) — lowering the guard, and weakening what it protects: evidence observed → reported, approval roles cleared or a
  required role dropped, a project check removed or its command changed, the stop gate off, the edit guard lowered, a
  shell write / move / delete of `.specs/roadmap.json` (or of `.specs/`; `command: null` — the user makes that change).
  Judged against the project's meta, which the hook passes in (`opts.meta`); no readable meta → fail closed. Raising,
  adding or a no-op stays allowed. A `roadmap.json` that exists but doesn't parse keeps the strictest `"approvalGuard"` its
  raw text names (`approvalGuardLevel` and the hook). Known limits: shell variables, aliases, splatting, inline scripts
  (`node -e`), `cd .specs && … > roadmap.json`, and the Write / Edit tools.

## Decisions and spikes (1.14)
- **`decisions.md`** (committed with the spec — `.execution/` is the scratch area): a localized header, then per entry
  ```
  ## D-<n> — <title>
  - _Kind: decision | discovery_
  - _Date: <ISO timestamp>_
  - _Affects: US-1.AC-2, T-03, <design section>_      (optional)
  - _Supersedes: D-1_                                 (optional)
  **Context:** …  **Decision:** (or **Discovery:**) …  **Consequences:** …   (localized labels; any EN/PT/ES spelling read)
  ```
  The IDs and markers are English-stable; markers are read only between the heading and the first label; HTML comments
  and fenced code never hold an entry. `spec_decide` appends under the feature lock: numbered after the highest D-n, the
  existing bytes never rewritten (a BOM and CRLF kept — the entry follows the file's line ends; a code fence left open at
  the end is closed first, by appending its closer — the entry was written unreadable and its D-n handed out again); title ≤ 200 and texts ≤
  20 000 characters. `_Affects:_` is validated when written (an AC defined in requirements.md, a T-ID planned in
  test-plan.md, an EC/NFR/SC ID written in requirements.md, anything else a design.md section heading — bug.md /
  design.md for a bugfix, spike.md for a spike; unknown → error `unknownAffects`, nothing written) and `_Supersedes:_ D-n`
  must name existing entries; a superseded entry is retired (the brief and `decision-affects-approved` skip it, the catalog
  marks it). Readers: the brief (bounded), finish's merge summary, spec_export, spec_catalog (count + titles),
  trace_check (`phantomAffects`, warnings — never a gap), doctor (`decision-affects`, and `decision-affects-approved` for
  a current decision recorded AFTER the approval of the requirements / design it names).
- **Spike kind** (`kind: "spike"`, `question`, `timebox` `YYYY-MM-DD` | `3d`): spike.md (Question · Timebox · Options
  considered · Evidence · Decision + `_Outcome: go | no-go | pivot_` · Follow-up — localized headings matched by
  `SPIKE_SYN`; `_Outcome:_` also reads the PT/ES words and yes/no) + investigation tasks; core-only; `gateWalk`,
  `pendingGateList` and `chainArtifacts` are empty for it, approve refuses every phase but the execution sign-off and
  add_track refuses it. Own doctor (`spikeDoctor`: question; decision — FAIL until written, prose outside the brackets,
  the `_Outcome:_` line alone is no rationale —; timebox — warn once past with no decision), next_action (question →
  investigate → decide → go: spec the real feature seeded from question + decision and archive the spike · no-go: archive
  · pivot: a new spike), finish (ready once decided and every task ticked — no suite / evidence gates) and detectPhase
  (requirements → tasks-ready → executing → complete). Roadmap (🔬, timebox attention), catalog, export and resources know
  it; the changelog never lists one. Prototype code lives outside `.specs/`.

## Import sources and flows (1.14)
- **`spec_import` tools** (exact enum on both surfaces): `kiro` · `spec-kit` · `openspec` · `plan` · `execplan` · `bmad`,
  same guarantees for all (a NEW feature, the source only read and inside the project, mapping + warnings, the localized
  "Imported from" note, tracks auto-classified unless given; nothing dropped silently — what no mapping takes goes to
  design.md (plan / ExecPlan) or requirements.md (PRD), or into a warning).
  - `plan` — a Claude Code plan-mode file (plansDirectory defaults to `~/.claude/plans`, OUTSIDE the project — the refusal
    says to copy it in or point plansDirectory inside) or a Cursor `.cursor/plans/*.plan.md` (front matter name / overview /
    todos): goals and acceptance-like bullets → US-1's criteria (EARS when they already read like one, else
    `[NEEDS CLARIFICATION]`); checklists, else Cursor todos, else a Steps / Implementation section's items (an Approach / Abordagem / Enfoque section
    only when there is no other), else its
    sub-headings → tasks keeping state; file paths a step names → `_Implements:_` (`planPaths()`: never a URL, absolute or
    home path, `..`, alias, glob; `:line` / `#L10` dropped); the rest → design.md. A folder holding several plans is
    refused (name the file).
  - `execplan` — a Codex ExecPlan (PLANS.md): Validation and Acceptance → criteria; Progress (state kept) + Concrete Steps
    → tasks (deduplicated), a step naming a check command → `_Verify:_`; Decision Log → design.md `## Decisions` (D-1…);
    Purpose → summary; living sections → design.md verbatim.
  - `bmad` — the PRD (`docs/prd.md`, sharded `docs/prd/`, v6 `_bmad-output/planning-artifacts/`) FR / NFR lines → FR-n /
    NFR-n; epic stories + story files (`docs/stories/*.md`; the file wins over the PRD's copy) → US-1…US-n in story order,
    their ACs → US-n.AC-m; Tasks / Subtasks → `[USn]` tasks with `(AC: 1, 3)` → `_Requirements:_`; architecture + Dev
    Notes → design.md. One story file imports one story.
- **Flows:** `.state.json → flow: "design-first"` (`spec_create {flow}` / `create --flow`; changed with
  `spec_feature {action: "flow"}` / `feature flow <name> <flow>` — approved phases stay approved, pending gates follow the
  new order) orders the chain classification → design → requirements → test-plan / eval-plan → tests → tasks
  (`DESIGN_FIRST_PHASES`, `phaseOrder()`, `flowIndex()` swaps the requirements/design slots). Every reader of the order
  goes through it: `gateWalk` / `pendingGateList` (next_action, doctor, approve's phase-order check, the fast-forward),
  `detectPhase`, `chainArtifacts` (the placeholder gate's phase scoping), next_action's failing-check filter, the roadmap
  percent and spec_upgrade's status. The design gate of a design-first feature never reads the requirements; doctor
  defers AC traceability and the requirements' own checks while requirements.md is still a later phase's template. No
  flow / `requirements-first` = the default order. Any kind but a plain feature (bugfix, spike) ignores the flow
  (`flowOfState()`; spec_create says so, spec_feature refuses it).

## Undo, revoke, waivers, MCP-only gates (1.16 U)
- **Undo a tick** — `completeTask(…, {undo, reason})` → `untickTask` (`spec_complete_task {undo}` / `dev-spec undone <f> <n>
  [--reason]`), under the feature lock: it resolves the TICKED task of that number — several ticked tasks sharing it are
  refused, nothing changed (`duplicateTicked` + `tasks` [{number, line, text}]: which tick was the mistake is unknowable —
  done ticks the first OPEN one; renumber first); `.state.json` is written first
  (the evidence record `stale: true` + `staleBy: "undo"` — a re-tick needs a new run; `ticks[n]` dropped unless another task
  of that number stays ticked; `unticks` `[{n, at, reason?}]` appended), then tasks.md (CRLF / BOM kept). Evidence with
  `undo`, or a `reason` without it, is refused (CLI: `undone` refuses `--evidence` / `--exit` / `--cmd` / `--run` the same
  way); an open task → ok + `alreadyOpen`. Never gated (the bugfix gate refuses
  ticks only). `changesSince()` reads `unticks` (kind `untick`): a finish / execution sign-off older than an untick is
  stale. `reasonInput()`: one line, ≤ 500 characters.
- **Undo and `_Expect: fail_`** — `redProof()` reads through `staleBy: "undo"` (never a plain `stale`): an undo changed
  neither the spec nor the test, and once the fix is in the red run can't be made again (the task was stuck on
  `unexpected-pass`). The record still reads `stale-evidence` until a new run; the passing re-tick is the fix going green
  (`passAfterRed`, the red run carried as `red`). The undo answers `redKept: true` + `undo.redKept` (the red run is kept) in
  place of "a new run is needed". An edited `_Verify:_` no longer matches the record (`ownRecord`): no proof. `spec_impact
  --reopen` keeps its rule (stale without `staleBy`: the spec changed — the updated test must fail again). Observed mode is
  unchanged: `observedProof()` reads the kept red run's own stamp.
- **Revoke** — `revokeApproval()` (`spec_approve {revoke, reason}` / `approve --revoke`): removes `approvals[p]` and
  `signoffs[p]`, appends `{phase, at, by, revoked: true, reason?, role?, roles?, approvedAt?, wasForced?, partial?}` (no
  snapshot; pre-history approvals are seeded as legacy records first), never cascades (`laterApproved` stay approved — the
  revoked phase is pending again, so approving a later one is refused on `phase-order`). Refused with force / expires /
  through, and for a phase that isn't approved (`notApproved`). **Every reader of approvalHistory filters through
  `isApprovalRecord()`** — never `partial !== true` alone (a revoked record is no approval). The approval guard reads a
  revoke as an approval action (`revoke: true`; the human's command is `approve … --revoke`). `changesSince()` also emits
  each revocation newer than t (`{kind: "revoke", phase, at}` — a record that removed an approval, never `partial`, never of
  the `except` phase = `execution`), so a finish / execution sign-off older than it is stale (drift verdict `stale`,
  `revoke.driftWhy` in the CLI line; `revokedSinceList()` drops a phase re-approved since — it reads "re-approved"). The
  catalog's `finished` also needs no pending gate (`pendingGateList`, existence checks only): SPECS.md reads ☑ complete.
- **Waivers** — `force` + `reason` / `expires` (`waiverInput()`: `YYYY-MM-DD` from today up to 3650 days, or `Nd`) →
  `waiver {reason?, expires?}` on the approval, its history record and role sign-offs; either without force is refused, a
  gate that passes answers `waiverIgnored`. `waiverView` / `forcedApprovalList` / `strictestWaiver`: doctor warn
  `waiver-expired` (feature and spike doctors), the ROADMAP.md forced-approvals line (EXPIRED flagged), `spec_finish`
  `waivers` `[{phase, failing, reason?, expires?, expired}]` + a warning when expired + the merge summary's "Waived gates".
  Metrics count `revokedApprovals` and `untickedTasks`.
- **MCP-only surfaces** — `spec_stop_check {message, agent?}` = `stopCheck()` (the same decision as `dev-spec stop-check
  --json`); `spec_log {name, gitLog, max?}` = `taskCommits()` over git log TEXT the client supplies — the server still never
  runs git or any command (`dev-spec log` keeps running git itself; `log <f> - --max N` passes the window too). An empty
  `gitLog` (a repository without commits → 0 commits) and an empty `message` (→ `no-claim`) are values, not missing
  arguments: server.js `EMPTY_OK` exempts them from `missingArgs`' blank-string rule (the CLI accepted them already).

## Claude Code integration (1.16 C)
- **Status line** — `statusLine(dir, {columns})` / `statusLineProject(dirs)` (walks up at most 40 folders to the nearest
  dev-spec `.specs/`; reads each active feature's `.state.json` + tasks.md, ≤ 200 features; picks the most recently active
  feature with work under way, else the most recent). The step follows next_action's order but stays cheap — it runs the
  pending phase's approve checks, never the doctor, a code scan or the drift hash (`statusNext()`; review fixes): a spike
  takes next_action's own steps (fill · implement · blocked · decide — the decision, then its `_Outcome:_` · promote /
  archive / pivot); Phase 4 goes through `statusTestsGate()` (+ai's eval-sets check; +tdd answered only when provable
  without the walk — no planned T-ID → fix, every planned T-ID in a test FILE its plan row names, ≤ 20 files read → approve,
  else `tests`); once every phase is approved, a FORCED approval is re-checked (`approvalChecks` minus the checks the doctor
  only warns about, `STATUS_DOCTOR_WARNS`) and a bugfix with bug.md → Root Cause empty → `fix` (file bug.md — never a task the
  bugfix gate refuses); every task done: verify (a tick) → finish (no baseline, or `staleFinish(…, {newFiles: false})` →
  `again`) → verify (`suiteStatus(…, null)`: the project checks without the code hash → `suite`) → sign-off (execution
  missing, or `executionSignOffStale` → `again`) → finished (never "✓": drift is not checked). Step codes (stable): re-review ·
  fill · fix · approve · tests · tasks · implement · blocked · verify · decide · promote · archive · pivot · finish · sign-off ·
  finished — next_action's own except blocked → fix, tests → fix | approve, sign-off / finished → finished, and any end
  state may be next_action's `drift` (mcp/test.js "1.16 C review (parity)" checks 27 states). A network path (`isNetworkPath`,
  the engine's — server.js uses it too) is skipped before any fs call (a UNC cwd hung it for minutes). `dev-spec statusline` renders
  BEFORE any flag check (a status line must never print an error): exit 0 always, stdin capped, silent outside a project,
  cut to `$COLUMNS`, `--json`; `--print-config` prints the `statusLine` entry with this clone's absolute path (a note when
  it is a versioned plugin-cache copy). A plugin cannot ship a status line (plugin `settings` honour only `agent` /
  `subagentStatusLine`), hence the opt-in `/spec-statusline`.
- **User defaults** — the environment variables `DEV_SPEC_DEFAULT_LANG` / `DEV_SPEC_STOP_CHECK` / `DEV_SPEC_GUARD_DEFAULT`
  (`userOptionRaw()` → `userDefaults()`), FALLBACKS only: project meta always wins; empty, invalid or unexpanded (`${X}`)
  changes nothing. `newProjectLang()` only for a brand-new project (no meta.lang, no feature — active or archived), seeded
  by `seedProjectLang()` under the roadmap lock; `spec_init` reports what a variable decided in `userDefaults`, and so do
  spec_create and spec_import (whose own text — warnings, design.md headings — follows `configuredLang()` too);
  `init --stop-check on` writes meta when DEV_SPEC_STOP_CHECK says off. The guard and stop hooks read the same names raw
  (their cheap pre-checks). A roadmap.json that doesn't parse: DEV_SPEC_STOP_CHECK still decides (engine and hook), the
  guard stays off. DEV_SPEC_GUARD_DEFAULT reaches a dev-spec `.specs/` without roadmap.json (`isDevSpecDir` — steering/ or a
  feature's .state.json; the hook's `devSpecWithoutRoadmap()`), never a folder without `.specs/` nor another tool's. **Never plugin.json `userConfig`**: it opens a configuration dialog on every install / enable,
  reaches neither the Bash tool (the CLI) nor other MCP clients (Claude Code exports `CLAUDE_PLUGIN_OPTION_*` to hooks
  only), and an older Claude Code validating option fields strictly could refuse the whole plugin. Claude Code's
  settings.json `env` block reaches the hooks, stdio MCP servers and the Bash tool alike (code.claude.com/docs/en/env-vars).
- **MCP** — every tool carries `annotations` from server.js `TOOL_ANNOTATIONS` (`READ_ONLY` for the 14 tools no argument
  makes write; `destructiveHint` only on `spec_feature`; `idempotentHint` per tool; `openWorldHint: false` everywhere —
  the protocol's defaults are the opposite, so all are explicit); mcp/test.js requires one entry per tool and snapshots
  `.specs/` around every read-only one. `completion/complete` (prompts-resources.js `complete()`): feature slugs for a
  prompt argument that names a feature, the `specs://` template variables `slug` / `artifact` / `file` (≤ 100 values,
  prefix then substring); an unknown prompt / template / argument / ref → -32602; with prompts off `ref/prompt` → -32602.
- **Plan-mode bridge** — `spec_import {tool: plan | execplan, text}` (`TEXT_IMPORT_TOOLS`; server.js `REQUIRED_ONE_OF`:
  `path` or `text`) = the file import minus the source note (`inline: true`, `source: null`); CLI `import plan -` (stdin)
  or `--text` (a word after the tool that is no track list, given with `--text`, is passed as the path: the engine's "path or
  text, not both"). `hooks/plan-hook.js` (PostToolUse, matcher `ExitPlanMode`): one line of `additionalContext` in a dev-spec
  project, silent and exit 0 otherwise (the payload is undocumented — `tool_input.plan` and a plan-file path read
  defensively); a network cwd is skipped before any stat (an inlined `isNetworkPath`).

## Spec quality (1.16 Q)
- **Steering amendments** — `approvePhase` records `steering` {file: sha1} on a requirements / design approval and its
  history record (`STEERING_GOVERNED`; `governingSteering()` = constitution.md + the active tracks' steering files (a track
  pack's too) + `inclusion: always` files + `fileMatch` files matching the feature's `_Implements:_`; `steeringFingerprints()`
  — CRLF / BOM are encoding). `steeringChanges()` → stable codes `modified` | `removed`. Doctor warns
  `steering-changed-since-approval` (+ `steeringChanged` [{phase, approvedAt, files}]); next_action appends
  `quality.naSteering` to its step — never a step of its own. `spec_impact {phase: "steering"}` → `steeringImpact()`: name
  optional (the MCP schema has no `required`; the engine refuses a missing name for every other phase), read-only (`reopen`
  refused), `untracked` = approvals without `steering` (pre-1.16 — never flagged).
- **Cross-feature criteria** — `crossFeatureAcs(projectDir, {only})` over `xacTable()` (memoized per read-cache scope in
  `XAC_MEMO`, dropped by forgetCached / invalidateReadCache): active plain features only (no bugfix / spike). A criterion's
  shape = accents folded, lower-cased, `XAC_STOP` (EN/PT/ES stop words + EARS keywords) out, `xacStem`, numbers apart
  (1,000 = 1000; 0,5 = 0.5), polarity by `RE_XAC_NEG` (SHALL NOT / NÃO DEVE / NO DEBE / never), trigger = the words before
  the modal. `near-duplicate`: similarity ≥ 0.8, same polarity, same numbers; conflict: ≥ 0.7 with triggers ≥ 0.5 alike —
  `opposite-modal` | `different-numbers`. Never compared: a criterion with a template slot left or < 3 words, any
  built-in / track-pack / project template criterion's words (`builtinTemplateAcs()`, `projectTemplateAcs()`, and two light
  edits of one), criteria retired by a shipped `_Supersedes:_`, declared pairs (pending ones too). Candidates from a
  prefix-filter inverted index (exact for the threshold); caps 4000 criteria / 200k comparisons / 200 pairs. Doctor warn
  `cross-feature-acs` (names the other feature's AC), `spec_catalog.crossAcs` {pairs, truncated}, a SPECS.md section when
  a pair exists, agents/spec-critic.md.
- **Glossary** — the steering stub `glossary.md` (steering_scaffold; init never creates it): `- **Term** — definition.
  _Avoid: a, b_` (`_Avoid:_` English-stable, same line or a sub-line). `glossaryEntries()` / `glossaryHits()` (terms masked
  before the avoided words are searched — "End user" never reads as "user"; code, comments and `_Marker:_` tags skipped;
  ≤ 300 entries × 20 words, ≤ 200 hits) / `briefGlossary()` (≤ 8 entries / 1500 characters; `refs.glossary` with write).
  Clarify asks one question per avoided word with file:line (≤ 10) + `glossary`; doctor `glossary` (warn with the count).
- Messages: `i18n.msg(l).quality` (QUALITY_MSG). CHECK_PHASE: glossary 1, cross-feature-acs 1,
  steering-changed-since-approval 2.

## Exports and planning (1.16 E)
- **Formats** — `EXPORT_FORMATS` = html · md · csv · gherkin · jira · linear (server.js reads its enum from there).
- **Gherkin** — `gherkinFeature()` (the matrix — `buildTraceMatrix` — gives the planned T-IDs and the supersession state):
  `# language: en|pt|es` first (pt-BR → pt), then the AUTO-GENERATED marker as a `#` comment; Feature tags = the tracks
  (marker without brackets, else the name) + `@bugfix`; one Scenario per current AC tagged with its ID, T-IDs and track
  marker; template ACs and ACs a SHIPPED feature retired are left out with a comment, a draft's pending supersession is
  kept with one. `earsSteps(raw, lang)` is THE EARS → steps splitter and never drops a character: WHILE / WHERE / IF →
  Given, WHEN → When, the SHALL response → Then; quoted and code spans never split a clause; only English keywords plus the
  feature's own language count ("SI units" is no condition); a criterion that can't be split cleanly — a response with no
  subject before its modal included ("WHEN x, the cart, …, SHALL be kept", on the comma path too) — is one `Then` with its
  whole text (`unsplit`). Markup: `ghStripEmphasis()` drops only PAIRED emphasis runs (`**WHEN**`, `*WHEN*`, `_WHEN_`;
  flanking rules, an opener never after a letter / digit, a closer never before one; code spans opaque; linear) — `2**n`,
  `a_b_c`, `2*3*4` stay; characters before the first keyword (`(WHEN …`) lead its step. A fuzz test (mcp/test.js "1.16 E
  review m5") checks no character is lost. Dialect keywords are Gherkin tokens, so they live in spec.js `GHERKIN_DIALECT`,
  not i18n — `keywords` holds EVERY en / pt / es keyword of gherkin-languages.json (compare with cucumber/gherkin when
  adding a language; never vendor it), and `ghRiskyLine()` labels a summary line starting with any of them (block keyword +
  ':', step keyword + space, '*', a tag / comment / table / doc string). A named spike is refused (`spike: true`); no name →
  one `.feature` per active feature (`documents`), written all-or-nothing.
- **Tracker CSV** — `trackerRecords()` / `trackerCsv()` (the F5 `csvCell` / `csvRecord`: RFC 4180, the formula guard, a
  BOM): Jira `Work item ID · Work type (Epic / Story / Sub-task / Task) · Summary · Description · Status · Parent · Labels…`
  (one label per repeated column), Linear `ID · Title · Description · Status · Estimate · Labels · Parent issue` (local keys
  `<slug>`, `<slug>/US-n`, `<slug>/#n`; a duplicated task number's later occurrences `<slug>/#n (2)` — every key unique);
  parents first. Jira's Work item ID is the record's row number; a Parent names the FIRST record with that key. The
  AUTO-GENERATED marker is the LAST HEADER CELL (an empty column to leave unmapped) — a trailing record would become a
  work item.
- **Milestones** — `roadmap.json → meta.milestones [{name, date, features, archived?}]` (`spec_milestone` / `dev-spec
  milestone` / /spec-milestone), under the roadmap lock; `milestoneStore()` sanitizes — an entry is valid only as add writes
  it (a name `RE_MILESTONE_NAME` accepts — letters of any script with their marks —, a date `isoTime` accepts as a real
  day, feature lists of slugs, one entry per identity; a hand-edited roadmap.json reaches ROADMAP.md / .html, where every
  stored value still goes through `cell()` / `htmlEsc()`); a malformed list is refused by add / rm and read as its valid
  entries otherwise, and `list` / `findMilestone` return `roadmapError()` for a roadmap.json that doesn't parse. A name ≤ 60
  characters, ≤ 50 milestones × 200 features. IDENTITY = `milestoneKey()` — NFKC, lower-case, Latin accents folded,
  separator runs (space _ - . : # ( )) as one '-', every other letter / digit / mark / '+' kept ("Sprint α" ≠ "Sprint β",
  "C" ≠ "C++"; never the slug, which collapsed them); the FILE name is `milestoneFileKey()` — the slug when it equals the
  key (1.16.0's names keep their file), else slug (or `milestone`) + 8 hex of the key's sha1, hashed too when another
  milestone would share it. Features: a list's items split on commas only ("User Login" is one name), a single string on
  whitespace too (spec_depend's resolution). Adding an existing name updates date + features and keeps its `archived` list
  minus the slugs listed again. `milestoneStatuses()` (inside `roadmapExtras`) → stable codes `on-track` · `at-risk` (reasons
  `eta-after-date` · `eta-unknown` · `no-features`) · `late` · `done` + `eta`, `unknownEta`, `done`, `total`; ROADMAP.md /
  .html get a table between Features and Dependencies and late / at-risk attention lines. `milestonesFollow(rm, slug,
  rename | archive | remove | restore)` runs from `pruneRoadmapRefsLocked` (4th argument `archived`; returns
  `milestonesUpdated`) and restore (`restored.milestones`): an archived feature moves to the milestone's `archived` list
  (its notes still cover it). `spec_changelog {milestone}` → that milestone's features + its archived ones, `since`
  defaulting to `all`, written to `RELEASE-NOTES.<milestoneFileKey>.md` without stamping `meta.changelogAt`
  (`changelogData(…, only)`).
- CLI: switches `revoke`, `print-config`, `gherkin` (`spec.CLI_SWITCHES`); value flags `reason`, `expires`, `text`,
  `tracker`, `milestone`.

## Conventions & gotchas
- **Every name-taking op resolves its folder through `resolveFeature()` / `existingFeature()`** —
  never `path.join(specsRoot, slugify(name))`. An empty slug (non-Latin names, `...`, `undefined`)
  used to resolve to `.specs/` itself, so `spec_feature remove` deleted every spec (the v1.11
  Critical). The resolver also rejects the reserved slugs (`steering`; since 1.14 `templates` / `exports` too, since 1.15
  `tracks`, each with the pre-existing-feature exception — see Project templates) and Windows device names (`nul`, `con`, `com1`…),
  transliterates accents (`Autenticação` → `autenticacao`) and falls back to the pre-1.11 slug
  (`autentica-o`) so old folders are still found. `slugify(undefined)` is `""`, never `"undefined"`.
  `listFeatures` skips dot-folders and non-slug folders (reported as `ignored`).
- **`spec_feature remove` needs `confirm: true`** (CLI `--yes`). Without it nothing is deleted and the
  result (an error with `needsConfirm`) lists what would be — `removePreview()` checks roadmap.json first
  and uses `lstat` (a symlink/junction is one entry, never followed). Prefer archive (reversible).
- **JSON state is read with `readJson()` and written atomically (`writeFileAtomic`)**. A
  `roadmap.json` / `.state.json` that exists but doesn't parse is an ERROR every mutator returns
  (`roadmapError()`, `state.invalid`) — never "repaired" into `{}` (that erased deps, backlog,
  approvals and `meta.lang`). **Valid JSON of the wrong shape is refused the same way:** `readState()` checks
  the top level, `approvals`/`evidence`/`finishChecks`/`signoffs` (objects), `tracks`/`approvalHistory`/`changes`/`unticks` (lists);
  `loadRoadmap()` checks `features` and each entry, `dependsOn` (string lists), `meta`, `backlog`. Readers get
  a sanitized copy; every mutator refuses BEFORE its destructive step. A leading BOM is tolerated.
  `writeIfAbsent` uses `flag:"wx"`. `writeFileAtomic`'s temp file never outlives the call: when the rename and the
  plain-write fallback both fail (read-only / locked target on Windows, a folder at that path) it is removed before
  the error is thrown — the best-effort refreshes swallow that error, and used to leave a `<file>.<pid>.<ts>.tmp`
  in `.specs/` per call. On Windows an EPERM/EACCES/EBUSY rename is retried briefly (a scanner's lock). tasks.md
  ticks go through it too (a reader never sees a truncated tasks.md).
- **Feature mutators hold a cross-process lock** (`withFeatureLock` / `featureLocked` in the exports):
  `completeTask`, `approvePhase`, `appendTasks`, `addTrack` / `removeTrack`, `impactReport` with `reopen`,
  `finishFeature` with `write` or `evidence` (finishChecks), `decide`, `manageFeature`'s `flow`, `taskBrief` / `metrics` with `write` (a derived file written into the feature folder is a
  write: resolved before a rename and written after it, the brief recreated a zombie `.specs/<old>/.execution/`), and
  `createFeature` re-run on an EXISTING feature (it adds tracks through
  `applyTracks`, spec_add_track's path — a NEW feature has no folder to lock). Two MCP servers (or MCP + `dev-spec done`)
  on one feature each read tasks.md + `.state.json`, wrote the whole file back and the last writer won — ticks and
  evidence were lost while both answered ok. The lock is `.specs/<feature>/.lock` (holds `{pid, host, at, token}`; created by
  `acquireLockFile()`: the note is written to a temp file hard-linked into place — `linkSync` fails with EEXIST like O_EXCL —
  so the lock never exists without its note; where hard links are unsupported it falls back to the O_EXCL create + write, and
  `staleLock()` treats a noteless lock older than `LOCK_NOTELESS_STALE_MS` (5 s) as stale — a process killed in the old
  create→write window left an EMPTY lock that blocked the feature for 2 min), re-entrant in one process; waiters retry for `DEV_SPEC_LOCK_WAIT_MS` (default 10 s), then get
  `{ok:false, busy:true, error}` (`err.featureBusy`, localized) with nothing changed. A lock taken while this process already
  holds another (`LOCK_DEADLINE`: a folder move's roadmap lock inside its feature lock) waits only for the outer acquisition's
  remaining budget, at least `LOCK_NESTED_MIN_MS` — nested waits could add up to twice the wait. A dead holder's lock (same host)
  is reclaimed at once, any other after 2 min (10 min while its pid still runs). **Mutual exclusion rules** (each one
  lost updates under contention while every call answered ok): a lock that can't be stat'ed is NEVER stale (it was
  just released — retry the create); a stale lock is removed only by `reclaimStaleLock()` — under `<lock>.reclaim`
  (O_EXCL) and only while the file is still the one judged stale (`lockSnapshot`: note + ino/mtime/size), so a
  waiter can't delete the NEXT holder's fresh lock; a holder releases only the lock carrying ITS token
  (`releaseLock`, also after a folder move). A stale lock that can't be removed (a handle without delete sharing, a
  read-only folder, a directory named `.lock`) waits like a held one and ends in `{busy, stuck: true}`
  (`err.lockStuck`, "delete it by hand") — never a `continue` that skips the deadline and the sleep (it spun at 100%
  CPU forever and froze the MCP server). A multi-process counter test guards all of this. Where no lock file can be
  created (read-only folder) the op runs unlocked. **Folder moves** — `manageFeature` rename / archive / remove, and restore
  (on `.specs/_archive/<slug>/.lock`) — run under `withMoveLock`: never while another process holds the lock (it moved
  the folder away mid-write: the writer's next `writeFileAtomic` recreated a zombie `.specs/<old>/`, and ticks landed
  in one folder, the spec in the other); the lock file travels with the folder and is released at the NEW place
  (`releaseLock` with the acquisition's token — left there it kept the renamed feature "busy" while its holder lived). Folders move through
  `moveDirOrBusy()` → `renameDirSync` (Windows EPERM/EACCES/EBUSY retried ~1.4 s — the lock is held — then the localized
  `err.folderInUse`, `{busy, inUse}`; 60 ms of retries answered a raw EPERM under contention). **remove** renames the folder
  to a dot tombstone `.specs/.removing-<slug>-<rand>/` FIRST (its .lock inside) and deletes it there: `fs.rmSync` in place
  deleted the folder's .lock early while the folder still existed, a waiter created a fresh lock in the half-deleted folder
  and wrote into it — the removed feature came back (.state.json, .history/) after an ok remove. Dot folders are never
  features (list / roadmap / catalog / drift skip them, the hook exits for `/.specs/.removing-`); `sweepTombstones()` deletes
  a leftover one older than 60 s on the next remove. **`roadmap.json`** read-modify-writes (depend, backlog add/rm, `pruneBacklog`,
  `pruneRoadmapRefs`, restore, init `--lang`/`--guard`/`--stop-check`/`--check`/`--roles`, roadmap `--lang`, changelog
  `--write`'s `meta.changelogAt`) hold `.specs/.roadmap.lock`
  (`withRoadmapLock`, `err.roadmapBusy`; it forgets only roadmap.json from the read cache). Lock order: a feature lock,
  then the roadmap lock — never the reverse; the ROADMAP.md refresh runs after both are released. Internal calls use
  the unwrapped functions. **The lock files are git-ignored**: `ensureLockIgnore()` keeps `.specs/.gitignore` holding
  `.lock`, `.lock.reclaim`, `.roadmap.lock`, `.roadmap.lock.reclaim`, the temp files a killed process leaves
  (`*.[0-9]*.[0-9]*.tmp` — writeFileAtomic's `<file>.<pid>.<ts>.tmp` and the lock note's) and `.removing-*/` (unanchored — every
  feature folder and `_archive/`),
  called by init, create and `withLockFile` BEFORE the lock is created; an existing file only gains the missing lines
  (its EOL kept), and it never creates `.specs/` itself. A lock leaked by a killed process was committed by `git add -A`
  and made the feature "busy" on every clone (fresh checkout mtime, foreign host → no pid probe).
  **Known limits (documented, not fixed):** pid liveness is probed only when the note's `host` is this machine's hostname —
  two machines (or WSL and Windows) sharing one hostname on a network folder can probe the wrong process table (a live
  holder read as dead → its lock reclaimed; a dead one read as live → the feature waits `LOCK_MAX_HOLD_MS`); give them
  distinct hostnames. `rename` rewrites `_Supersedes:` lines in OTHER features' requirements.md under the renamed feature's
  lock and the roadmap lock only — not those features' own locks (taking them there would break the feature-then-roadmap
  lock order); a concurrent edit of one of those files can lose that one line change.
- **Generated roadmap files carry the `AUTO-GENERATED by dev-spec` marker (EN/PT/ES, `RE_AUTOGEN`)**.
  `writeRoadmapMd/Html` skip a same-named file without it — the hooks run in every project; `spec_roadmap`
  returns a refused ROADMAP.md write as an error (a kept hand-written ROADMAP.html is a warning). The
  roadmap chrome language is `meta.roadmapLang`; `meta.lang` is the project language and only `spec_init`
  sets it. The other generated files — `SPECS.md`, `UPGRADE.md`, `RELEASE-NOTES.md`, `.specs/exports/*` — use the same
  marker family and `isGeneratedOrAbsent()`: a hand-written file of that name is never overwritten.
- **`spec_depend`**: `dependsOn` REPLACES the list (`[]` / CLI `--clear` clears), `add`/`remove` (CLI
  `--add`/`--rm`, repeatable) edit it, `name` alone is a read (a bare `dev-spec depend <f>` used to clear the
  deps). Every dependency must be an existing feature.
- **Approvals record a content fingerprint** of the phase's artifact (`artifactFingerprint`; tasks.md
  with checkboxes normalized). `next_action` compares each artifact with ITS OWN approval — ticking a
  task is progress, not a spec edit. CRLF and a leading BOM are encoding, not content (`textFingerprint`): a
  "UTF-8 with BOM" re-save is no change. Compare through `fingerprintMatches` / `artifactMatches`, never `!==` —
  they also accept a fingerprint recorded (before the BOM was ignored) over a BOM-prefixed file.
- **Pending gates walk `PHASES` in order** (`specDoctor` → `pendingGates`, which next_action / finish / gatesOk read):
  a phase is due once the file `phaseFile(ph, kind)` names exists — a bugfix's `design` gate is `bug.md` (it used to
  look for design.md, so it was never asked for) — and Phase 4 `tests` (no artifact) via `testsGateDue()`: +tdd with
  test-plan.md or +ai with eval-plan.md, never a bugfix (its failing regression test is a task). `phaseActive('tests')`
  is tdd||ai. **Approving `tests` checks what Phase 4 produces** (`approvalChecks`): +tdd `tests-in-code` — every
  planned T-ID named by a test file (trace_check's code scan); +ai `eval-sets` — evals/golden.json is a set of the
  feature's own (not the scaffold's sample, not empty). Nothing to approve on a core-only feature. next_action keeps
  the Phase 4 wording (`/writeTests`) plus what the gate checks — but on an executing / complete feature (tasks ticked,
  e.g. an upgraded 1.12 one) it uses `next.signOffTests` (a sign-off for the tests that exist, never "failing tests
  first, no implementation code"). **Approving `execution`** runs spec_finish's blockers
  (`finishFeature(…, {gateOnly: true})` → stable ids `doctor`, `root-cause`, `placeholders`, `changed-since-approval`,
  `tasks`, `open-tasks`, `verification`, `approval-gates`, `suite-evidence` with meta.checks; a spike: `spike`, `decision`);
  otherwise only `force` records it. spec_metrics' `finished`
  = the earliest of the first execution approval and `state.finished.at` (spec_finish {write} on a ready feature).
- **Rename follows every reference** (`renamePlan`, computed BEFORE the folder moves so the old slug still resolves,
  written after): roadmap.json dependsOn, `_Supersedes: <old>/…_` markers in other features' requirements.md (active
  and archived; never one in a comment/fence), and archived features' `.state.json → archived` records. A broken
  archived state file that names the old slug refuses the rename.
- **EARS context**: the loose heuristics (numbered item that "reads like" a requirement, lowercase
  `deve/debe`) apply only under an Acceptance Criteria heading or in heading-less snippets; elsewhere a
  criterion needs SHALL / capitalised DEVE·DEBE / "sistema deve", a stable ID or a CAPITALISED EARS
  keyword. Word boundaries are unicode (`(?<![\p{L}\p{N}_])`) — JS `\b` never matched `DEVERÁ`. Stable IDs
  include `EC-n`, `NFR-n`, `SC-nnn`; a deeper sub-list continues its parent criterion.
- **Mandatory sections**: `extractSection(md, syn, marker)` prefers the heading carrying the track
  marker (`[SaaS]`/`[AI]`), skips fenced code, **never matches the H1 title** (it carries the feature name)
  and requires the synonym to START the heading (after marker / numbering / "Section N:" / an emoji), word-bounded; a
  track section also accepts an English inflection of its name (s / es / ing — "Threat Modeling").
  "Unfilled" = the `> **TODO**` sentinel is still there OR the body is empty. `spec_status` reports each
  section as present + filled (CLI ✓ filled · ◐ unfilled · ✗ missing).
- **AC/test IDs**: `US-<n>.AC-<n>` and `T-<n>`. Extraction uses a lookbehind guard, NOT `\b` —
  markdown italics (`_US-1.AC-1_`) make `\b` fail because `_` is a word char. Don't reintroduce `\b`.
  A test-plan row covering an AC requirements.md doesn't define is a gap (`phantomAcsInTests`, +tdd; fenced examples
  excluded), like a phantom AC in tasks — doctor fails and the test-plan approval is refused. Every reader of
  test-plan.md's IDs goes through `planIdText()` (comments AND fenced code out): coverage, planned T-IDs, the code
  scan, the Phase 4 gate, doctor, finish, `testIndex` / `testPlanEntries` — a fenced example row covered its AC (a
  false pass) and planned a T-ID the tests gate demanded. A scaffolded test plan
  only gets the template rows of the track ACs requirements.md has (`testPlanTracks()`, shared by spec_create on an
  existing feature and spec_add_track — a track added after the requirements brings none).
- **Secondary IDs are trace WARNINGS, never the verdict**: EC-n / NFR-n need a task or (+tdd) a test-plan
  row, SC-nnn a test-plan row or a real quickstart.md line; compared by number (`SC-1` = `SC-001`); untouched
  template rows don't count. `warnings` = `[{kind, items}]`, excluded from `traceGaps()`.
- **`trace --code` T-ID convention:** a test names its T-ID — `T-01` anywhere (`test("T-01 …")`), or without
  the hyphen an uppercase `T` + zero-padded number (`test_T01_…`, `testT01`, `TestT01`, `T01_…`) — see
  `RE_CODE_TID`. The scan (`scanTestCode()`) is bounded and read-only; a plan row whose File column names a
  concrete test path counts only in that file/folder; another feature's `.specs/<f>/tests/` never counts; a test file
  ANOTHER feature's plan (active or archived) names in its File column — and this feature's plan does not — never counts
  for this feature's T-IDs (T-IDs restart at T-01 in every feature: a new feature's Phase 4 gate passed on another
  feature's tests). A folder token (`test/`) scopes rows but claims no file, and a claim is the EXACT project-relative path (a suffix match
  made `tests/test_api.py` own a monorepo package's `services/beta/tests/test_api.py`).
  A T-ID whose EVERY row names only non-code artifacts in its File column (`load-test.md`, `evals/*.json`, a
  `.feature` — any extension outside `GUARD_CODE_EXT`) is run outside test code: `plannedOutsideCode`, never
  `plannedNotInCode`, so neither doctor, finish nor the Phase 4 gate expects it in a test file (the scaffold's own
  load/eval rows warned forever). A code path outside a test folder, a template slot or a row without a File cell
  keeps the T-ID expected. Doctor's `tests-in-code` warns only for T-IDs made green by DONE tasks.
- **`_Implements:_` of an OPEN task is the plan**: a missing file only named by open tasks is
  `plannedImplFiles`, not a gap; a done task's missing file (or any path outside the project) stays
  `missingImplFiles`. `spec_coverage` = code files named in any `_Implements:_` (file, folder or glob) of any
  feature, active or archived. Every reader resolves a reference through `implementsPath()` (`:12` / `#L12` anchors
  dropped) — trace_check included, reporting the spelling the task wrote; an anchor alone names nothing (missing).
  Comparisons go through `implementsRel()` (+ backticks, `./`, trailing `/`) / `implementsKey()` (+ FOLD_CASE):
  `next --batch` (a shared file — or a folder and a file under it — ends the batch) and the brief's design sections.
- **`earsValidate` is criterion-based, never line-based.** EARS phrasing (`ENQUANTO … QUANDO … O
  SISTEMA DEVE …`) wraps past one line, and markdown list items continue across lines (indented or
  lazy). `criterionBlocks()` folds physical lines into logical criteria FIRST — bounded by blank
  lines, headings, tables, HR and fenced code (fence *state* is tracked, so `const shall = 1` inside
  ` ``` ` is code, not an AC) — and only then lints each joined criterion. A comment-only line does
  **not** split a criterion. Issues report the criterion's start `line` (plus `endLine` when it spans
  several) and a stable `code` (`no-modal`/`no-id`/`vague`/`placeholder`/`no-keyword`/`needs-clarification`). Every unit
  that DEFINES an AC is its own criterion for the linter: an ID-led line or checkbox item, a heading led by an AC ID (its
  body absorbed) and a table row with a cell that is exactly an AC ID (under an Acceptance Criteria / story heading, with no
  heading, or carrying a modal — elsewhere it is a summary table). Such a unit is a REFERENCE, never linted, when a list
  item defines that ID anywhere or an earlier unit already did (a Notes line "US-1.AC-2 depends on …", a coverage table),
  and outside an acceptance-criteria context a line or heading defines one only when it carries a modal verb or a
  capitalised EARS keyword. Doctor's `ears` FAILS (and the requirements approval
  is refused) when requirements.md defines AC IDs but no criterion was linted (`earsUnlinted()`, `earsNoCriteria`). The
  requirements.md save hook and the pre-commit validator call the same `earsValidate()`, so a table-row or heading AC
  without a modal is an EARS error there too.
- **Fences: one closer rule, `closesFence(line, marker)`** — every fence-aware reader (`stripFencedCode`,
  `criterionBlocks`, `designSections`, `headingIndex`, the placeholder scan, `mdListItems`, import, the task
  scanner's `fenceLine`) closes a fence only on a CommonMark closer: the opener's character, at least as long,
  nothing after it but spaces. Never `line.trim().startsWith(fence)` — it closed an open backtick fence on a line
  carrying an info string (a `js` opener), and requirements.md then read inverted (its ACs vanished from EARS and
  trace_check). `stripFencedCode`, `criterionBlocks`, `designSections`, `headingIndex` and the placeholder scan step
  through ONE helper, `fenceStep(st, line)`, which also applies CommonMark's list rule (the task scanner's too): a fence
  opened inside a list item (indented) ends with the item — a non-blank line less indented than its opener is outside.
  Without it one unclosed fence in a test-plan bullet blanked every row below it (no coverage, no planned T-IDs,
  phantoms in tasks.md). An unclosed TOP-LEVEL fence still runs to the end of the file.
- **Classifier signals are matched as WORDS, never substrings** (`keywordRe`, not `indexOf`).
  `indexOf` fired `claude` inside `.claude-plugin`, `rag` inside `sto·rag·e`, `sla` inside
  `tran·sla·te`, `auth` inside `auth·or` — and a phantom STRONG signal auto-enables a track, which
  then *hides* the negation the classifier computed for it. The regex allows inflections
  (`payment→payments`, `rate-limit→rate-limiting`), plural-only for ≤3-char acronyms (so `rag`+`ing`
  ≠ `raging`), `STEMS` for deliberate prefixes (`idempoten`, `hallucinat`, `summariz`, `alucina`), `VERB_STEMS` (a stem + its
  listed endings only — `encript`, `cifr`, `criptograf`: never "cifra"; the self-match sweep probes them by infinitive),
  and `-based/-powered/…` adjectives (`AI-powered`), while rejecting `-<letter>` compounds
  (`claude-plugin`) and dotted/slashed identifiers. `-<digit>` stays legal (`gpt-4`). When you add a
  keyword, add it to the self-match sweep's expectations if it needs a new suffix class.
- **Negation never vetoes a track**, it annotates it. "the system shall not hallucinate" negates
  `hallucinat` on a feature that is unmistakably `+ai`. So when a track is on *and* has negated
  keywords, `classify` emits a conflict note ("+ai is ON although 'llm' appeared negated") for the
  human who confirms Phase 0 — it must never silently drop a negation it computed.
- **HTML-comment stripping** (`stripHtmlComments`): `ears`/`clarify`/`doctor` (for `[NEEDS
  CLARIFICATION]`) AND `trace_check` (for AC/test IDs and `_Implements:_`) all strip `<!-- -->`
  first, so example markers in template-guidance comments don't count as real. Keep template
  examples inside comments. A `<!--` that never closes is plain text everywhere — ONE comment reader, `commentLines()`, serves
  `stripHtmlComments`, `criterionBlocks` and the placeholder scan (and `scanTaskLines` keeps its own): a `<!--` inside
  fenced code or an inline code span is text, and a comment opens only when a `-->` outside code follows it: a stray marker used to hide every
  criterion below it (EARS 0 criteria → pass, the requirements approval passed) while trace_check counted them.
- **Tasks: ONE scanner.** `taskBlocks()` (over `scanTaskLines()`) reads tasks.md like a markdown reader —
  HTML comments (a line-start `<!--` may span lines) and fenced code never hold tasks; `<!--`/`-->` inside
  code spans don't count. `parseTasks()` is its line-only projection (its shape is public through
  `spec_status`), so status/next/complete/brief/finish can never disagree. Task numbers are numeric (`01.` is
  task 1); `resolveTask()` picks the first OPEN task of a duplicated number (doctor warns `duplicate-tasks`);
  `completeTask` ticks exactly the resolved line at its checkbox column (CRLF kept). Tasks are
  story-organized (P1 first) with `[P]` parallel markers + `**Checkpoint:**` lines; the design's
  `Constitution Check` section is checked by `doctor`.
- **Roadmap files are generated, never hand-edited.** Default is **`ROADMAP.md`** (git-friendly,
  keeps the Mermaid graph); `ROADMAP.html` is opt-in (`html:true`, self-contained, zero-dep, brand
  palette + system-default light/dark toggle). `roadmapData()` is the shared computation;
  `renderRoadmapMd`/`renderRoadmapHtml` (both take `lang`) build the output; `ROADMAP_I18N` holds
  EN/PT/ES chrome; `meta.roadmapLang` (else `meta.lang`) in `roadmap.json` persists the language for auto-refresh.
  `maybeRefreshRoadmap` (in every mutator) writes MD always + HTML if it exists + SPECS.md if it exists —
  best-effort. The PostToolUse hook does the same for hand-edits, skipping when the changed file IS a
  `ROADMAP.*`. HTML must stay **offline** — no CDN/external URLs (test asserts it). Backlog lives in
  `roadmap.json` `backlog: [{name,note}]`; `spec_create` drops the backlog item with the same slug. Name and note are one
  line (`flatText()` on add and when rendered — a line break became a heading in ROADMAP.md); a name an ACTIVE feature
  already holds is refused (`backlogIsFeature`); `remove` is an alias of `rm` on every surface (`BACKLOG_ACTIONS`).
- **Multilingual headings:** the `TRACK_SECTIONS` tables (`SAAS_SECTIONS` / `AI_SECTIONS` / `SEC_SECTIONS` /
  `PRIVACY_SECTIONS`) are `{name, syn:[…], loose?:[…]}` with EN/PT/ES synonyms; `extractSection` matches any synonym
  (a `loose` one only in the track's context — see The track model). `doctor`/`clarify` use `RE_CONSTITUTION_CHECK`,
  `RE_SUCCESS_CRITERIA`, `RE_INDEPENDENT_TEST`, `RE_OUT_OF_SCOPE`, `RE_NFR`, `RE_EDGE_CASES`,
  `RE_GLOBAL_CONSTRAINTS`; `addTrack` uses `RE_TESTABILITY` for the +tdd block heading. Add a synonym when
  adding a language. Localized BODY content is in `mcp/lib/i18n.js`, not spec.js.
- **Hooks: never reference `hooks/hooks.json` in `plugin.json`.** Claude Code auto-loads the standard
  `hooks/hooks.json` from the plugin root. Declaring `"hooks": "./hooks/hooks.json"` in the manifest
  loads it a SECOND time → `Duplicate hooks file detected` and the plugin fails to load hooks (the bug
  fixed in 1.9.1). `manifest.hooks` is ONLY for *additional* hook files at non-standard paths.
- **Hooks never block and stay cheap.** Every hook exits 0 on any error or irrelevant event, emits at most
  one JSON object, has a 10 s timeout, and only acts on a `.specs/` dev-spec owns (`isDevSpecProject` — checked by
  PostToolUse AND SessionStart: another tool's `.specs/` gets no status block in every session). The PostToolUse hook:
  requirements.md → EARS + placeholders, tasks.md → every trace gap + EC/NFR/SC warnings, design.md →
  `designSaveCheck()` (active tracks' marker sections, Constitution Check, placeholders); it skips `/.execution/`,
  `.specs/templates/` (unless that folder is a pre-1.14 feature), `.specs/tracks/` (1.15, the same exception) and generated files. The Stop / SubagentStop hook
  follows the same rules (see End-of-turn evidence gate), and so do the 1.14 observe hook (it prints nothing at all and
  exits as soon as it has appended its line) and approval hook (silent unless `meta.approvalGuard` is on — its only
  output is a permission decision).
- **Flush stdout before exiting — on Windows AND Linux pipes.** Hooks read stdin asynchronously (not
  `fs.readFileSync(0)`) and exit only in the write callback. The same holds for the test harnesses (they exit once stdout
  has flushed — on a Linux pipe, docker or `| tee`, writes go async past the 64 KB buffer and the tail, FAIL lines and the
  total, was dropped) and for the MCP server (on stdin close it flushes its queued replies first — a slow reader on Linux
  got 0 of 8; a stdout EPIPE / EOF / ERR_STREAM_DESTROYED exits quietly 0, any other stdout error prints one stderr line
  and exits 1). Never `process.exit()` right after a write. The pre-commit validator reads staged
  names NUL-separated with `core.quotePath=false`, so accented paths work. Only EARS errors and phantom task refs
  block; a requirements.md with EARS warnings or template placeholders (the STAGED text, `featurePlaceholders(…, text)`)
  gets a ⚠ line (`earsWarnings`), never "EARS clean" — the PostToolUse hook's rule.
- **`spec_import` stays inside the project.** The source path must resolve inside `projectDir` — checked
  lexically first (nothing outside is even stat'ed), then by real path (a symlink out is refused) — and it is
  only read. Tool names are exact (`kiro` | `spec-kit` | `openspec` | `plan` | `execplan` | `bmad`, the schema enum) on
  both surfaces, and it never imports over an existing feature.
- **Tests run on Windows AND Linux** (`npm run test:docker`): a `_Verify:_` a test writes must work under cmd.exe AND
  `/bin/sh` — quote it (`node -e "process.exit(0)"`; the bare `node -e process.exit(0)` is a sh syntax error that cmd.exe
  accepts); don't depend on a case-insensitive file system (assert the Linux counterpart where Windows/macOS fold case)
  or on the text of a V8 error (Node 18 omits a RegExp's flags in its SyntaxError).
- **Never write a literal U+FEFF into source.** The Edit tool can turn the escape `\uFEFF` inside a regex or string into
  the raw BOM character (invisible, and it breaks the match). Build it: `String.fromCharCode(0xfeff)` /
  `new RegExp("^" + String.fromCharCode(0xfeff))` (as prompts-resources.js does), or check the bytes after an edit.
- **Dates/timestamps**: fine to use `new Date()` in the MCP server and scripts (normal Node
  process). Do NOT assume that in any Workflow-script context.
- **Protocol**: stdio transport is newline-delimited JSON; messages must not contain embedded
  newlines (tool descriptions are single-line strings). Framing splits on `\n` ONLY (a `StringDecoder` keeps multibyte
  characters whole across chunks; one trailing `\r` is dropped) — never `readline`, which also splits on U+2028 / U+2029,
  both legal raw inside a JSON string (text pasted from Word / PDF): a valid request was cut in two and never answered.
  Replies escape U+2028 / U+2029 (`frame()`) so readline-based clients survive them. `initialize` echoes the client's
  `protocolVersion` when supported (`SUPPORTED_PROTOCOLS`), else answers with the latest; default `2024-11-05`.
  A message without an `id` member is a notification: never a reply (and never runs a tool). An `id` must be a string or
  an integer — null, an object, an array, a boolean or a fraction gets -32600 (id null); an id without a string `method`
  gets -32600, except a client's JSON-RPC response (`result` / `error`, no method), which is ignored whatever its id (checked
  before the id rule — a client's error reply carries id null). A JSON-RPC batch gets ONE array
  reply; `null`/malformed input gets -32600/-32700; an unknown method -32601; an unknown tool (or `tools/call` without a
  name) -32602, localized (`args.unknownTool` / `args.noTool`); prompts/resources use -32602 / -32002 (see Capabilities).
- **Commands never reuse a Claude Code built-in name.** `/init`, `/status`, `/doctor` and `/commit`
  collided with the built-ins (a bare `/doctor` ran Claude Code's, and our own messages told users to
  "run /doctor"); they are `/spec-init`, `/spec-status`, `/spec-doctor`, `/spec-commit` since v1.11.
- **Returned text is localized, structured fields are not.** Engine errors (`errs()`), EARS issue
  `msg`, classifier `notes`/`reasoning`, doctor section names and details (the ears `earsDetail`), add_track's
  `added` annotations (`design.md (+secções)`), the ROADMAP.md/.html Phase column (`phaseNames`; the JSON
  `phase` stays English), CLI output (usage prefix, section labels, EARS severities included), hook and
  pre-commit lines all go through `i18n.msg(lang)`. Callers branch on stable fields — EARS `code` / `severity`,
  evidence `unverifiedReason` (and `spec_impact`'s task `evidence`), doctor check `id`, next_action `step` —
  never regex a `msg`.
- **Classifier language guess** (`guessLang`): STRONG PT/ES markers (weight 2: `não`, `uma`, `-ção`,
  `ñ`…) and WEAK ones (weight 1: `de`, `por`, `com`…) must beat the English function-word count —
  never add ambiguous words (`do`, `da`, `usa`, `los`, `no`, `.com`): they flipped English text to PT.
  The guess decides how `no` is read — a negator in EN/ES, the contraction *em+o* in PT ("aplicado no
  checkout"; also after a lowercase participle, never after a capitalised name like "Canada"). An
  explicit `lang` overrides the guess for negation too. Without one, every surface — spec_classify / classify, spec_create /
  create (a new feature), spec_import — reads the text in its OWN language, with roadmap.json `meta.lang` only as the
  fallback when the text is inconclusive (`classify(…, {projectDir})` → `configuredLang()` → `guessLang(text, fallback)`;
  never the 'en' default): forcing meta.lang read "no checkout" in a PT summary as an English negation in an EN project,
  and create disagreed with the classify the human confirms. One matched span counts once per track. Prose pairs like
  `login/signup` are split before matching; path-like tokens (`src/rag.ts`) are not. PT/ES plurals
  (`-ções`, `-ciones`, first word of a phrase) are generated by `pluralize()`.
- **CLI `--lang` is the MCP enum**: `main()` refuses anything outside the MCP `lang` enum (case-folded) with the
  localized `args.invalid` message before dispatch — the engine's `normalizeLang()` would turn `fr` into `en` and save it.
- **CLI exit codes are scriptable**: `doctor` (FAIL), `trace` (gaps), `ears` (errors), `finish` (not ready),
  `drift` (drift, a stale baseline or an error) and any refused operation exit 1. The eval harness
  (`mcp/evals/run-evals.js`, also `dev-spec evals`) exits 2 on a usage error (a `--max-items` that isn't an
  integer ≥ 1 — it graded nothing and scored 0/0 = 100%) and 1 on an invalid set (an empty one included). An engine refusal goes through `fail(r)`, never
  `die(r.error)`: with `--json` the whole `{ok: false, error, …}` result (`recorded`, `neverApproved`, `gated`…) is
  the one JSON document on stdout, as MCP returns it. `die()` is for CLI usage/argument errors only.
- **CLI boolean switches are read with `on(k)`, never by truthiness**: `--x=false` is the string "false" (truthy),
  so `done --run=false` ran the `_Verify:_` commands. `normalizeBoolFlags()` (every name in `BOOL_FLAGS`) turns
  `true|false|1|0|yes|no|on|off` into booleans and refuses any other value. `BOOL_FLAGS` is `[...spec.CLI_SWITCHES]`
  (1.14): ONE list, which the approval hook's lexer (`cliApprovalAction()`) also reads to tell a switch from a value flag —
  a new switch goes into `spec.CLI_SWITCHES` (never a CLI-only list: the hook would read the word after it as its value), a new
  value flag into `VALUE_FLAGS` — `refuseUnknownFlags()` refuses any other `--flag` before anything runs (exit 1, a
  localized did-you-mean; `done 2 --rnu` used to tick the task with no evidence). `evals` is exempt (its flags go to
  run-evals.js untouched); `--` ends the options; `--help` anywhere prints the help and runs nothing. An explicit
  `--include-body=false` / `--include-brief=false` is passed through as false (`boolFlag()`), as MCP receives it.
  The eval harness (`mcp/evals/run-evals.js`, which `evals` forwards to untouched) applies the same rule to its own
  switches (`--dry-run`, `--set-baseline`, `--require-live`: exit 2 otherwise).
  Numeric flags that MCP bounds (`--cap`, `--max`) and the CLI-only `--timeout` go through `intFlag()` (integer ≥ 1).
  The engine refuses what the MCP schema refuses where the CLI passes raw strings: `taskNumber()` (digits only — `"1.9"` / `"2abc"` are not
  task 1 / 2), `createFeature` kind ∈ feature|bugfix|spike, `backlog` action ∈ add|rm|remove|list.
- **Eval harness** (`run-evals.js`) resolves the feature with the engine's resolver (accents, legacy slugs,
  `${VAR}` guard), prints in the feature's language, and treats a wrong-shaped set as invalid (exit 1). It validates
  EVERY item (`itemProblems()`: object, `id`, `input`, a grader in contains|equals|regex|refuse|judge, a value / a regex
  that compiles with gradeItem's flags / a rubric) and `thresholds.json` (a number in [0, 1] per set) before anything
  runs: a dry run exits 1 naming each bad item, a live run calls no model while any set is invalid.

## Tests
`node mcp/test.js` drives the full MCP handshake and exercises every tool, prompt and resource against a temp project
(1256 assertions, incl. a PT and an ES end-to-end scaffold, per-feature lang override, the prose guards —
README tool tables, rule files, no PR/CI steering — the behavioural eval fixtures, and a regression per review finding);
`node cli/test-cli.js` adds 402 for the CLI. The harness fails (exit 1) if the server dies or stops
answering — never let it drain to exit 0. Add an assertion when you add a tool or change behavior. Keep
it dependency-free. `node mcp/evals/run-evals.js <feature> --dry-run` validates the eval path offline.
Exact counts that change when a package adds a command, tool or template (54 command files, the tools/list length, the
template keys, the resource list) are asserted in place — update them in the same change.
- **Linux, locally:** `npm run test:docker` (`scripts/test-docker.js`, zero-dep) runs both suites in
  `node:18-alpine` (the engines floor, musl), `node:22-bookworm-slim` and `node:24-alpine`:
  `docker run --rm --network none --user 1000:1000 -v <repo>:/repo:ro`, `--init`, the repo READ-ONLY (the suites work
  under `os.tmpdir()`), no network, an unprivileged user (`--root` to opt out). Only the first run needs network — to pull
  and to build a cached derived image `dev-spec-test:<image>` that adds git (`--no-git` skips it; the git-dependent tests
  then skip; `--rebuild` rebuilds it). Options `--image <name>` (repeatable), `--suite mcp|cli`. Exit 0 all passed · 1 a
  suite failed or an image couldn't be prepared · 2 no Docker (not installed, daemon down, Windows-containers mode) or a
  usage error; logs in `<tmp>/dev-spec-docker/<image>-<suite>.log`. Never wire it to hosted CI.
- **Plugin evals** (`claude plugin eval`, maintainer-side, cost tokens, local only): the triggering suite
  (`--tag triggering negative`) and the behavioural suite (`--tag behavior` plus `--scaffold --allow-real-servers
  --allow-tools …` — the exact command is in evals/README.md). `mcp/test.js` checks every behavioural case is well-formed
  (runs, turns, a scaffold, ≥ 3 graders incl. a deterministic one, regexes compile, every MCP tool it names exists) and
  builds every fixture with the current engine (bash / Git Bash; skipped without bash) — fix a fixture there, not after
  a paid run.

## Bugfix and finish (v1.12)
- **`kind: "bugfix"`** is stored in `.state.json`; `createFeature` scaffolds `bug.md` +
  bug requirements/test plan/tasks (always +tdd), `specDoctor` swaps the design checks for
  `reproduction` (warn) and `root-cause` (**fail** until filled — the iron law, enforced at execution by
  `bugfixGate()`).
- **`spec_finish`** builds a merge title + summary (`mergeTitle`/`mergeSummary`, `.execution/merge-summary.md`)
  from the spec chain; it never merges, pushes or approves. **No PRs:** the owner's cost rule extends to
  pull requests — the plugin integrates by local merge only and must never steer users to open a PR or
  run CI (a test asserts no command/skill/agent text does).
- **Global Constraints** heading synonyms: `RE_GLOBAL_CONSTRAINTS` (EN/PT/ES); placeholder bullets are
  skipped when inlined into briefs.
- **Plugin evals** (`evals/<case>/prompt.md` + `graders/*.md`; behavioural cases add `case.yaml` +
  `fixture.sh`) follow the `claude plugin eval` reference; they cost tokens and run locally only (never CI).

## When extending
- New MCP tool → add the function to `mcp/lib/spec.js`, a TOOLS entry + dispatch case in
  `mcp/server.js` (its `inputSchema` IS the validation — declare types, enums, required keys), the CLI
  subcommand, a test in `mcp/test.js` (and bump the exact tool count), the README tool tables (EN/PT/ES —
  `mcp/test.js` builds the expected set from the live `tools/list`: a missing or phantom row in any language fails
  the suite), a `TOOL_ANNOTATIONS` entry in `mcp/server.js` (1.16 — mcp/test.js requires one per tool and snapshots `.specs/`
  around every read-only one), and (usually) a thin command in `commands/`.
- New command → a `commands/<name>.md` with `description` + `argument-hint` front matter; it is automatically an MCP
  prompt too (bump the exact command count in `mcp/test.js` and the README command lists). Never a Claude Code built-in
  name.
- New track → a TEAM's track is a track pack (`.specs/tracks/<name>/`, no code — see Project-defined tracks); a BUILT-IN
  one → The track model (registries). New artifact → the resource allowlist, the template allowlist
  (`TEMPLATE_ARTIFACTS`) and `templateCorpus()` if it has slots.
- A new reader of the track registries → the accessor functions (`allTracks()` / `optionalTracks()` / `markerTracks()` /
  `trackMarker()` / `trackSectionTable()` / `trackSteeringFiles()` / `trackSignalTable()`), never the built-in constants —
  those miss the project's track packs (only the process-wide template corpus and the built-in lists of `spec_tracks list`
  read the constants on purpose).
- New CLI switch (a flag that takes no value) → `spec.CLI_SWITCHES` in `mcp/lib/spec.js` (the CLI's `BOOL_FLAGS` and the
  approval hook's lexer both read it); a new value flag → the CLI's `VALUE_FLAGS`.
- New hook → `hooks/hooks.json` (never `plugin.json` — see Conventions), silent and exit 0 on any error, the engine loaded
  only after a cheap raw pre-check (roadmap.json / the payload), and a row in `references/tooling-reference.md`.
- Any generated/returned user-facing text → put the strings in `mcp/lib/i18n.js` for every language (EN / PT / ES;
  pt-BR inherits PT unless it needs its own wording) and resolve the lang via `featureLang()`/`projectLang()`; keep
  IDs/markers English-stable.
- Keep `SKILL.md` the source of truth for the workflow; commands stay thin.
