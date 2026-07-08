# Changelog

All notable changes to **dev-spec-driven**. Format loosely follows Keep a Changelog;
this project versions the plugin as a whole.

## [1.9.2]

### Fixed — engine correctness (dogfooding the plugin on its own specs)
- **`ears_validate` was line-based, not criterion-based — it hard-failed any well-written long
  criterion.** EARS phrasing wraps across lines (`WHILE … WHEN … THE SYSTEM SHALL …`), and markdown
  list items continue on the next line. The validator scored each *physical* line: the half carrying
  the ID had no modal verb (**error**), the half carrying the modal verb had no ID (**warn**) — the
  same criterion counted twice. Because `spec_doctor` gates the phase on `errors === 0` (and the
  PostToolUse hook + pre-commit check run the same validator), this **blocked the design gate and
  commits** on any criterion over ~one line. Criteria are now folded into logical blocks first
  (bounded by blank lines, headings, tables, HR and fenced code), then each whole criterion is
  linted. Issues report the criterion's start `line` (plus `endLine` when it spans several).
- **Fenced code counted as acceptance criteria.** A `const shall = 1;` line inside a ` ``` ` block
  matched the modal-verb heuristic. Fence state is now tracked; a fence body is never a criterion.
- **`spec_classify` matched signals as substrings, firing phantom tracks.** `indexOf` fired `claude`
  inside `.claude-plugin/plugin.json` (→ `+ai`), `rag` inside `storage` (→ `+ai`), `sla` inside
  `translate` (→ `+saas`) and `auth` inside `author` (→ `+tdd`). Keywords are now matched at word
  boundaries, keeping inflections (`payments`, `rate-limiting`), plural-only for ≤3-char acronyms
  (so `rag`+`ing` ≠ `raging`), deliberate stems (`idempoten`, `hallucinat`) and `-based`/`-powered`
  adjectives, while rejecting `-<letter>` compounds and dotted/slashed identifiers (`gpt-4` still
  matches). All 260 signal keywords verified to still self-match.
- **A phantom signal silently masked the negation the classifier had computed.** Because the bogus
  strong match turned a track on, the "kept off — negated" note never fired. Negation now annotates
  rather than vetoes: when a track is on *and* has negated keywords, `classify` surfaces the conflict
  (`+ai is ON although 'llm' appeared negated — confirm this is intentional`) for the Phase-0 review.

### Tests
- `mcp/test.js` 66 → 80 assertions (wrapped EN/PT/ES criteria, block boundaries, substring traps,
  inflection/acronym coverage, negation-conflict surfacing).

## [1.9.1]

### Fixed
- **Plugin failed to load hooks: `Duplicate hooks file detected`.** The manifest
  (`.claude-plugin/plugin.json`) declared `"hooks": "./hooks/hooks.json"`, but Claude Code already
  loads the standard `hooks/hooks.json` automatically — the explicit reference loaded the same file a
  second time and errored out. Removed the `hooks` key from the manifest; `hooks/hooks.json` (and its
  PostToolUse/SessionStart `spec-hook.js`) still load via the standard path. `manifest.hooks` is only
  for *additional* hook files.

## [1.9.0]

### Added — trilingual generation (EN / PT / ES): the engine now WRITES, not just reads, three languages
- **Localized scaffolding.** `spec_init` and `spec_create` accept `lang` (`en`/`pt`/`es`); every
  generated artifact (classification / requirements / design / tasks / test-plan / eval-plan /
  load-test / quickstart / checklist), every steering stub, the prompt stub and the evals README come
  out in that language. CLI: `--lang en|pt|es` on `init` / `create`.
- **Single source of truth + per-feature override.** The project language is persisted in
  `.specs/roadmap.json` `meta.lang` (set by `spec_init`, inherited by every new feature); a feature can
  override it, persisted in `.specs/<feature>/.state.json`. Resolution: explicit `lang` > project
  default > `en`.
- **Localized tool messages.** `spec_doctor`, `spec_clarify`, `spec_next_action`, `spec_add_track` and
  the local hooks (EARS / traceability / roadmap-refresh / session start) now respond in the feature's
  language.
- **New module `mcp/lib/i18n.js`** holds all localized content (artifact + steering builders, tool
  messages); `spec.js` keeps the logic and delegates. EN output is byte-identical to 1.8.0.

### Fixed
- `spec_status` scale-section completeness matched English literals only — it now uses the EN/PT/ES
  synonym tables, so a PT/ES design reports section presence correctly.
- `spec_add_track` detected an existing `+tdd` block by the English "Testability Notes" heading only —
  it now matches the localized heading too (no duplicate scaffolding in a PT/ES project).

### Conventions
- Structural tokens stay **English-stable** across all languages (AC/SC/test IDs, `[SaaS]`/`[AI]`,
  `[US1]`/`[shared]`/`[P]`, the `> **TODO**` sentinel, `[NEEDS CLARIFICATION]`, the `_Requirements:_`/
  `_Implements:_` annotation tags, `**Checkpoint:**`, the ` ```mermaid `/` ```typescript ` fences, and
  the eval-harness `## System` heading). EARS keywords and section headings are localized and matched by
  the existing synonym (`SAAS_SECTIONS`/`AI_SECTIONS`) and `RE_*` tables.

