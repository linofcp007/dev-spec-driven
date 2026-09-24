# CLAUDE.md — maintainer notes for dev-spec-driven

Context for anyone (human or Claude) working on this plugin. Read this before changing the engine.

## What this is
A Claude Code **plugin** that unifies four spec-driven skills into one **track-based** skill, plus
a bundled **local, zero-dependency MCP server**. Hard constraints set by the owner:
- **No GitHub Actions / no paid CI / no pull requests.** All automation is local (hooks + the MCP
  server). Never add a `.github/workflows/` for this project, never open PRs — merge locally and push.
- **Zero runtime dependencies.** The MCP server and all scripts use only Node core (`fs`, `path`,
  `readline`, `child_process`, built-in `fetch`). No `npm install` required. Keep it that way.
- Specs always live in `.specs/` (no alternate directory detection).

## Layout
```
.claude-plugin/plugin.json     manifest (skills, commands, mcpServers point here; NO hooks key — see gotcha)
.claude-plugin/marketplace.json local marketplace for install
mcp/servers.json               registers the `spec-driven` stdio server (plugin.json → mcpServers; deliberately NOT a root .mcp.json — see Config paths)
skills/dev-spec-driven/SKILL.md the workflow (track routing engine, prose)
skills/.../references/          deep library, read on demand
commands/*.md                  slash commands (thin wrappers that invoke the skill/MCP)
agents/*.md                    plugin subagents, auto-discovered and dispatched as `dev-spec-driven:spec-implementer` /
                               `dev-spec-driven:spec-reviewer` (subagent execution) / `dev-spec-driven:spec-critic` (--deep)
evals/                         plugin evals for `claude plugin eval` (triggering EN/PT/ES) — maintainer-side, results ignored
mcp/server.js                  MCP stdio protocol (JSON-RPC 2.0, newline-delimited)
mcp/lib/spec.js                ALL domain logic (classify, scaffold, lint, trace, doctor, state)
mcp/lib/i18n.js                ALL localized content EN/PT/ES (artifact + steering builders, tool messages)
mcp/evals/run-evals.js         local eval harness (uses ANTHROPIC_API_KEY; --dry-run offline)
mcp/test.js                    smoke test — `node mcp/test.js`
cli/dev-spec.js                universal CLI over mcp/lib/spec.js (cross-tool; also prints MCP configs)
cli/test-cli.js                smoke test for the CLI — `node cli/test-cli.js` (never a top-level bin/, see below)
hooks/hooks.json + spec-hook.js local PostToolUse/SessionStart automation
hooks/precommit-check.js       optional git pre-commit validator
AGENTS.md                      portable workflow for non-Claude agent tools
.cursor/ .windsurf/ .github/copilot-instructions.md GEMINI.md  per-tool rule files (point to AGENTS.md)
INTEGRATIONS.md                per-tool setup + MCP config snippets

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
MCP clients, (2) the `dev-spec` CLI for any tool/terminal, (3) Claude Code skill+commands+hooks.
When you add an operation, add it to `spec.js` first, then wire it into server.js (tool) AND
cli/dev-spec.js (subcommand) AND mcp/test.js (assertion). Keep the CLI and MCP behavior identical.
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
  `_Emits metrics:_`/`_Implements:_`/`_Verify:_`, `**Checkpoint:**`, the ` ```mermaid `/` ```typescript ` fences,
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
`spec_coverage` · `spec_clarify` · `spec_next_action` · `spec_add_track` · `spec_feature` ·
`spec_task_brief` · `spec_finish` (**23 total**; verify with an `initialize` + `tools/list` handshake against `mcp/server.js`). The
server is **tools-only** — it advertises `capabilities: { tools: { listChanged: false } }` and exposes
no `resources`/`prompts`. All tools are pure-local file ops on `.specs/` (or read-only codebase scan
for brownfield); none hit the network. They scaffold and check — they never overwrite existing files.
Roadmap/deps persist in `.specs/roadmap.json`; cross-feature deps are cycle-checked.

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

## Subagent-driven execution (Phase 6, opt-in — v1.11)
`spec_task_brief` (engine) builds a self-contained brief per task: task block (via `taskBlocks()`, which
keeps sub-lines, phase heading and closing `**Checkpoint:**` — `parseTasks()` stays line-only because
its shape is public through `spec_status`), AC IDs resolved to their full EARS text (`acIndex()` over
`criterionBlocks()`, exact-ID keys so AC-1 never hits AC-10), T-IDs resolved to their test-plan row
(keyed by the FIRST table cell), design sections that mention the task (bounded by
`BRIEF_DESIGN_BUDGET`), steering pointers, and the loop's definition of done. Labels/rules live in
`i18n.js` `BRIEF` + `renderBrief()`. `write:true` writes `.specs/<f>/.execution/` — a self-ignoring
folder (`.gitignore` = `*`), the brief is regenerated, `ledger.md` is created once and only ever
appended by the controller. The PostToolUse hook exits early for `/.execution/` paths. The protocol is
prose in `references/subagent-execution.md` + `agents/spec-implementer.md` / `agents/spec-reviewer.md`;
the engine never dispatches anything (keeps it cross-tool). Adapted from obra/superpowers (MIT).

## Conventions & gotchas
- **Every name-taking op resolves its folder through `resolveFeature()` / `existingFeature()`** —
  never `path.join(specsRoot, slugify(name))`. An empty slug (non-Latin names, `...`, `undefined`)
  used to resolve to `.specs/` itself, so `spec_feature remove` deleted every spec (the v1.11
  Critical). The resolver also rejects `steering` and Windows device names (`nul`, `con`, `com1`…),
  transliterates accents (`Autenticação` → `autenticacao`) and falls back to the pre-1.11 slug
  (`autentica-o`) so old folders are still found. `slugify(undefined)` is `""`, never `"undefined"`.
- **JSON state is read with `readJson()` and written atomically (`writeFileAtomic`)**. A
  `roadmap.json` / `.state.json` that exists but doesn't parse is an ERROR every mutator returns
  (`roadmapError()`, `state.invalid`) — never "repaired" into `{}` (that erased deps, backlog,
  approvals and `meta.lang`). A leading BOM is tolerated. `writeIfAbsent` uses `flag:"wx"`.
- **Generated roadmap files carry the `AUTO-GENERATED by dev-spec` marker (EN/PT/ES, `RE_AUTOGEN`)**.
  `writeRoadmapMd/Html` skip a same-named file without it — the hooks run in every project. The
  roadmap chrome language is `meta.roadmapLang`; `meta.lang` is the project language and only
  `spec_init` sets it.
- **Approvals record a content fingerprint** of the phase's artifact (`artifactFingerprint`; tasks.md
  with checkboxes normalized). `next_action` compares each artifact with ITS OWN approval — ticking a
  task is progress, not a spec edit.
- **EARS context**: the loose heuristics (numbered item that "reads like" a requirement, lowercase
  `deve/debe`) apply only under an Acceptance Criteria heading or in heading-less snippets; elsewhere a
  criterion needs SHALL / capitalised DEVE·DEBE / "sistema deve", a stable ID or a CAPITALISED EARS
  keyword. Word boundaries are unicode (`(?<![\p{L}\p{N}_])`) — JS `\b` never matched `DEVERÁ`.
- **Mandatory sections**: `extractSection(md, syn, marker)` prefers the heading carrying the track
  marker (`[SaaS]`/`[AI]`) and skips fenced code, so `[AI] Observability for AI` can't satisfy
  `[SaaS] Observability`. "Unfilled" = the `> **TODO**` sentinel is still there OR the body is empty.
- **AC/test IDs**: `US-<n>.AC-<n>` and `T-<n>`. Extraction uses a lookbehind guard, NOT `\b` —
  markdown italics (`_US-1.AC-1_`) make `\b` fail because `_` is a word char. Don't reintroduce `\b`.
- **`earsValidate` is criterion-based, never line-based.** EARS phrasing (`ENQUANTO … QUANDO … O
  SISTEMA DEVE …`) wraps past one line, and markdown list items continue across lines (indented or
  lazy). `criterionBlocks()` folds physical lines into logical criteria FIRST — bounded by blank
  lines, headings, tables, HR and fenced code (fence *state* is tracked, so `const shall = 1` inside
  ` ``` ` is code, not an AC) — and only then lints each joined criterion. A comment-only line does
  **not** split a criterion. Linting per line scored a wrapped AC twice: the half holding the ID had
  no modal verb (**error**) and the half holding the modal verb had no ID (**warn**), which
  hard-failed `spec_doctor`'s `ears` gate on any well-written long criterion. Issues report the
  criterion's start `line` (plus `endLine` when it spans several).
