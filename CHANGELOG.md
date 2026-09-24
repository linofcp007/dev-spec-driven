# Changelog

All notable changes to **dev-spec-driven**. Format loosely follows Keep a Changelog;
this project versions the plugin as a whole.

## [1.12.0]

More ideas from [obra/superpowers](https://github.com/obra/superpowers) (MIT), rebuilt on the spec engine
so they extend the traceability chain rather than sit beside it.

### Added
- **Evidence before claims** (*verification-before-completion*). A new English-stable task marker
  `_Verify: <command>_` names the command that proves a task. `spec_complete_task {…, evidence:
  {command, exitCode, summary}}` records it in `.state.json`, a non-zero exit code **refuses the tick**,
  and a task declaring `_Verify:_` that is ticked without evidence is flagged by the result, by
  `spec_doctor` (new `verification` check), by `ROADMAP.md` ("needs attention") and by `spec_finish`,
  until the evidence is back-filled. CLI: `dev-spec done <feature> <n> --run` runs the task's own
  `_Verify:_` command(s) and records the result (a failure leaves the task open, exit 1), or
  `--evidence "…" --exit N --cmd "…"`. `spec_status` marks each task `verified`. Briefs carry the
  command and require its output in the implementer's report; the reviewer checks it.
- **Bugfix flow** (*systematic-debugging*): `/spec-bugfix`, `spec_create {kind: "bugfix"}`,
  `dev-spec bugfix "<name>"`. It scaffolds `bug.md` (reproduction · expected vs actual · root cause ·
  fix · regression test), a one-story `IF … THEN THE SYSTEM SHALL …` requirement, a regression test plan
  and the fixed order reproduce → root cause → failing regression test → fix → verify, in EN/PT/ES.
  `spec_doctor` **fails until the root cause is written** (no fix before the cause is known); design.md
  isn't required. `references/bugfix.md` covers the four phases, the "three failed fixes → question the
  design" rule and the red flags.
- **`spec_finish` / `/spec-finish` / `dev-spec finish`** (*finishing-a-development-branch*), tool #23.
  It reports the blockers (doctor fails, open tasks, tasks without evidence, pending approvals) and the
  track-gated checks to run fresh, and **generates the PR title and description from the spec chain**:
  summary, root cause/fix, ACs, tasks with their evidence, tests, checks, spec files. `write:true` puts
  it in `.execution/pr-description.md`. Then the user picks: merge locally, open a PR, or keep the
  branch. It never merges or pushes by itself.
- **`/spec-review-feedback`** (*receiving-code-review*, anchored in the spec): every comment is
  verified and classified before any change. AC violation → fix; spec change → back to its phase for
  approval; out of scope / YAGNI → reasoned push-back citing `Out of Scope`; unclear → ask; no
  performative agreement. See `references/review-feedback.md`.
- **`spec-critic` agent + `/spec-doctor --deep`** (*brainstorming's spec reviewer*): a semantic review
  of the artifact at its gate — completeness, contradictions, ambiguity, testability, scope, YAGNI,
  track coverage, and for bug.md an evidence-backed root cause.
- **Global Constraints** (*writing-plans*): a `## Global Constraints` section in every `tasks.md`
  (EN/PT/ES headings), inlined verbatim into each task brief.
- **Bounded mode** (*brainstorming's three paths*): between Vibe and Spec, a contained change to an
  existing flow gets a short design in chat and an explicit yes, with no artifacts. The ratchet is
  one-way: hidden complexity upgrades the mode.
- **Parallel `[P]` tasks** (*using-git-worktrees* + *dispatching-parallel-agents*):
  `spec_next_task {batch: true}` / `dev-spec next --batch` returns the next open task plus the following
  `[P]` tasks of the same section with declared, disjoint `_Implements:_` files. The subagent protocol
  gains a parallel mode (one worktree per implementer, merge one at a time, full suite after each) and
  a **baseline-green** precondition.
- **Red flags & rationalizations** per phase (`references/red-flags.md`), including the TDD iron law.
  **Verification reference**: `references/verification.md`.
- **Plugin evals** (*writing-skills: test the skill under pressure*): `evals/` cases for
  `claude plugin eval` check that the workflow triggers on planning and bug-fix requests in EN/PT/ES and
  stays silent on unrelated ones. They run locally and cost tokens (never CI). Results are git-ignored.
  The case layout matches `claude plugin eval init --bare` (CLI 2.1.282); run with `--ablation none` so the
  `tool_used: Skill` graders are scored rather than shown as indicators. First run: **5/5 cases at 1.0**
  (15 runs, $1.71). `claude plugin validate .` passes, and the eval harness loaded the MCP server through
  `plugin.json → mcp/servers.json`, which confirms the 1.11 move.

### Fixed before release (independent review of 1.12)
- A failed re-check of an already-ticked task is now recorded, and the task counts as **unverified**.
  Before, it was discarded and the old passing evidence stayed. A non-integer `exitCode`, or a command
  given without its exit code, is rejected; summary-only evidence counts as a manual attestation.
- Parallel batches never cross a `**Checkpoint:**` and never include +ai prompt tasks.
- `_Verify:_` values lose wrapping backticks, and a `[placeholder]` is not treated as a command.
  `done "" --run` fails before running anything.
- `add_track saas|ai` on a bugfix creates `design.md` with the track sections. A different explicit
  `kind` on an existing feature is reported (the stored kind wins). `spec_finish` is never ready with zero
  tasks. `next_action` prompts the test-plan / eval-plan gates.
- PR body: evidence collapsed to one line with safe code spans; the title keeps "e.g." inside the
  sentence. ES bugfix tasks are titled "Tareas".

### Changed
- `spec-implementer` must report `_Verify:_` evidence; `spec-reviewer` checks it (missing or
  non-zero evidence is Important).
- `SKILL.md` stays at ~540 lines: Brownfield, Language and a few supporting sections were condensed
  into pointers to their references.

## [1.11.0]

### Added
- **Subagent-driven execution (Phase 6, opt-in).** `/executeTask <feature> --subagents` (and `/dsx`):
  the main session becomes a controller that never writes feature code. Per task it writes a brief,
  dispatches a fresh **`dev-spec-driven:spec-implementer`** agent, sends the diff to a **`dev-spec-driven:spec-reviewer`** agent
  (verdict per AC ID + code quality + track checks), runs a fix loop capped at 5 rounds (rounds 4–5
  on a fresh, more capable implementer), and only then calls `spec_complete_task`, so a ticked task
  means *implemented and reviewed*. It runs on its own within a story, **stops at every
  `**Checkpoint:**`** for human review, and sends any finding that would change an AC, the design or a
  planned test back to that phase. +ai prompt/eval tasks stay inline. There is an append-only ledger
  for resume after compaction, a pre-flight conflict scan, per-role model selection and a track-aware
  final review. Protocol: `references/subagent-execution.md`. Adapted from the
  `subagent-driven-development` skill of [obra/superpowers](https://github.com/obra/superpowers) (MIT).
- **`spec_task_brief` MCP tool + `dev-spec brief <feature> [n] [--write]`** (tool #22). Builds a
  self-contained brief for one task (the next open task by default). It includes the task,
  story/phase/`[P]`/closing checkpoint, the full EARS text of each AC in `_Requirements:_`, the
  test-plan row of each T-ID in `_Makes green:_`, the evals/metrics/files markers, the design sections
  that mention the task, the steering files to read, unresolved (phantom) references, and the
  definition of done for the task's loop. It is generated in the feature's language (EN/PT/ES).
  `write:true` writes `.specs/<feature>/.execution/` (a self-ignoring workspace plus `ledger.md`) and
  returns paths instead of content. It is useful in any tool, subagents or not.
- **Plugin agents** `agents/spec-implementer.md` and `agents/spec-reviewer.md` (task / re-review /
  final modes).

### Changed (heads-up)
- **Renamed the four commands that collided with Claude Code built-ins:** `/init` → `/spec-init`,
  `/status` → `/spec-status`, `/doctor` → `/spec-doctor`, `/commit` → `/spec-commit`. A bare `/doctor`
  ran Claude Code's own doctor, and our messages told users to "run /doctor". `/dss` still points at
  status. If you invoked the old namespaced forms (`/dev-spec-driven:doctor`), use the new names.
- **The MCP server registration moved from a root `.mcp.json` to `mcp/servers.json`** (referenced by
  `plugin.json → mcpServers`). A root `.mcp.json` is also read as a *project* config when the repo is
  opened directly, where `${CLAUDE_PLUGIN_ROOT}` is undefined. That caused the `CONNECTION_CLOSED` error
  in every maintainer session.
- **CLI exit codes:** `dev-spec doctor` (FAIL), `trace` (gaps) and `ears` (errors) now exit 1, so they
  can be used in scripts.
- **`spec_create` tracks are optional in MCP too.** Without tracks a NEW feature is auto-classified
  from name + summary (an existing feature keeps its tracks), the same as the CLI (which gains `--summary`). New `dev-spec steering <file>` subcommand,
  equivalent to `steering_scaffold`. The CLI honours `CLAUDE_PROJECT_DIR` like the server.
- **Everything the engine returns is trilingual:** errors, EARS issue messages (plus a stable `code`),
  classifier notes and reasoning (in the description's language, or `lang`), doctor section names,
  SessionStart lines and pre-commit output. EN text is unchanged.
- The two plugin agents no longer restrict `tools:` (behaviour with unknown tool names is undocumented,
  so a Windows-only `PowerShell` entry could break them elsewhere). Read-only / no-subagents stay as
  rules in the prompts.
- `SKILL.md` is ~530 lines (was ~590): the command table, the annotated `.specs/` tree and the roadmap
  details moved to `references/tooling-reference.md`.

### Fixed — full plugin review (6 parallel reviewers + a final review of this release; every fix has a regression test)
- **Critical: `spec_feature remove` could delete the whole `.specs/`.** A name that slugifies to `""`
  (non-Latin text such as `日本語`, `...`, a missing name) resolved to `.specs/` itself. Every
  name-taking operation now goes through one resolver that rejects empty slugs, `steering` and Windows
  device names (`nul`, `con`, …). The MCP server also validates each tool's required arguments, so a
  missing `name` no longer creates `.specs/undefined/`.
- **Data loss on unreadable JSON.** A `roadmap.json` / `.state.json` with a typo was read as empty and
  then written back, erasing dependencies, backlog, approvals and the project language. Such files are
  now reported and left untouched. A UTF-8 BOM (Windows editors) is accepted. Writes are atomic.
- **The hooks overwrote a hand-written `.specs/ROADMAP.md` in any project.** Only files that carry the
  `AUTO-GENERATED` marker are regenerated, and the hook only acts on dev-spec projects.
- **EARS (PT/ES):** `DEVERÁ`/`DEBERÁ` were never recognised (JS `\b` is ASCII-only), so correct
  criteria hard-failed `doctor`. Numbered prose under Assumptions/Pressupostos ("O utilizador já se
  registou") and template prose ("Cada história deve…") are no longer linted as criteria. ES `SI` was
  added, and `clarify`'s unwanted-behaviour check now looks for IF/SE/SI…THEN (it used CUANDO = WHEN).
- **`doctor` passed a `[SaaS] Observability` section still marked TODO** once an `[AI] Observability
  for AI` heading existed. Sections now prefer the track-marked heading and skip fenced code. An empty
  section counts as unfilled, and zero criteria is a warning, not a pass. AC uniqueness counts
  definitions, not references.
- **`next_action` said "re-review tasks.md" for the whole execution phase.** Approvals now record a
  content fingerprint, and checkbox ticks don't count as edits.
- **Tasks:** a duplicated task number re-ticked the first line forever, and `1.1 sub-step` was parsed
  as task 1. `_Implements: src/user_service.py_` was cut at the underscore. A scaffold whose tasks are all
  still `[bracketed placeholders]` reported phase `tasks-ready`.
- **`spec_depend` with only an order wiped the dependencies.** The CLI now takes `--order 3` /
  `--cap 10` / `--by NAME` (space form) instead of turning `3` into a dependency.
  `roadmap --write --json` prints valid JSON, and the codex TOML path is safe for `'`.
- **`spec_roadmap {lang}` silently changed the project language.** The roadmap chrome now has its own
  `meta.roadmapLang`. `html:true` implies writing.
- **MCP protocol:** a `null` message crashed the server. Malformed JSON gets `-32700`, notifications
  never get a response (and never run tools), and `initialize` negotiates a supported protocol version.
- **The test harness exited 0 when the server died mid-run.** It now fails on early exit and times out
  each request.
- **Hooks:** they now survive a `null` payload or a non-string `file_path`, flush before exit, have a
  10 s timeout, and the stdin safety net can't run the hook twice. The **pre-commit validator** checks
  the **staged** content (`git show :path`), not the working tree, supports nested `.specs/`, and its
  install snippet no longer blocks every commit if the plugin folder moves.
- **Eval harness:** the default model is `claude-sonnet-5` (was the previous generation), with room for
  adaptive thinking (`max_tokens` 4096). A dry run with an invalid set now exits 1, and
  `--require-live` refuses to fall back to a dry run without a key. The references recommended pinning
  `claude-sonnet-4-6-20250929`, which doesn't exist; they now pin exact published IDs.
- **Skill:** the `description` was 2,577 characters, over the Agent Skills 1,024 limit and a likely
  cause of Desktop sync failures. It is now 1,015, and the long trigger lists moved into a "When to use
  this skill" section. `/grill` was added to the command reference, and `steering-templates` now
  lists 9 templates.
- **Wording:** `/tasks` (non-existent) → `/createTask` in `next_action`. PT-PT fixes: *concorrentes →
  simultâneos*, *imposto → garantido*, AO90 forms, and *página → alerta imediato*. ES (Spain): *corre →
  ejecuta*, *ligar → vincular*, *caché*. Slugs now transliterate accents (`Autenticação` →
  `autenticacao`); folders created with the old slug are still found.
- **Caught by the final review before release** (regressions this release had introduced): sections
  filled under `###` sub-headings read as empty (the plugin's own `scale-design-template.md` failed
  `doctor`); `_Affects evals:_` on ordinary code tasks made them inline-only prompt tasks (they now keep
  their tdd/core loop plus an eval check); briefs could show the wrong criterion when one AC mentions
  another; Kiro-style `1.1` sub-tasks became separate briefs; `_Implements:` mid-line; bracket-style
  tasks read as complete after one tick; EARS false errors on open questions, `SI units`, pt-BR
  *Critérios de Aceite*, sub-headings under an AC heading and plural `DEBERÁN`/`DEVERÃO`; `ears_validate`
  missing legacy slugs; an existing `aux` folder that could not be renamed; the hook skipping v1.8-era
  projects.
- **Classifier:** the PT contraction *no* (em+o) no longer negates ("desconto aplicado no checkout" →
  +tdd), while EN "no auth" and ES "no usa LLM" still do. Prose pairs such as `login/signup` and
  `RAG/embeddings` are matched, and paths like `src/rag.ts` still aren't. PT/ES plurals (`migrações`,
  `suscripciones`, `limites de taxa`) are recognised, and new signals were added (*subscrição, sessão,
  sesión, modelo de linguagem/lenguaje, language model, resumir*). `spec_classify` now uses its `name`.
- **EARS reports every vague term** in a criterion, not just the first. The PT/ES vague-word lists now
  include feminine forms and counterparts of *real-time, lightweight, clean, optimal, as needed*.
- `spec_create` on an existing feature keeps the feature's language and says so, instead of mixing
  languages. `spec_coverage` matches whole slug segments ("ui" no longer documents "build-tools") and
  reads only the top-level listing. A JSON-RPC batch gets one array reply. An unexpanded `${VAR}`
  project dir is ignored.
- **Caught by a third review** of the remaining-items round: the language guess read ordinary
  English ("Do the export", "example.com", "USA offices", "Canada") as PT/ES and stopped negating;
  English multi-word keywords got plurals ("tools used" → *tool use*, "loads test" → *load test*); the
  twin keywords `sessão`/`sessao` counted twice; `spec_create` without tracks re-classified an
  existing feature (it now keeps its tracks, and a string `tracks` is accepted again); extensionless
  paths like `routes/login` were split; *leve* ("não leve mais de 5 s") was flagged as vague; the
  pre-commit spoke the project language instead of the feature's; scan/coverage notes were English-only.
- **Docs:** stale `bin/` paths in INSTALL.md, and test/tool/command counts across README, INSTALL,
  CONTRIBUTING, llms-install and CLAUDE.md. The release checklist now includes `marketplace.json`, and
  a test asserts that all three versions agree.

## [1.10.1]

### Fixed
- **Marketplace sync failed on Claude Desktop / claude.ai.** The top-level `bin/` directory is now
  `cli/`. Desktop does not clone the repository — it delegates validation to a remote Anthropic
  service, which rejected the plugin with `status=failed_content`: *"Plugin contains a top-level
  bin/ directory ('bin/dev-spec.js', 'bin/test-cli.js'). claude.ai-hosted plugins may not ship bin/
  executables because they are added to PATH on the CLI but are not shown on the admin approval
  surface. Declare executable entry points via hooks, commands, or mcpServers instead."* The UI
  surfaced this only as **"Marketplace sync failed. Check the repository URL"**, which is misleading
  — the URL was always correct. Installing through the Claude Code CLI was never affected, because
  it uses a local `git clone` and skips this validation, so a passing CLI install is not evidence
  that Desktop will accept the plugin.
- The universal CLI is now `node cli/dev-spec.js` and its smoke test `node cli/test-cli.js` — same
  commands, same assertions. `package.json` (`bin`, `test`, `cli` scripts) and all 16 referencing
  files were updated: `README.md`, `INSTALL.md`, `INTEGRATIONS.md`, `CONTRIBUTING.md`, `CLAUDE.md`,
  `AGENTS.md`, `GEMINI.md`, `llms-install.md`, `examples/`, `integrations/` and the per-tool rule
  files for Cursor, Windsurf and Copilot.

## [1.10.0]

### Added
- **`/grill` — planning-time interrogation of your *understanding*, not just the text.** The sharp,
  decision-tree cousin of `/clarify`: it runs the dev-grill engine (or an inline fallback) over a
  feature's significant decision-branches — business rules, validation → failure paths, in/out of
  scope, the language-agnostic I/O contract, edge cases — one question at a time, then folds the
  resulting shared understanding into `requirements.md` as EARS acceptance criteria and filled-in
  edge-case / out-of-scope / non-functional sections. `/clarify` now points to it for deeper passes.
- **`references/improvement-specs.md` — how to spec internal-improvement work.** Defines the
  *improvement spec*: a feature whose success criterion is a **re-measurable metric delta** (coverage
  floor, size budget, complexity, dead-code, perf/security budgets pulled from the project's guardian
  budgets) rather than new behaviour, with a mandatory behaviour-preserving guard (+tdd
  characterization tests) so "cleaner" never means "broken". Closes the dev-guardian loop: gate
  measures → seeds specs → grill → execute → re-run the gate to prove the delta. `/backlog` now
  routes `guardian-improve` seeds here, and the reference is indexed in the skill's library.

## [1.9.3]

### Fixed
- **Roadmap progress no longer reads ~70% before any code is written.** The completion percentage
  was derived purely from the *phase*, so a fully-planned feature (phase `tasks-ready`, zero tasks
  implemented) reported **70%**, and an `executing` feature reported a flat **85%** regardless of how
  many tasks were actually done — even though implementation is the bulk of the work. Planning now
  tops out at **30%** and the implementation span (`executing` → `complete`) is driven by the *real*
  fraction of tasks completed (`featurePercent`, using the counts `detectPhase` already parsed): a
  planned-but-unimplemented feature reads **30%**, `executing` 2/4 reads **65%**, and only `complete`
  reaches **100%** (in-flight `executing` is capped at 99% so it never masquerades as done). Applies
  to `spec_roadmap`, the generated `ROADMAP.md`/`.html`, and the roadmap-updated message. Regression
  test added.

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
