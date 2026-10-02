# Project templates, scoped steering, imports and exports

Maintainer notes, one topic of the map in [CLAUDE.md](../../CLAUDE.md) — the index and the hard constraints.
`.specs/templates/`, steering front matter, the `spec_import` sources, and every export (HTML / md / CSV, Gherkin,
trackers, release notes, milestones).

## Project templates (1.14) — `.specs/templates/`
- **Resolution:** `.specs/templates/<lang>/<artifact>.md` wins over `.specs/templates/<artifact>.md`, which wins over the
  built-in i18n builder (`templateOverride()`); a pt-BR feature reads `pt-BR/`, then `pt/` (`templateLangChain()`). Only allowlisted names are ever read — `TEMPLATE_ARTIFACTS`
  (classification, requirements, design, tasks, test-plan, eval-plan, load-test, quickstart, checklist, integration-plan,
  bug, bug-requirements, bug-test-plan, bug-tasks, spike, spike-tasks, change — 1.21 F5: a change's one file; a sized
  feature's built-in scaffold follows its size, a project template is written as it says, its missing track blocks
  appended whole) plus `steering/<file>.md` (a known stub, or a name
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
  **The summary is written through `safeSpecText`** (1.22 review) — into `{{summary}}` and every built-in scaffold that holds it
  (requirements.md, classification.md, change.md, bug.md, the bug requirements), as the bug prefill and the spike question
  are: its `<!--` paired with the scaffold's closing EARS-guidance `-->` and hid every criterion (placeholders 30 → 0, trace
  5 ACs → 0, EARS 0 criteria). `createFeature` keeps the RAW text for the classifier (`writtenSummary` is only what is written).
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

