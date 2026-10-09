# Project templates, scoped steering, imports and exports

Maintainer notes, one topic of the map in [CLAUDE.md](../../CLAUDE.md) — the index and the hard constraints.
`.specs/templates/`, steering front matter, the `spec_import` sources, and every export (HTML / md / CSV, Gherkin,
trackers, ADRs, release notes, milestones). The rules come first; how they came to be — the releases and review findings —
is in History at the end.

## Project templates — `.specs/templates/`
- **Resolution:** `.specs/templates/<lang>/<artifact>.md`, then `.specs/templates/<artifact>.md`, then the built-in i18n
  builder (`templateOverride()`); a pt-BR feature reads `pt-BR/`, then `pt/` (`templateLangChain()`).
- **Only allowlisted names are read:** `TEMPLATE_ARTIFACTS` (the phase artifacts, the bug and spike variants, `change`) and
  `steering/<file>.md` (a known stub or a name steering_scaffold accepts). Every path is built from the allowlist and
  `LANGS`, never from a caller's string; at most three levels, no dot files, no linked folder, no file whose real path
  leaves the project; `init` never writes through a link. Files are read BOM-stripped, LF; a whitespace-only one is ignored.
- **Who uses them:** `createFeature` (so `spec_import` too), `applyTracks`, `initProject`, `scaffoldSteeringFile` — all
  create-only (`writeIfAbsent`), naming the templates used (`templates`). A sized feature's built-in scaffold follows its
  size; a project template is written as it says.
- **Variables** (case-insensitive, inner spaces allowed): `{{name}}` `{{slug}}` `{{summary}}` `{{tracks}}` `{{lang}}`
  `{{date}}`; an unknown one stays as is; no summary → the language's generic slot (`[TBD]`, `[a definir]`,
  `[por definir]`), still a placeholder. Steering: name and slug are the project folder's, tracks init's; a spike's
  summary is its question.
- **The summary is written through `safeSpecText`** wherever a scaffold holds it, as are the bug prefill and the spike
  question: a raw `<!--` pairs with the scaffold's closing EARS-guidance `-->` and hides every criterion. `createFeature`
  classifies the RAW text (`writtenSummary` is only what is written).
- **Track blocks — ONE rule for an overridden design / requirements / tasks / test-plan:** each active track's built-in
  block is appended as spec_add_track appends it (`trackDesignBlock`, `trackTaskBlock`, `trackRequirementsBlock` and
  `trackTestRowsBlock` numbered after the template's own IDs, from `trackIdMap`) — UNLESS the template already carries the
  track (its marker on a real heading, the localized Testability Notes, its task-block heading; a test plan citing its
  criteria). Every other artifact, the bugfix and spike variants included, is written as the template says.
- **Placeholder corpus:** `projectTemplateSets()` adds the templates' bracket texts, code-span slots and task lines (bug.md's
  join `bugTemplateSlots()`), so an untouched custom scaffold reads placeholder to doctor, approve and next_action. Scoped
  to the engine call's
  `.specs/` (`TEMPLATE_SCOPE_ROOT`, set by `specsRoot()`), memoized per call, dropped on a write under `templates/`
  (`forgetCached`), parses cached by content (`TEMPLATE_PARSE_CACHE`). A slot holding a variable matches through a LINEAR
  wildcard (`templateWildcard`) — never a regex built from template text.
- **Reserved slugs:** `RESERVED_SLUGS` (`steering`, `exports`, `templates`, `tracks`) are refused for a new feature
  (`resolveFeature`). **Legacy exception** (`reservedSlug(name, root)`): a `templates/`, `exports/` or `tracks/` folder
  holding a `.state.json` is a feature made before its name was reserved and stays one; a legacy `templates/` is never
  read as templates (`templateFileList()` returns nothing, `spec_templates` refuses with `legacyFeature: true`, the
  PostToolUse hook and the pre-commit check treat it as a feature).
- **`check`** applies the current rules (track sections and their `> **TODO**`, EARS and AC / T-IDs across the trio,
  bug.md's Root Cause slot, unknown variables, slot-less chain templates, empty or stray files) →
  `{file, line?, code, severity, message}` + verdict pass | warn | fail; the CLI exits 1 on an error.

## Scoped steering
- **Front matter** (`steeringFrontMatter()`, Kiro-compatible): `inclusion: always | fileMatch | manual` +
  `fileMatchPattern` (string or list). None → the brief's default files (constitution / tech / structure + the active
  tracks' files) count as `always`, others stay out; no `inclusion` → `always`; an unknown mode (Kiro's `auto`) →
  `manual` — listed, never injected silently.
