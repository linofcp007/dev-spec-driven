# Reading spec markdown — EARS, IDs, fences, comments, trace and the matrix

Maintainer notes, one topic of the map in [CLAUDE.md](../../CLAUDE.md) — the index and the hard constraints.
How every reader parses requirements / tasks / test plans, what trace_check counts, and the requirements traceability
matrix. The rules come first; how they came to be — the releases and review findings — is in History at the end.

## Readers

### Headings and sections
- **The ONE heading reader:** `headingEntries(lines)` → `[{ i, level, text, body, atx, indent }]` — ATX headings indented
  0–3 spaces and SETEXT ones (a ONE-line paragraph over ≥ 3 `=` / `-`; a multi-line paragraph over `---` is none, so YAML
  front matter never reads as a heading), never one inside fenced code or an HTML comment (`commentLines`). `extractSection`,
  `sectionState`, `weighSectionHead`, `bugPlaceholders`, `designSections` (level-2 entries), `sectionDropLines` /
  `headingHasMarker` and `criterionBlocks` read it; `headingIndex(lines)` = its ATX entries at the margin, for the readers
  that parse the line themselves (decisions, export, import, packs). Never write a heading regex of your own.
- **Mandatory sections:** `extractSection(md, synonyms, marker, loose)` prefers the heading carrying the track marker,
  **never matches the H1 title** (the feature name), skips fenced code and needs the synonym to START the heading (after a
  marker, numbering, "Section N:" or an emoji), word-bounded, an English inflection allowed (s / es / ing). The unmarked
  fallback never takes a heading that carries another track's marker or sits under one (`inOtherTrackContext`: the nearest
  marked ancestor decides); a `loose` synonym (Processors) counts only on or under a marked heading (`inTrackContext`). Both
  contexts come from ONE stack pass — a back-walk per heading is quadratic.
