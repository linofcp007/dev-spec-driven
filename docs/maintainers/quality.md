# Spec quality — steering amendments, cross-feature criteria, glossary, design weighing, reuse

Maintainer notes, one topic of the map in [CLAUDE.md](../../CLAUDE.md) — the index and the hard constraints.
The spec-quality checks, the design's trade-offs / risks / reuse sections and their doctor warnings, the constraint nudge,
the TDD micro-cycle. The rules come first; how they came to be — the releases and review findings — is in History at the end.

## Spec quality
- **Steering amendments** — a requirements / design approval (`STEERING_GOVERNED`) and its history record carry `steering`
  {file: fingerprint} of the files `governingSteering()` returns: constitution.md, the active tracks' (and packs') steering
  files, every `inclusion: always` file and EVERY `fileMatch` file, its patterns kept in `steeringMatch` — matched later, as
  tasks.md names no file yet at those approvals (CRLF / BOM are encoding: `steeringFingerprints()`). `steeringChanges()` →
  `modified` | `removed`; a `steeringMatch` file counts only while the feature's CURRENT `_Implements:_` match its recorded or
  current patterns. Doctor warns `steering-changed-since-approval`; next_action appends `quality.naSteering` to its step, never
  a step of its own; `spec_impact {phase: "steering"}` (`steeringImpact()`: the name optional, read-only) lists the features
  concerned, and approvals without `steering` as `untracked` — never flagged. Re-approving records the current steering.
- **Cross-feature criteria** — `crossFeatureAcs()` over `xacTable()`, memoized per read-cache scope (`XAC_MEMO`) and across
  calls by file signatures (`XAC_FEATURE_CACHE`, `XAC_TABLE_CACHE`; their rules are in the comment above them — a file
  modified < 2 s ago is never trusted, `XAC_RACY_MS`; a feature with inferred tracks or `packMarkers` is never cached). Doctor
  runs the check `last`; the lean doctor (next_action's, finish's) skips it once another check warns or fails.
- **Comparing criteria** — `acShape` splits a criterion at its modal into `trig` / `resp` word sequences. Polarity is the
  RESPONSE's negation only; a trigger negator marks its next word "!w", and w vs !w (`xacOpposed()`) are complementary
  conditions, never a pair; numbers keep the word after them (`numKey`). `xacClauseSim()` = LCS / union, order-aware.
  `near-duplicate`: trig AND resp each > 0.8, same polarity and numbers; a conflict (`opposite-modal` | `different-numbers`):
  word Jaccard ≥ 0.7 (the index gate), trig and resp ≥ 0.5 (`XAC_RESPONSE`). Never compared: a criterion with a slot left or
  under 3 words, a template criterion (built-in, pack or project, or two light edits of one), criteria retired by a shipped
  `_Supersedes:_`, declared pairs. Caps: 4000 criteria / 200k comparisons / 200 pairs.
  Surfaces: doctor warn `cross-feature-acs`, `spec_export {format: "catalog"}.crossAcs`, a SPECS.md section, spec-critic.
- **Glossary** — the steering stub `glossary.md` (steering_scaffold; init never creates it):
  `- **Term** — definition. _Avoid: a, b_` (`_Avoid:_` English-stable). `glossaryEntries()` reads ≤ 300 (`truncated`: doctor
  warns, clarify says so). `glossaryHits()` masks the terms before searching the avoided words ("End user" never reads as
  "user"), skips code, comments and `_Marker:_` tags, reads `_client_` emphasis but not snake_case, and never reads TEMPLATE
  text: `glossUserParts()` drops each line matching a line of a built-in, project or pack template (`glossBuiltinLines()`,
  `glossProjectLines()`), a top-level `[…]` / `{{…}}` a wildcard (an untouched slot skipped, a filled one read).
  `briefGlossary()`: ≤ 8 entries / 1500 characters. Clarify asks one question per avoided word (≤ 10); doctor `glossary`
  warns with the count.
