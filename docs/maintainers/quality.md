# Spec quality — steering amendments, cross-feature criteria, glossary, design weighing, reuse, duplicates

Maintainer notes, one topic of the map in [CLAUDE.md](../../CLAUDE.md) — the index and the hard constraints.
The spec-quality checks, the design's trade-offs / risks / reuse sections and their doctor warnings, the constraint nudge,
the critical flows, the TDD micro-cycle, the duplicate-code detector. The rules come first; how they came to be — the releases and review findings — is in History at the end.

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
- **The deep review (1.31, prose only — the engine dispatches nothing).** `agents/spec-critic.md` has three modes: **gate**
  (the checklist; at the plan gate its Readiness row — zero design decisions left to the implementer —, under YAGNI a code
  search for each `New` row of Reuse & Integration and premature optimisation), **naive** (a cold read: the artifact and
  what it links, steering / glossary only to check a term before flagging it; it opens with `### Understood as`, a
  restatement) and **brief** (the task brief's pre-flight — tasks-and-evidence.md → Subagent-driven execution).
  `references/critic-review.md` is the protocol `/spec-doctor --deep` and the gate offer (SKILL.md → Gates, phase-guide.md →
  At every gate; m / l or no size, before the requirements approval, never at classification) follow — the size from
  `spec_doctor`'s `size` (doctor.js `doctorRun`; no key = no size), the mode on the dispatch prompt's first line (`Mode: naive`,
  never a tool parameter): reviewers by size (s the gate critic; m / none + a cold read; l two independent
  gate critics + a cold read), dispatched in one message with none of the controller's reasoning, merged, each Blocking /
  Important finding triaged by the controller (Fix with the exact edit · Contest with evidence · Ask), ONE question to the
  user, one re-audit after fixes. The critic and the verifier declare `omitClaudeMd: true` (claude-code-integration.md →
  Hooks and commands). From google/elephant-goldfish-model (Apache-2.0): its Comprehension and Implementation Readiness
  reviewers, the resolve step, the convergence cap — its structural and style reviewers were left out (the first is
  `spec_doctor`, the second noise).

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
- **Critical flows (1.33)** — `criticalFlowState()` (quality.js): a plain feature (never a bugfix, a spike, a change; not when a
  track section that owns the question is scaffolded at the feature's size or present in its design — `criticalOwned()`, one
  question bank, below) whose USER text (`userSpecText()` of requirements.md + design.md, each without its Out of Scope
  section — `withoutOutOfScope()`, ONE linear pass over the headings) names a limited resource or a money flow: `CRITICAL_SIGNALS`
  {en, pt, es} by concept (stock · coupon · balance · wallet · credit · booking · reservation · appointment · seat · slot ·
  ticket · invite · quota · checkout · payment · charge · subscription), English in every spec + the feature language's, and
  the capitalised gateways (`RE_CRITICAL_PRODUCTS`: Stripe, Paddle). ONE signal fires (the user never writes
  "concurrency"); a "-" next to the word makes another word (zero-coupon, load-balance), a "/" doesn't (coupons/vouchers).
  **The everyday senses** are cue rules in the classifier's data shape, run by its own machinery (classify.js `cueRules`,
  the `near` kind, keyed by concept over the lower-cased text): `CRITICAL_CUES` — stock photos / the stock market / an IT
  inventory, a bond's coupon and pt-BR's cupom fiscal, a load / work-life / white balance and the verb, an Apple Wallet,
  tax / end / photo / ECTS credits, DHCP / nature / capital reservations, the appointment of a director and PT marcação
  (markup) / agendamento de tarefas / ES citas bibliográficas / textuales / de los autores, a seat belt / car seat / vagas de emprego, UI / Vue / Shadow DOM /
  PCI slots and slot machines, the bilhete de identidade, a calendar invite / "invites abuse", a sales quota, git checkout, the
  balance of payments / withdrawal of consent, free of charge, a newsletter / GraphQL subscription and pt-BR assinatura
  digital — plus +tdd's own rules for `credit` and `charge` (`SIGNALS.tdd.cues`: one list of their everyday senses). A
  hard negative goes into the corpus of 15-quality-critical-flows.js with its positive twin.
  **Answered** anywhere in that text — read WITH its code spans and fenced code (`userSpecText(…, {code: true})`) — by
  `RE_CRITICAL_ANSWER` (a unique constraint / index, ON CONFLICT, a conditional / atomic update, the affected rows,
  `SELECT … FOR UPDATE`, an `UPDATE … SET … WHERE`, a row / advisory lock, a version column, If-Match, processed events, PT /
  ES twins, + `LOCKING_ANSWERS`, the phrases it shares with `RE_CONSISTENCY_ANSWER`: idempotency, exactly-once, the isolation
  level, optimistic locking, atomically…; never a bare "unique" / "lock", never eventual consistency or at-least-once alone),
  or by a written design section named Critical flows / Concurrency / Race conditions (`CRITICAL_FLOWS_SYN`, weighSection +
  designWeighState min 0 — "None: this feature only reads the balance" answers). Surfaces: clarify's `nudges` gets
  `{code: "critical-flow-unstated", signals}` (≤ 3, one per concept) AFTER `consistency-unstated` (unchanged — both may be
  returned; `clarifyCriticalFlow`); doctor's `critical-flows` (phase 2: a designed feature, not while design.md is a later
  phase's template) and `critical-flow-tests` (phase 3, +tdd: test-plan.md's rows — the lines holding a T-ID, each WITHOUT the
  scaffold's row descriptions, `planTemplatePhrases()`, so a template row never answers — need a repetition row (twice /
  duplicate / again with the same / two at once / simultaneous / concurrent / in parallel… `RE_REPETITION_ROW`; never a bare
  retry, which is retry-on-failure) and, when the user text is about own
  data or permissions (`RE_OWN_DATA`), another user's access (`RE_OTHER_USER_ROW`)). Both only WARN — no gate, no
  `warnsOnly` —, share the context view `critical` (doctor.js `CHECK_VIEWS`) and follow the stamp scheme: `approvePhase`
  stamps `critical: true` on every design and test-plan approval (and its record); an approval without it passes with a note
  ("approved before 1.33" — `legacyApproval` / `criticalFlows.legacyPlan`). spec_upgrade lists them, never as `attention`
  (`CRITICAL_FLOW_IDS`). The raw text is pre-checked with the signal regex: a spec naming no flow never builds the template
  lines. A read-only flow (one word fires: "the account balance on the dashboard") is answered by one line under `## Critical
  flows` — the warn's detail says so. The guide: `references/critical-flows.md`; the test plan template's Strategy carries the
  rows as a comment.