### Tests
- `mcp/test.js` 55 → 66 assertions (PT and ES end-to-end scaffolds + per-feature language override);
  `bin/test-cli.js` 34 → 38. Still zero runtime dependencies.

## [1.8.0]

### Added — review-driven UX: real gates, lifecycle, resume
- **Approval gates are now a real gate.** `spec_doctor` adds an `approval-gates` check plus `gatesOk`
  and `pendingGates`: any artifact that exists but whose phase hasn't been approved is surfaced
  (warn-level, so quality fails still dominate the verdict). Progress is sign-off-checked, not just
  quality-checked.
- **`spec_next_action`** (`/next-action`, `dev-spec next-action`) — "you are here → do this next",
  synthesized from phase + doctor verdict + gates, and lists any artifact modified **after** its last
  approval (so a post-approval edit is re-reviewed, not silently shipped).
- **`spec_add_track`** (`/add-track`, `dev-spec add-track`) — escalate an existing feature to
  `+tdd/+saas/+ai`. **Additive only**: scaffolds just the missing artifacts and appends that track's
  mandatory `design.md` sections; never overwrites. Idempotent.
- **`spec_feature`** (`/feature`, `dev-spec feature`) — lifecycle management: **archive** (reversible,
  to `.specs/_archive/`), **rename** (slug + folder + every `roadmap.json` dependency reference), or
  **remove** (destructive). All keep the dependency graph consistent and regenerate the roadmap.

### Fixed
- `spec_roadmap` no longer crashes on a project with no `.specs/` yet (full early-return shape).
- Classifier no longer double-counts overlapping multilingual signals (e.g. `agent`/`agente`).
- `ears_validate`: vague-term detection uses Unicode word boundaries (`clean` no longer matches inside
  `cleanup`); criteria after an inline `<!-- … -->` comment are counted.
- `slugify` no longer leaves a trailing dash when a long name is truncated.
- Roadmap Markdown table escapes `|` in task text (no broken columns).
- Local hook emits exactly one JSON object (idempotent `emit`), and the MCP server reports the real
  package version.

### Security
- MCP tool calls reject a `projectDir` containing `..` path segments (the CLI, user-driven, is not
  restricted). `trace_check` `_Implements:` paths are clamped to the project root. The eval harness
  fetch has a 30s timeout and a `--max-items` cap.