## Scoped steering (1.13 — from Catalog, drift, restore, guard, steering)
- **Scoped steering:** `steeringFrontMatter()` reads Kiro-compatible front matter — `inclusion: always |
  fileMatch | manual` + `fileMatchPattern` (string or list). No front matter → the brief's default files
  (constitution/tech/structure + the active tracks' files) count as `always`, others stay out; front matter
  without `inclusion` → `always`; an unknown mode (Kiro `auto`) → `manual`. `briefSteering()` quotes a
  matching `fileMatch` file's body (front matter and guidance comments stripped, `BRIEF_STEERING_BUDGET`) and
  lists `manual` ones. `steeringGlobMatch()` is a linear matcher with capped brace expansion — never a
  backtracking regex. Custom names (`steering_scaffold`) must match `^[a-z0-9][a-z0-9-]{0,62}\.md$` and not be
  a Windows device name or a prototype key. Doctor's `steering` check warns about files still templates.

## Import sources and flows (1.14)
- **`spec_import` tools** (exact enum on both surfaces): `kiro` · `spec-kit` · `openspec` · `plan` · `execplan` · `bmad` · `fluidplan`,
  same guarantees for all (a NEW feature, the source only read and inside the project, mapping + warnings, the localized
  "Imported from" note, tracks auto-classified unless given; nothing dropped silently — what no mapping takes goes to
  design.md (plan / ExecPlan) or requirements.md (PRD), or into a warning).
  - `plan` — a Claude Code plan-mode file (plansDirectory defaults to `~/.claude/plans`, OUTSIDE the project — the refusal
    says to copy it in or point plansDirectory inside) or a Cursor `.cursor/plans/*.plan.md` (front matter name / overview /
    todos): goals and acceptance-like bullets → US-1's criteria (EARS when they already read like one, else
    `[NEEDS CLARIFICATION]`; a command-only bullet — "Run `npm test`", "`npm test` passes", 1.22 review: also with a trailing
    "and expect …" / PT "e esperar …" / ES "y esperar …" clause, `planCommandOnly()` — stays in design.md); checklists, else Cursor todos, else a Steps / Implementation section's items (an Approach / Abordagem / Enfoque section
    only when there is no other), else its
    sub-headings → tasks keeping state; file paths a step names → `_Implements:_` (`planPaths()`: never a URL, absolute or
    home path, `..`, alias, glob; `:line` / `#L10` dropped; a single backticked name without a folder needs a known
    extension — `PLAN_FILE_EXT`: since 1.21.1 every `CODE_EXT` / test-only extension (engine/scan.js — `.psm1`, `.bats`,
    `.go`…) but `PLAN_EXT_AMBIGUOUS` (d, s, v, f, t, m, r, el, re, sc, cmd — `conf.d`, `this.el`, `color.r`, `args.cmd`,
    `obj.m` are object fields: such a name needs a folder part, `scripts/build.cmd`), plus docs / config / data such as `.psd1`); the
    rest → design.md. A folder holding several plans is refused (name the file).
  - `execplan` — a Codex ExecPlan (PLANS.md): Validation and Acceptance → criteria; Progress (state kept) + Concrete Steps
    → tasks (deduplicated), a step naming a check command → `_Verify:_`; Decision Log → design.md `## Decisions` (D-1…);
    Purpose → summary; living sections → design.md verbatim.
  - `bmad` — the PRD (`docs/prd.md`, sharded `docs/prd/`, v6 `_bmad-output/planning-artifacts/`) FR / NFR lines → FR-n /
    NFR-n; epic stories + story files (`docs/stories/*.md`; the file wins over the PRD's copy) → US-1…US-n in story order,
    their ACs → US-n.AC-m; Tasks / Subtasks → `[USn]` tasks with `(AC: 1, 3)` → `_Requirements:_` (1.22 review: a nested unit
    citing none inherits its parent's — the nearest unit above with a smaller indent; a grandchild its inherited ones);
    architecture + Dev Notes → design.md. One story file imports one story.
  - `fluidplan` (1.17) — a plan settled with the fluidplan skill (`.fluidplan/<id>/`, its plan.json, PLAN.md / DECISIONS.md —
    also at plan.json's `output` paths or fluidplan.config.json's `outputDir` (`fpConfig`) —, or PLAN.md's text inline,
    DECISIONS.md optionally following it). The finalized PLAN.md / DECISIONS.md win (PLAN.md is where fluidplan ticks tasks;
    state.json "exported" with no PLAN.md found → a warning); plan.json + answers.json fill in or stand alone
    (`fpFromPlanJson` restates fluidplan's rules — "Not OK" is a final rejection there). Pages → stories, acceptance →
    criteria (EARS, else `[NEEDS CLARIFICATION]`), tasks numbered by the parser (`model.tasks.numbered`), files →
    `_Implements:_` (a delete → a "To delete" line), one `_Verify:_` per command, after → `_Depends:_` (an `after` cycle:
    the edges against the plan's order dropped, `wCycle`), settled decisions → decisions.md (`decisionEntryLines`,
    `_Affects:_` = their tasks' criteria, the revision note in Context) + design.md `## Decisions` /
    `## Alternatives & Trade-offs`, rejected → Out of Scope, open ones (a list decision with an item "to change" too —
    verdict `mixed`, "partly settled") → "Open decisions" with `[NEEDS CLARIFICATION]` + the reviewer's question / remarks,
    working rules → Global Constraints, the intro of a page no story carries → design.md `## Themes`, the subtitle →
    the summary or design.md's Context. **The plan's text is written inert** (1.17 F review): every value written into one
    line is one line (`fpV` / `fpHead` for headings — whitespace runs folded), marker look-alikes get their colon escaped
    (`_Verify\:` — `fpInert`: task + decision + `_Outcome:_` labels), AC / T / EC / NFR / SC IDs are escaped (`US-7\.AC-1`),
    `<!--` / `-->` neutralized, and each physical line gets the heading / task-line / checkpoint escapes (`fpLine`,
    `fpProse` — which also closes a fence the text leaves open): only fluidplan's `verify` field makes a `_Verify:_`. A
    plans folder is listed only when its real path is inside the project. EN / FR labels; every pattern linear
    (`fpTitleOf` / `fpTaskHeading`, `FP_LINE_MAX`, `fpOneLine` splits, `sortGroup` = Kahn + a min-heap; `mdHeadings` is a
    scan — `mdHeadingParts`). importSpec writes every imported requirements.md line comment-inert for every importer
    (`commentInert` / `inertBlock`). A `<!--` / `-->` inside an inline code span stays as written (`inertOutsideCode` —
    backtickRuns, commentLines' pairing): in `commentInert` and in `fpInert(s, true)` for the criteria, a story's prose and
    Out of Scope (whole requirements.md lines or after a backtick-free prefix); everything else (design.md, decisions.md —
    read by the code-span-blind `blankHtmlComments` —, tasks.md, a value joined to others on a line, the feature name) is
    escaped everywhere. The ID / marker escapes apply inside code spans too (extractAcIds / taskMarkerSpans read them).
    The escapes never reach stakeholders as stray characters: `expInline` unescapes every ASCII punctuation escape
    (`RE_MD_ESCAPE`), and the Gherkin / matrix CSV / tracker (criteria, summaries) exports and the HTML `<title>` write
    `mdPlainText()` (escapes + entities decoded outside code spans; a numeric reference to a control character kept).
    Never write a raw U+2028 / U+2029 (or its `\u` escape through the Edit tool): build it
    (`FP_LS_PS`). Pinned to fluidplan 755d1b2 (2026-09-26).
- **spec-kit scenarios** (1.22 review): numbered items under the story, else — only under an explicit "Acceptance Scenarios"
  label, as kiro.js reads its criteria — bulleted ones (`mdListItems(…, false)`); a bullet outside the label stays prose.
- **A title that names no folder** (1.22 review): when the caller gives no `name` and the parser's `nameHint` (a plan's /
  ExecPlan's / fluidplan's title, BMAD's PRD or story title) slugifies to nothing (`# Добавить тёмную тему`), importSpec uses the
  parser's `nameFallback` — the name it had without the title (the plan file's stem, the folder, fp.id, the story file's stem);
  inline text has none (its virtual file is `<tool>.md`): `importSpec.noUsableTitle` says to pass a name. A name the caller
  gives is theirs (resolveFeature's own error).
- **`spec_import` stays inside the project.** The source path must resolve inside `projectDir` — checked
  lexically first (nothing outside is even stat'ed), then by real path (a symlink out is refused) — and it is
  only read. Tool names are exact (`kiro` | `spec-kit` | `openspec` | `plan` | `execplan` | `bmad` | `fluidplan`, the schema enum) on
  both surfaces, and it never imports over an existing feature.
- (**Flows** — the section's last bullet — moved to gates-and-approvals.md.)
- **The brownfield scan and coverage** (engine/scan.js — area 13 of the suites; 1.22 review):
  - **The cap counts code.** Both walk with `walkProject(…, {counts, gitignore})`: only a file `counts` says yes to — code
    (`isCodeFile`, not a fixture) and, for the scan, a manifest (`MANIFEST_NAMES`, `*.csproj` / `*.psd1` / `*.cabal` /
    `*.nimble`) — counts toward `cap` (scan 5000, coverage `COVERAGE_CAP`; coverage's `opts.cap` is engine-internal, for
    tests); every other file is still visited, and `WALK_ENTRY_CAP` (200,000 folder entries) still ends a huge tree.
    `truncated` = a counted file (or, past the entry cap, any entry) was left unvisited — "code was skipped". The scan's
    `filesScanned` is every file visited, `codeFilesCounted` what the cap counted. The other walks (globs, trace, finish)
    pass no `counts`: every file counts, as before.
  - **Generated folders** (`gitignoreRules()`): the ROOT `.gitignore`'s plain directory patterns — a name, a leading / trailing
    `/`, a path of names (a slash inside anchors it), simple classes (`[Bb]in/`, `[a-z]`), folded where the file system folds
    case — skip a folder (and a top-level module); negations, wildcards, escapes and negated classes are ignored (a pattern
    read wrongly would hide code). A folder (not the root) whose own `.gitignore` ignores everything (`gitignoresAll`: `*`,
    re-including at most `.gitignore` / `.gitkeep` / `.keep`) is skipped too (Laravel's storage/framework/views). Never a
    built-in `bin` (Ruby / Node keep code there). `testdata/` is a fixture folder (`isTestFixture`).
  - **Manifests:** a root one is read only as a file or a link that stays inside the project (`projectFileInside`); nested
    ones (`NESTED_MANIFESTS` — a package's manifest, never a per-folder CMakeLists / Makefile; never under fixtures /
    testdata) join the stack by name and the first `NESTED_MANIFEST_CAP` (20) are read for frameworks / test runners; the
    root package.json alone gives entrypoints (listed first).
  - **ASP.NET tokens:** `[controller]` = the class name minus "Controller", `[action]` = the decorated method
    (`aspActionName`, its "Async" suffix dropped); one it can't name stays. **A projectDir that is no folder** → ok: false
    (`brownfield.notFolder`; the CLI exits 1).
  - **coverage's folder lookup:** `implementsTargets(…, sorted)` binary-searches keys sorted once per call
    (`keysWithPrefix`) — the same files the scan of every key gives, in key order.

## Stakeholder export and release notes (1.14)
- **`spec_export`** writes (with `write`) `.specs/exports/<slug>.<html|md>` (1.14 F5: `format: "csv"` → `<slug>.rtm.csv`,
  the traceability matrix — markdown-and-trace.md → Requirements traceability matrix) — the project: `project.<fmt>`, a feature
  slugged `project`: `project.feature.<fmt>` — with the `RE_AUTOGEN` marker family; `isGeneratedOrAbsent()` means never
  over a hand-written file (an error), and (1.22 review) never through a link: `specsWriteContained()` (engine/files.js) refuses
  — before anything is read or written — a `.specs/exports/` or a target document that is a symlink / junction or resolves
  outside the real `.specs/` (a link inside the project is still refused), in every format, Gherkin's all-or-nothing write
  included (`stakeholderExport.exportsLinked`). A feature renders in its language, the project in the project language. The HTML
  is offline by construction: a zero-dep markdown renderer (`expInline` and friends) escapes EVERY text run (`htmlEsc` —
  a `<script>` in a criterion is shown as text), keeps link targets only for http(s) / mailto, turns an image into its alt
  text, and loads no font, script or stylesheet URL (a test asserts it); roadmap palette, system light/dark + toggle,
  print rules. Approvals are flagged "changed since" by content fingerprint only — a file date is no evidence (as in
  finish). A change (1.21 review C5) exports as itself: its kind label, its criteria (change.md without the task blocks),
  one Tasks table, no design, the plan's approval row (`planPhase`); the project export lists its criteria, not stories. A story written as its own `## US-n` section appears once, under the stories.
- **`spec_changelog`** reads the spec data only (no model, no git log). Added = features that shipped since `since`
  (finish `{write}` recorded their baseline, or their execution sign-off was approved) with their user-story ACs (template
  criteria left out); Changed = ACs superseded by a feature shipped since then + change requests (`changes`) recorded since
  then, with the current AC text (folded into the entry of a feature new in these notes); Fixed = bugfixes shipped + the
  root-cause one-liner. A feature shipped before `since` is never Added again (a role's `partial` execution sign-off is no shipment — only the
  completing one); a spike is never listed. `since`: an ISO
  date (`YYYY-MM-DD` = 00:00 UTC) or timestamp, `last` (default — `meta.changelogAt`; everything while unset) or `all`.
  `write` → `.specs/RELEASE-NOTES.md` (AUTO-GENERATED, never over a hand-written one) and stamps `meta.changelogAt`, both
  under the roadmap lock; nothing to report → nothing written or stamped (`note`).

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
  review m5") checks no character is lost. Dialect keywords are Gherkin tokens, so they live in `engine/export.js` `GHERKIN_DIALECT`,
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
  rename | archive | remove | restore)` runs from `pruneRoadmapRefsLocked` (4th argument `archived`; the results carry
  `milestonesUpdated`) and restore (`restored.milestones`): an archived feature moves to the milestone's `archived` list
  (its notes still cover it). It edits every VALID stored entry in place (`milestoneStore().valid`) and leaves an invalid one
  (or a meta.milestones that is no list) exactly as it is — one hand-edit typo used to stop every entry from following (1.16
  verify NEW-1); the results then carry `milestonesInvalid` {count, names — the entry's name when add would accept it, else
  `#<position>` —, notList?}, and so do spec_roadmap (`milestoneInvalidInfo()`), a "Needs attention" line of ROADMAP.md / .html
  (`🏁 meta.milestones`, `milestone.attention.invalid` / `notList`, EN/PT/ES) and the CLI roadmap tail. `spec_changelog {milestone}` → that milestone's features + its archived ones, `since`
  defaulting to `all`, written to `RELEASE-NOTES.<milestoneFileKey>.md` without stamping `meta.changelogAt`
  (`changelogData(…, only)`).
- CLI: switches `revoke`, `print-config`, `gherkin` (`spec.CLI_SWITCHES`); value flags `reason`, `expires`, `text`,
  `tracker`, `milestone`.