- **Classifier signals are matched as WORDS, never substrings** (`keywordRe`, not `indexOf`).
  `indexOf` fired `claude` inside `.claude-plugin`, `rag` inside `sto·rag·e`, `sla` inside
  `tran·sla·te`, `auth` inside `auth·or` — and a phantom STRONG signal auto-enables a track, which
  then *hides* the negation the classifier computed for it. The regex allows inflections
  (`payment→payments`, `rate-limit→rate-limiting`), plural-only for ≤3-char acronyms (so `rag`+`ing`
  ≠ `raging`), `STEMS` for deliberate prefixes (`idempoten`, `hallucinat`, `summariz`, `alucina`),
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
- **Hooks: never reference `hooks/hooks.json` in `plugin.json`.** Claude Code auto-loads the standard
  `hooks/hooks.json` from the plugin root. Declaring `"hooks": "./hooks/hooks.json"` in the manifest
  loads it a SECOND time → `Duplicate hooks file detected` and the plugin fails to load hooks (the bug
  fixed in 1.9.1). `manifest.hooks` is ONLY for *additional* hook files at non-standard paths.
- **Hooks on Windows**: read stdin asynchronously (not `fs.readFileSync(0)`), and flush stdout
  before `process.exit` (write callback) — pipes truncate otherwise.