### Packaging / distribution
- **No machine-specific paths committed** — the repo is now portable for `git clone`/download. The
  in-repo MCP dotfiles use workspace-relative references (`.vscode/mcp.json` → `${workspaceFolder}`;
  `.cursor/mcp.json` and `.gemini/settings.json` → `mcp/server.js`), and the `integrations/*` global
  templates carry a `/ABSOLUTE/PATH/TO/dev-spec-driven/…` placeholder. Run
  `node bin/dev-spec.js mcp-config <client>` to print a config with the correct absolute path for your
  machine. (Claude Code's `.mcp.json` already uses `${CLAUDE_PLUGIN_ROOT}`.)

- 21 MCP tools, 31 commands; tests 55 (MCP) + 34 (CLI).

## [1.7.0]

### Added — optional branded HTML roadmap + localized chrome
- **`.specs/ROADMAP.md` stays the default** roadmap output (git/PR-friendly, keeps the Mermaid
  dependency graph).
- **Optional `.specs/ROADMAP.html`** (`--html` / `html:true`) — a **self-contained, zero-dependency,
  offline** page (no CDN/network) styled with the Pro Digital Key brand palette (brand `#11689B`,
  Outfit font), a **light/dark toggle that defaults to the system preference** (`prefers-color-scheme`)
  and remembers your choice. Progress bar, feature table with colored status dots, dependency list,
  needs-attention, and backlog.
- **Localized chrome (EN/PT/ES)** — the roadmap labels are written in the language of the command
  (`--lang` / `lang`), stored in `roadmap.json` `meta.lang` so auto-refresh keeps it. Spec content
  is already in the user's language.
- Auto-refresh updates the MD on every mutation (and the HTML too if it exists). `spec_roadmap`
  gained `html` + `lang`; CLI `dev-spec roadmap --write [--html] [--lang pt]`.

## [1.6.0]

### Added — always-current `.specs/ROADMAP.md`
- **A generated, single-file overview** of every feature: progress bar + overall %, a feature table
  (status ✅🟡⛔⬜, tracks, phase, %, tasks done/total, deps, next task), a **Mermaid dependency
  graph**, a **"needs attention"** section (blocked / open `[NEEDS CLARIFICATION]` / unfilled design),
  and a **backlog** of planned-but-unspecced features.
- **Kept current three ways** (as requested): (1) the engine regenerates it on every mutation
  (`spec_create`, `spec_complete_task`, `spec_approve`, `spec_depend`, `spec_backlog`); (2) the
  PostToolUse hook regenerates it when you hand-edit a spec file; (3) a skill rule + on-demand
  `spec_roadmap write:true` / `dev-spec roadmap --write`.
- **`spec_backlog`** MCP tool + `/backlog` command + `dev-spec backlog [add|rm]` — manage planned
  features (stored in `.specs/roadmap.json`).
- 18 MCP tools, 28 commands; tests 45 (MCP) + 25 (CLI).

## [1.5.0]

### Added — ideas adapted from the official GitHub Spec-Kit (kept EARS-based, local & zero-dep)
- **Prioritized, independently-testable user stories (P1/P2/P3)** + per-story *Independent Test* line,
  and a **Success Criteria** section (measurable, technology-agnostic `SC-001` …) alongside EARS ACs.
- **`[NEEDS CLARIFICATION: …]` inline markers + gate** — `ears_validate` counts them (ignoring
  template comments), `spec_clarify` lists them first, and `spec_doctor` **fails the `clarifications`
  check until they're resolved** (design is gated).
- **Story-organized tasks with story tags + `[P]` parallel markers + `**Checkpoint:**` lines** — the
  tasks template groups by independently-shippable story (Setup → Foundational → Story US-1 (P1) → …
  → Polish). Each task is tagged `[US1]`/`[US2]` or `[shared]` (cross-cutting) so membership is
  obvious even for foundational/setup/polish tasks; `[P]` marks parallelizable work (`[US1][P]`).
  `parseTasks` exposes `story` and `parallel`. The skill documents a fallback to a technical-layer
  layout (keeping the tags) when stories aren't genuinely independent.
- **Worked example** under `examples/demo-project/` — a real, verifiable feature (`api-keys`, core
  +tdd +saas) in the v1.5 shape that passes `doctor` and `trace`, plus a second feature with a
  cross-feature dependency on the roadmap. See `examples/README.md`.
- **Brownfield support** — a read-only `scan` of an existing codebase (no model, no cost), an
  inferred `constitution.md`, and reverse-engineered specs that pass `doctor` + `trace`, via the
  `spec_scan` / `spec_coverage` tools and the `/scan` · `/reverse` · `/coverage` commands.

### Changed
- **Multilingual section headings.** `spec_doctor` and `spec_clarify` now recognize the mandatory
  section headings in EN/PT/ES (the 5 +saas sections, the 10 +ai sections, `Constitution Check`,
  `Success Criteria`, `Independent Test`, `Out of Scope`, edge-cases, NFR). A spec written fully in
  the user's language — headings included — passes the checks. Structural IDs/markers/tags stay
  stable (`US-1.AC-1`, `_Requirements:_`, `[US1]`, `[P]`, `[NEEDS CLARIFICATION:]`). Only code stays English.

### Fixed
- `trace_check` now strips HTML comments before extracting AC/test IDs and `_Implements:_` markers,
  so example markers inside template guidance comments no longer count as real references (matches
  the `[NEEDS CLARIFICATION]` handling).
- **Constitution Check + Complexity Tracking** sections in `design.md`; `spec_doctor` checks the
  Constitution Check section is present.
- **`quickstart.md`** scaffolded per feature — a human-runnable acceptance/smoke scenario.
- **Folded "analyze" checks into `spec_doctor`**: duplicate-AC-ID detection (`ac-uniqueness`),
  success-criteria presence, story prioritization presence.
- Kept EARS as the testable-behavior layer (NOT replaced by spec-kit's FR/Given-When-Then). Did NOT
  adopt the `uv`/Python `specify` CLI, `/speckit.*` naming, or `taskstoissues` (GitHub-coupled).
- Tests now 38 (MCP) + 24 (CLI).

## [1.4.0]

### Added — ideas adapted from GitHub Spec-Kit (SpillwaveSolutions/sdd-skill), kept local & zero-dep
- **Brownfield / reverse-engineering** — `spec_scan` (heuristic codebase inventory: stack, modules,
  endpoints) and `spec_coverage` (% of code modules with specs). New `/scan`, `/reverse`,
  `/coverage` commands + `references/brownfield.md`; a Brownfield mode in the skill.
- **Constitution** — `constitution.md` is now a core steering file (project principles/laws);
  `spec_doctor` checks it's present and the skill/`/prReview` check designs against it.
- **Multi-feature roadmap + dependencies** — `.specs/roadmap.json`, `spec_roadmap` (per-feature
  completion %, blocked status, overall %, cycle detection) and `spec_depend` (declare deps/order,
  **rejects circular dependencies**). New `/roadmap`, `/depend` commands.
- **Clarify phase** — `spec_clarify` surfaces requirement ambiguities/gaps (vague terms,
  placeholders, missing edge-cases/NFR/out-of-scope, missing IF…THEN, track-specific gaps) before
  design. New `/clarify` command, wired into Phase 1.
- **Spec ↔ code traceability** — `trace_check` now parses `_Implements: path_` task markers and
  flags missing files (orphaned specs).
- **Per-feature `checklist.md`** (track-aware) scaffolded with each feature; structured phase-summary
  guidance at every gate.
- Engine grew to **17 MCP tools** and **27 commands**; tests now 35 (MCP) + 23 (CLI).

## [1.3.0]

### Added — cross-tool support (works beyond Claude Code)
- **Universal CLI** `bin/dev-spec.js` (`dev-spec`) — the whole engine from any terminal or tool,
  even without MCP: `classify`, `init`, `create`, `list`, `status`, `doctor`, `trace`, `ears`,
  `next`, `done`, `approve`, `evals`, and `mcp-config` (prints ready configs per client). Added to
  `package.json` `bin`.
- **`AGENTS.md`** — portable, tool-agnostic version of the workflow (read by Codex CLI, Gemini CLI,
  and other agent tools).
- **Per-tool rule files** — `.cursor/rules/dev-spec-driven.mdc`, `.windsurf/rules/dev-spec-driven.md`,
  `.github/copilot-instructions.md` (a static instructions file, NOT a GitHub Action), and `GEMINI.md`.
- **`INTEGRATIONS.md`** — step-by-step setup + exact MCP config for Claude Code, Claude Desktop,
  Claude CoWork, Cursor, Windsurf, GitHub Copilot (VS Code), Gemini CLI, OpenAI Codex CLI, any MCP
  client, and plain CLI.
- **`integrations/`** — ready-made, path-filled config files per client (+ `integrations/README.md`
  mapping each to its destination). Root `.cursor/mcp.json`, `.vscode/mcp.json`, `.gemini/settings.json`
  make this folder MCP-enabled out of the box and double as live examples.
- `bin/test-cli.js` (17 assertions) added to `npm test` alongside `mcp/test.js` (27).
- README compatibility section.

The same local, zero-dependency engine now reaches every MCP/agent tool — still no GitHub Actions,
no cloud, no cost. Claude-specific slash commands/hooks remain Claude-only, but every function they
trigger is available via `dev-spec` and the MCP tools.

## [1.2.0]

### Added / Improved (semantic layer)
- **Multilingual classifier** — `SIGNALS` now covers EN/PT/ES plus technical synonyms across all
  three tracks, so Portuguese/Spanish feature descriptions classify correctly.
- **Weighted signals** — signals are split STRONG (enables a track alone) vs WEAK (needs
  corroboration). A lone weak signal (e.g. "agent", "model") is surfaced as `possible` rather than
  auto-enabling a track, cutting false positives. Confidence is reported per track.
- **Negation after the keyword** — detects "auth is not needed", "auth não é preciso", etc., in
  addition to "no auth" / "sem auth".
- **EARS in PT/ES** — `ears_validate` accepts `DEVE`/`DEVERÁ` (PT) and `DEBE`/`DEBERÁ` (ES) as
  modal verbs alongside `SHALL`, and recognizes EARS keywords QUANDO/ENQUANTO/SE/ONDE and
  CUANDO/MIENTRAS/SI/DONDE.
- **Expanded lexicons** — `VAGUE_WORDS` (EN/PT/ES weasel words) and the eval `REFUSAL` markers
  (EN/PT/ES) are much broader.
- Richer skill `description` triggers: more natural-language intents in EN/PT/ES.

## [1.1.0]

### Added
- **`spec_doctor`** — one health-check per feature (EARS lint + traceability + steering presence
  + design/Mermaid + mandatory +saas/+ai section completeness) returning a `readyToAdvance` verdict.
- **`spec_approve`** + `.specs/<feature>/.state.json` — auditable, resumable phase-approval gates.
- **Bidirectional `trace_check`** — also flags phantom AC/test IDs referenced by tasks (typos).
- **Local hooks** (`hooks/hooks.json`): PostToolUse lints `requirements.md` (EARS) and checks
  `tasks.md` (traceability) on save; SessionStart prints feature status. Optional git
  `pre-commit` validator (`hooks/precommit-check.js`). The free substitute for CI.
- **Local eval harness** (`mcp/evals/run-evals.js`) — runs golden/adversarial/regression sets
  against a model with your own `ANTHROPIC_API_KEY`; `--dry-run` works offline; `--set-baseline`
  records a baseline. Sample `golden.json`/`adversarial.json` scaffolded for +ai features.
- **Smarter classifier** — negation handling ("no auth", "sem LLM"), per-track confidence levels,
  and weak-signal flags.
- New commands: `/doctor`, `/approve`, `/eval`; aliases `/ds`, `/dsx`, `/dss`; PT/ES triggers.
- Project meta: `package.json`, `LICENSE` (MIT), `CLAUDE.md`, a combined-track worked example,
  and dev-guardian / ui-ux-pro-max handoff guidance.

### Fixed
- AC/test ID extraction missed IDs wrapped in markdown italics (`_US-1.AC-1_`) because `_` is a
  word char and defeated `\b`. Now uses a lookbehind guard; trace + EARS detect all IDs.
- Hook stdout could be truncated on Windows pipes (exit raced the flush); now flushes first.

## [1.0.0]

### Added
- Initial unified, track-based plugin merging four predecessor skills into one
  (`core` + optional `+tdd` / `+saas` / `+ai`), with a Phase 0 classifier.
- Local, zero-dependency stdio MCP server `spec-driven` with: `spec_init`, `spec_classify`,
  `spec_create`, `spec_list`, `spec_status`, `spec_next_task`, `spec_complete_task`,
  `ears_validate`, `trace_check`, `steering_scaffold`.
- 15 slash commands, a deep `references/` library, README, INSTALL, and a bundled
  `.claude-plugin/marketplace.json` for local install. No GitHub Actions anywhere.
- The four original skills preserved under `_archive/`.