- **The brief:** `briefSteering()` quotes a matching `fileMatch` file's body (front matter and guidance comments stripped,
  within `BRIEF_STEERING_BUDGET`) and lists the `manual` ones. `steeringGlobMatch()` is linear with capped brace
  expansion — never a backtracking regex.
- **Custom names** (`steering_scaffold`): `^[a-z0-9][a-z0-9-]{0,62}\.md$`, never a Windows device name or a prototype key.
  Doctor's `steering` check warns about files still templates.
- **Imported steering** (Import sources → Steering sources) is real content, read like any file here — never a template.

## Import sources and the brownfield scan
- **The tools** — `spec_import {tool}`, one exact enum on both surfaces: `kiro`, `spec-kit`, `openspec`, `plan`,
  `execplan`, `bmad`, `fluidplan` make a feature; `kiro-steering`, `cursor-rules` steering files. A feature import is
  always a NEW feature, the source only read, with a mapping, warnings, `counts`, the localized "Imported from" note and
  tracks auto-classified unless given; nothing is dropped silently (unmapped text goes to design.md or requirements.md,
  or into a warning). The design-first flow: gates-and-approvals.md → Flows.
- **`spec_import` stays inside the project.** `importSourceAt()` (import/index.js, shared by the steering import): the
  path must resolve inside `projectDir` lexically (nothing outside is even stat'ed), then by real path; it is only read.
  No hidden segment (`importHiddenPart`, also by real path) except an importer's own folder as the first segment
  (`IMPORT_DOT_ROOTS`) and `.claude/plans/`; a source FILE must be a document (`IMPORT_SOURCE_EXT`), every file a
  parser reads a known kind (`IMPORT_READ_EXT`, else `wUnreadable`). Codes: `import-outside`, `import-not-found`,
  `import-hidden`, `import-not-source`. Over MCP an explicit non-default `projectDir` must hold a dev-spec `.specs/` (`project-no-specs`,
  mcp.md → Argument validation); the CLI gets the engine's rules only.
- **The import cap:** `IMPORT_MAX_BYTES` (2 MiB) counts CHARACTERS after decoding. Inline text or any file a parser reads
  over it refuses the WHOLE import (`tooLarge: true`, `importSpec.tooLarge`) — never a silent cut. A file over 3 × the
  cap (a text holds ≥ 1 character per 3 bytes) is refused from its stat, unread.
- **What an import writes:** the name is one line (`flatText`) and comment-inert (`specNameText`; a title's `<!--` is
  escaped before its slug is taken); every requirements.md line is comment-inert (`commentInert`, `inertBlock`); the
  track design and task blocks follow the body through `appendSpecText` (an open fence closed first); an archived twin
  slug is a warning (`createArchivedTwin`); the roadmap is refreshed ONCE, at the end (createFeature's
  `{ refresh: false }`).
- **No usable title** (a parser's `nameHint` slugifying to nothing, `# Добавить тёмную тему`) → its `nameFallback` (the
  file's stem, the folder, fp.id); inline text has none → `importSpec.noUsableTitle`.
- **Dry run** (`dryRun: true`, CLI `--dry-run`): `importRun` inside `withDryRun` (conventions.md → The dry-run sink) — the
  same reads, refusals and rendering, nothing written (`isDryRun()` also skips `maybeRefreshRoadmap`). `dryRunResult` =
  the real result or refusal + `dryRun: true` + a `preview` of the files under `dir` (first-write order, no dot files,
  each ≤ `DRY_RUN_FILE_CHARS` cut at a line end, ≤ `DRY_RUN_TOTAL_CHARS` in all). mcp/tests/13-imports-1-25.js compares
  it with the real import, file by file.

### The sources
- **`plan`** — a Claude Code plan-mode file (its default plansDirectory, `~/.claude/plans`, is outside the project: the
  refusal says to copy it in) or a Cursor `.cursor/plans/*.plan.md`. Goal and acceptance bullets → US-1's criteria (EARS
  as written, else `[NEEDS CLARIFICATION]`); a command-only bullet, even with a trailing "and expect …" (PT, ES too —
  `planCommandOnly()`), stays in design.md. Tasks, state kept: checklists, else Cursor todos, else a Steps or
  Implementation section (Approach only alone), else the sub-headings. Named paths → `_Implements:_` (`planPaths()`: no
  URL, absolute or home path, `..`, alias, glob; `:line` and `#L10` dropped; a bare name needs a `PLAN_FILE_EXT`
  extension — scan.js's code and test ones minus `PLAN_EXT_AMBIGUOUS`, whose `conf.d` or `args.cmd` need a folder — or a
  docs, config or data one). A folder holding several plans is refused.
- **`execplan`** — a Codex PLANS.md: Validation and Acceptance → criteria; Progress and Concrete Steps → tasks
  (deduplicated); a check command → `_Verify:_` (`planCommand`) with its leading `cd <dir> &&` KEPT — the runner reads the
  command after it, and without it `done --run` runs at the root; Decision Log → design.md `## Decisions`; Purpose →
  summary; living sections → design.md.
- **`bmad`** — the PRD (`docs/prd.md`, sharded `docs/prd/`, v6 `_bmad-output/planning-artifacts/`): FR and NFR lines →
  FR-n, NFR-n; stories (a story file wins over the PRD's copy) → US-n with their ACs; Tasks and Subtasks → `[USn]` tasks,
  `(AC: 1, 3)` → `_Requirements:_` (an uncited nested unit inherits its parent's); architecture and Dev Notes →
  design.md. One story file imports one story.
- **`spec-kit`** — scenarios: numbered items, else bullets only under an explicit "Acceptance Scenarios" label.
  `specKitTaskMarkers()` adds the `_Requirements: US<n>_` and `_Implements:_` sub-lines a task lacks.
  `specKitDesignDocs()` appends research.md, data-model.md, contracts/ and quickstart.md to plan.md under localized,
  demoted headings (`importSpec.skDocs`, `demoteMd`); a non-markdown contract is fenced (`SPECKIT_CONTRACT_EXT`); at most
  `SPECKIT_CONTRACTS_MAX` contracts, two levels deep, the rest named in the "not imported" warning; no plan.md →
  `wNoPlanDocs`.
- **`fluidplan`** — `.fluidplan/<id>/` (plan.json, PLAN.md, DECISIONS.md, also at the `output` / `outputDir` paths —
  `fpConfig`) or PLAN.md inline; the finalized PLAN.md and DECISIONS.md win, plan.json and answers.json fill in or stand
  alone (`fpFromPlanJson`). Pages → stories, acceptance → criteria, files → `_Implements:_` (a delete → "To delete"),
  commands → `_Verify:_`, after → `_Depends:_` (cycle edges dropped, `wCycle`); settled decisions → decisions.md
  (`decisionEntryLines`) and design.md, rejected → Out of Scope, open or `mixed` → "Open decisions" with
  `[NEEDS CLARIFICATION]`; working rules → Global Constraints, a page intro no story carries → `## Themes`. A plans
  folder counts only when its real path is inside the project. Pinned to fluidplan 755d1b2 (2026-09-26).
- **Imported text is written inert:** one value, one line; marker look-alikes and AC, T, EC, NFR, SC IDs escaped
  (`fpInert` — `_Verify\:`, `US-7\.AC-1`), inside code spans too; comment delimiters neutralized; heading, task and
  checkpoint escapes per line, an unclosed fence closed (`fpLine`, `fpProse`) — only fluidplan's `verify` field makes a
  `_Verify:_`. A comment inside an inline code span stays as written (`inertOutsideCode`) only in requirements.md prose;
  design.md, decisions.md (the code-span-blind `blankHtmlComments` reads it), tasks.md and the name escape it everywhere.
  Every pattern is linear (`FP_LINE_MAX`, `sortGroup` = Kahn + a min-heap). Never write a raw U+2028 / U+2029 (nor its
  `\u` escape through the Edit tool) — build it (`FP_LS_PS`). Exports undo the escapes: `expInline` (`RE_MD_ESCAPE`),
  `mdPlainText()` (Gherkin, the CSVs, the HTML `<title>`).

### Steering sources
- **Where:** `importSteering` (import/steering.js) writes `.specs/steering/<name>.md`, no feature. `path` is optional
  (`STEERING_IMPORT_TOOLS`: server.js's `REQUIRED_ONE_OF` `unless`, the CLI's usage) — none → the
  `STEERING_IMPORT_DEFAULTS` that exist; a folder → its top-level `.md` (Cursor: `.mdc`, `.md`) files, the rest named
  (`wOthers`); `name` and `tracks` are refused (`featureArgs`). The file name is the stem slugified
  (`steeringTargetName`, `customSteeringError`'s rule).
- **Kiro:** front matter kept verbatim, else `inclusion: always` written in (Kiro's default; without it dev-spec would
  leave the file out of every brief); `auto` → `wMode`. **Cursor:** `ruleFrontMatter()` reads leniently (`globs: *.ts`
  is no YAML): `alwaysApply: true` → always; `globs` → fileMatch (`cursorGlobs`: a folder-less glob → `**/` + it, as
  Cursor matches at any depth; quoted in the quote kind it lacks — `globQuoted`; holding both → left out, `wGlobs`); else
  manual. `.cursorrules` → `cursorrules.md`; the plugin's own `dev-spec-driven.mdc` is skipped (`own`).
- **Create-only:** one provenance comment after the front matter (`importSteering.note`); `existsRaw` then
  `writeIfAbsent` — an existing file is skipped (`exists`, plus `template: true` for an init stub: delete it, import
  again). Other skips: `duplicate`, `empty`, `too-large` (also `STEERING_IMPORT_MAX_CHARS` per call), `outside`,
  `unreadable`, `name`; at most `STEERING_IMPORT_MAX_FILES` per call (`wLimit`); a linked `.specs/steering/` is refused
  (`linkedSpecsFolder`).

### The brownfield scan and coverage
engine/scan.js — area 13 of the suites.
- **The cap counts code:** `walkProject(…, {counts, gitignore})` counts toward `cap` (scan 5000, coverage `COVERAGE_CAP`)
  only code (`isCodeFile`, not a fixture) and the scan's manifests; every other file is still visited, and
  `WALK_ENTRY_CAP` ends a huge tree. `truncated` = a counted file (past the entry cap, any entry) was left unvisited
  (`filesScanned`, `codeFilesCounted`).
  The other walks (globs, trace, finish) pass no `counts`.
- **Generated folders** (`gitignoreRules()`): only the root `.gitignore`'s PLAIN directory patterns (names, anchoring
  slashes, simple classes like `[Bb]in/`, case folded where the file system folds it) skip a folder; wildcards, escapes and
  negated classes are ignored — a pattern read wrongly would hide code. A nested folder whose own `.gitignore` ignores
  everything (`gitignoresAll`) is skipped too; never a built-in `bin`; `testdata/` is a fixture (`isTestFixture`).
- **Negations:** a root pattern a negation could re-include is not applied (`gitignoreNegationReincludes()`: the
  negation's LAST name, `/**` reading as any, against the pattern's — a DP exact for classes; line order ignored); a
  nested `.gitignore`'s negations switch it off for that subtree only (`folderGitignore`, `reincluded(text)`,
  `gitignoreOffMerge` — a new set per folder). Past `GITIGNORE_MAX_NEGATIONS`, `GITIGNORE_NESTED_MAX`, the one
  `GITIGNORE_NEGATION_BUDGET` or `GITIGNORE_MAX_CHARS`, every root pattern goes off below (`GITIGNORE_ALL_OFF`).
- **Read as Git reads it:** `gitignoreLines` skips a BOM and drops only TRAILING unescaped spaces (never a trim);
  `gitignoreHead` reads UTF-16 (PowerShell 5.1's `echo lib/ > .gitignore`) as no pattern; a root file over
  `GITIGNORE_MAX_CHARS` applies none; the ignore-all test reads `GITIGNORE_ALL_HEAD` + 1 characters. Known limit:
  `toLowerCase` folding, while Git's `core.ignorecase` folds ASCII only.
- **Manifests and entrypoints:** the root manifest only as a file or an inside link (`projectFileInside`); nested ones
  (`NESTED_MANIFESTS`, never under a `MANIFEST_FIXTURE_DIRS` folder such as docs or examples) name the stack, the first
  `NESTED_MANIFEST_CAP` give frameworks and test runners; only the root package.json gives entrypoints. Never a test file
  (`isTestFile`); `@SpringBootApplication` only in a `.java` or `.kt` source; a package.json with no dependency is
  "node". ASP.NET `[controller]` and `[action]` are resolved (`aspActionName`).
- **Edges:** a projectDir that is no folder → `brownfield.notFolder` (CLI exit 1). coverage binary-searches keys sorted
  once per call (`implementsTargets(…, sorted)`, `keysWithPrefix`).

## Stakeholder export and release notes
- **`spec_export`** with `write` → `.specs/exports/<slug>.<html|md>` (csv: `<slug>.rtm.csv`, markdown-and-trace.md →
  Requirements traceability matrix); the project's `project.<fmt>`, a feature slugged `project` `project.feature.<fmt>`;
  the `RE_AUTOGEN` marker. Without `write` and `includeBody` (the MCP default), html and md return a markdown preview
  (`EXPORT_PREVIEW_CHARS`, `bytes`, `hint`).
- **Never over a hand-written file** (`isGeneratedOrAbsent()`) **and never through a link:** `specsWriteContained()`
  (engine/files.js) refuses, before any read or write, a `.specs/exports/` or document that is a link or resolves outside
  the real `.specs/`, in every format (`stakeholderExport.exportsLinked`).
- **The document:** a feature in its language, the project in the project's. The HTML is offline by construction: a
  zero-dep renderer (`expInline`) escapes EVERY text run (`htmlEsc`), links only http(s) and mailto, shows an image as its
  alt text and loads no font, script or stylesheet URL (a test asserts it). "Changed since" approvals go by content
  fingerprint only — a file date is no evidence. A change exports as itself (`planPhase` gives its approval row); a story
  written as its own `## US-n` section appears once.
- **Release notes** (`format: "changelog"`) read the spec data only — no model, no git log. Added: features shipped since
  `since` (a finish `{write}` baseline or the completing execution sign-off — a role's `partial` is none), with their
  user-story ACs (template criteria left out), never twice. Changed: the changes shipped (`changed.changes`), ACs
  superseded by a feature shipped since and change requests since, with the current text. Fixed: bugfixes and their root
  cause. Never a spike. `since`: an ISO date (00:00 UTC) or timestamp, `last` (default: `meta.changelogAt`, everything
  while unset) or `all`. `write` → `.specs/RELEASE-NOTES.md` (never over a hand-written one) and stamps
  `meta.changelogAt`, under the roadmap lock; nothing to report → nothing written or stamped (`note`).

## Exports and planning
- **Formats** — `EXPORT_FORMATS`: html, md, csv, gherkin, jira, linear, adr, catalog, changelog (server.js reads the
  facade's copy); catalog and changelog return what `dev-spec catalog` and `dev-spec changelog` do.
- **ADR** (`format: "adr"`, CLI `--adr`; `exportAdr()` in engine/decisions.js, beside the log): one MADR 4 file per
  decision, `.specs/exports/adr/<slug>/NNNN-<title>.md` and an `index.md`; no name → every feature's (archived ones under
  `adr/_archive/<slug>/`) and `adr/index.md`.
  - **The number IS the D-number, per feature** (D-3 → 0003, ≥ 4 digits): the log is append-only, so no number moves —
    only a hand-deleted LAST entry lets spec_decide reuse one. Never a global sequence: it shifts with every removed
    feature and interleaved merge, and a stable one needs a registry to merge. The title part is
    `slugify(mdPlainText(title))` cut to `ADR_SLUG_MAX`: a retitle renames the file.
  - **Content:** front matter `status` (accepted, superseded by ADR-NNNN, superseded) and `date` (the log's day),
    English-stable; then only the localized MADR sections the log has text for, linking the feature, the log entry and
    each `_Affects:_` target (`resolveAffect`). A discovery is no ADR (`excluded`: `discovery`, `duplicate-id`,
    `unsafe-file` — a linked decisions.md is never read, `readContained`). User text is inert where it sits in our
    structure (`adrLabel`, `mdCell`, `adrInert`, `adrBlock`). No run date: a re-run is byte-identical.
  - **Write**, all-or-nothing: the legacy `exports` feature, a linked target or scope (`specsWriteContained`) or an
    unmarked same-named file (`isGeneratedOrAbsent`, `skipped: true`) refuses it all; unchanged text is not rewritten;
    `adrStaleFiles()` (marked `RE_ADR_NAME` or index.md files no longer produced) are removed (`removeSpecFile`,
    `removeEmptySpecDir`, never above `adr/`). A feature export touches only its folder. Without `write`: `documents`,
    `stale`.
- **Gherkin** (`gherkinFeature()`; T-IDs and supersession from `buildTraceMatrix`): `# language:` first (pt-BR → pt), the
  marker as a `#` comment; the tracks and `@bugfix` as Feature tags; one Scenario per current AC, tagged with its ID,
  T-IDs and track; template and shipped-retired ACs left out with a comment, a draft's pending supersession kept with
  one. A named spike is refused (`spike: true`); no name → one `.feature` per active feature, all-or-nothing.
  - **`earsSteps(raw, lang)` is THE splitter and never drops a character:** WHILE, WHERE, IF → Given; WHEN → When; the
    SHALL response → Then; quoted and code spans never split; only English and the feature's own keywords count; what
    can't split cleanly is one `Then` (`unsplit`). `ghStripEmphasis()` drops only PAIRED emphasis runs (linear; `2**n`,
    `a_b_c` stay). A fuzz test (mcp/test.js "1.16 E review m5") checks no character is lost.
  - **Dialect keywords are Gherkin tokens:** `GHERKIN_DIALECT` in `engine/export.js`, not i18n — EVERY en, pt and es
    keyword of gherkin-languages.json (compare with cucumber/gherkin when adding a language; never vendor it);
    `ghRiskyLine()` labels a summary line that starts with one.
- **Tracker CSV** (`trackerRecords()`, `trackerCsv()`; the matrix's `csvCell` and `csvRecord`): Jira columns Work item ID
  (the row number), Work type, Summary, Description, Status, Parent (the FIRST record with that key), one Labels column
  per label; Linear columns ID, Title, Description, Status, Estimate, Labels, Parent issue, with local keys `<slug>`,
  `<slug>/US-n`, `<slug>/#n` (a repeat `<slug>/#n (2)` — every key unique); parents first. The marker is the LAST
  HEADER CELL — a trailing record would become a work item.
- **Milestones** — roadmap.json `meta.milestones` (`spec_roadmap_edit {kind: "milestone"}`, `dev-spec milestone`),
  under the roadmap lock.
  - **Stored entries:** `milestoneStore()` keeps only what add could write (`RE_MILESTONE_NAME`, a real day, slug lists,
    one per identity, ≤ 50 × 200 features); add and rm refuse a malformed list, readers take its valid entries; a stored
    value still goes through `cell()` or `htmlEsc()`. An unparsable roadmap.json → `roadmapError()`.
  - **Identity** is `milestoneKey()` (NFKC, lower-case, Latin accents folded, separator runs → '-', other letters, marks
    and '+' kept — never the slug: "C" ≠ "C++"); the file is `milestoneFileKey()` (the slug when it equals the key, else
    plus 8 hex of its sha1). A features list splits on commas only, a single string on whitespace too. Re-adding a name
    replaces its date and features; its `archived` list loses the slugs listed again.
  - **Status:** `milestoneStatuses()` → `on-track`, `at-risk` (`eta-after-date`, `eta-unknown`, `no-features`), `late`,
    `done`.
  - **Following the features:** `milestonesFollow()` (from `pruneRoadmapRefsLocked` and restore) edits each VALID entry
    in place — an archived feature moves to `archived` — and leaves invalid ones as they are, reported
    (`milestonesInvalid` {count, names, notList?}, `milestoneInvalidInfo()`, the "Needs attention" line —
    `milestone.attention.invalid` / `notList`).
  - **Release notes:** `{format: "changelog", milestone}` → its features and archived ones, `since` = `all`,
    `RELEASE-NOTES.<milestoneFileKey>.md`, `meta.changelogAt` untouched (`changelogData(…, only)`).
- **CLI flags of this area:** switches `revoke`, `print-config`, `gherkin`, `adr`, `dry-run` (`spec.CLI_SWITCHES`); value
  flags `reason`, `expires`, `text`, `tracker`, `milestone`.

## History
How the rules above came to be, section by section — grep a release (`1.21.1`) or a finding id (`M8`, `r6 B3`) here.

### Project templates
- **1.14** — `.specs/templates/` introduced: a team's own scaffolds over the built-in i18n ones. `templates` and `exports`
  became reserved slugs; a feature created before 1.14 under either name stays a feature (the legacy exception).
- **1.15** — `tracks` joined `RESERVED_SLUGS` (the project's track packs), with the same exception.
- **1.21 F5** — `change` joined `TEMPLATE_ARTIFACTS` (a change's one file, kind change, size xs); a sized feature's built-in
  scaffold follows its size, while a project template is written as it says, its missing track blocks appended whole.
- **1.22 review** — the summary goes through `safeSpecText` (requirements.md, classification.md, change.md, bug.md, the
  bug requirements): its `<!--` paired with the scaffold's closing EARS-guidance `-->` and hid every criterion
  (placeholders 30 → 0, trace 5 ACs → 0, EARS 0 criteria).

### Scoped steering
- **1.13** — scoped steering: Kiro-compatible front matter, fileMatch bodies quoted into the brief, `manual` files listed.
  Before it every default file was always in the brief — why one without front matter still counts as `always`. First
  written under "Catalog, drift, restore, guard, steering" (lifecycle.md), then moved here.
- **1.25** — steering imported from Kiro / Cursor; the steering logic itself was left untouched.

### Import sources and the brownfield scan
- **1.14** — `spec_import`, with the same guarantees for every source. The section ("Import sources and flows") also held
  the design-first Flows, since moved to gates-and-approvals.md → Flows.
- **1.17 (F)** — the `fluidplan` source, read at fluidplan 755d1b2 (EN / FR labels). **1.17 F review** — the plan's text is
  written inert (one line per value, marker / ID / comment escapes, fences closed): plan text could otherwise forge a
  marker, an ID or a `_Verify:_`.
- **1.21.1** — `PLAN_FILE_EXT` grew to every `CODE_EXT` / test-only extension of engine/scan.js (`.psm1`, `.bats`, `.go`…),
  minus `PLAN_EXT_AMBIGUOUS` (d, s, v, f, t, m, r, el, re, sc, cmd): `conf.d`, `this.el`, `color.r`, `args.cmd`, `obj.m` are
  object fields, not files.
- **1.22 review** — a plan's command-only bullet with a trailing "and expect …" / "e esperar …" / "y esperar …" stays in
  design.md; a BMAD nested unit citing no AC inherits its parent's; spec-kit bullets count as scenarios only under an
  "Acceptance Scenarios" label, as kiro.js reads its criteria; a title that slugifies to nothing falls back to the
  parser's `nameFallback`. The brownfield scan and coverage got their rules (engine/scan.js): the cap counts code
  (`WALK_ENTRY_CAP` 200,000 entries), generated folders from the root .gitignore, manifests, ASP.NET tokens (the "Async"
  suffix dropped), the binary-searched folder lookup.
- **1.22 review 2** — gitignore negations: the Python template's `lib/` with `!frontend/src/lib/` hid a SvelteKit app's
  `frontend/src/lib/*.ts` (coverage 4 → 2 code files, its `_Implements:_` "non-code"); Visual Studio's
  `!**/[Pp]ackages/build/` must keep `[Bb]in/` applied. Nested manifests under docs / examples: a Node app's Sphinx
  `docs/requirements.txt`, Jekyll `docs/Gemfile` and `examples/flask-client/` made its stack "python (flask)" and "ruby".
- **1.22 review 3** — nested negations: only the root .gitignore's were read, so root `lib/` with `frontend/.gitignore`'s
  `!src/lib/` (Git tracks frontend/src/lib/api.ts) still hid it; `backend/lib/` must stay hidden.
- **1.22 review 4** — `execplan` keeps a leading `cd <dir> &&`: dropping it imported `cd packages/web && npm test` as
  `_Verify: npm test_`, which `done --run` ran at the root and the natural run read command-mismatch. Gitignore read as
  Git reads it: `!frontend/src/**` was read as `src`, so root `lib/` kept hiding frontend/src/lib/; a leading BOM hid a
  nested file's first-line negation; a trim turned `  lib/` / `lib/\t` / ` *` into patterns Git never applies; a UTF-16
  file; a root file over the cap ended mid-line (`srcgen/` read as `src`) and a negation past it was never weighed; `*` +
  4 KB of comments + `!keep.ts` read as ignore-all. Known limit kept: `Äpp/` hides `äpp/`, `[@-Z]` folds to `[@-z]`.
- **1.23 review 5** — the import cap: a source over `IMPORT_MAX_BYTES` was cut silently (a plan's Steps past the cut
  dropped, the scaffold's tasks kept with a "no steps list found" note); now the whole import is refused, and 2.1 MB of
  CJK text under the cap imports whole. What an import writes: a line break in the name opened a heading in every file's
  title (`flatText`); a design ending inside a ```mermaid had the track sections written into it (`appendSpecText`); an
  archived twin became a warning; the roadmap rendered every feature twice per import (`{ refresh: false }`).
- **1.24 r6 (G4)** — a GIVEN name's `<!--` opened a comment in every imported file's title: `specNameText`.
- **1.24 r6 (G-I1 / G-I3)** — spec-kit: `specKitTaskMarkers()` (the imported sample read every criterion uncovered) and
  `specKitDesignDocs()` (research.md, data-model.md, contracts/, quickstart.md had been skipped with a "not imported"
  warning; `SPECKIT_CONTRACTS_MAX` = 30).
- **1.25** — the steering tools `kiro-steering` · `cursor-rules` (import/steering.js), sharing `importSourceAt()`; the dry
  run (`DRY_RUN_FILE_CHARS` 4,000, `DRY_RUN_TOTAL_CHARS` 24,000); `counts` on every result.
- **1.25.1 (review 7)** — `spec_import {projectDir: "<home>/.aws", tool: "plan", path: "credentials", dryRun: true}`
  returned the credentials in its `preview`: hidden paths and non-documents are refused, and over MCP a foreign projectDir
  must hold a `.specs/`. Scan: `tests/app.py` was a "python" entrypoint (`entryKind` reaches depth 2); any code file naming
  `@SpringBootApplication` (a JS string, a Python comment) was a "spring boot" one; a package.json with no dependency read
  "node ()".

### Stakeholder export and release notes
- **1.14** — `spec_export`: one offline HTML / md document (roadmap palette, light / dark + toggle, print rules).
  **1.14 F5** — `format: "csv"`, the traceability matrix (`<slug>.rtm.csv`), with `csvCell` / `csvRecord` (the tracker
  CSV reuses them).
- **1.21 review C5** — a change exported as a feature; it exports as itself (the project export lists its criteria, not
  stories).
- **1.22 review** — never through a link: `specsWriteContained()` before any read or write under `.specs/exports/`.
- **1.24 r6 G-I10** — the changes shipped since `since` were listed under Added as new features; they are under Changed.
- **1.26** — html / md without `write` return a preview of `EXPORT_PREVIEW_CHARS` (1,500): an 18.5k-character HTML for a
  template-only feature landed in the agent's context on every call.

### Exports and planning
- **1.16 E** — Gherkin (E1), the Jira / Linear tracker CSV (E2) and milestones; with them the CLI switches `revoke` (U2),
  `print-config` (C1) and `gherkin`. **1.16 E review m5** — Gherkin's emphasis: `2**n` / `a_b_c` / `2*3*4` and code spans
  kept, `*WHEN*` / `_WHEN_` read as the keyword, a leading `(` kept; the fuzz test checks no character is lost.
- **1.16.0** — milestones were filed by slug, which collapsed "Sprint α" / "Sprint β" and "C" / "C++"; identity became
  `milestoneKey()`, and `milestoneFileKey()` keeps a 1.16.0 name's file when its slug equals the key.
- **1.16 verify NEW-1** — one hand-edit typo in meta.milestones stopped every entry from following a rename / archive:
  `milestonesFollow` edits each valid entry and reports the invalid ones (`milestonesInvalid`).
- **1.25** — the ADR export (`format: "adr"`, CLI `--adr`), numbered by D-number rather than a global sequence (the
  reasons are in the rules); `ADR_SLUG_MAX` = 60.
- **1.26** — `catalog` and `changelog` became `spec_export` formats (`EXPORT_FORMATS`); this note listed the formats only up
  to `adr` until the 1.27 restructure.