- **Dates/timestamps**: fine to use `new Date()` in the MCP server and scripts (normal Node
  process). Do NOT assume that in any Workflow-script context.
- **Protocol**: stdio transport is newline-delimited JSON; messages must not contain embedded
  newlines. `initialize` echoes the client's `protocolVersion` when supported (`SUPPORTED_PROTOCOLS`),
  else answers with the latest; default `2024-11-05`. Notifications never get a reply (and never run
  tools); a JSON-RPC batch gets ONE array reply; `null`/malformed input gets -32600/-32700.
- **Commands never reuse a Claude Code built-in name.** `/init`, `/status`, `/doctor` and `/commit`
  collided with the built-ins (a bare `/doctor` ran Claude Code's, and our own messages told users to
  "run /doctor"); they are `/spec-init`, `/spec-status`, `/spec-doctor`, `/spec-commit` since v1.11.
- **Returned text is localized, structured fields are not.** Engine errors (`errs()`), EARS issue
  `msg`, classifier `notes`/`reasoning`, doctor section names, hook and pre-commit lines all go through
  `i18n.msg(lang)`. Callers branch on stable fields — EARS issues carry `code`
  (`no-modal`/`no-id`/`vague`/`no-keyword`/`needs-clarification`); never regex a `msg`.
- **Classifier language guess** (`guessLang`): STRONG PT/ES markers (weight 2: `não`, `uma`, `-ção`,
  `ñ`…) and WEAK ones (weight 1: `de`, `por`, `com`…) must beat the English function-word count —
  never add ambiguous words (`do`, `da`, `usa`, `los`, `no`, `.com`): they flipped English text to PT.
  The guess decides how `no` is read — a negator in EN/ES, the contraction *em+o* in PT ("aplicado no
  checkout"; also after a lowercase participle, never after a capitalised name like "Canada"). An
  explicit `lang` overrides the guess for negation too. One matched span counts once per track. Prose pairs like
  `login/signup` are split before matching; path-like tokens (`src/rag.ts`) are not. PT/ES plurals
  (`-ções`, `-ciones`, first word of a phrase) are generated by `pluralize()`.
- **CLI exit codes are scriptable**: `doctor` (FAIL), `trace` (gaps) and `ears` (errors) exit 1.

## Tests
`node mcp/test.js` drives the full MCP handshake and exercises every tool against a temp project
(181 assertions, incl. a PT and an ES end-to-end scaffold + per-feature lang override and one regression per
finding of the v1.11 full review and final review; `node cli/test-cli.js` adds 53 for the CLI). The harness fails (exit 1) if the
server dies or stops answering — never let it drain to exit 0. Add an assertion when you add a tool or change behavior. Keep
it dependency-free.
`node mcp/evals/run-evals.js <feature> --dry-run` validates the eval path offline.

## Evidence, bugfix, finish (v1.12)
- **`_Verify: <command>_`** is an English-stable task marker (like `_Requirements:_`); `taskMarkers()`
  keeps its value whole (commas belong to the command). `spec_complete_task {evidence}` records
  `{command, exitCode, summary, at}` in `.state.json → evidence[<n>]`; a non-zero `exitCode` refuses the
  tick; `verificationStatus()` feeds doctor (`verification` check), `ROADMAP.md` attention and
  `spec_finish` blockers. The MCP server never executes commands — the agent runs them and reports;
  only the CLI's explicit `done --run` executes a task's `_Verify:_` (the user's own tasks.md).
- **`kind: "bugfix"`** is stored in `.state.json`; `createFeature` scaffolds `bug.md` +
  bug requirements/test plan/tasks (always +tdd), `specDoctor` swaps the design checks for
  `reproduction` (warn) and `root-cause` (**fail** until filled — the iron law).
- **`spec_finish`** builds a merge title + summary (`mergeTitle`/`mergeSummary`, `.execution/merge-summary.md`)
  from the spec chain; it never merges, pushes or approves. **No PRs:** the owner's cost rule extends to
  pull requests — the plugin integrates by local merge only and must never steer users to open a PR or
  run CI (a test asserts no command/skill/agent text does).
- **Global Constraints** heading synonyms: `RE_GLOBAL_CONSTRAINTS` (EN/PT/ES); placeholder bullets are
  skipped when inlined into briefs.
- **Plugin evals** (`evals/<case>/prompt.md` + `graders/*.md`) follow the `claude plugin eval`
  reference; they cost tokens and run locally only (never CI).

## When extending
- New MCP tool → add the function to `mcp/lib/spec.js`, a TOOLS entry + dispatch case in
  `mcp/server.js`, a test in `mcp/test.js`, and (usually) a thin command in `commands/`.
- Any generated/returned user-facing text → put the strings in `mcp/lib/i18n.js` for all three
  languages and resolve the lang via `featureLang()`/`projectLang()`; keep IDs/markers English-stable.
- Keep `SKILL.md` the source of truth for the workflow; commands stay thin.