- **One question bank** — /clarify --grill's "Constraints round" skips a question an active track's design sections own
  (+dist: atomicity … dependency failure; +saas: volume; +api: idempotent creates, concurrent updates), and a sized design's
  Error Handling points at the IF…THEN criteria instead of asking again (prose only). The critical-flow nudge and checks
  follow it (`CRITICAL_OWNERS`): +dist's Concurrency and +api's Pagination, Idempotency & Concurrency own the question — both
  tier "extended", so a size-s scaffold leaves them out (scaffold.js `sizedTrackSections`) and the detector runs there, unless
  the design holds that section anyway.
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
- **Doctor `design-reuse`** — the third `DESIGN_WEIGH` entry, the trade-offs pattern exactly (a WARN, `REUSE_SYN`, min 0:
  "greenfield: nothing to reuse" counts; `designSaveCheck`'s `reuse`, `templates check`'s `reuse-missing`). The heading must
  NAME the section — never a bare "Integration" or "Existing" (`weighTextMatches`). **Brownfield:** a missing or empty section
  passes as `integration` when `integration-plan.md` → Integration Points is filled (`designReuseFallback`).
- **A gate at size m / l (1.28)** — `designReuseGated(kind, size)`: a plain feature of size m or l (never a bugfix, spike,
  change, size s / xs or an unsized feature — those keep the warning). There `designWeighChecks(…, {gate: size})` FAILS
  design-reuse where it would warn (`designWeigh.reuseGate`), and the design gate refuses it: `GATES.design` runs
  `design-weigh:reuse` (the entry's `gate.reuse` probe — the approval being made, never legacy). Forceable like every gate
  (`force` + the user's consent; a forced approval keeps failing in doctor). The m / l builder scaffolds the section
  (`reuseSized`: one example row), so a filled design passes. **The `reuseGate` stamp** (`DESIGN_WEIGH_STAMPS`, gates.js on
  every design approval and its record): a design approved without it — before 1.28 — keeps the warning, its detail naming the
  rule (`designWeigh.reuseGateLegacy`), never a fail; spec_upgrade lists such a feature whose section is missing / unfilled
  (attention `design-reuse`, `designReuseDue`, `upgrade.item.designReuse` — lifecycle.md → Upgrade); nothing is edited.
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
  the controller files refactor candidates in the backlog. No engine gate reads the Reuse block. The review flow runs the
  duplicate detector first (below). Extending a unit OUTSIDE the
  task's `_Implements:_` files is never a silent edit (NEEDS_CONTEXT → a converge task or the controller's go-ahead, or create
  locally and say so) — the scope guard would stop a subagent mid-task; the brief's `reuseRule` says it.
- **Steering** — the `structure.md` stub has Module Boundaries and Shared Code slots, the constitution stub the example
  principle "Search before you write: extend an existing module before adding a new one" — EN / PT / ES.

## Duplicate-code detector (1.28)
The mechanical half of reuse — the prose asks the implementer to search, this finds what a feature repeats. engine/dupes.js.
- **The matcher** — `duplicateRuns(files, {minLines, feature, code})` over texts already read (`[{file, text}]` — the plugin's
  duplication guard, mcp/tests/16-conventions-duplication.js, runs it over its own sources: testing.md). `code: true` gives each
  run its normalized lines (what an allow-list reads); `scanned.duplicated` counts the code lines in a repeated window, both
  sides (the guard's share at window 6). Per line (`codeLines()`): comments stripped by family (`STYLES` / `STYLE_OF_EXT`: C-like `//` +
  `/* */` with backtick strings, `#` (the shells' only at a word's start), `--` for SQL / Lua / Haskell, `<!-- -->` in markup,
  `;` `%` `'` `!` and a batch file's REM; PHP also `#`, but never its `#[…]` attribute); strings kept and never read as a comment
  (a one-line string ends at its quote or the line's end; a backtick or `"""` string spans lines); JS / TS (and vue / svelte /
  astro) read a regex literal — a `/` where an operand starts (line start, after an operator or an opening bracket, after
  `return` / `typeof` …; never after `<`: JSX's `</div>`) runs to its closing `/` (escapes, a character class's `/`), else it
  divides — so `/[/*]/` opens no block comment and ``/`/`` no template string; one pass that jumps from one trigger character to
  the next (`st.trig`). Whitespace collapses; a BOM and CRLF are encoding; punctuation-only, block-closer and import / include /
  use lines are dropped, and so is an import spread over lines: a SURE opener (`import (`, `from x import (`, `import {`, `use
  a::{`, `use A\{`) drops every line to its bracket's close; `export {` / `const {` count only when the close says so (`} from
  "…"`, `} = require(…)`), held until then; a line no import holds (an `=`, a call) ends the block as code — an unclosed bracket
  never swallows a file. A notebook (`.ipynb`, JSON) has no code lines. Each distinct line gets an id (interned) and a count: a
  window holding a line seen once is never hashed. Windows of `minLines` (default 6, 4–100) holding ≥ minLines × 12 characters
  are hashed (two 32-bit mixes → one 53-bit number; a match is then checked id by id); ≤ 32 occurrences kept per window. With a
  feature, its windows are hashed first and the rest only looked up. The index (`lineIndex` / `indexFile`) drops each file's text
  once its ids are in, and `matchRuns` only reads it: the report's project-wide second match (the budget) reuses it.
- **Runs** — matched windows grouped by diagonal (file a, file b, offset); windows no more than a window apart merge (every
  line between lies in a matched window); each side's places merged per file where they overlap or touch. `existing` = a
  feature place repeating code outside the feature's files; `within` = inside them (or anywhere, without a feature) — listed
  ONCE, longest first, a place already listed beside another skipped (`once()`). Sorted: existing first, then the longest, then
  file (code-unit order, never `localeCompare`) and line. `lines` counts code lines; from / to are the file's own lines.
- **The report** — `duplicationReport(projectDir, {name, minLines, tests, cap})`: the scan's corpus (`walkProject` +
  `gitignoreRules`, `isCodeFile`, no fixture, no notebook, test files only with `tests: true`), `DUP_FILE_CAP` 5,000 files
  (`truncated`); a file past `DUP_MAX_BYTES` (512 KB — `skipped.large`) or generated / minified (`RE_GENERATED_NAME`; the
  generators' header — `@generated`, `<auto-generated>`, Go's `Code generated … DO NOT EDIT` in the first 5 lines, or a comment
  in the first 3 that STARTS with "generated by / from …", "auto-generated", "this file was (automatically) generated" or an
  upper-case DO NOT EDIT — never any comment naming the word: "// IDs generated by the server" is hand-written; 400+
  characters a line — `skipped.generated`) is never read; one open + fstat + read per file into a reused buffer
  (`decodeText`). **The byte budget** `DUP_TOTAL_BYTES` (32 MiB of source, all files; `opts.maxBytes` for tests): past it only
  the feature's own files are read and the result carries `partial` {bytes, unread} — the CLI prints `cliOutput.dupesPartial`,
  finish's warning appends `finish.duplicatesPartial` and its `duplicates` gets `partial`. With a name: the feature's code = the
  code files its tasks' `_Implements:_` name (every task; `implementsTargets` — globs, folders), a plain path past the cap still
  read (`featureFileOnDisk`, never through a link out); no file of its own → nothing read (`featureFiles: 0`). The top
  `DUP_TOP` (20) + `counts` / `total`; `also` ≤ 5 + `alsoMore`. Timing: this repo ~0.2–0.3 s (75 files); a synthetic 5,000-file
  project (730k code lines) ~1.5–2.5 s warm, ~4–5 s cold; 200 files × 500 KB of distinct lines: 0.9 s / 280 MB within the
  budget (3.3 s / 506 MB read whole, 4.5 s / 634 MB before the index dropped the texts).
- **Surfaces** — `spec_scan {duplicates: true, name?, minLines?, tests?}` (a mode on spec_scan's SECOND key — mcp.md →
  Arguments by mode) = `dev-spec dupes [feature] [--min-lines N] [--tests]` (one operation, `dupes`; the human report:
  `cliOutput.dupes*`). **spec_finish** runs it for the feature (never on the execution gate's `gateOnly` path): a warning,
  never a blocker — `finish.duplicates` (how many places, the top 3 as `file:from-to ↔ file:from-to`, the `within` count, the
  calls that list them all) or `finish.duplicatesWithin` (the count alone); the result's `duplicates` {existing, within, top}
  only when there is one. **The review flow** (commands/spec-review.md branch · converge · simplify, /executeTask
  --subagents' final review, the reviewer, the simplifier, code-reuse-and-quality.md, subagent-execution.md): the `existing`
  runs are the reviewer's candidate findings, the `within` runs the simplifier's — each verified (spec-verifier) like any
  finding; a repeat the spec asks for or one under "Duplicated on purpose" is none.
- **dev-guardian's duplication budget (1.29)** — `duplicationBudget(root)` reads ONE key of `.guardian/budgets.yml`:
  `quality.duplication_pct` (jscpd's duplicated-lines %, project-wide — dev-guardian's quality_check holds the project to it;
  the file's only other keys are `quality.complexity` and `perf.*`). Read as dev-guardian's `loadBudgets` reads it (its
  budgets/budgets.ts: a YAML parser + a schema), without a YAML parser (`readBudgets`): top-level keys `perf` / `quality` only,
  each a block mapping (its keys at ONE indent, the first entry's) or a flow mapping on its line, of the KNOWN fields (perf:
  lcp_ms, inp_ms, cls, tbt_ms, bundle_size_kb · quality: duplication_pct, complexity), each a plain YAML number; comments, a
  leading `---`, CRLF fine. A file dev-guardian refuses — an unknown key or field, a quoted "5", `5%`, a nested map, a list, an
  empty section — enforces NO budget there, so none here; so does a form this reader can't follow (a tab, a repeated key). A
  plain file inside the project (lstat, realpath), ≤ 64 KB; no file → none. The project report (no `name`)
  then carries `budget` {file, key, limit, measured — `scanned.duplicated / scanned.lines`, %, one decimal —, over, note
  (`guardian.budget`, the project language: the measures are close, not identical — windows of N code lines vs jscpd)}; the
  CLI prints the note (`⚠` when over). spec_finish asks the feature report for `budget: true`: a second, project-wide match
  over the index already built, only when the budget is set; its duplicate warning appends `guardian.finishBudget` only when
  the project is over it (never a warning of its own, never a blocker).

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
- **1.31** — the deep review, from google/elephant-goldfish-model: until then `--deep` dispatched one critic that read
  everything the approver reads, so it could not see what the artifact itself leaves undefined; the critic's findings
  reached the user untriaged, and a review loop had no cap.
- **1.31 review 13** — the size rule needed a size no read tool returned (`spec_doctor` gained `size`); the first m / l
  approval is classification's, which no reviewer covers (the offer moved to the requirements approval); `mode: brief` read
  like an Agent-tool parameter (now the prompt's first line, `Mode: brief`); the brief pre-flight counted `AGENTS.md`, which
  the implementer doesn't load, and skipped no spike; a converge ❌ after a drift had two routes (now `/spec-bugfix`).
- **1.31 review 14** — the review-13 fixes left SKILL.md without the design-first offer point and sent EVERY converge ❌ after
  a drift to `/spec-bugfix` (an intended change is a spec change); brief mode missed `.claude/CLAUDE.md` / `CLAUDE.local.md`.

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
- **1.33** — critical flows: a plain feature ("users redeem a coupon at checkout", "book a slot") was never asked what two
  identical requests at once do — the constraint nudge needs two concepts or a strong phrase, and only +dist / +api / +sec ask
  it in their sections. One signal now fires a second nudge (`critical-flow-unstated`) and two doctor warns (`critical-flows`,
  `critical-flow-tests`); `consistency-unstated` unchanged (`LOCKING_ANSWERS` only factored out of its answer). The everyday
  senses reuse the classifier's `near` cues (`cueRules` exported) and +tdd's credit / charge rules; the test plan's Strategy
  gained the guidance comment, the critic a Critical flows row, test-patterns.md the twice / two-at-once section, the
  implementer's hard rule "never skip, delete or weaken a test or an assertion" (one wording, test-patterns.md repeats it).
- **1.33 review** — four findings: the +dist / +api skip held at size s, where their owning sections are not scaffolded (a
  `core +api` coupon feature was asked nothing — `criticalOwned()` by size); `withoutOutOfScope()` looked ahead from every
  Out of Scope heading (80k of them: 7.7 s — one pass now, 05-markdown-trace's linear guard); the plan check read the
  scaffold's own rows (+ui's "an error with Retry", +data's "twice … no duplicate" passed the full track combination on the
  template alone) and took a bare retry for a repetition; Shadow DOM slots and ES quotations (citas textuales / de los
  autores) fired.

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
- **1.28** — at size m / l the Reuse & Integration became an approval check of the design (`designReuseGated`, the
  `reuseGate` stamp): reuse was enforced by prose alone — a warning a design could ship with. Designs approved before keep the
  warning; spec_upgrade names them.

### Duplicate-code detector
- **1.28** — introduced: engine/dupes.js, spec_scan {duplicates}, `dev-spec dupes`, spec_finish's warning, the review flow's
  candidates (from a prototype: windows of 6–8 normalized lines, ≥ 12 characters a line). On this repo's own mcp/lib it reported
  5 repeated blocks at minLines 8 — after 1.27.1's cleanup, 2: the link lists the duplication guard allows. The guard (1.27.1,
  16-conventions-duplication.js) runs this detector since 1.28 — one detector (testing.md); `code` and `scanned.duplicated`
  serve it.
- **1.29** — dev-guardian's duplication budget beside the project report (`budget`) and in finish's warning when over; the
  reader takes only `quality.duplication_pct` (dev-guardian has no file / function size or coverage budget —
  references/improvement-specs.md said it had, and cited a `.guardian/perf-budget.yml` that never existed).
- **1.30 review 8** — ds-engine 3: a multi-line import block (Go `import (`, TS `import {` … `} from`, Python `from x import (`)
  was reported as a duplicate — the import-line filter read only its first line. ds-engine 4: any two `.ipynb` were one
  17-line duplicate (their kernelspec metadata). ds-engine 5: PHP's `#` comments were kept; a JS regex `/[/*]/` opened a block
  comment that dropped the rest of the file (a real 8-line duplicate missed) and ``/`/`` a template string that kept every later
  comment; any comment naming "generated by" / "do not edit" in the first 5 lines skipped the whole file. ds-engine 10: the
  budget reader took `duplication_pct` at any depth (`complexity: {duplication_pct: 1}` read as the limit) and accepted files
  dev-guardian refuses (quoted values, unknown keys). ds-security 9: time and memory grew with the bytes read (every text kept
  until the match) — the byte budget + `partial`, and the index that drops each text. ds-prose 14: the heads said "1 files" /
  "place(s)".