- **Messages:** `i18n.msg(l).quality` (QUALITY_MSG). Phases (`DOCTOR_CHECKS`' `phase`): glossary 1, cross-feature-acs 1,
  steering-changed-since-approval 2.

## Design trade-offs and risks, the constraint nudge, the micro-cycle
- **The sections** — the core design builder scaffolds `## Alternatives & Trade-offs` (after Architecture: the options per key
  decision, pros / cons / cost of being wrong, the choice) and `## Risks` (before the Constitution Check: likelihood, impact,
  mitigation, owner) — slots, so a fresh design's approval is refused on `placeholders`. Doctor `design-tradeoffs` /
  `design-risks` only WARN (phase 2, no gate): `designWeighChecks()` → missing · template · empty · few · filled
  (`designWeighState`); skipped for a bugfix, a spike and a design still a later phase's template. `designSaveCheck` returns
  `weigh` notes (never unclean); `templates check` warns `tradeoffs-missing` / `risks-missing`; no artifact is ever edited. An
  approval without the check's stamp is never flagged (The stamp scheme, below); spec_upgrade lists these ids but never counts
  them toward `attention` (`DESIGN_WEIGH_IDS`).
- **Headings** — `weighSection()` (not extractSection): a `TRADEOFFS_SYN` / `RISKS_SYN` synonym after the heading lead is the
  WHOLE heading or is followed by a separator or a connector word (`RE_WEIGH_HEADING_REST`): "Risks & Mitigations" matches,
  "Risk-based rate limiting" doesn't. An unmarked heading wins over a `[MARKER]` one; never the H1; the headings are
  `headingEntries()`' (markdown-and-trace.md → Readers). A plain **"Decisions"** heading is NOT one: the execplan / fluidplan
  imports write `## Decisions`, a decision LOG whose entries would read as options.
- **Counting** — `designBody()`: table data rows + list items at the section's OUTERMOST level (deeper ones are pros / cons),
  or, when more, sub-headings / bold-led paragraphs. Units holding only a slot word (`genericUnit` = markdown.js's
  `genericAnswer`) → `template`; nothing → `empty`. Trade-offs: ≥ 2 entries, or no list and a paragraph of ≥
  `WEIGH_PROSE_WORDS` (3) words ("No key decision here: …"); one option → `few`. Risks: any entry or prose ("None." counts).
- **Constraint nudge** — `constraintNudge()` reads only the USER's text of requirements.md + design.md (`userSpecText()`: no
  line that IS template text, no section still holding `> **TODO**`), so a pristine scaffold never fires it. Signals by
  concept (`CONSTRAINT_SIGNALS` {en, pt, es} — English in every spec + the feature language's: "fila" is a queue in PT, a row
  in ES): TWO distinct concepts or ONE strong phrase (message queue, race condition, webhook…) — "click event" alone never
  fires. Answered ANYWHERE in that text by a multi-word phrase (`RE_CONSISTENCY_ANSWER`: eventual consistency, idempotency,
  exactly-once, outbox…; `ACID` upper-case), never a bare "consistent" or "isolation". → `nudges` with the code
  `consistency-unstated` (≤ 3 signals); plain features only, never with +dist.
- **One question bank** — /clarify --grill's "Constraints round" skips a question an active track's design sections own
  (+dist: atomicity … dependency failure; +saas: volume; +api: idempotent creates, concurrent updates), and a sized design's
  Error Handling points at the IF…THEN criteria instead of asking again (prose only).
- **The merged section (size S)** — a sized-S design writes ONE `## Decisions, reuse & risks` section. `designWeighChecks`
  reads it (`WEIGH_MERGED_SYN`) for a check whose own section the design lacks, min 0 ("no material risk" answers); the brief's
  Reuse part reads it too. A design with its own section is judged on that section.
- **The TDD micro-cycle** (adapted from obra/superpowers, MIT) is prose only — test-patterns.md "The micro-cycle inside a
  task", spec-implementer (a hard rule), spec-reviewer, /executeTask, AGENTS.md, SKILL.md. It lives INSIDE a task: never a new
  T-ID, never an edit of a planned assertion. Its red flags (green on the first run, written after the code) apply to a NEW
  behaviour's test only — a guard test (a bugfix's T-02), a characterization test and a T-ID an earlier task turned green pass
  first time by design. The reviewer flags production behaviour no test exercises — never "no test in the diff" (the target
  T-IDs are committed in Phase 4).

## Reuse & Integration and clean code
- **The section** — the core design builder scaffolds `## Reuse & Integration` between Architecture and Alternatives &
  Trade-offs: a Kind · What · Where (path) · Why table (Reuse / Extend / New) + a `**Module boundaries:**` line — slots,
  refused on `placeholders` until written. Guide: `references/code-reuse-and-quality.md`.
