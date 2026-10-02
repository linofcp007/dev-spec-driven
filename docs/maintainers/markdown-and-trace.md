# Reading spec markdown — EARS, IDs, fences, comments, trace and the matrix

Maintainer notes, one topic of the map in [CLAUDE.md](../../CLAUDE.md) — the index and the hard constraints.
How every reader parses requirements / tasks / test plans, what trace_check counts, and the requirements traceability
matrix.

## Readers (from Conventions & gotchas)
- **EARS context**: the loose heuristics (numbered item that "reads like" a requirement, lowercase
  `deve/debe`) apply only under an Acceptance Criteria heading or in heading-less snippets; elsewhere a
  criterion needs SHALL / capitalised DEVE·DEBE / "sistema deve", a stable ID or a CAPITALISED EARS
  keyword. Word boundaries are unicode (`(?<![\p{L}\p{N}_])`) — JS `\b` never matched `DEVERÁ`. Stable IDs
  include `EC-n`, `NFR-n`, `SC-nnn`; a deeper sub-list continues its parent criterion.
- **Mandatory sections**: `extractSection(md, syn, marker)` prefers the heading carrying the track
  marker (`[SaaS]`/`[AI]`), skips fenced code, **never matches the H1 title** (it carries the feature name)
  and requires the synonym to START the heading (after marker / numbering / "Section N:" / an emoji), word-bounded; a
  track section also accepts an English inflection of its name (s / es / ing — "Threat Modeling"). The unmarked fallback
  never takes a heading carrying another track's marker, nor (1.21 review B5 — `inOtherTrackContext`) one nested under a
  heading that does (the nearest marked ancestor decides): "### Data quality" under "## [PRIVACY] …" is +privacy's text.
  "Unfilled" = the `> **TODO**` sentinel is still there OR the body is empty. `spec_status` reports each
  section as present + filled (CLI ✓ filled · ◐ unfilled · ✗ missing; a sized feature's ○ optional, ✓ covered).
  **1.21 F5:** "template" = every visible line is a line of a track design block as the scaffold wrote it
  (`sectionOwnLines()` — exact lines of the built-in blocks, EN / PT / ES, pt-BR's for a pt-BR feature, the project's
  packs' — a pack line with `{{name}}` / `{{slug}}` as a linear wildcard; a guidance line the user edited is theirs, and so is
  fenced code — a json / yaml / mermaid block answers a section, 1.21 review C2) — it fails a new approval and warns on an approved design; a sized
  feature's `na` / `na-short` (an `n/a — <reason>` answer) and `covered` (TRACK_OVERLAPS) — every gate reads them through
  `trackSectionReport()` + `sectionVerdict()` (gates-and-approvals.md → Right-sized rigor).
  **Linear (1.22 review):** `inTrackContext` (a loose synonym under a marked ancestor) reads every heading's answer from ONE stack
  pass, like `inOtherTrackContext` — the back-walk per loose heading (`heads.indexOf` + a scan up) made 200 KB of "### Processors"
  with no `[PRIVACY]` heading cost status 9 s (now ~0.15 s).
- **A change's one file (1.21 review C1):** change.md holds the criteria AND the tasks — every reader takes its two views
  (`changeViews` / `criteriaText` / `tasksIdText`, tasks.js — gates-and-approvals.md → Right-sized rigor): trace_check's
  required ACs never include a task's `_Requirements:_` reference, and EARS never lints a task block.
- **AC/test IDs**: `US-<n>.AC-<n>` and `T-<n>`. Extraction uses a lookbehind guard, NOT `\b` —
  markdown italics (`_US-1.AC-1_`) make `\b` fail because `_` is a word char. Don't reintroduce `\b`.
  **A bare `AC-n` is no ID (1.22 review):** EARS still LINTS a unit led by one (`RE_LIST_DEFINES_AC` / `RE_LEAD_DEFINES_AC`), but
  its stable-ID check reads `RE_FULL_ID` (US-n.AC-n, T-, EC-, NFR-, SC-) — a bare one is `no-id` with `ears.bareAcId` ("write
  US-<story>.AC-<n>"). And the mirror of `earsUnlinted`: `earsUnidentified(reqText, ears)` — EARS linted criteria but
  `requirementAcIds` is empty (bare IDs, or none; review 4: or a criterion is numbered with a bare AC-n) → the criteria as labels (each one's bare ID, else `L<line>`, from the
  result's non-enumerable `criteria`). trace_check reports them as the gap `unidentifiedCriteria` (first in `TRACE_GAP_ORDER`, a
  verdict kind; only present when non-empty, so every other result is unchanged), doctor's `ears` fails (`earsNoAcIds`), so do
  the requirements approval and a change's plan approval; the pre-commit check names them instead of "traceability clean (0
  ACs)". A spec numbered AC-1, AC-2 used to trace 0 ACs and pass everything ("all 0 ACs covered"). **Only a criterion with NO
  stable ID counts (review 2):** one carrying `NFR-n` / `EC-n` / `SC-nnn` (`RE_FULL_ID`) has its own — trace's secondary
  warnings read it — so a performance spec of NFR-1, NFR-2 alone passes (it failed doctor, trace and the requirements approval);
  a criterion with no ID beside them is still named, and so is one whose only ID is another feature's (`checkout/US-3.AC-2`) or
  a `_Supersedes:_` reference (`ownStableId` — requirementAcIds' reading). **Review 3 — the LABEL, never a mention:** any ID
  anywhere in the criterion counted, so `- AC-1: WHEN … SHALL redirect (see EC-1)` or `… (T-01)` had "its own" ID (earsUnidentified
  null, doctor's ears passed, trace counted 0 ACs with no gap, spec_upgrade's bareAcIds []). `criterionLabel(text)` (markdown.js)
  reads the ID that LABELS a criterion — its lead after a heading mark, a list marker, a checkbox, an emphasis / bracket opener
  (`RE_LEAD_LABEL`; `- **US-1.AC-1** —`, `1. NFR-2:`, `### US-1.AC-3:`, `- [ ] (EC-1)`), with the token before a slash in front of
  it (`P1/US-1.AC-4`), or, with no lead, a table row's cell that is exactly such an ID (`RE_CELL_LABEL`). `ownStableId` is a
  US-n.AC-m / EC / NFR / SC label not behind another feature's slug (`featureRefTest`); a bare AC-n label is no ID whatever the
  criterion cites, and a T- ID (a test's) never a criterion's. **Review 4 — no label, an ID anywhere:** with NO label
  (`criterionLabel` null), a non-T stable ID anywhere in the criterion's own text is its ID (`RE_FULL_ID_NO_T` over the text after
  `stripSupersedes` / `stripForeignAcRefs`) — EARS's no-id lint reads the same (label, else that); `- THE SYSTEM SHALL answer … in
  200 ms (NFR-1)`, `- **Latency (NFR-1):** …`, `- **[NFR-1]** …`, `a. NFR-1: …` were unidentified (doctor's ears failed, the
  approval refused) while EARS counted their ID. **Review 4 — each criterion by its own ID:** `earsUnidentified` returned null
  for any document with a US-n.AC-m in it, so `- AC-1: … (see US-1.AC-9)` escaped while the CITED ID became the only required AC;
  now a criterion numbered with a bare AC-n (`bareLabel`) is named whatever the document defines, and one with no ID at all only
  when the document defines no AC ID (beside US-n.AC-m criteria it stays EARS's no-id warn). trace_check lints for it when
  `requiredAcs` is non-empty only if the text holds a bare AC-n (`RE_BARE_AC`) — no second EARS pass otherwise.
  `criteriaBareIds(reqText)` (the bare IDs the criteria are numbered with — `bareLabel`: the label, else a
  bare AC-n in a criterion with no label) feeds spec_upgrade's renumber item (lifecycle.md → Upgrade).
  **`<feature>/US-n.AC-m` is another feature's (1.22 review):** `requirementAcIds` drops it (`stripForeignAcRefs` — the
  `_Supersedes:_` / `_Affects:_` syntax written in prose: "rules of checkout/US-3.AC-2 stay as they are" was a required AC no
  task covered); a token that is itself an ID keeps the pair ("US-1.AC-1/US-1.AC-2"). tasks.md's references are read as before.
  **Review 2 — only ANOTHER feature's:** never a priority (`**P1/US-1.AC-1**`), a story (`US-1 / US-1.AC-1`), a number
  (`1.1/US-1.AC-1`) or a token with no letter (`RE_NOT_A_SLUG`) — every required AC of such a spec went to 0. With the feature's
  folder (`requirementAcIds(text, dir)` — trace_check, the matrix, doctor's / the approvals' `earsUnlinted` / `earsUnidentified`,
  a change's scope, decisions' targets, the test-plan scaffold, the importer's no-criteria warning) the token must resolve as
  `_Supersedes:_` resolves it (`locateFeatures`, active or archived — `featureRefTest`: "other" · "self" · null) to a feature
  OTHER than this one; the feature's own `login/US-1.AC-1` stays its ID. **Review 3 — a token that names NO feature:** it counted
  as this feature's, so "keep the rules of billing/US-3.AC-2" with no billing feature was a required AC no task covered. It is
  this feature's only when the same ID LABELS one of the text's criteria (`criterionLabelIds` — `5. Step-2/US-1.AC-5 — WHEN …`,
  and then every `<x>/US-1.AC-5` citing it); otherwise a foreign reference, dropped. **The limit:** a reader with no folder (a
  template, a pack's numbering, the importer's task fitting) can't resolve — there every slug-shaped token counts as another
  feature's.
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
- **`trace --code` T-ID convention:** a test names its T-ID — `T-01` anywhere (`test("T-01 …")`, Pester's `It 'T-01 …'`,
  Bats' `@test "T-01 …"`), or without the hyphen an uppercase `T` + zero-padded number (`test_T01_…`, `testT01`,
  `TestT01`, `T01_…` — GoogleTest's `TEST(Token, T01_Rejects)`) — see `RE_CODE_TID`. **Which files (1.21.1):** a code file
  (`isCodeFile()` — `CODE_EXT`, the one list guard mode, the scan and coverage read; a `.bats` suite / Perl's `t/*.t`
  where they are tests) that `isTestFile()` calls a test — ONE rule (engine/scan.js; trace's `isTestCodePath` is it): the
  test folders (`TEST_DIRS`; `t/` / `xt/` for a Perl `.t` only) and every language's name convention in `RE_TEST_NAME`
  (`*.test.*` / `*.spec.*`, `test_*.py` / `*_test.go` / `*Test.java` / `*Tests.cs`, F# / Scala / Groovy / Elixir / Dart,
  shell `*_test.sh`, C/C++ `*_test.cc` / `*_unittest.cc`, busted `*_spec.lua`, testthat `test-*.R`, `*_SUITE.erl` /
  `*_tests.erl`, `*_test.clj`, XCTest `*Tests.m`, `*Tests.vb`) and `RE_TEST_NAME_EXTRA` (case-insensitive: Pester's
  `*.Tests.ps1`, `*.bats`) — anchored, linear, the existing names kept (a name that merely ends in "spec" / "test" is code;
  the 1.21.1 review dropped the name-only `test_*.sh` / `test_*.c` / `*Spec.hs` rules — `scripts/test_data.sh`,
  `src/test_utils.c`, `lib/DevSpec.hs` are code; in a test folder they are tests). **Fixtures:** `isTestFixture()` — a
  `TEST_DATA_EXT` file (`.sql`, `.ipynb`) in a test folder whose NAME follows no convention (`testNamed()`, + pgTAP's
  `test_*.sql` / `*_test.sql`) is data — and so is every file under a `testdata/` folder (Go's convention; 1.22 review): the scan, coverage and the test-code scan skip it (1,600 `tests/fixtures/*.sql`
  exhausted the read cap; a 'T-01' in a seed counted as the test); guard mode still asks before editing one — unless a
  plan claims it (review 2): the test-code scan reads a fixture some feature's test plan claims in its File column
  (`fixtureClaim()` over every plan's `planFileScopes().scopes`) — pgTAP's `test/sql/users.sql`, a numbered
  `tests/001_users.sql`; `scannableTestPath()` keeps such a path as a scope (it no longer drops fixtures, which made a plan
  naming one warn forever). Review 3 narrowed the claim: the FILE itself (its trailing whole segments, as `pathNames`
  matches a file) or the folder that DIRECTLY holds it — `db/tests/pgtap/` claims `db/tests/pgtap/users.sql`, `tests/`
  claims `tests/001_users.sql` but never `tests/fixtures/seed.sql` (any folder holding it made seed data a test through
  the common `tests/` entry). The files read that way come back as `scanTestCode().fixtures`, and `traceTestCode` counts
  their T-IDs only for this plan's rows that claim the file themselves (never a row without a File cell, never another
  feature whose plan doesn't name it — the project-wide by-number match skips them), their AC IDs only when this plan
  claims the file. The test-code
  scan collects its candidates, reads them all in walk order below `CODE_TRACE_READ_CAP`, above it the test-NAMED ones
  first, and reads each through `readFileHead()` (files.js — the first `SCAN_READ_BYTES` CHARACTERS, as the slice it replaced:
  one bounded read of up to 4 bytes a character, decoded, then sliced — review 2: a byte cap lost a T-ID behind 150,000
  'é'; never the whole file then a slice; the brownfield scan and the status line's tests gate too). **UTF-16 (1.22
  review):** `readFileHead` and `readRaw` — so every `readIfExists` / `readContained` — decode through `decodeText()`: a BOM
  FF FE is UTF-16LE, FE FF UTF-16BE (swapped), anything else UTF-8. Windows PowerShell 5.1's `>` / Out-File writes UTF-16LE: a
  Pester `tests/Login.Tests.ps1` naming T-01 was never found, a UTF-16 requirements.md traced 0 ACs. The BOM stays the U+FEFF
  every reader drops (a rewrite of such a file is UTF-8); the importer, the specs:// resources, the requirements.md save hook,
  `dev-spec ears <file>` and the observe hook's pre-filter read the same way. Until 1.21.1 the scan read only the scanner's
  short `CODE_EXT` and a PowerShell project's tests gate never passed. The scan (`scanTestCode()`) is bounded and read-only; a plan row whose File column names a
  concrete test path counts only in that file/folder; another feature's `.specs/<f>/tests/` never counts; a test file
  ANOTHER feature's plan (active or archived) names in its File column — and this feature's plan does not — never counts
  for this feature's T-IDs (T-IDs restart at T-01 in every feature: a new feature's Phase 4 gate passed on another
  feature's tests). A folder token (`test/`) scopes rows but claims no file, and a claim is the EXACT project-relative path (a suffix match
  made `tests/test_api.py` own a monorepo package's `services/beta/tests/test_api.py`).
  A T-ID whose EVERY row names only non-code artifacts in its File column (`load-test.md`, `evals/*.json`, a
  `.feature` — any extension outside `GUARD_CODE_EXT`; a `.ps1`, `.bats` or `t/*.t` row is code) is run outside test code: `plannedOutsideCode`, never
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
  several) and a stable `code` (`no-modal`/`no-id`/`vague`/`placeholder`/`no-keyword`/`needs-clarification`). `vague`
  skips a VERB use of clean / limpa / limpia (`VAGUE_VERB_NEXT`: followed by up / out / an article / a possessive / a
  quantifier / old / temporary / expired… — "THE SYSTEM SHALL clean up its temporary files"); "a clean UI" stays vague. A
  sub-list continues its parent only when the parent reads as a criterion: that modal test is cached per block (`curModal` —
  once true it stays true; until then only the untested parts plus the two before them, a modal phrase spanning at most three
  parts) — re-testing the whole joined block per sub-line was quadratic (200 KB of nested "- … SHALL x": trace + matrix 12 s,
  now ~0.2 s). Every unit
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
- **HTML-comment stripping** (`stripHtmlComments`): `ears`/`clarify`/`doctor` (for `[NEEDS
  CLARIFICATION]`) AND `trace_check` (for AC/test IDs and `_Implements:_`) all strip `<!-- -->`
  first, so example markers in template-guidance comments don't count as real. Keep template
  examples inside comments. A `<!--` that never closes is plain text everywhere — ONE comment reader, `commentLines()`, serves
  `stripHtmlComments`, `criterionBlocks` and the placeholder scan (and `scanTaskLines` keeps its own): a `<!--` inside
  fenced code or an inline code span is text, and a comment opens only when a `-->` outside code follows it: a stray marker used to hide every
  criterion below it (EARS 0 criteria → pass, the requirements approval passed) while trace_check counted them.

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