- **Section states** (`sectionState`): `missing` · `unfilled` · `template` · `filled`; on a sized feature also `na` /
  `na-short` / `covered` (TRACK_OVERLAPS), read by every gate through `trackSectionReport()` + `sectionVerdict()`
  (gates-and-approvals.md → Right-sized rigor); `spec_status` shows them.
  - **Unfilled:** the `> **TODO**` sentinel outside comments and code, or nothing WRITTEN — `writtenContent()` =
    `sectionContent()` (no structure: sub-headings, a thematic break, a table's header / separator rows) minus the lines that
    answer nothing: a generic slot word (`genericAnswer()`: `isGenericSlot`'s TODO / TBD / "…", "Pending" in any language,
    behind markers, emphasis, brackets, punctuation) or no letter or digit; a table row answers when one cell does. "N/A",
    "None." answer (an unsized feature); fenced code is the author's. ONE reader: `sectionState`, `sectionOwnLines`,
    `hasProseOutsideBrackets()` (gates.js's `sectionFilled()` / `bugSectionFilled()`, the spike / decision prose);
    quality.js's `genericUnit` is `genericAnswer`.
  - **Template:** every visible line is a scaffold line of a track design block (`sectionOwnLines()` — exact lines, every
    language, the packs' with `{{name}}` / `{{slug}}` as a linear wildcard); an edited guidance line is the user's, a TBD
    beside it is not. It fails a new approval and warns on an approved design.
- **Doctor's `mermaid`:** `mermaidState(design)` → present · template · missing, over the ```` ``` ```` / `~~~` blocks
  whose info string starts with `mermaid`, outside comments. `template` — each holds a scaffold diagram
  (`templateDiagramSet()`, every language and design size, from the corpus; `renderTemplateDiagrams()` when it is stale) —
  warns `doctor.mermaidTemplate`, unless design.md is still a later phase's template. A project template's diagram is not
  known.
- **A change's one file:** change.md holds the criteria AND the tasks; every reader takes its two views (`changeViews` /
  `criteriaText` / `tasksIdText`) — a task's `_Requirements:_` is no required AC, and EARS never lints a task block.

### EARS criteria
- **Context:** the loose heuristics (an item that reads like a requirement, lowercase `deve/debe`) apply only under an
  Acceptance Criteria heading or in heading-less snippets; elsewhere a criterion needs SHALL / capitalised DEVE·DEBE /
  "sistema deve", a stable ID (US-n.AC-m, `EC-n`, `NFR-n`, `SC-nnn`) or a CAPITALISED EARS keyword. Word boundaries are
  unicode (`(?<![\p{L}\p{N}_])`) — `\b` never matches `DEVERÁ`.
- **Criterion-based, never line-based:** `criterionBlocks()` folds lines into logical criteria FIRST — bounded by blank
  lines, headings (SETEXT too), tables, HR and fenced code (`const shall = 1` in a fence is code); a comment-only line does
  **not** split one — then lints each. A sub-list continues its parent only when the parent reads as a criterion — a modal
  test cached per block (`curModal`); re-testing per sub-line is quadratic. Issues carry the start `line` (+ `endLine`) and a
  stable `code`: `no-modal` / `no-id` / `vague` / `placeholder` / `no-keyword` / `needs-clarification` / `padded-id`.
- **`no-keyword`** (info) spares the ubiquitous form naming its own system (`RE_UBIQUITOUS`: "THE <name> SHALL", one to four
  words, and the PT / ES forms). **`vague`** skips a verb clean / limpa / limpia (`VAGUE_VERB_NEXT`: "clean up its temporary
  files"); "a clean UI" stays vague.
- **Units that define an AC** are criteria of their own: an ID-led line or checkbox item (the ID may sit behind emphasis, a
  code span or a bracket — `RE_LIST_DEFINES_AC` / `RE_LEAD_DEFINES_AC`), a heading led by an AC ID (its body absorbed), a
  table row with a cell that is exactly an AC ID (under an AC / story heading, with no heading, or with a modal). One is a
  REFERENCE, never linted, when a list item defines that ID anywhere or an earlier unit did (a Notes line, a coverage table);
  outside an AC context it defines one only with a modal or a capitalised EARS keyword. A table-row or heading AC without a
  modal is an EARS error.
- **AC definitions — ONE reader:** `criterionBlocks(text, {acUnits})` returns `defs` [{ id, key, line }], every US-n.AC-m
  definition in document order, repeats included (a repeat defines again with a modal, or as an AC-context heading no list
  item defines); `acDuplicates()` (`ac-uniqueness`) compares them by `key` (US-1.AC-01 = US-1.AC-1). A reference (a coverage
  table, a Notes line, a heading over the item defining its ID) and a sub-criterion ID are no duplicates.
- **Every AC ID is linted:** doctor's `ears` fails (and the requirements / change-plan approval is refused) when
  requirements.md defines an AC ID (`requirementAcIds`) no linted criterion carries (`earsUnlinted()`, `earsNoCriteria`).
  The raw-text `earsValidate()` (ears_validate, the save hook, the pre-commit validator) judges criteria, not an ID set.
- **Zero-padded IDs:** readers compare AC IDs AS WRITTEN, so EARS warns `padded-id` (`US-1.AC-01` → "write US-1.AC-1";
  `acKey`, `ears.paddedAcId`) and only ac-uniqueness compares by number; a task citing `US-1.AC-1` for `US-1.AC-01` stays a
  visible uncovered + phantom gap.

### AC and test IDs
- **The forms:** `US-<n>.AC-<n>` and `T-<n>`, extracted with a lookbehind guard, NOT `\b` — in `_US-1.AC-1_` the `_` is a
  word char. Don't reintroduce `\b`. `US-1.AC-1.2` is NO AC ID (`extractAcIds` refuses an ID followed by `.<digit>`): a label
  (`RE_LEAD_LABEL` / `RE_CELL_LABEL`), no stable ID (`RE_OWN_LABEL_ID` skips it; `ears.subAcId`), listed like a bare AC-n —
  the trace model has no hierarchy below the story.
- **A criterion's ID is its LABEL, never a mention:** `criterionLabel(text)` reads the lead ID after a heading mark, list
  marker, checkbox or emphasis / bracket opener (`RE_LEAD_LABEL`; a `P1/` before it allowed), or a table cell that is exactly
  an ID (`RE_CELL_LABEL`). `ownStableId` = such a US-n.AC-m / EC / NFR / SC label (not another feature's); with NO label, a
  non-T stable ID anywhere in the criterion's own text (`RE_FULL_ID_NO_T`, after `stripSupersedes` / `stripForeignAcRefs`).
  A bare AC-n label is no ID whatever the criterion cites. EARS's no-id lint reads the same.
- **A bare `AC-n` is no ID:** EARS lints a unit led by one and warns `no-id` (`ears.bareAcId`). `RE_BARE_AC` skips the AC-n of
  a US-n.AC-m and of an importer's escaped `US-7\.AC-1` (fluidplan escapes a bare one too: `AC\-1`, `fpInert`); `bareLabel`
  reads the own text with `RE_BARE_AC_OWN` — never an AC-n behind a slash (`checkout/AC-2`) or running into a letter / digit
  (`AC-230V`). `criteriaBareIds(reqText, dir)` feeds spec_upgrade's renumber item (lifecycle.md → Upgrade).
- **Unidentified criteria are a gap:** `earsUnidentified(reqText, ears, dir)` names (bare ID, else `L<line>`) each criterion
  numbered with a bare AC-n or a sub-criterion ID, and one with no ID only when the document defines no AC ID (an EC / NFR /
  SC label is an ID). trace_check's gap `unidentifiedCriteria` (first in `TRACE_GAP_ORDER`, only when non-empty); doctor's
  `ears` fails (`earsNoAcIds`), so do the requirements and change-plan approvals; the pre-commit check names them.
- **Untraced criteria are a warning:** beside US-n.AC-m criteria, a modal criterion with no ID at all is `untracedCriteria`
  (`L<line>`, `TRACE_INFO_FIELDS`, only when some; doctor's `traceability` warns). trace_check runs ONE EARS pass (`earsOf`)
  whenever ACs are defined; `earsUnidentified` only when none are or the text holds `RE_BARE_AC` / `RE_SUB_AC`.
- **`<feature>/US-n.AC-m` is another feature's:** `requirementAcIds` drops it (`stripForeignAcRefs`); an ID, a priority, a
  story, a number or a letterless token (`RE_NOT_A_SLUG`) before the slash keeps the ID. With the folder
  (`requirementAcIds(text, dir)` — trace_check, the matrix, the EARS checks, a change's scope, decisions, the test-plan
  scaffold, the importer) the token must resolve like `_Supersedes:_` (`locateFeatures`; `featureRefTest` → "other" ·
  "self" · null) to ANOTHER feature; one naming NO feature is this one's only when that ID LABELS a criterion
  (`criterionLabelIds`). With no folder (a template, a pack, the importer's task fitting) every slug-shaped token is foreign.
- **The `#` title is no criterion:** `stripTitleLines` blanks level-1 headings before the IDs are read.

### What trace_check counts
- **Task citations — one reader:** `taskCitations(blocks, dir, reqText)` = each task block's prose (`taskProse`, never a
  fenced example) minus foreign references (`stripForeignAcRefs(text, dir, reqText)`: requirements.md's labels decide) →
  `{ per, acs, tids }` — what `acsInTasks` / `uncoveredByTasks` / `phantomAcsInTasks` and the matrix read, never tasks.md
  whole. The test plan drops foreign references the same way; `_Implements:_` is read from the whole file. T-IDs compare by
  number (`tKey` / `testIdKeys`: T-01 = T-1), reported as spelled.
- **Test-plan IDs:** every reader of them (`testIndex`, `testPlanEntries`, the gates) goes through `planIdText()` (comments
  and fenced code out). A plan citing an AC requirements.md doesn't define is a gap (`phantomAcsInTests`, +tdd — any
  mention, a Gaps note too): doctor fails, the approval is refused.
- **Coverage = a test ENTRY** (`testPlanEntries()` — `uncoveredByTests`, the matrix's `no-test`, the test-plan approval): a
  table row with a T-ID in its Test ID column (`RE_TEST_ID_HEADER`, else the first; pipe-less GFM tables too), a list item
  or a heading led by a T-ID (+ its body). An AC named only outside the entries (a Gaps / Out of Scope note) stays a gap —
  accepting it is a forced approval — and the warning `justifiedTestGaps` (+tdd, `TRACE_WARNING_ORDER` after the secondary
  kinds) lists it.
- **Scaffolded test rows:** only those of the track ACs requirements.md has (`testPlanTracks()` — spec_create on an existing
  feature, spec_add_track).
- **A removed track's criteria:** the REQUIRED ACs are the ACTIVE requirements' (`activeDesign`), covered by the ACTIVE tasks
  (`activeTasks`), as the matrix reads them; a phantom is an ID defined NOWHERE (`definedAcs`). Secondary IDs alike
  (`traceSecondary(…, allReqText)`), doctor's `secondary-trace` too. A section is inactive only when the off track's marker
  LEADS its heading (`headingLeadMarkers()`); the ACs only an inactive section defines are the warning `inactiveAcs` (only
  when some) — never silent.
- **Secondary IDs are WARNINGS, never the verdict:** EC-n / NFR-n need a task or (+tdd) a test-plan row, SC-nnn a test-plan
  row or a real quickstart.md line; compared by number (`SC-1` = `SC-001`); untouched template rows don't count. `warnings` =
  `[{kind, items}]`, excluded from `traceGaps()`.

### Test code and file reads
- **`trace --code`:** a test names its T-ID — `T-01` anywhere, or `T` + a zero-padded number without the hyphen
  (`test_T01_…`, `TestT01`, `T01_…`) — `RE_CODE_TID`.
- **Which files:** a code file (`isCodeFile()` — `CODE_EXT`, shared with guard mode, the scan and coverage) that
  `isTestFile()` calls a test — ONE rule (engine/scan.js; trace's `isTestCodePath` is it): the test folders (`TEST_DIRS`;
  `t/` / `xt/` for Perl's `.t`) and each language's naming convention (`RE_TEST_NAME`, `RE_TEST_NAME_EXTRA`), anchored and
  linear. A name merely ending in "spec" / "test", or a name-only `test_*.sh` / `test_*.c` / `*Spec.hs`, is code outside a
  test folder.
- **Fixtures:** `isTestFixture()` — a `TEST_DATA_EXT` file (`.sql`, `.ipynb`) in a test folder with no test name
  (`testNamed()`, + pgTAP's), or any file under `testdata/`, is data: the scans and coverage skip it (guard mode still asks).
  A plan's File column claims one (`fixtureClaim()`; `scannableTestPath()` keeps it) by the file itself or the folder
  DIRECTLY holding it (`tests/` claims `tests/001_users.sql`, never `tests/fixtures/seed.sql`); `traceTestCode` counts a
  claimed fixture (`scanTestCode().fixtures`) only for the claiming plan's rows that name it.
- **Scoping:** a row's concrete File path counts only there; another feature's `.specs/<f>/tests/`, or a test file only
  ANOTHER feature's plan names, never counts (T-IDs restart at T-01 per feature). A folder token claims no file; a claim is
  the EXACT project-relative path, never a suffix.
- **Outside code:** a T-ID whose rows' File names only non-code artifacts (outside `GUARD_CODE_EXT`: `load-test.md`,
  `evals/*.json`, a `.feature`) is `plannedOutsideCode`, never `plannedNotInCode` — no gate expects it in a test file; a code
  path, a template slot or a row with no File keeps it expected. Doctor's `tests-in-code` warns only for T-IDs made green by
  DONE tasks.
- **Bounded reads:** `scanTestCode()` (read-only) reads its candidates in walk order below `CODE_TRACE_READ_CAP` (test-named
  ones first above it), each through `readFileHead()` (files.js): the first `SCAN_READ_BYTES` CHARACTERS from one bounded
  read — never the whole file, never a byte cap. The brownfield scan and the status line's tests gate too.
- **Encodings:** every reader of spec / test text decodes through `decodeText()` (`readFileHead`, `readRaw` →
  `readIfExists` / `readContained`, the importer, the resources, the save and observe hooks, `dev-spec ears <file>`): a BOM
  FF FE is UTF-16LE (PowerShell 5.1's `>`), FE FF UTF-16BE, else UTF-8; the BOM stays the U+FEFF readers drop. A text with
  CRs and NO LF reads as lines (`crOnlyToLf`). A rewrite is UTF-8 / LF — except tasks.md, kept in its own encoding
  (tasks-and-evidence.md → Tasks: ONE scanner).

### `_Implements:_`
- **An OPEN task's `_Implements:_` is the plan:** a missing file only open tasks name is `plannedImplFiles`; a done task's
  (or a path outside the project) is `missingImplFiles`. `spec_scan {coverage: true}` = the code files any feature's
  `_Implements:_` names (file, folder or glob). Every reader resolves through `implementsPath()` (`:12` / `#L12` dropped; an
  anchor alone names nothing); a trailing annotation after the path is a note (`RE_IMPL_ANNOTATED`); a path with spaces is
  read as written. Comparisons: `implementsRel()` / `implementsKey()` (+ FOLD_CASE) — `next --batch` (a shared file, or a
  folder and a file under it, ends the batch) and the brief's design sections.

### Fences, code blocks and HTML comments
- **Fences:** every fence-aware reader (also `mdListItems`, import, the task scanner's `fenceLine`) closes a fence only on a
  CommonMark closer — `closesFence(line, fence)`: the opener's character, at least as long, nothing after but spaces. Never
  `line.trim().startsWith(fence)`: an info-string line closes the fence and inverts the file. `stripFencedCode`,
  `criterionBlocks`, `designSections`, `headingEntries` and the placeholder scan step through `fenceStep(st, line)`, which
  ends a fence opened in a list item with the item (the task scanner too); an unclosed top-level fence runs to the end.
- **Indented code:** `codeBlockLines(lines)` = the fence lines + every INDENTED code block line (≥ 4 columns, a tab 4; after
  a blank line, heading, fence or the text's start, never inside a list); `stripFencedCode` and `criterionBlocks` read it,
  so an indented `US-1.AC-7` defines nothing.
- **HTML comments:** EARS, clarify, doctor and trace_check strip `<!-- -->` first (`stripHtmlComments`) — keep template
  examples in comments; `clarificationMarkers()` also strips fenced and indented code (an inline span still counts). ONE
  comment reader, `commentLines()` (`stripHtmlComments`, `criterionBlocks`, `headingEntries`, the placeholder scan;
  `scanTaskLines` keeps its own): a `<!--` in code is text, and a comment opens only when a `-->` outside code follows — an
  unclosed `<!--` is plain text.

## Requirements traceability matrix
- **`buildTraceMatrix(projectDir, {slug, dir}, {code?, scan?, supBy?})`** (`traceMatrix(projectDir, name, opts)` resolves the
  name) REUSES the readers — never a second verdict, nothing recorded. Rows = trace_check's AC set (`requirementAcIds`,
  document order), then the secondary IDs (`secondaryDefinitions`, kind order), over the ACTIVE requirements. Per row: `text`
  (`acOneLine`, ≤ 1000 chars), `template` (`placeholderReport`), `design` (the `##` sections naming it, a bugfix's `bug.md`
  too, + a `[SEC]` / `[PRIVACY]` criterion's track sections), `tasks` (the active tasks citing it or its T-IDs:
  `{number, text, done, verified, reason, nothingToVerify?, cites, evidence}` — `taskVerification()` in the project's
  evidence mode, `rtmEvidence()`), `tests` (+tdd: the citing entries' T-IDs; with `code` their files and `outsideCode`, one
  `scanTestCode()` walk shared with trace), `decisions` (whose `_Affects:_` name it), `supersedes` / `supersededBy`
  (`supersededByIndex()`, once per call), `approval` `{at, by, forced, changed}` (THIS row changed since the snapshot —
  `latestSnapshot`; fingerprint-only: `changed: null` once the file changed). Plus `approval` (`baseline: snapshot |
  fingerprint-only | none`), `counts` {rows, verified, implemented, planned, untraced, template, superseded}, `lang`, `kind`,
  `tracks`.
- **Linear:** rows read indexes built once (`rtmIndex()`, `rtmKey()`, `rtmMerge()`), never a scan per row;
  mcp/tests/05-markdown-r7-readers.js bounds the matrix at max(1.5 s, 4 × the plain trace).
- **Stable codes:** `status` (`RTM_STATUSES`): `untraced` · `planned` (a linked task open, or none yet) · `implemented` (all
  done, one unverified) · `verified` (all done and verified; nothingToVerify counts). `gaps`: `no-task` · `no-test` (+tdd)
  · `no-coverage` (EC / NFR / SC; never an untouched template row) — exactly trace_check's gaps and warnings for that ID.
  Labels: `i18n.msg(lang).rtm`.
- **Surfaces:** `trace_check {matrix: true}` (informational; with `code`, ONE walk); `dev-spec trace <f> --matrix`
  (`printMatrix`) / `--csv` (the data alone — no BOM, no marker; exit code = trace gaps); `spec_export {format: "csv"}` /
  `export [f] --csv` → `.specs/exports/<slug>.rtm.csv` (`project.rtm.csv`; a feature slugged `project`:
  `project.feature.rtm.csv`); the feature export's "Traceability matrix" section (`rtmMarkdown`, not for a spike; `rtmCell`
  neutralizes `<!--`) and the project export's counts (`rtmProjectMarkdown`).
- **CSV** (`matrixCsv(matrices, lang, {document?})`): RFC 4180, a localized header, a Test files column only with `code`, a
  formula guard (`RE_CSV_FORMULA`: `=` `+` `-` `@` tab CR → a leading apostrophe). `{document: true}` adds a UTF-8 BOM (Excel)
  and a LAST record `# AUTO-GENERATED by dev-spec …` in the first cell — the header stays row 1 and `isGeneratedOrAbsent`
  finds the marker in the tail.

## History
How the rules above came to be, section by section — grep a release (`1.21.1`) or a finding id (`M8`, `r6 B3`) here.

### Readers
- **v1.9.2** — EARS became criterion-based (`criterionBlocks()`): a line-based lint split wrapped EARS phrases and list items.
- **1.13** — the CommonMark fence closer (`closesFence`): `line.trim().startsWith(fence)` closed a backtick fence on a `js`
  opener and requirements.md read inverted (its ACs vanished from EARS and trace_check). `fenceStep`'s list rule: one
  unclosed fence in a test-plan bullet blanked every row below it (no coverage, no planned T-IDs, phantoms in tasks.md).
  `planIdText()`: a fenced example row covered its AC (a false pass) and planned a T-ID the tests gate demanded.
  `plannedOutsideCode`: the scaffold's own load / eval rows warned forever. Per-feature T-IDs: a new feature's Phase 4 gate
  passed on another feature's tests.
- **1.14 full review (Pa) / final review (R)** — the comment reader learned code spans and unclosed `<!--`: a stray marker hid
  every criterion below it (EARS 0 criteria → pass, the requirements approval passed) while trace_check counted them. A test
  file another feature's plan names stopped counting. A claim became the exact path (a suffix match made `tests/test_api.py`
  own `services/beta/tests/test_api.py`).
- **1.21 F5** — sized features: `template` (`sectionOwnLines()`), `na` / `na-short` / `covered`, read through
  `trackSectionReport()` + `sectionVerdict()`.
- **1.21 review B5** — the unmarked fallback stopped taking a heading nested under another track's (`inOtherTrackContext`):
  "### Data quality" under "## [PRIVACY] …" is +privacy's text.
- **1.21 review C1** — a change's one file: readers take change.md's two views (a task's `_Requirements:_` was a required AC,
  EARS linted task blocks). **C2** — fenced code answers a section (a json / yaml / mermaid answer read as the template).
- **1.21.1** — ONE test-file rule (`isTestFile()`) for every language: until 1.21.1 the scan read only the scanner's short
  `CODE_EXT`, and a PowerShell project's tests gate never passed. Fixtures: 1,600 `tests/fixtures/*.sql` exhausted the read cap
  and a 'T-01' in a seed counted as the test. `readFileHead()` replaced reading the whole file then slicing. The 1.21.1 review
  dropped the name-only `test_*.sh` / `test_*.c` / `*Spec.hs` rules (`scripts/test_data.sh`, `src/test_utils.c`,
  `lib/DevSpec.hs` were tests).
- **1.21.1 review 2** — a plan-claimed fixture is read (`fixtureClaim()`, pgTAP's `test/sql/users.sql`); `scannableTestPath()`
  stopped dropping fixtures (a plan naming one warned forever). `readFileHead`'s cap became characters: a byte cap lost a T-ID
  behind 150,000 'é'.
- **1.21.1 review 3** — the claim narrowed to the file or its direct folder: any folder holding it made seed data a test
  through the common `tests/` entry.
- **1.22 review** — `inTrackContext` reads one stack pass like `inOtherTrackContext`: the back-walk per loose heading made
  200 KB of "### Processors" cost status 9 s (now ~0.15 s). `curModal`: re-testing the joined block per sub-line took trace +
  matrix 12 s on 200 KB of nested "- … SHALL x" (now ~0.2 s). A bare AC-n is no ID (`earsUnidentified`,
  `unidentifiedCriteria`): a spec numbered AC-1, AC-2 traced 0 ACs and passed everything ("all 0 ACs covered").
  `<feature>/US-n.AC-m` dropped: "rules of checkout/US-3.AC-2 stay as they are" was a required AC no task covered. UTF-16
  (`decodeText()`): a Pester `tests/Login.Tests.ps1` naming T-01 was never found, a UTF-16 requirements.md traced 0 ACs.
  `testdata/` folders are fixtures (Go). `vague` spares a verb "clean".
- **1.22 review 2** — only a criterion with NO stable ID is unidentified: an NFR-1, NFR-2 performance spec failed doctor,
  trace and the requirements approval. Only ANOTHER feature's slug is foreign: a priority (`**P1/US-1.AC-1**`), story, number
  or letterless token before the slash sent every required AC to 0; the feature's own `login/US-1.AC-1` stays its ID.
- **1.22 review 3** — the LABEL, never a mention (`criterionLabel`): `- AC-1: WHEN … SHALL redirect (see EC-1)` or `… (T-01)`
  had "its own" ID (earsUnidentified null, doctor's ears passed, trace counted 0 ACs with no gap, spec_upgrade's bareAcIds
  []). A token naming NO feature counted as this feature's: "keep the rules of billing/US-3.AC-2" with no billing feature was a
  required AC no task covered — now it is this feature's only when it labels a criterion (`5. Step-2/US-1.AC-5 — WHEN …`).
- **1.22 review 4** — no label → an ID anywhere is the ID: `(NFR-1)`, `**Latency (NFR-1):**`, `**[NFR-1]**`, `a. NFR-1:` were
  unidentified (doctor's ears failed, the approval refused) while EARS counted their ID. Each criterion by its own ID:
  `earsUnidentified` returned null for any document with a US-n.AC-m in it, so `- AC-1: … (see US-1.AC-9)` escaped while the
  cited ID became the only required AC. An importer's escaped `US-7\.AC-1` was listed as an unidentified `AC-1` (the import
  read gaps-found); `checkout/AC-2`, `/pages/AC-12`, `AC-230V` were each a criterion's "number" and every gate and spec_upgrade's
  renumber item asked to renumber another feature's ID; a criterion whose only ID was a `_Supersedes:_` marker's or another
  feature's counted as identified for EARS, untraced with no warning.
- **1.23 review 5 (M2)** — ONE heading reader (`headingEntries`): a `## [SEC] Threat Model` wrapped in `<!-- … -->` read as
  present and filled (doctor "all 5 filled"), a commented-out `## Risks` passed design-risks. **(L28)** — the sentinel in a
  comment / code example is none, and a body of structure only is `unfilled` (it was "filled"); doctor's `mermaid` was a
  substring test: a `~~~mermaid` fence warned, one quoted in a comment passed, the untouched template diagram passed.
  **(L32)** — indented code blocks (`codeBlockLines`): "Example:\n\n    US-1.AC-7 …" was a required AC and an EARS no-modal
  error; T-IDs by number (`tKey`). **(L31)** — a sub-criterion ID read as US-1.AC-1: two sub-criteria collapsed into one
  required AC, a task citing `.1` covered both, doctor said "duplicate US-1.AC-1". **(M5)** — one task-citation reader
  (`taskCitations`): tasks.md was read WHOLE, so a "Deferred: US-1.AC-2" note or the title covered US-1.AC-2 (doctor "all ACs
  covered") while the matrix said `no-task`, and `checkout/US-2.AC-1` covered this feature's US-2.AC-1 or was a phantom; the
  test plan's references too. `RE_UBIQUITOUS` — `no-keyword` counted only "THE SYSTEM". tasks.md is written back in its own
  encoding since review 5.
- **1.23.1** — the `#` title is no criterion: a feature name holding `US-9.AC-1` (bold or plain) was one more required AC no
  task covered.
- **1.24 review 6 (F1)** — `RE_LIST_DEFINES_AC` / `RE_LEAD_DEFINES_AC` take criterionLabel's openers: `- [US-1.AC-1] User can
  log in`, no modal, was counted by trace_check, never linted, and approved. Per ID (`earsUnlinted()`): the check fired only
  when nothing at all was linted, so beside one well-formed criterion a blockquoted AC or `- Login US-1.AC-1: …` was a
  required AC EARS never read. **(F2)** — `defs`, one AC-definition reader: `acDuplicates` read only `- US-` / `1. **US-**`
  items, so a second checkbox / italic / bracketed / heading / table-row definition passed and its criterion vanished from
  trace_check. **(F3)** — test coverage = a test entry: any mention counted, so an AC in the "Gaps (with justification)" list
  or under "Out of Scope for Testing" was covered and the approval passed (`justifiedTestGaps`). **(F4)** — `writtenContent()`:
  a [SEC] section saying "TBD" read as filled (doctor "all 5 filled", the design approved). **(F8)** — `padded-id`.
  **(F9)** — a removed track's criteria: trace_check read the whole files, so a feature that removed +saas and deleted its
  +saas tasks failed traceability (doctor too) on criteria the matrix no longer listed. **(F11)** — `clarificationMarkers()`
  strips code: an example marker in a ```md block blocked the design. **(F-I8)** — `untracedCriteria`, which since 1.24
  review 6 makes trace_check run EARS whenever ACs are defined. **r6 D3** — the "\r\r\n" reading `decodeText()` keeps.
- **1.25.1** — the test-entry shapes: pipe-less GFM tables, a Test ID column that is not the first, T-ID-led headings — each
  read as no entry (covered 0/N, every AC a `justifiedTestGaps` warning). Only a LEADING marker makes a section inactive:
  `### US-2 (P1): API notes [API]` hid its ACs and doctor passed them untasked (`inactiveAcs` names what an inactive section
  holds). CR-only line endings (`crOnlyToLf`): a feature saved with bare `\r` traced 0 ACs beside its planned tests, doctor's
  placeholders failed and status said phase requirements. `RE_IMPL_ANNOTATED`: `_Implements: src/lib/a.ts (the helper)_` was a
  missing file that blocked doctor and finish. `criterionBlocks` takes SETEXT headings: "Acceptance Criteria" over `-------`
  opened no AC context.

### Requirements traceability matrix
- **1.14 F5** — the matrix: `trace_check {matrix: true}`, `trace --matrix` / `--csv`, the export's section and `.rtm.csv`.
  **F1** — its task verdict is `taskVerification()` in the project's evidence mode (`unobserved` under `"observed"`).
- **1.23 review 5 (M5)** — the per-task citations read `taskCitations` (trace_check's reader): the matrix and trace_check
  disagreed on a "Deferred:" note.
- **1.24 review 6 (F3)** — `no-test` reads test entries only, never a Gaps note. **(F9)** — rows and tasks over the active
  requirements and tasks.
- **1.25.1** — linear: each row scanned every task, test entry, section and decision; 2,800 stories (8,400 rows) took the
  matrix 5.5–6.4 s beside a 0.5 s trace — now ~0.5 s, the same rows.