- **Doctor `design-reuse`** — the third `DESIGN_WEIGH` entry, the trade-offs pattern exactly (WARN only, `REUSE_SYN`, min 0:
  "greenfield: nothing to reuse" counts; `designSaveCheck`'s `reuse`, `templates check`'s `reuse-missing`). The heading must
  NAME the section — never a bare "Integration" or "Existing" (`weighTextMatches`). **Brownfield:** a missing or empty section
  passes as `integration` when `integration-plan.md` → Integration Points is filled (`designReuseFallback`).
- **The stamp scheme** — `approvePhase` stamps a design approval (and its history record) `weigh: true` and `reuse: true`;
  each DESIGN_WEIGH entry names the stamp it needs. A check whose stamp the approval lacks is legacy: a pass whose detail says
  so (`designWeigh.legacyApproval`, the release from `DESIGN_WEIGH_STAMPS` — "approved before 1.19"), since a finished feature
  following the advice would reopen its whole chain; `opts.legacy` makes every check legacy. A new design check → a new stamp
  key (additive: an older engine keeps its own rules).
- **The brief** — `briefReuse()` → the Reuse units (`reuseUnits`; one holding a slot is none) that name the task — its file, a
  sibling, its folder or one above (`RE_REUSE_PATH`), a ≥ 5-character basename, or one of its AC IDs — ≤ 8 entries / 1,500
  characters; and the source files (`GUARD_CODE_EXT`) next to its `_Implements:_` targets: ≤ 5 folders, each read by ONE bounded
  `opendirSync` of ≤ 1,000 entries (`readDirBounded`), the first 15 (non-test first) + `more`, a lower bound when `truncated`.
  `taskBrief` renders it after Files; with `write: true` only `refs.reuse {entries, files}`.
- **Paths from spec text** — `reuseTargets` keeps only a reference INSIDE the project, decided on its TEXT before any fs call
  (`reuseInsideRel`): a network path (`isNetworkPath` — a stat of `//host/share/x.ts` opens an SMB connection, NTLM credentials
  on Windows), an absolute path elsewhere or a `..` out names nothing; one into the project reads as its relative spelling.
  Inside, `reuseProbe` lstat's each segment and stops at a symlink or junction — never followed (the list is a hint; a link
  could reach a share).
- **Design context** — only the ONE section weighSection picks can leave the brief's "Design context", and only when the
  Reuse part quotes ALL of it (`reuseQuotedSection`: every unit, in order, no fenced code); every other section keeps the
  usual selection (mcp/test.js "1.19 R review 2"). `_Emits metrics:_` also pulls an +obs feature's `[OBS] Telemetry` section,
  beside `[SaaS] Observability`.
- **Backlog names** — `spec_roadmap_edit {kind: "backlog"} add` of an existing name (case-insensitive) keeps its entry and
  APPENDS the new note (`BACKLOG_NOTE_SEP`; a note it holds already changes nothing) → `exists: true`, `appended`, a localized
  `note` the CLI prints instead of "✓ added". Any note is ≤ `BACKLOG_NOTE_MAX` (2,000) characters; past it add is refused,
  nothing written. One name per refactor candidate.
- **Prose** — spec-implementer: "Search before you write" (Before-you-begin step 3: reuse → extend → create, the rule of
  three) + a hard rule + the report's `### Reuse` block; spec-reviewer: duplication against the EXISTING codebase is Important;
  the controller files refactor candidates in the backlog. No engine gate reads the Reuse block. Extending a unit OUTSIDE the
  task's `_Implements:_` files is never a silent edit (NEEDS_CONTEXT → a converge task or the controller's go-ahead, or create
  locally and say so) — the scope guard would stop a subagent mid-task; the brief's `reuseRule` says it.
- **Steering** — the `structure.md` stub has Module Boundaries and Shared Code slots, the constitution stub the example
  principle "Search before you write: extend an existing module before adding a new one" — EN / PT / ES.

## History
How the rules above came to be, section by section — grep a release (`1.21.1`) or a finding id (`M8`, `r6 B3`) here.

### Spec quality
- **1.16 Q** — package Q: steering amendments (Q1), cross-feature criteria (Q2), the glossary (Q3). Approvals made before 1.16
  carry no `steering`: never flagged, `untracked` in spec_impact.
- **1.16 Q review** — matching the `fileMatch` patterns at approval time recorded none (requirements / design are approved
  before tasks.md names a file): every `fileMatch` file is recorded with its patterns, matched against the CURRENT
  `_Implements:_`.
- **1.16 Q review 6** — `_client_` / `__org__` underscore emphasis is read, snake_case is not; a loose list's indented `_Avoid:_`
  paragraph after a blank line belongs to its entry.
