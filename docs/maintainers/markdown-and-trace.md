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
  "Unfilled" = the `> **TODO**` sentinel is still there OR the body holds nothing WRITTEN — **`writtenContent()` (1.24 review 6,
  F4)**: `sectionContent()` (visible, no structure) minus every prose line that answers nothing: a generic slot word
  (`genericAnswer()`: `isGenericSlot`'s TODO / TBD / TBC / FIXME / "…" / "a definir", plus "Pending" / "Pendente" / "Pendiente" /
  "to be decided …" — after list / quote / checkbox markers, emphasis, a wrapping bracket and trailing punctuation: "- TBD", "**TBD**",
  "[TBD]", "- [ ] TODO", "> TBD", "Pending.") and a line with no letter or digit ("-", "—", "..."); a table row answers when one
  cell does. A [SEC] section saying "TBD" read as filled (doctor "all 5 filled", the design approved). A real one-word answer stays
  filled — "N/A", "None.", "No." (on an UNSIZED feature; a sized one has its own `na` / `na-short` rule) — and fenced code is the
  author's. ONE reader: `sectionState` and `sectionOwnLines` (a TBD beside the guidance line is no line of the author's — still
  `template`), and `hasProseOutsideBrackets()` → gates.js's `sectionFilled()` (the Constitution Check) and `bugSectionFilled()` (a
  bugfix's Reproduction / Root Cause), the spike / decision prose; quality.js's `genericUnit` (design-trade-offs / risks / reuse) is
  `genericAnswer` — a Risks section saying "Pending." is `template`, "None." is filled. `spec_status` reports each
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
  **The ONE heading reader (review 5, M2):** `headingEntries(lines)` → `[{ i, level, text, body, atx, indent }]` — never a
  heading inside fenced code or an HTML comment (`commentLines`; a line that starts inside a comment is none), an ATX heading
  indented 0–3 spaces (closing `#`s and a trailing comment dropped from `text`), and a SETEXT heading: a ONE-line paragraph (after
  a blank or comment-only line, a heading, a fence or the text's start) underlined by ≥ 3 `=` (level 1) or `-` (level 2) — a
  multi-line paragraph over `---` is left alone, so YAML front matter never reads as a heading. `extractSection` (the marker read
  in the heading's visible text), `sectionState`, `weighSectionHead` (quality.js), `bugPlaceholders`, `designSections` (tasks.js
  — level-2 entries; a title drops its closing `##`, as weighSectionHead's does), `sectionDropLines` / `headingHasMarker`
  (tracks.js) all read it — a `## [SEC] Threat Model` section wrapped in `<!-- … -->` read as present and filled (doctor "all 5
  filled"), a commented-out `## Risks` passed design-risks. `headingIndex(lines)` (decisions, export, import, packs — readers
  that parse the line themselves) = its ATX entries at the margin. **Sentinel and structure (review 5, L28):** `sectionState`
  tests the `> **TODO**` sentinel on `stripFencedCode(stripHtmlComments(body))` (one kept in a comment or quoted in a code
  example is none), and a body of structure only — sub-headings, a thematic break, a table's header / separator rows
  (`sectionContent()`, `isTableSep()`) — is `unfilled` (it was "filled"). **Doctor's `mermaid` (review 5, L28):**
  `mermaidState(design)` → present · template · missing — the fenced blocks (```` ``` ```` or `~~~`, any length) whose info
  string starts with `mermaid`, outside HTML comments, an empty one drawing nothing; `template` when each still holds the
  scaffold's own diagram (`templateDiagrams()` — the core design builder's, EN / PT / ES, pt-BR's on a miss, whitespace folded).
  It warns `doctor.mermaidTemplate` on a template diagram — except while design.md is still a later phase's template (a pass,
  as the weigh checks skip it). It was a substring test: a `~~~mermaid` fence warned, one quoted in a comment passed, the
  untouched template diagram passed. A project template's own diagram is not known (the limit).
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
  `requiredAcs` is non-empty only if the text holds a bare AC-n (`RE_BARE_AC`) — no second EARS pass otherwise. `RE_BARE_AC`
  never reads the AC-n of a US-n.AC-m — nor of an importer's ESCAPED `US-7\.AC-1` (an ID-led line of imported prose, demoted
  so it defines nothing, e.g. a fluidplan page intro): that one was listed as an unidentified `AC-1` and the import read
  gaps-found. `bareLabel`'s no-label branch reads the criterion's OWN text (`stripSupersedes`) with `RE_BARE_AC_OWN`: never
  an AC-n behind a slash (another feature's `checkout/AC-2`, a URL's `/pages/AC-12`) or running into a letter / digit
  (`AC-230V`) — each was the criterion's "number", and every gate and spec_upgrade's renumber item asked to renumber another
  feature's ID. EARS's no-id lint reads the own text too (`stripSupersedes`, then `stripForeignAcRefs` with no feature folder:
  every resolvable slug is another's) — a criterion whose only ID was a `_Supersedes:_` marker's or `checkout/US-3.AC-2`
  counted as identified there, untraced with no warning (doctor named it). The fluidplan importer escapes a bare `AC-1` of
  imported prose (`AC\-1`, `fpInert`) as it escapes `US-7\.AC-1`.
  `criteriaBareIds(reqText)` (the bare IDs the criteria are numbered with — `bareLabel`: the label, else a
  bare AC-n in a criterion with no label) feeds spec_upgrade's renumber item (lifecycle.md → Upgrade).
  **`<feature>/US-n.AC-m` is another feature's (1.22 review):** `requirementAcIds` drops it (`stripForeignAcRefs` — the
  `_Supersedes:_` / `_Affects:_` syntax written in prose: "rules of checkout/US-3.AC-2 stay as they are" was a required AC no
  task covered); a token that is itself an ID keeps the pair ("US-1.AC-1/US-1.AC-2"). tasks.md's and the test plan's references
  too since review 5 (M5 — below). **The `#` title is no criterion (1.23.1):** `stripTitleLines` blanks every level-1 heading
  before the IDs are read — the title is written from the feature's name, and a name holding `US-9.AC-1` (bold or plain) made
  one more required AC no task covered; a `##` heading or a list item still defines one.
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
  **What the TASKS cite — one reader (review 5, M5):** `taskCitations(blocks, dir, reqText)` (trace.js) = each task block's prose
  (`taskProse` — its line and body, never a fenced example) with another feature's references dropped
  (`stripForeignAcRefs(text, dir, reqText)` — a slug that names no feature is this feature's only when requirements.md LABELS
  that ID with it: the third argument says whose labels decide) → `{ per, acs, tids }`. trace_check's `acsInTasks` /
  `uncoveredByTasks` / `phantomAcsInTasks` / the tasks' T-IDs and the matrix's per-task citations both read it (doctor through
  trace_check): tasks.md was read WHOLE — a "Deferred: US-1.AC-2" note or the title covered US-1.AC-2 (doctor "all ACs covered")
  while the matrix said `no-task`, and `checkout/US-2.AC-1` covered this feature's US-2.AC-1 or was a phantom. The test plan's AC
  references drop another feature's the same way (`uncoveredByTests`, `phantomAcsInTests`, the matrix's rows). `_Implements:_`
  is still read from the whole file (a marker outside any task stays a gap). **T-IDs by number (review 5, L32):** trace_check
  compares the plan's and the tasks' T-IDs by `tKey` (`testIdKeys` — T-01 = T-1, as the matrix and the test-code scan do),
  reporting each as its file spells it. **Sub-criterion IDs (review 5, L31):** `US-1.AC-1.2` is NO AC ID — `extractAcIds`
  refuses an ID followed by `.<digit>` (it read as US-1.AC-1: two sub-criteria collapsed into one required AC, a task citing
  `.1` covered both, and doctor said "duplicate US-1.AC-1"). It is a label of its own (`RE_LEAD_LABEL` / `RE_CELL_LABEL`), no
  stable ID (`RE_FULL_ID` / `RE_FULL_ID_NO_T` skip it): EARS's no-id lint names it (`ears.subAcId`), `bareLabel` returns it, so
  `earsUnidentified` / trace_check's `unidentifiedCriteria`, doctor's `ears`, the approvals and spec_upgrade's renumber item
  (`criteriaBareIds`) list it like a bare AC-n; `acDuplicates` no longer counts it as its parent. One stable ID per criterion
  — the trace model has no hierarchy below the story.
  A test-plan row covering an AC requirements.md doesn't define is a gap (`phantomAcsInTests`, +tdd; fenced examples
  excluded), like a phantom AC in tasks — doctor fails and the test-plan approval is refused. Every reader of
  test-plan.md's IDs goes through `planIdText()` (comments AND fenced code out): coverage, planned T-IDs, the code
  scan, the Phase 4 gate, doctor, finish, `testIndex` / `testPlanEntries` — a fenced example row covered its AC (a
  false pass) and planned a T-ID the tests gate demanded. A scaffolded test plan
  only gets the template rows of the track ACs requirements.md has (`testPlanTracks()`, shared by spec_create on an
  existing feature and spec_add_track — a track added after the requirements brings none).
  **Test coverage = a test ENTRY (1.24 review 6, F3):** an AC is covered by the test plan only when one of its test entries cites
  it — `testPlanEntries()`: a table row whose first cell holds a T-ID, a list item led by one (with its continuation lines) — the
  matrix's `tests` reader; trace_check's `uncoveredByTests`, the matrix's `no-test` and the test-plan approval read the same set.
  Any mention counted (`extractAcIds` over the whole plan): an AC named in the Coverage Check's "Gaps (with justification)" list or
  under "Out of Scope for Testing" was covered, and the approval passed. Such an AC stays a gap — no test covers it; accepting it is
  a forced approval — and the warning `justifiedTestGaps` (+tdd, a top-level array in `TRACE_INFO_FIELDS`, `TRACE_WARNING_ORDER`
  after the secondary kinds; doctor's `traceability` detail repeats it unless the plan's kinds are deferred) lists the uncovered ACs
  the plan names outside its entries, so the reader sees they are accounted for. `phantomAcsInTests` still reads every mention (a
  typo in a Gaps note is a phantom).
  **A removed track's criteria (1.24 review 6, F9):** trace_check reads the ACTIVE requirements (`activeDesign` — a turned-off
  track's `[SaaS]` / `[AI]` / … sections, a missing pack's ghost sections) for the REQUIRED ACs and the ACTIVE tasks (`activeTasks`)
  for their coverage — the matrix's rows and tasks, tracks.md's removal rule; it read the whole files, so a feature that removed
  +saas and deleted its +saas tasks failed traceability (doctor too) on criteria the matrix no longer listed. A phantom is an ID
  requirements.md defines NOWHERE (`definedAcs`, the whole text): a task or test row citing an inactive criterion is no typo. The
  secondary IDs alike (`traceSecondary(…, allReqText)`: coverage asked of the active ones, phantoms against all); doctor's
  `secondary-trace` count reads the active requirements too.
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
  every reader drops (a rewrite of such a file is UTF-8 — except tasks.md, written back in its own encoding since review 5:
  tasks-and-evidence.md → Tasks: ONE scanner); the importer, the specs:// resources, the requirements.md save hook,
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
  several) and a stable `code` (`no-modal`/`no-id`/`vague`/`placeholder`/`no-keyword`/`needs-clarification`/`padded-id`). `no-keyword`
  (info) spares the ubiquitous form naming ITS system (review 5 — `RE_UBIQUITOUS`): "THE <name> SHALL" (one to four words: the
  API, the billing service), PT "O / A / OS / AS <nome> (NÃO) DEVE(M) / DEVERÁ(ÃO)", ES "EL / LA / LOS / LAS <nombre> (NO)
  DEBE(N) / DEBERÁ(N)" — only "THE SYSTEM" counted. `vague`
  skips a VERB use of clean / limpa / limpia (`VAGUE_VERB_NEXT`: followed by up / out / an article / a possessive / a
  quantifier / old / temporary / expired… — "THE SYSTEM SHALL clean up its temporary files"); "a clean UI" stays vague. A
  sub-list continues its parent only when the parent reads as a criterion: that modal test is cached per block (`curModal` —
  once true it stays true; until then only the untested parts plus the two before them, a modal phrase spanning at most three
  parts) — re-testing the whole joined block per sub-line was quadratic (200 KB of nested "- … SHALL x": trace + matrix 12 s,
  now ~0.2 s). Every unit
  that DEFINES an AC is its own criterion for the linter: an ID-led line or checkbox item, a heading led by an AC ID (its
  body absorbed) and a table row with a cell that is exactly an AC ID (under an Acceptance Criteria / story heading, with no
  heading, or carrying a modal — elsewhere it is a summary table). The ID may sit behind an emphasis, a code span, a bracket
  or a parenthesis (`- [US-1.AC-1] …`, `- (US-1.AC-1) …`, `- [ ] [US-1.AC-1] …` — 1.24 review 6, F1: `RE_LIST_DEFINES_AC` /
  `RE_LEAD_DEFINES_AC` take criterionLabel's openers; `- [US-1.AC-1] User can log in`, no modal, was counted by trace_check,
  never linted, and approved). Such a unit is a REFERENCE, never linted, when a list
  item defines that ID anywhere or an earlier unit already did (a Notes line "US-1.AC-2 depends on …", a coverage table),
  and outside an acceptance-criteria context a line or heading defines one only when it carries a modal verb or a
  capitalised EARS keyword. **Per ID (1.24 review 6, F1):** doctor's `ears` FAILS (and the requirements / change-plan approval
  is refused) when requirements.md defines an AC ID (`requirementAcIds`) that NO linted criterion carries in its own text
  (`earsUnlinted()` → the IDs, `earsNoCriteria`) — it fired only when nothing at all was linted, so beside one well-formed
  criterion `- WHEN … the user sees an error (US-1.AC-1)`, a blockquoted AC or `- Login US-1.AC-1: …` was a required AC EARS never
  read. The raw-text `earsValidate()` (ears_validate, the requirements.md save hook, the pre-commit validator) has no such check —
  it judges criteria, not a feature's ID set — but a table-row or heading AC without a modal is an EARS error there too.
  **Zero-padded IDs (1.24 review 6, F8):** every reader compares AC IDs AS WRITTEN (tasks, the test plan, decisions, the brief, the
  catalog) — comparing by number everywhere would touch each of them — so EARS warns `padded-id` on a US-n.AC-m with a leading zero
  in the criterion's own text (`US-1.AC-01`, `US-01.AC-1` → "write US-1.AC-1"; `acKey`, `ears.paddedAcId`), and ac-uniqueness
  compares by number (below). A task citing `US-1.AC-1` for a `US-1.AC-01` criterion stays a visible uncovered + phantom gap.
  **AC definitions — ONE reader (1.24 review 6, F2):** `criterionBlocks(text, {acUnits})` also returns `defs` [{ id, key, line }] —
  every US-n.AC-m DEFINITION in document order (criterionLabel's ID of a defining list item, heading, table row or paragraph line), a
  repeat included: a unit repeating an ID is still a reference (never linted), but a definition again when it carries a modal verb,
  or — a heading in an acceptance-criteria context — when no list item defines that ID. `acDuplicates()` (doctor's and the
  approvals' `ac-uniqueness`) reads them by `key` (the number: US-1.AC-01 = US-1.AC-1); it read only `- US-` / `1. **US-**` items,
  so a second `- [ ] **US-1.AC-1**` (or an italic / code / bracketed one, two headings, two table rows, two paragraph lines) passed
  and its criterion vanished from trace_check. A coverage table, a Notes line, a heading over the list item that defines its ID
  and a sub-criterion ID (US-1.AC-1.2) are no duplicates.
- **Fences: one closer rule, `closesFence(line, marker)`** — every fence-aware reader (`stripFencedCode`,
  `criterionBlocks`, `designSections`, `headingEntries`, the placeholder scan, `mdListItems`, import, the task
  scanner's `fenceLine`) closes a fence only on a CommonMark closer: the opener's character, at least as long,
  nothing after it but spaces. Never `line.trim().startsWith(fence)` — it closed an open backtick fence on a line
  carrying an info string (a `js` opener), and requirements.md then read inverted (its ACs vanished from EARS and
  trace_check). `stripFencedCode`, `criterionBlocks`, `designSections`, `headingEntries` and the placeholder scan step
  through ONE helper, `fenceStep(st, line)`, which also applies CommonMark's list rule (the task scanner's too): a fence
  opened inside a list item (indented) ends with the item — a non-blank line less indented than its opener is outside.
  Without it one unclosed fence in a test-plan bullet blanked every row below it (no coverage, no planned T-IDs,
  phantoms in tasks.md). An unclosed TOP-LEVEL fence still runs to the end of the file. **Indented code (review 5, L32):**
  `codeBlockLines(lines)` = the fence lines + every line of an INDENTED code block (≥ 4 columns, a tab is 4; it starts after a
  blank line, a heading, a fence or the text's start — never interrupting a paragraph — and never inside a list, which a heading
  or a less-than-2-column line after a blank ends). `stripFencedCode` (so `requirementAcIds`, `planIdText`, the duplicate-ID and
  success-criteria readers, the pack fragments, the weigh sections) and `criterionBlocks` read it: "Example:\n\n    US-1.AC-7 …"
  was a required AC and an EARS no-modal error.
- **HTML-comment stripping** (`stripHtmlComments`): `ears`/`clarify`/`doctor` (for `[NEEDS
  CLARIFICATION]`) AND `trace_check` (for AC/test IDs and `_Implements:_`) all strip `<!-- -->`
  first, so example markers in template-guidance comments don't count as real. `clarificationMarkers()` (doctor, the gates, clarify,
  the export) strips fenced and indented code too since 1.24 review 6 (F11) — `stripFencedCode`, as EARS's criterion blocks do: an
  example of how to mark an open point, in a ```md block, blocked the design. (An inline code span still counts.) Keep template
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
  criterion, that track's sections), `tasks` (the ACTIVE tasks whose PROSE — `taskCitations`, trace_check's reader (review 5,
  M5): `taskProse`, never a fenced example, another feature's references out — cites the ID or one of its planned T-IDs: `{number, text, done, verified, reason, nothingToVerify?, cites, evidence}` —
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
  entry covers — a row or a T-ID-led item, never a Gaps note: 1.24 review 6, F3) · `no-coverage` (EC / NFR: no task or planned test; SC: no test-plan row or quickstart.md line — never for a
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