- **1.16 verify NEW-2** — a removed feature took a deleted pack's last ghost marker with it, so cached rows went stale: the rows
  and the table are keyed by the call's ghost-marker set, and features with `packMarkers` are never cached.

### Design trade-offs and risks, the constraint nudge, the micro-cycle
- **1.17 A** — package A: the `Alternatives & Trade-offs` / `Risks` sections and their doctor warnings (A1), the constraint
  nudge and /grill's constraints round (A2), the TDD micro-cycle.
- **1.17 A review 1** — the nudge read the tool's own text (a template criterion such as +sec's "record a security audit
  event" fired it): it reads the user's text only (`userSpecText()`).
- **1.17 A review 2** — the answer counts anywhere in the user's text: /clarify folds it into requirements.md, and the grill
  asks in Phase 1 while design.md is still a template.
- **1.17 A review 3** — `approvePhase` stamps `weigh: true` from 1.17 on; an approval before it is never flagged (the 1.16
  `steering` precedent) — a finished feature following the advice would reopen re-review, changed-since-approval, a stale
  finish and the execution sign-off.
- **1.17 A review 4** — the red flags fired on guard tests, characterization tests and T-IDs already green: they are scoped to a
  NEW behaviour's test.
- **1.17 A review 5** — the reviewer asked for "a test in the diff", but the target T-IDs are committed in Phase 4, outside the
  task's diff: it flags behaviour no test exercises instead.
- **1.17 A review 6** — "Risk-based rate limiting" read as a Risks section: a heading must NAME its section (whole heading, or a
  separator / connector after the synonym); new synonyms (Trade-off analysis, Considered Options, Key / Design Decisions,
  Compromisos, Decisões e alternativas…); a plain "Decisions" heading is no trade-offs section (the imports' decision logs);
  counting by the outermost level, the prose escape for Trade-offs.
- **1.17 A review 7** — one weak word ("click event", "Retry button", "Images load async", "transactions") fired the nudge: two
  concepts or one strong phrase.
- **1.21 F5** — the merged `## Decisions, reuse & risks` section of a size-S design.
- **1.21 F5 P6** — one question bank: the grill skips a constraint question an active track's design sections own, and a sized
  design's Error Handling points at the IF…THEN criteria.
- **1.23 review 5 (M2)** — the weigh headings come from the ONE heading reader, `headingEntries()` (never in a comment or a
  fence; setext and indented ATX count).
- **1.24 review 6, F4** — `genericUnit` became markdown.js's `genericAnswer` (writtenContent's rule): "Pending.", "[TBD]",
  "**TBD**" are slot words too, beside a bare TODO / TBD.

### Reuse & Integration and clean code
- **1.19 R** — package R: the Reuse & Integration section and doctor `design-reuse` (R1), the brief's Reuse part (R2), the
  prose (R3), the steering stubs (R4); R5 — prose only, no engine gate reads the report's Reuse block. 1.17 / 1.18 approvals
  carry `weigh` only (held to trade-offs / risks, never to reuse) — the `reuse` stamp comes in with 1.19.
- **1.19 R review 1** — the 1.19 code stat'ed `//host/share/x.ts` and opened an SMB connection to the host a spec named (4.7–7.2 s
  on an unreachable one, NTLM credentials on Windows): a reference is judged on its TEXT before any fs call.
- **1.19 R review 2** — the r19 exclusion of every REUSE_SYN heading from "Design context" dropped whole sections (a 1.18
  design's Integration Points with its contract bullets): only the ONE section the Reuse part quotes whole leaves it; the rest
  keeps the 1.18 needle rule.
- **1.19 R review 3** — nothing is followed through a link on the way to a target (a link out of the project, or to a share,
  listed its files).
- **1.19 R review 4** — `more` became a lower bound when a folder holds more than the bounded read sees.
- **1.19 R review 5** — add of an existing backlog name answered "✓ added" and kept the old note, so a second refactor
  candidate filed as the same `refactor-<topic>` was lost: the note is appended.
- **1.19 verify 5** — a first add stored a note of any length: a new entry's note has the same cap.
- **1.19 R review 6** — extending a unit outside the task's files is never a silent edit (the scope guard stopped subagents on a
  permission prompt); the PT / ES "integration with the existing system" headings name the Reuse section, as EN's did.
- **1.19 T review 6** — a task emitting metrics on an +obs feature reached no `[OBS]` section: `_Emits metrics:_` pulls its
  `[OBS] Telemetry` section too.
