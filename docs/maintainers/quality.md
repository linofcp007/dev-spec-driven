# Spec quality — steering amendments, cross-feature criteria, glossary, design weighing, reuse, duplicates, the design system

Maintainer notes, one topic of the map in [CLAUDE.md](../../CLAUDE.md) — the index and the hard constraints.
The spec-quality checks, the design's trade-offs / risks / reuse sections and their doctor warnings, the constraint nudge,
the critical flows, the TDD micro-cycle, the duplicate-code detector, the design-system registry. The rules come first; how
they came to be — the releases and review findings — is in History at the end.

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
  phase's template) and `critical-flow-tests` (phase 3, +tdd: test-plan.md's rows — the lines holding a T-ID — read in their
  DESCRIPTION cell only (`planCellsOf`: the column named by the table's header as the scaffold writes it, EN / PT / ES / pt-BR —
  `planDescHeaders`; never the File, Covers, Layer, Kind or Test ID; a table without that header: its cells but the IDs; a list
  row whole), minus a description that EQUALS a template one (`planTemplateCells`: the built-in plan of every track — EN + the
  feature's language —, the track packs' test-plan rows, the project's test-plan templates; an edited one is the user's,
  sectionOwnLines' rule). Before comparing, every value the scaffold filled in is FILLED (`planFeatureValues` — the name read
  back from an artifact title that slugifies to the feature's folder, the slug, the Summary, tracks, lang, the creation date;
  a pack's {{title}} / {{marker}}), so a feature named "Duplicate charge guard" keeps its scaffolded "{{name}} happy path"
  row template; a slot is tested on the cell as written. Only per-row values ({{acs}}, {{t1}} …) stay variables: such a cell
  is a glossary pattern (`glossPatternSegs`, ≥ 4 literal characters AND a literal at its start or its end — "{{acs}} with
  {{t1}}" would cut "with" out of real rows) matched by the LINEAR `glossSpans` — never a regex built from template text — and
  gives only those values (`planCellOwn`, glossUserParts' rule). `planFold` folds case, `**` / `_x_` / backticks, blanks and a
  final period. They need a repetition row (twice / duplicate / repeated — never a repeated password / e-mail / confirmation
  / form field — / again with the same / two at once / "at the same time" (`AT_ONCE_EN`) in four forms: (1) after a COUNTED
  quantity — a number word, a digit, both — followed within three words by an action verb (`acts`: two admins approve, 2 pods
  process, both tabs submit — any actor, no closed noun list decides) or right away (one word between at most) by an actor or a
  request (`actors`: two buyers, 3 requests); (2) after an action in an UNAMBIGUOUS verb form (`txActs`: redeemed, paid, submitted,
  booked, clicked — redeemed by Alice and Bob …, envían el pago) a few words before it — a form that is also a noun (click, press,
  reservation, charge, PT compra / reserva / resgate, ES canje / compra / clic) counts only after a quantity; (3) right after a
  PLURAL request noun (requests / clicks … at the same time); (4) the phrase first, then a counted quantity ("at the same time,
  two users redeem …"). A quantity never counts when the noun right after it, or one word later, is a UI or structural part
  (`parts`: columns, rows, forms, fields, filters, panels, buttons, cards, widgets, pages, screens, lists, badges, steps, phases,
  items … — a browser tab is an actor, kept) or a unit (`UNITS`: MB / KB / GB, ms / s / min / h, days, px, am / pm, %), when a step
  / phase / item number precedes it ("step 2 the user …": a lookbehind bounded to 3 separators — unbounded, a run of hyphens made
  it quadratic) or when it is the digits of a time or a decimal (10:00, 1.5, 1,5: a digit and . , : before it); an ordinal (2nd)
  never reads as one. Never on its own ("the list and the badge render at the same time"): the verbs are actions — never render /
  show / load / update / see / the same millisecond / identical
  requests / simultaneous / concurrent / in parallel / resubmitted / a redelivered or replayed anything, a retried webhook,
  event, message, callback or payment — after a failure too: the provider redelivers —; PT repetido(a) — never a senha /
  e-mail / confirmação / campo field —, reenviado, com a mesma chave, "ao mesmo tempo" by the same rule (`AT_ONCE_PT`); ES the
  same — contraseña / correo / confirmación —, con la misma clave, "al mismo tiempo" / "a la vez" (`AT_ONCE_ES`). One at-once
  rule per language (`atOnce({ notCount, quant, parts, actors, acts, txActs, nouns, phrase })`), each with its own words — PT / ES
  verbs conjugated, accents included (envían, cajeros) — and phrase: ES "dos" (two) is PT "of the", so it counts only before ES's
  phrase…
  `RE_REPETITION_ROW`; never a bare retry — a Retry or Resubmit button, notifications retried after the provider fails) and,
  when the user text is about own data or permissions (`RE_OWN_DATA`), another user's access (`RE_OTHER_USER_ROW`)). Both only WARN — no gate, no
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

## Design-system registry (1.35)
ONE inventory every +ui feature builds from — the prose of `[UI] Design System Usage` made checkable. The registry and its
readers are in quality.js (every doctor and brief reads them); what reads the CODE is engine/design-system.js, in the lazy tier.
- **The file** — `.specs/steering/design-system.md` (`DESIGN_SYSTEM_FILE`), a steering STUB like glossary.md
  (`steering_scaffold`; init never creates it) and deliberately NOT a track steering file (`TRACK_STEERING`): it grows with
  every feature, and a file the approvals fingerprint would flag every approved +ui feature on each new row
  (`steering-changed-since-approval`), and every brief would quote it whole. `designSystemRegistry(root)` reads EVERY table
  whose first header cell is Component / Componente(s) or Token(s) (`RE_DS_COMPONENT_HEAD`; the other columns by their header —
  `RE_DS_COL` — else by place) through `mdTables` (comments and fences aside). `keys`: EVERY component name the file lists —
  what "is it listed?" asks —, `origins` (name → its `_From:_` feature) and `tokenNames` likewise, past the caps: finish
  appends at the END of a long registry, so what is asked about a row must never depend on where it sits; `components`: the
  first 500 with their details, `tokens`: the first 1,000 (`truncated`). A name
  once (`dsKey`: letters and digits, lower-cased, accents folded — DatePicker = date-picker), a slot or generic row none.
  English-stable markers: `_Token sources: a, b_` and `_Libraries: a, b_`, each a line of its own (`RE_DS_MARKER` — the value
  runs to the line's end: a path may hold an underscore or a blank; the stub's `[slot]` names nothing; the label alone may be
  italic, `_Libraries:_ a` — a BLANK follows that `_`, where `_sass/_variables.scss` is a path). Entries are cut at `,` / `;`
  outside parentheses (`dsEntries`); a parenthesis that ENDS one is a note — read as an entry is: the part before a
  comma, no version written as one (`(MUI, v6)`, `(@mui/material@6)`), nor a bare number, which a note has no use
  for (`(antd 5)`, `(MUI 6)` — review 11: they named nothing); a note with no letter is none (`antd 5 (>= 5)` made
  ">= 5" a library) —, and a library's note may name it too
  (`dsAlias`): SURELY ("strong": cited wherever a row names it) when it is a scoped package, a scope a dependency
  lives under (`(@radix-ui)`, never `(@jane)`), its acronym in order from the first letter (`RE_DS_ACRONYM`:
  `Material UI (MUI)`, `Material 3 (M3)` — unless the capitals spell a framework's name, `React 19 (REACT)`), a
  short name made of the entry's own words (`Radix UI (Radix)`: its
  author wrote it) or a dependency of the project (`Design System (acme-ui)`); WEAKLY (`weakLibraries`: cited only
  where a row CITES — `dsCited`: inside a closed `(…)` or `[…]`, nested ones with it (`dsInside`: `Modal (Bootstrap,
  large (lg))` — review 11: only the innermost group was read, while the name was already read outside all of
  them), after a dash, before a colon; `Button (SLDS)`, never
  `SLDS Button`, which no shape tells from `Pro Table`) for any other acronym (`Lightning Design System (SLDS)`,
  `antd (PRO)`) and for a framework's name, which a note gives as a remark (`DS_FRAMEWORKS`: `Headless UI (react)`) —
  a dependency or a word of the entry alike (`React Aria (react)`; review 10: the entry's own words were asked
  first, and without `react` in the root manifest "React Select" was the library's); never for a remark (`antd
  (deprecated)`, a version `(V5)`, a short name only PARTLY made of the entry's words). `dsCited` is one-sided on
  purpose — what FOLLOWS a dash set off by blanks, what PRECEDES a colon followed by a blank — and a remark that
  happens to be the alias cites there too (`antd (PRO)`: `Table — pro version`): the accepted "remark in capitals"
  limit, said in the user docs. Four rounds to get here: any one word (review 6),
  "derived from the entry" asked of EVERY note (review 7 — review 8's HIGH: `Design System (@acme/ui)` named
  nothing), then weak for every dependency and every number-less name (review 8 — review 9's HIGH, below). A library
  entry is read as it is NAMED: a markdown link is its text, unwrapped BEFORE the note is read and cleaned again
  (`RE_DS_LINK`), and a version WRITTEN as one is dropped (`RE_DS_VERSION`: `antd v5`, `antd@^5.2.0`, and a range
  with no `@` — `antd ^5.21`, `antd >= 5`: review 10, it named nothing a row can cite and `@mui/material ^6` was not
  `packaged` —, of several parts too: `dsUnversioned`, `antd >=5 <6`, `antd ^5 || ^6`); a bare
  number stays, and the name without it is an alias too (`RE_DS_BARE_VERSION`) — strong when it is a name a row
  would write anywhere (`dsNamed`: an acronym, two words or more, a scoped package, or the library's own package in
  the project — a dependency of that name, one under a SCOPE that begins with it, four letters or more (`Carbon` of
  `@carbon/react`), or the word joined, before or after, with a dash or none, to what says "its UI package": a
  framework's name, `ui`, `components` — every part of what is joined (`DS_FRAMEWORKS`, `DS_UI_WORDS`: `Flowbite`
  of `flowbite-react`, `Bootstrap` of `react-bootstrap`, `Prime` of `primevue`, `Evergreen` of `evergreen-ui`,
  `Carbon` of `carbon-components-svelte`)), weak for one plain word no package
  backs — `Material` of `Material 3` must not make "Material Picker" the library's (review 8) —, for a framework's
  own name or its stem (`React 19`, `Next 15`: "Next Button" is a wizard's; `Tailwind` of tailwindcss, `Solid` of
  solid-js) and for a word another package merely begins with
  or contains (`base64-js`, `material-icons`, `@mui/material`). Review 9 made ALL of them weak (`Reuse | antd Table`
  refused); review 10 found the repair too wide — any package that BEGAN with the word backed it; review 11 found
  review 10's "joined to ONE framework's name" too narrow (`carbon-components-svelte`, `evergreen-ui`). The two
  joined words are a list, knowingly: no shape tells `antd-mobile` (the library's) from `material-icons` (a font).
  And a SCOPE that merely begins with the word still backs it — `Material 3` beside an icon font's
  `@material-symbols/…` —: asking more of the scope lost real libraries whose scope adds a word. The
  project's manifests answer (`projectDependencies`, 1.35.1: the root package.json and its workspace packages' —
  The project's manifests, below; until then the root one alone, and a monorepo's short name stayed weak): where
  none it reads holds the package — a CDN, an undeclared folder two levels down — the short name is weak. So what the author WRITES as a
  name is strong, whatever was derived before it: an entry of its own (`Carbon 11, Carbon`) and a note that names
  the library surely (`Bootstrap 5 (Bootstrap)` — review 10: a note equal to the derived name was skipped as "held
  already"; a note that names it weakly leaves a name the registry holds as it was, `react, Headless UI (react)`).
  A name has ONE strength, whatever its case and its place on the line — the strongest any writing of it earned
  (review 11: compared with its case, the derived name weakened the entry written before it, `vuetify, Vuetify 3`;
  `Lightning Design System (SLDS), SLDS 2` left the acronym weak). A framework's name written as an ENTRY —
  `react`, `React v19`, `React ^19` — is what the author declared and stays strong (a React Native project's
  `react-native` must stay `packaged`); only the name derived from a bare number or given in a note is weak, so
  `React 19` and `React ^19` differ, knowingly.
  A weak alias never makes a registry with no
  component row `packaged`: what may not cite outside a parenthesis cannot switch the gate on. A library is cited as
  a whole WORD (`dsCites`: `own` is not in "Dropdown"), and a `-` / `/` / `@` beside it is a word's end —
  `@radix-ui/react-dialog`, `react-bootstrap`, `MUI-X`, `@mui/material` cite Radix, Bootstrap and MUI; so
  `antd-mobile` cites antd, knowingly (review 8: a `-` read as "another package" refused all of the above). A LIBRARY
  entry whose
  FIRST word says none names nothing (`RE_DS_NONE`, EN / PT / ES: `none yet`, `nenhuma ainda`, `sin bibliotecas`, `TBD`) —
  a nicety for what the brief and the report show, NEVER what the check stands on (below: `packaged`). A token SOURCE is
  a path: one with a `/` or a `.` names nothing only when it IS such a word (`RE_DS_NONE_WHOLE` — `todo.css`, `No
  Name/tokens.css` are files). ≤ `DS_MARKER_LINES` lines, `DS_MARKER_ENTRIES` entries, each cut before it is cleaned
  (`stripEnds`, never a trailing-run replace). And in a
  component's row `_From: <feature>_` (`RE_DS_FROM` → the entry's `from`, left out of its `notes`).
- **`_Deprecated: use X_`** (1.37, `dsDeprecated`) — the team retires a component in its row: English-stable, any case, in
  any cell after the name — an `_…_` emphasis whose first word is Deprecated, whatever follows the word that is no letter or
  digit (`_Deprecated — use X_`, `_Deprecated. Use X._`, `_Deprecated (v3): use X_`): `_Deprecated_` alone,
  `_Deprecated<text>_`, the label alone italic (`_Deprecated:_ <text>`, `_Deprecated._ <text>` — the emphasis holds no letter
  or digit after the word: the text runs to the cell's end, as `_Libraries:_ a` does) or never closed (to the cell's end).
  ONE case-insensitive regex over the cell as written (`RE_DS_DEPRECATED`): it starts the cell or follows a blank, `(` or `*`
  (never `snake_deprecated_flag`, `config_deprecated: true`), and a letter or a digit after the word (`_deprecatedness`,
  `_deprecated2`) or a `_` that does not close it (`_deprecated_flag`) makes another word; its closing `_` is one the
  cell's end, a blank or one of `.,;:)*` follows (`use Data_Grid now` keeps its `_`); the row's first marker counts, a later
  occurrence after one that is none is still looked at. Deprecated is a property of the NAME: a name listed twice is marked
  by its first row that carries the marker (the replacement from that row, the marker put first in the entry's notes —
  `entries`). Read on the rows read in full only (the 500-row cap — doctor and the brief read the same rows): `deprecated`,
  a Map — the key → its REPLACEMENT, the first component the file lists (`keys`, past the cap too) that is not deprecated
  itself (`use Popup` while Popup is retired names none — the next one named is) and that the marker's text names among its
  first `DS_DEPRECATED_WORDS` (20) words, a word or two adjacent ones (`dsNameIn`) — the pair first, and only when blanks
  alone part them: `use Data Grid` is DataGrid even beside a `Data` row, `use Card. Header` is Card; a word is a hyphenated
  / slashed / dotted / snake name WHOLE (`RE_DS_NAME_WORD`: `data-grid` is DataGrid, `@mui/x-data-grid-pro` and
  `@/components/ui/dialog` name none) —, as written there; "" when it names none (no word list says which word is the
  replacement: a listed name is). The marker is cut out of whichever cell holds it — a path stays a path, a variants cell
  stays the variants — and the notes show it FIRST as one text, `_Deprecated<the first DS_DEPRECATED_SHOWN (120)
  characters after the word, as written>_` (`dsDeprecatedShown`): `dsCell` drops a closing `_` after a letter and the
  notes' 200-character bound cuts what comes last, so the brief quotes the marker whole. Linear: each `_` looked at once (a
  hostile-vs-plain ratio check: 1,000 cells of `_Deprecated: ` and 190 `_a`). A token row's marker is not read; nor
  `__Deprecated__` (bold), `*Deprecated*` or a marker in the NAME cell (`Table _Deprecated_` is a name); `_Deprecated_: x`
  is the bare marker (the colon outside the italics, as the other markers never read it). The marker retires the WHOLE
  component, wherever it stands: a deprecated variant or prop is written without it (the user docs say so — a
  `ghost (_deprecated_)` variants cell retires the component).
- **The feature's rows** — the +ui block's Design System Usage has a SECOND guidance line and a `Kind | Component | Why / notes`
  table since 1.35 (appended: a 1.34 one-line block still reads as template text; the no-size pin in
  mcp/tests/06-gates-sizes.js changed on purpose). `designSystemUsage(design)` → the table rows whose first cell is a kind word
  (`RE_DS_KINDS`: Reuse · Extend · New, EN / PT / ES and a few synonyms) and whose second names a component — several in one
  cell are a row each, cut OUTSIDE parentheses and, from the part a `(` is never closed in, at EVERY separator
  (`dsCellParts`): an unclosed `(` must not swallow the components after it (review 10: `Card ( ; Buton` passed) nor
  tear the entries that closed before it (review 11: review 10 asked the balance of the WHOLE cell, and `TextField
  (@mui/material, outlined), Card :)` was refused as "outlined)"); a `)` nothing opened counts for nothing. The name is
  what stands outside the parentheses, nested ones too (`dsOutside`: `Card (wide (2 cols), dense)` is Card), and `cell`
  keeps them (a library: "Button (@mui/material)"); a slot row is none; ≤ 100 rows, `DS_USAGE_CELL` characters of a cell
  (review 11: at 400, twelve library components in one cell were torn and an unlisted one past the bound was never
  read — both bounds are in the user docs). A row whose first cell is no kind word
  (`| Modify | Buton |`) is no usage row — neither checked nor counted, said in the user docs.
- **The findings** — `designSystemFindings(usage, registry, slug)`: `unknown` (a Reuse / Extend naming nothing the registry
  lists, nor a declared library in its cell; `near`: the did-you-mean), `listed` (a New already there — unless its registry
  row says `_From: <slug>_`: the feature's OWN component, added by its finish; EVERY caller passes the slug — doctor's run
  and its `GATES.design` probe, the save check, the feature report —, or the gate refuses what doctor passes), `near` (a
  New that is a listed name with a
  fork's affix — ButtonV2, NewButton, CustomCard — or an edit or two away, `dsNearComponent`; never when its notes name that
  component), `no-why` (a New without a reason). It compares NAMES: a new component under an unrelated name passes (the
  reviewer's search). The `unknown` hint offers, before "make it a New row", to add the row when the code already has the
  component: what the scan cannot tell — a component wrapped by another function, 1.35.1; until then every further
  export of a file (review 10) — is unknown until someone lists it. Only the first `DS_NEAR_ROWS` rows that need one pay a name comparison, a name past `DS_NAME_MAX` none.
- **Doctor `ui-design-system`** (`designSystemCheck`; one entry of `DOCTOR_CHECKS`, phase 2) — a plain feature with +ui whose
  design.md is no later phase's template. States: no-section · unfilled (the scaffold's: `ui-sections` and the placeholder gate
  own both) · no-registry / empty-registry (a WARN saying how to create it — never a fail: there is nothing to agree with.
  EMPTY = it lists no component and declares no library that IS one — `packaged` (`dsPackaged`): a dependency of the
  project (`projectDependencies`: the root package.json and its workspace packages' — The project's manifests, below;
  dependencies, dev and peer, any case; each manifest read as the scan reads one — a regular file or a link that
  stays inside the project, its first 256K characters, a BOM dropped), a scoped
  package by its very name, or a scope alone whose packages are dependencies (`@radix-ui` — what the seed writes; never
  `@radix`). When it declares libraries and none is one the warning says so and how to name one
  (`quality.dsEmptyRegistryLibraries`). A `_Libraries:_` line is free text: no word list holds
  every "not yet" (review 4: one that slipped through turned the warning into a size m refusal), and "does the design cite
  it" switched the gate off for a registry that is library-only on purpose (review 5: `Reuse | Buton` approved). A
  packaged library-only registry is checked like any other: no-rows and unknown rows fail at m / l) · na
  (the section's ONE `n/a — <reason>` line, `sectionState`'s rule, at any size — asked BEFORE the registry since
  1.35.1: a design that uses no component has nothing to agree with, and with no registry yet it was told to create
  one) · no-rows · mismatch · ok. A WARN — and an
  approval check where `designSystemGated(kind, size)` holds (= `designReuseGated`: a plain feature of size m / l): no-rows and
  mismatch FAIL there, and `GATES.design` refuses on `ui-design-system`.
- **An approved design is never failed by the registry moving on.** The check reads a file that changes after an approval —
  a finish adds rows, a team renames a component, the registry is created later. So doctor passes `gate` only while the design
  is not SETTLED (`designSystemSettled`, doctor.js): approved under the check (its `designSystem` stamp), the id not among a
  forced approval's `failing`, design.md unchanged since (`changedArts`). Settled → a WARN at most; the approval gate itself
  stays strict (an edited design is re-approved against the registry of the day), and a forced approval keeps failing. The
  stamp `designSystem` (gates.js, every design approval and its record): a design approved before 1.35 passes with a note
  (`quality.dsLegacy`, `DS_SINCE`) — never flagged, at any size. An approval's context has no `root`: the view reads
  `specsRoot(c.projectDir)`. `designSaveCheck` (the design.md save hook) adds a ▲ note for mismatch / no-rows and carries
  `designSystem` (the state) — a note, never unclean, and never for a missing registry (doctor says that once, not every save).
- **Doctor `ui-deprecated`** (1.37, `designSystemDeprecatedCheck`; the `DOCTOR_CHECKS` entry right after `ui-design-system`,
  phase 2, the same `uiDesigned` feature) — each component a Reuse / Extend row names that the registry's `deprecated` holds
  is a WARN naming its replacement (`quality.dsDeprecatedItem`: `'Table' (use DataGrid)`, the name alone when the marker
  names none); silent when the row's notes name that replacement AS A COMPONENT — `dsNameIn` over the WHOLE notes, a word or
  two adjacent ones, in the letters the registry writes its name with (`dsLetters`: letters and digits as written, case and
  accents kept — the replacement's row name, the marker's spelling for one past the rows read in full): `Dialog lacks a
  sheet`, `` `Dialog` ``, `<Dialog />`, `the Data Grid lacks grouping` silence — the team keeps this one on purpose and says
  why —, `the delete-confirmation dialog` does not (component names are common nouns); never with no replacement. A code
  span or a tag is no exception to the case (`<data-grid>` does not silence DataGrid): the letters are kept wherever they
  stand; once
  per component, a silenced row hiding no later one; a New row is not asked (`listed` is ui-design-system's); six named,
  the rest counted. It runs only while the registry holds a deprecated row (no registry: never — the applies asks it
  first) and never on a feature with a finish recorded (`state.finished`: what it built is history; an archived feature
  never reaches doctor). Never a fail, not `warnsOnly`, not in `GATES`, NO stamp: it reports the registry of today — a
  component deprecated after the design's approval —, not a rule an approval was held to, so a design is never failed for
  it and the warn says what is still to migrate; `spec_upgrade` lists it (attention `warnings`, the default — no
  design-writing warn). Detail only (`{id, status, detail}` — doctor keeps no other key).
- **The brief** — `briefDesignSystem(root, design)` for a task `uiTask()` says builds a view (the visual review's rule): each
  component the design names with its registry entry (kind, path, variants, notes, the row's reason; ≤ 12 / 1,500 characters),
  the names the registry doesn't list (`unknown`), the token count and sources, the libraries; null without a registry. A
  deprecated component's entry carries its `_Deprecated: use X_` marker whole, first among its notes (1.37) — the rows
  doctor's `ui-deprecated` reads, no more (past the 500-row cap neither marks a component).
  `renderBrief` writes it after Reuse; the result's `designSystem` holds identifiers (`write: true`: `refs.designSystem`, the
  names).
- **The code** (engine/design-system.js, LAZY — entries `designSystemReport`, `designSystemSeed`, `designSystemFinish`) —
  `scanCode`: ONE walk (`walkProject` + `gitignoreRules`, 20,000 counted files; a file read up to 256K characters; a view
  file's line read for raw values up to 2,000, a token file's line whole). A component (`componentOf`) = a view file (.tsx /
  .jsx / .vue / .svelte / .astro, an Angular `*.component.ts`, a
  PascalCase .js) whose NEAREST telling folder is a component folder (`COMPONENT_DIRS`: components, ui, design-system,
  widgets, atoms…) — never a page folder below it (`PAGE_DIRS`) —, named by its file (kebab-case → PascalCase) or its folder
  for an index — and, since 1.35.1, every further component a .tsx / .jsx / .js file EXPORTS (`exportedComponents`;
  1.35 review 10 found the limit on real file contents: shadcn's `card.tsx` was Card alone, and a design reusing
  `CardHeader` "not in the registry"). What tells a component is its DECLARATION, never its name — no suffix list
  ("Context", "Props") is ever complete: an exported function, a class that extends React's `Component` /
  `PureComponent` or a component class the file declares above it (`classHeader` reads the header to its `{`, what
  its brackets hold aside — type parameters over lines or holding a `>`, `extends` on the next line —, then
  `RE_CLASS_EXTENDS` / `RE_REACT_CLASS`: never `class LoginError extends Error`, `extends mixin(Component)`, a base
  that is imported — or, 1.35.2, whatever it extends, a class that RENDERS: a `render` (`RE_RENDER`) and JSX in its
  statement), or an exported const whose value
  is a function (`functionValue`: an arrow, `async`, a generic one — its `<` alone at the line's end too, shadcn's
  FormField —, `function`; a `(` is a parameter list's when its `)` is followed by `=>` or `:` or does not close on
  its line, so `(1 + 2) * 3` is a value; a parenthesis inside a quoted string is none — `quoteEnd`), one of React's
  own wrappers, a `styled` one or a context's provider
  (`RE_VALUE_WRAPPER`: `forwardRef`, `memo`, `lazy` — with `React.` or bare: a framework's API, a closed list;
  never `z.lazy(`, `cache.memo(` —, `styled.x` / `styled(X)` / `styled<P>(…)`, `X.Provider` / `X.Consumer`), or
  another component under a new name
  (`RE_VALUE_ALIAS`: `= DialogPrimitive.Root`, `= FormProvider` — a capitalised name the file IMPORTS or declares,
  or a member of one: never `= Infinity`, `= Number.MAX_SAFE_INTEGER`, a local enum's member — asked once the
  whole file is read, `DS_ALIAS_PASSES` deep: a function declared below is hoisted, an import may follow its use).
  The value is what
  follows the `=` that ENDS the declaration's annotation (`declaredValue`): at no bracket's depth, never an arrow's
  — `React.FC<{ onDone: () => void }> = …` —, on a later line while a bracket is open (`DS_DECL_LINES`), and the
  next line with text when the `=` ends its own; a `,` before it ends the declarator (`let First, Second = …`
  gives First none). Exported on its declaration, in an `export { … }` list (over
  lines, `X as Y`) or as the default. Never a type, a context, an object, a schema, `cva(…)`, any other call, a
  re-export (`export { X } from`, `export *`: a barrel's). A name is read WHOLE, accents too. Top-level statements
  only (column 0), comments aside (`withoutComments` with `script` — a `/*` in a string opens none, and a script's
  strings are the ones that CLOSE on their line, backticks too (`quotedPlaces`): the apostrophe of `<p>Don't</p>`
  quotes nothing — and `html: false`: `<!--` is no comment in a script), a BOM dropped; a template literal's lines are text, never a statement (`scriptView`, 1.35.2 — until then a code
  sample at the margin read as the file's own declarations); an imported enum's member still reads as a component,
  knowingly. An `import` clause is an import STATEMENT's (`RE_IMPORT`: never
  `import.meta…`, `import(…)`, `importantSetup()`) and ends where one ends (`RE_IMPORT_END`: the module's quote, a
  `;`, the `=` of `import X = Y.Z`). Every pattern is anchored and unambiguous (a value is SLICED off the
  line, never captured by `(.*)$`; no `\s*;?\s*$`) — each has its hostile fixture. Bounds: `DS_EXPORT_FILES`
  component files and `DS_EXPORT_CHARS` characters read, the shorter path first, `DS_EXPORT_NAMES` names a file
  (past any of them `limits` says `component-files` and the report is never in sync), `DS_EXPORT_LIST_LINES`
  lines an unclosed `export {` or `import {` may take, and the file's own length for all that its declarations
  read BELOW their line (a real file's never overlap; a file of `const A: X<` lines read sixty lines for each —
  spent, a declaration has no value and the file says `more`). A component with a file of its own keeps that file (read
  after every file's own name is known); a route segment's special file is a page and is not read. What one file
  cannot settle the project's other files may (What the project's files settle, below — 1.35.3: a component made by a
  call that shows nothing, a class that renders only through its imported base, CommonJS, a re-export under a new name
  in a component folder's barrel); what NO file renders where the reader sees it is still a row to add by hand, and
  the `unknown` hint still says so. A feature's own files are read
  the same way for its New components' paths (`featureReport`: the finish wrote `—` for one its file exports
  beside the file's own — a component file's alone, its own file first). Review 1 of 1.35.1 measured the first
  draft on six real kits: 197 of 218 found, 7 non-components listed; its fix round found 204 and listed two, both
  PascalCase helper functions — the kind the docs name —; never a test, a story, a hook (`useX`, `use-x`), a helper or an entry file (`NOT_COMPONENT`, as written:
  utils, types, constants, main, app, store…; never applied to an Angular `*.component.ts` — the suffix says what it is).
  Of them `main` / `app` (`ENTRY_NAMES`) are entry files only RIGHT inside the telling folder, `src/` looked through as
  `homeDir` does (`src/ui/main.tsx`, `packages/ui/src/main.tsx`): deeper, `components/layout/main.tsx` is the component
  Main (review 6; review 7: `src/` was not looked through).
  NOT a framework's special-file names (page, layout, loading, error, not-found, template): those files live in ROUTE
  folders, and a file is read here only under a component folder — `components/loading.tsx`, Nuxt's `components/error.vue`
  and `loading/loading.component.ts` are components (review 5: left out of the seed, "in sync", a size m design reusing
  Loading refused) — EXCEPT in a ROUTE SEGMENT of Next's app router (`routeSegments`). Three properties of the PROJECT,
  never of the folder alone: (1) the project is Next's — a package.json that depends on `next`, or a `next.config.*`, at or
  above the root,
  inside the project (`dependsOnNext`: a monorepo's `apps/web/package.json`; an Nx project whose dependencies are
  hoisted keeps its config). Asked only of the roots above a component named like a special file, a manifest read once
  per folder and `DS_MANIFESTS` of them at most (review 9: per root and per folder above it, 10,000 roots cost 36 s); a
  single-page app that keeps `src/app/layout.tsx`
  beside `src/app/components/{page,loading}.tsx` has no segment (review 8); (2) the router's root is the `app/` that
  holds the top-most `layout.*`, through route groups and dynamic segments (`routerRootOf`: next-intl's
  `app/[locale]/layout.tsx`, `app/(app)/layout.tsx` — review 8: asked right in `app/`, those apps had no router);
  (3) a segment is every folder from the root down to a `page.*` / `route.*` (`RE_ROUTE_MARK`), never through a
  private `_folder/`, plus the parallel slots, groups and dynamic folders right under one (`app/ui/@modal/default.tsx`).
  `componentOf` says `route` (`ROUTE_FILES`), `scanCode` knows the segments only once the walk is over. Review 6
  took ANY folder holding a `page.*` for a segment, and a component folder with its own `page.tsx`
  (`src/components/`, Remix's `app/components/`) lost Loading and Error — the gate's verdict flipped both ways (review 7).
  A barrel's index is none (`GENERIC_DIRS`, any case: packages/ui/src/index.tsx is no "Src", icons/index.tsx no "Icons"), nor
  a helper folder's (`HELPER_DIRS`, as written: config/, context/, store/, constants/, i18n/, mocks/, util/, helper/,
  tokens/, style/) — but NOT the special-file
  names: `layout/index.tsx`, `loading/`, `error/`, `theme/`, `page/` under components/ ARE the components of those names
  (review 4: with `NOT_COMPONENT` applied to an index's folder, a design reusing Layout was refused); a folder's leading `_`
  is dropped (`dirName`: Next's `_components/`).
- **Token files** (`tokenFileKind` → style · named · theme · plain; `isTokenFile`) — by name AND place: a stylesheet named
  tokens / _variables / theme and a design-tokens.* / *.tokens.json / tailwind.config.* anywhere; `theme.*` ANYWHERE but
  under a folder that holds something else by that name, at any depth (`NOT_UI_DIRS`: store, models, redux, server, types,
  hooks, context, e2e, scripts… — never utils / helpers / docs / public, review 6: a theme kept beside the helpers or in
  a docs site IS the project's) — wide on purpose: listing one too many costs a path in a list, missing one loses the
  project's tokens (a WordPress theme's wp-content/themes/acme/theme.json, Expo's constants/theme.ts); a plain `tokens.*`
  only at the root or in a telling folder (`TOKEN_DIRS`), `src/` looked through (`homeDir`: packages/ui/src/tokens.ts lives
  in `ui`) — narrow on purpose, the name is everyone's: never `src/auth/tokens.ts`, `src/tokens.ts`, `ui/lib/tokens.ts`,
  nor the singular `token.json`. A GLOBAL stylesheet counts too — a CANDIDATE by its NAME, wherever it lies
  (`sheetRank`: `globals` / `global`; then app, application, main, style(s), base, root, site, tailwind, custom, input;
  then index — .css / .scss, a Sass partial's `_` aside, a CSS module never), and a SOURCE by ≥ 5 (`GLOBAL_CSS_MIN`)
  custom properties: EVERY one of a `globals.css` (the name can only be the page's: a theme on `[data-theme]` or
  `.light` / `.dark` alone counts), and for a name a component's own sheet has too those of a PAGE-WIDE block —
  styleTokens' `global`, decided ONCE when the block opens (`pageWide`): a rule with `:root` / `html` / `body` as a
  selector of its list (alone or qualified, in `:where()` / `:is()`, never with a descendant — and never `:host`
  alone, a web component's own scope), a `&` rule that only QUALIFIES one (`&.dark`, never `& .card`), Tailwind 4's
  `@theme`, a theme plugin's `@plugin`, any other at-rule taking its parent's answer (`@layer base { :root { … } }`);
  then, once the file is read, a THEME — a block at least HALF of which overrides page-wide tokens (a `.dark` block:
  what else it declares is a token — shadcn's dark-only names; review 9: ONE override made a theme, and
  `.btn-outline-primary { --bs-gradient: none; … }` seeded twelve `--bs-btn-*`) — and a mixin a page-wide block
  includes. The half has two edges, both said in the user docs (review 10; any threshold has them): a `.dark` that
  overrides three names and adds five is no theme, and `.btn { --btn-pad; --radius }` is one. A sheet is a source
  only when it brings a NAME no earlier source holds: a twin (`main.min.css`, a second
  app's identical `globals.css`) takes no place — and stays a TOKEN FILE for the raw-value read (`twins`; review 9:
  dropped without a trace, a feature that edited one was told to "use the token" on the line that declares it). Which
  of the twins is THE source: the first by name rank, depth, then path — it may be the built copy
  (`public/css/app.css`, not `resources/css/app.css`), and a registry is in sync when it names that one. A token
  file, source or twin, is exempt WHOLE from the raw-value read: a rule's raw value written in it is not reported
  (exempting only its token declarations would be the finer property — not built). How it
  got here — every shortcut failed once: review 5 listed the folders a global sheet may be in (six ordinary places
  lost), review 6 the folders a component's OWN sheet is in (both ways wrong), review 7 made EVERY stylesheet a
  candidate judged by its selector, `:host` included — an Angular app's 24 `x.component.scss`, a vendored Bootstrap's
  16 dist files and 25 theme files each became a source, filling the 20 for good, and a `globals.css` whose theme
  lives on classes was no source (review 8); and the scope, asked per DECLARATION, walked the open blocks outward —
  quadratic on nested at-rules, 16 s for one file. The price of the name list, said in the user docs: a global sheet
  under another name is not read (name it in `_Token sources:_`). Read: custom properties, Sass variables and — in a
  .less file — Less variables (`RE_TOKEN_DECL_LESS`: a blank may precede the colon, Semantic UI's aligned style;
  `@page` is the one at-rule a colon may follow and is excluded by name). `styleTokens` reads the WHOLE line (a
  minified token file is one line), so NO regex runs over a value: the name and its colon are matched, and the value
  is the piece's tail — `\s*:\s*(.*)$` was quadratic on a tail a `.` cannot cross, review 7. A statement is cut at
  `; { }` OUTSIDE quoted strings (`--q: "}"` closed its block; review 8) and comments (`quotedPlaces`: a `/*` in a
  string opens none — nor the one inside a `//* …` line comment of a .less / .scss file: `withoutComments` took
  Bootstrap 3's `//** doc` above each variable, or a `//*****` banner, for a block comment's opening that never
  closed, and every variable below the first such line was lost — 2 of 42 on a real variables.less, the report "in
  sync", on every commit since the first; review 11's one MEDIUM, found by building the file the Less repair was
  FOR). A declaration no `;` / `}` ends on its line goes on below and is listed by its NAME, unless its
  block or its file ends right there — a lone `;` too —, or the file is an indented .sass, where a line's end ends
  it — never a value that stops at a `,`. A `name:` INSIDE the parentheses a statement opened is a parameter or a
  map's key, never a declaration (a mixin's `$border: $background,` shadowed the real `$border`, review 7); the count
  is closed by its `)` and by a `{` / `}`, and a STRAY `(` is undone where it stands — a line that opens more than
  it closes and ends in neither `,` nor `(` goes on nowhere (`// spacing (in px` in a .css) — but in Less, where a
  mixin's parameters are separated by `;`: there a line that ends in one goes on when the STATEMENT that opened the
  parenthesis is a mixin's — it begins with `.` or `#` (`RE_LESS_MIXIN`: `.button-variant(@color; @background;` then
  its defaults, a call after a declaration on its line; `@open: fade(#000;` and a value's `calc(100% - 2px;` are
  undone — review 10: review 9 had dropped the Less case, and `@hover-background: darken(…)` shadowed the real
  variable; review 11: review 10 asked it of the LINE, "it holds no declaration", so a value's stray `(` in a rule
  swallowed down to the next brace and a call after a declaration was undone).
  It is undone to the count the line FOUND, not to none: a stray `(` inside an open list leaves the list open. And
  the count a line found open is never closed by a line's end: review 8 closed it at the end of any line that did
  not go on, and the last argument of a call nested
  in a parameter list re-opened the parameters after it as declarations (review 9). In an indented file a line at the
  margin is a statement of its own. The exception: `@use … with (…)` / `@forward … with (…)`, whose parentheses hold
  the module's real overrides — listed by name (review 8: dropped). Then a JSON file's leaves (`jsonTokens`); a
  JS / TS / YAML one is listed as a source, its
  values unread — the
  files whose values ARE read come first (21 `tailwind.config.ts` must not take tokens.css's place). Libraries =
  `UI_LIBRARIES` ∩ the project's dependencies (`projectDependencies`).
  The walk's EVENTS (1.37): `styleTokens(text, rel, on)` — the ONE CSS block walker, for a reader of a sheet's STRUCTURE (the
  UI checks: a rule's selector, what it declares, the blocks around it); never a second walker beside it (CRIT_1: this one
  took reviews 7–11 to get right). `on.block({ id, parent, prelude, line, global })` when a `{` opens a block (the prelude
  over lines, its last DS_PRELUDE characters, `#{…}` as written), `on.statement({ text, block, line, from })` (`from`, 1.37: the line its text
  starts on) when a `;` OUTSIDE
  parentheses or a `}` ends one (the walker's pending text and the piece — its lines joined by a blank; never blank, never
  a prelude), `on.close({ id, line })` when a `}` closes a block (a stray one closes none). Each handler is optional and is
  given a fresh object of plain values: nothing it does reaches the tokens. The events read the walker's state, they never
  steer it — so they inherit its view: a `;` inside parentheses (a Less mixin's parameters, an unquoted `data:` URL) ends no
  statement and what stands before it is not kept; after a token declaration left open at its line's end the next statement
  starts below it; an indented .sass file has no block. Behaviour-preserving when it came: the tokens of 2,493 real
  stylesheets byte-identical to 1.36's, with and without an observer; an observer costs ~1.3–1.6× the walk
  (mcp/tests/15-quality-design-system-walks.js pins the events on one sheet and that a handler writing into what it is
  given changes no token).
- **The project's manifests** (`projectDependencies`, quality.js — 1.35.1) — the dependency names the registry's reader
  (`dsNamed`, `dsAlias`, `packaged`) and the seed's `_Libraries:_` stand on: the root package.json AND its workspace
  packages'. Until 1.35.1 the root one alone (left knowingly in review 6; 1.35 review 10's MEDIUM: `antd 5` + `antd
  Table` passed in one layout and was refused in a monorepo, whose seed declared no library). The folders are the
  ones the project DECLARES (`workspacePatterns`): package.json `workspaces` (an array, or Yarn's `{packages}`),
  pnpm-workspace.yaml `packages` (`pnpmPackages`: a block list or a flow one, on its line or over several — the one
  key, at the margin, quoted or not, a BOM dropped, a flow list to the `]` that ends a line; no YAML parser, zero
  dependencies), lerna.json `packages` (or Lerna's default, `packages/*`, when NOTHING declares a workspace: beside
  declared ones it read a folder the project had not declared — review 2 of 1.35.1). Each pattern is followed
  folder by folder (`workspaceDirs`): a name, a `*` within
  one (two at most: its match must stay linear in a folder's name), `**` (that folder and two levels below it —
  never inside a folder that is a package: its `src/` and `dist/` are its own, and looked into they spent the
  folders listed; review 2); a
  `\` is a separator on every platform. A project that declares NONE is looked through one level down
  (`frontend/package.json` beside a Django app, `client/` + `server/`) and — 1.35.3 — when that level holds no
  package at all, the next (`apps/web/`; review 1 of 1.35.3: looked through as `**`, a `web/` app's `fixtures/x/`
  was read too), a bound of that guess never said (no declared folder went unread: `guessed`, which keeps the `cut`
  it found); "declares" is a workspace FILE being there (`declares`:
  package.json's `workspaces` key, pnpm-workspace.yaml, rush.json, lerna.json) — one that names nothing it can read is
  looked through one level as before — and only when its root is no app of its own, with `dependencies` (`own`); a root
  that looks like a library (`library`: not `private` — a private one is never published, its `main` is a script's —
  with a `name`, `peerDependencies` / `main` / `module` / `exports`) keeps the first level and never the second (review 1: the second read a library's `examples/with-mui/`;
  review 2: blocking both lost an `npm init` root's `client/` — `npm init` writes a `name` and a `main`):
  an app whose `docs/` or `storybook/` site keeps another kit is not that kit's project (review 1 of 1.35.1: the
  union made the report ask, for good, for libraries the app does not use). What a pattern never reaches: upward
  (`..`), a link (a `*` match is a Dirent that is no directory; a NAMED folder is asked itself, `lstat`; a manifest
  that is a link out of the project is not read), and a `*` never matches a dot folder or node_modules — a NAMED
  one is the project's own word. A `!negation` takes its folders out (1.35.3 — it removed nothing until then):
  `negation` reads its pattern as `braceExpand` and the walk do (a `*` within a name, two at most; `**` any folders,
  none too; out of the project, too long or too deep: none), each alternative's segments compiled ONCE (review 1: a
  matcher built for every folder against 6,000 negations of ten packages took 103 s) and matched by `globMatch`, a
  dynamic program over segments × names — never one RegExp over the path (review 2: `**` and two-`*` names in one
  backtracked, 13.8 s a line). A folder it matches is never given — by the patterns BEFORE it, npm's order (a later
  pattern gives it back), the project's own and a workspace package's for its folder (its place: where its next pattern
  is queued); pnpm-workspace.yaml's are put LAST (`workspacePatterns`), where they narrow every pattern, as pnpm reads them
  (review 2). `DS_WORKSPACE_NEGATIONS` alternatives, asked before one is compiled — past them said (`cut`). A brace list is expanded
  first (`braceExpand`, 1.35.2: the first list and the `}` that closes it, cut at the commas of its own depth — a nested
  list adds its names, it does not multiply them; `DS_WORKSPACE_BRACES` patterns a list). A declared
  pattern the reader does not FOLLOW — past a bound, a brace list it cannot expand (of one, never closed), a
  segment of three `*` — is
  SAID (`cut`): the project named folders that went unread (review 2: dropped without a word, the report said in
  sync); a negation and a path out of the project are not — nothing went unread. Bounded, and nothing a manifest
  holds throws out of the registry's
  read (review 1: an 8 KB pattern overflowed the stack; 50 long ones cost 11 s): `DS_WORKSPACE_PATTERNS` patterns
  of `DS_WORKSPACE_CHARS` characters and `DS_WORKSPACE_SEGMENTS` segments, `DS_WORKSPACE_DIRS` folders listed once
  each (`readDirBounded`, `DS_WORKSPACE_ENTRIES` entries, sorted by name), `DS_WORKSPACE_ASKED` folders asked,
  `DS_WORKSPACE_MANIFESTS` manifests READ — a folder that is no package costs none of them (review 1: counted by
  folders NAMED, `packages/**` spent the hundred on each package's `src/` and `dist/` and left the library unread,
  silently). Past a bound the names read so far stand and the Set says so (`cut`, and `read`: the workspace
  manifests read — 0 when the first pattern was the one not followed, never "at least 1"): the scan reports it
  (`limits`: workspace-manifests). The cost is paid only when a marker ASKS (a bare-number name, a note, a registry
  with no component row) and once per scan; a single-package project pays nothing but its root manifest.
  `packageDependencies` stays ONE folder's manifest (`dependsOnNext` asks it of a router's folders). 1.35.2 reads
  what 1.35.1 said it did not: rush.json's `projects` (`rushFolders`: each `projectFolder`, a folder named in full —
  `jsonPlain` takes the comments and trailing commas Rush allows out, strings kept; a rush.json that is no JSON is
  declared and unread: said) and the `workspaces` a workspace package declares for its own folder (`manifestWorkspaces`,
  given back by the visit and queued: `DS_WORKSPACE_NESTED` deep, as many as can be asked (`DS_WORKSPACE_ASKED`) —
  past either, said; a path from a root and a negation name none). And the fifty are the patterns that are WALKED (`RE_WORKSPACE_WILD`): a
  folder named in full costs one question (asked once, however many patterns share it), `DS_WORKSPACE_EXACT` of
  them are followed — a rush.json names every project so.
- **The export reader's view** (`scriptView`, design-system.js — 1.35.2) — until 1.35.2 the reader read one LINE of a
  declaration; what 1.35.1 left to add by hand needs what a STATEMENT holds. The file is read once into: `code` (its
  lines, comments out — `scriptLines`: a line that starts inside a template literal is read from the backtick that
  closes it, so no comment opens in a template's text, and a script's `//` inside a string that closes on its line
  is none: `quotedPlaces`' mask), `tpl` (the lines that start inside a template literal — text; a backtick that
  never closes is a stray one, and then the file is read AGAIN with no template at all, as 1.35.1 read it), `next`
  (where the next statement starts: a line at the margin that begins a name, `RE_NAME_START`; one that begins
  anything else but a closer, a `{` — a brace on its own line is the statement's above — or an operator,
  `RE_STATEMENT_START`, WHEN the line above — a line of blanks aside — ends a statement: text at the margin inside an element ends none
  (an expression's `{` never starts one); or an
  indented `export` of a declaration, `RE_INDENTED_EXPORT` — never the word `export` as an object's key or a
  sentence's), `jsx` (the lines that hold
  JSX: a closing tag or a self-closing one, `RE_JSX` — every element has one, and neither is anything else in a
  script; `<Name` alone is a type argument's shape too; strings emptied first, `withoutStrings`) and `called` (the
  capitalised names the file calls as a function). A statement's EXTENT is `[i, next[i])`: its closing lines at the
  margin are its own — the formatting every formatter gives —, and NO bracket is matched across lines (a `(` in JSX
  text or in a regex would derail one). On it stand: a call of any function is a component when its extent
  holds JSX or loads (`RE_DYNAMIC_IMPORT`) AND it is given a function (1.35.3, `RE_GIVES_FUNCTION`: an arrow, the
  word `function` or a method's shorthand in its extent — with none, its JSX is an element handed over, `mount(root,
  <App />)`, `createRoot(el).render(<App />)`, and a value that IS `import("./x")` a promise, `RE_PLAIN_VALUE`) or a
  component's name or a string first (`RE_HOC_FIRST`, below) — UNLESS what its LAST argument list holds first is an object, a list or
  an element (`givenFirst` over `lastList`: the list at the call's own depth, never a `)(` inside an argument, the
  callee's type arguments aside; on its line, or the first line below when the list opens and the line ends — or
  the list a LATER line opens at the statement's own margin, `})((props) => …`: `curriedFirst`, review 4): a
  configuration, or an element handed over — a generic arrow (`RE_VALUE_GENERIC`) is neither. The rule asks nothing
  of the arguments themselves: asked whether one IS a function (reviews 1 and 2 of 1.35.2), it cut them apart and
  lost whatever a type's comma or a line break stood in (review 3). Or when its
  extent DEFINES a `render` and holds JSX (`renders`: `createReactClass`); or when its last argument list is ONE
  capitalised name (`RE_HOC_ARG`, a cast after it cut off: `uncast`; on a line of its own: `RE_LONE_NAME`) that is a
  component of the file's OWN (`own`: declared by a declaration, or an alias of one — never an alias of an import)
  — or, the application being curried, one it imports (`applies`, settled with the aliases). A call given an object or a list is a configuration whatever JSX it holds; a single
  call around an imported name says nothing (`createContext(DefaultTheme)`, `Object.freeze(IconSizes)`). A class is
  one when it renders — `renders`: a `render` that is DEFINED (what follows its `)` is a `{` or a return type, on
  its line, below it, or after a list over lines — a line's open lists followed down ONCE, `DS_DECL_LINES` deep,
  and read on from the line that closes them, the blank lines below it `DS_DECL_LINES` deep too (`readOn`); a field
  whose value begins a function, a generic's `<T,>` or a name — `render = memoize(…)` —, never a local `const
  render` (`RE_LOCAL_BEFORE`); `render: function`), never a call of one (a ternary's too), a member's (`this.render = …`) or an
  element's attribute (`render={…}`, `render="span"`) — and JSX; an element in
  parentheses and a function called at once (`RE_IIFE_END`, only of a value that IS a function in parentheses) are
  no function's value. A PascalCase function is a helper by a PROPERTY (`isHelper`): its first parameter is a
  capitalised name, it has three (`paramList`, on the declaration's line: the commas of its own depth, type
  parameters skipped — a `<` is one only right after a name), or the file calls it AND it renders nothing itself.
  The second half is what makes the first safe: a name before a `(` is not always a call — a plural (`File(s)`), a
  regex's, a typed parameter's or a method's header (`{` after its `)`), a signature (`:` after it), an element's
  text (after a tag's `>`, an expression's `}`, under a tag's line, a sentence) — and `called` tells those apart by
  what the name IS and where it STANDS (`closers`: each `(` of a line matched once), yet a function that returns
  JSX is a component whoever calls it. An apostrophe right after a letter opens no string (`opensString`: `Don't`
  in an element's text, `it's` in the comment after it — a pair of them quoted the `//` between, or a closing tag),
  and no comment is open below a line that ends inside a template (`scriptLines`). A part (`RE_PART`, `Object.assign` — `assigned`: the statement read whole,
  its arguments by `givenArgs` (cut at the commas of the list's own depth, a type's arguments aside, to the `)` that
  closes it), EVERY literal after the first argument, its capitalised keys alone — `RE_PART_KEY`; with no such key
  the const is the component it is given only when that one is the file's own; a component written as its first
  argument makes the const one, and a CALL there (never `{}`, `new X()`) — a HOC's, with its arguments — makes it one
  when a part of it is; a member there (`Card.Root`) stands on nothing;
  the parts are recorded WHATEVER the first argument is: record, then decide) is declared as `Owner.Part` and
  exported under each name its owner is exported by — its own and those of the component it stands on by its bare
  name (`stands`, `DS_ALIAS_PASSES` deep; never a member's: `= Tabs.List`), each exported name expanded once —
  a key once, a part that is no component spending no room (`partsOf`, settled once an owner) —, `DS_EXPORT_NAMES`
  of them in all, a part past them SAID (`more`); an ENTRY is asked of its own text (`kindOf`'s
  `piece`), never of the statement it stands in. `RE_COMPOUND_NAME` lets one dot through, and `dsKey` gives `Card.Header` the key of
  `CardHeader` — a design may cite either. Decorators are taken off the line (`undecorated`); React's wrappers are
  asked of the names an import of `react` gives (`RE_VALUE_SPACED`); a destructuring from an import, or a `require`,
  gives names an alias may stand on (`borrowed`). Linear: every pattern has its hostile line in the tests, and an
  extent has no cap because extents never overlap — the main loop asks statement STARTS only: a line that starts
  inside a template is none (asked, its extent was the file's — review 4 of 1.35.2). A regular expression's literal
  holds no template (1.35.3, `regexEnd` in `templateOpen`: a `/` where a value starts — after `( , = : [ ! & | ? ; {`,
  an arrow's `=>`, `return` / `typeof` / `case`… — to the `/` that closes it outside a `[…]`, on its line; once one
  does not close no further one is looked for on the line: linear), and a quote right after `return` / `case` /
  `typeof`… opens a string (`RE_QUOTE_KEYWORD` in `opensString`: minified `return'</b>'`). Known, and said in the
  user docs: a stray backtick in an element's text hides what stands up to the next one, a template inside another's
  `${ … }` over lines is read as code; text at the margin that begins a NAME ends the statement it stands in (a
  `<pre>`'s lines); a REAL component with three parameters, a capitalised first one, or called in its file with no
  JSX of its own is taken for a helper — each settled since 1.35.3 when the project renders it (next).
- **What the project's files settle** (`usesOf`, `settle`, design-system.js — 1.35.3) — what one file cannot know,
  the others show: a component is RENDERED, a helper is CALLED. `kindOf` tells STRONG (a function whose extent — an
  entry's own text — holds JSX, React's wrapper, `styled`, a context's provider, a class that extends React's or the
  file's own, another name of a strong one: `strong`, passed down the alias passes) from WEAK (a function with no JSX,
  any call the rules take, a class by `renders` alone, a HOC applied: `applies` — and a part that stands on an import;
  a TOP-LEVEL alias of an import is never asked, `own` or a part's `.` only: the project nearly always renders one, and
  asking each read a big project's files for nothing, review 1); a literal (`RE_PLAIN_VALUE`: a string, a number, an
  object, a list, an instance — `new X()`, a cost guard: review 2…) and a context (`RE_CREATE_CONTEXT`: `createContext(…)`, React's API — React 19 renders one as its
  own provider, `<X value>`: fourteen of a kit's listed, review 1) are `plain` — never a name to settle. A call given no
  function keeps its verdict when what it is given first is a component's name or a string (`RE_HOC_FIRST`: a HOC's
  shape, `withContext(Ark.Arrow, …, { defaultProps: { children: <Tip /> } })`, or an element factory's tag,
  `withContext("span", …)` — six of a kit's lost, review 1; `t("hint", { link: <a /> })` has the second shape and is
  listed knowingly), and a method's shorthand is a function given (`withProvider("div", "root", { wrapElement(…) { …
  } })`). The file
  gives back its `weak` names and its `candidates` — what it exports and the rules take for none (`!declared`), its
  undeclared parts (`looseOf`: settled once an owner, the cost guard against parts × names), its re-exports under a name
  of its own or a package's (`reexported`) —, DS_EXPORT_NAMES of them, past it `more`; and its `defaultName`. `usesOf`
  reads a view: its imports (`importClause`: a default, `* as NS`, `{ a as b }`, over lines — a `type` one needs no
  skip: what only a type names is neither rendered nor called —;
  a `require` — `RE_REQUIRE_DECL` —, a whole one as a namespace), the tags it RENDERS (`RE_TAG_NAME`: a capitalised
  name or a member, `<a.b`, where an expression may start — never after a name, a `)` or a `]`, unless `return` /
  `yield`… (`RE_TAG_KEYWORD`) or the tag closes itself (`RE_SELF_CLOSED`: JSX text's `Press <Kbd />`) — nor a type
  parameter: `<T,>`, `<T extends X>`, `<T = …>` (`RE_TYPE_PARAM_AFTER`); every closing tag), a provider's tag as written
  (`providers`: `<X.Provider>` / `<X.Consumer>` — settle tells a context from a part named so), a context read
  (`RE_USE_CONTEXT`: `useContext(X)`, React 19's `use(X)` — bare or React's, never `app.use(Router)`: `contexts`), a
  part read as an object (`RE_MEMBER_READ`: `Button.Sizes.Large`, `UI.List.Sizes.Large` through a namespace — never in
  a tag) and scriptView's `called`; a call that renders a name — what a tag compiles to (1.35.4: `RE_FACTORY_CALL`
  bound to an import of `RE_JSX_RUNTIME`'s modules — `createElement` / `h` / `createVNode`, the runtimes' `jsx` / `jsxs` /
  `jsxDEV`, a namespace's or a default import's member —; its first argument, `RE_FIRST_ARG`, any case, type arguments
  aside, the first line below with text when the call's line ends at its `(`; `typeInto`: the same sets as a tag;
  a file that binds no factory is not read again — a cost guard); and what the file passes on (`reexports`, 1.35.4: `export {
  … } from` over lines — a list's lines are its entries, read once; one that never closes is given up —, `export *`,
  `export * as NS`, a name imported and exported again). The other scripts are viewed `lite` (scriptView's statement,
  next-statement and JSX passes skipped: what usesOf reads alone — 15 to 29% of the view, 1.35.4). `settle` asks the names of every component file read (and of a component folder's
  barrel, `RE_BARREL` + `inComponentFolder`: read apart from the component files' DS_EXPORT_FILES — a kit of
  `button/index.ts` + `button/button.tsx` folders reads as many as before — its weak names "unproven": a `.ts` file
  holds no JSX) of their own file (by the local name) and of every other script of the project (DS_USAGE_FILES and
  DS_USAGE_CHARS read, the files that may hold JSX first, then the shorter path; a file that writes none of the names
  asked, nor a default export's, is never viewed; a `.ts` one is read only when a weak name is asked — it holds no JSX
  and renders through a factory call alone: read for candidates too, it cost a Vue and a Svelte kit's reports ×6 for no
  row, 1.35.4; then the markup files — `markupUses`, below —, the shorter path first, within the same bound; a story's or
  a test's CALL is no evidence — `render: (args) => Button(args)`, review 1): a name it
  writes is followed through its import (`resolve`, once a folder, a module and a name: one name exported by a
  thousand kits walked their list for each tag, review 1) to the files the module may be — `placeOf` over the walk's
  `projectPlaces` (the folders holding a package.json / tsconfig.json / jsconfig.json, DS_PROJECT_ROOTS; the manifests'
  `name`s asked lazily by `packageOf` — the folders that bear the name's last segment first, from an index built once,
  then the walk's order, each with a budget of DS_PACKAGE_NAMES: review 2, the walk's first 500 lost `@acme/ui` behind
  520 examples; review 3, one shared budget let a miss asked first spend it; review 4, each folder name's group is read
  once and the walk goes on from where the last ask stopped — each miss walked the manifests again, ×4 to ×8. A name's
  folders are EVERY one named like its last segment — shadcn's templates each hold a `packages/ui` named
  `@workspace/ui`, the first alone lost the others' —, else the first other folder read under it, so whichever import
  asks first, an example of the same name never takes the package's place — `next/link` asked first had bound `@acme/ui`
  to `examples/a`, review 4): a relative path; a bare or scoped module as a workspace package's (each of its folders, its
  subpath and the subpath below its `src/`; the root's own: no leading `/`, review 2); `RE_ALIAS_SPEC` (`@/`, `~/`, `#`)
  and a path of two segments or more from each root above the file — the project's own folder always — and its `src/` /
  `app/` (review 2: `~/*` → `./app/*`, React Router's; review 3 narrowed `app/` to `~/`, review 4 restored it: shadcn's
  React Router monorepo writes `@/*` → `./app/*`, and the match narrowing spared needs the same file under `app/` and
  `src/`); where its `exports` map says (1.35.4 — below); where the config that governs the file says (1.35.4 —
  `aliasReader`, below) — another package names no file of the project, and is none (review 1: the module's
  segments matched ANYWHERE, `@wordpress/components` was every `components/` folder) —; `pointsTo` takes a file or a
  folder (its index, a barrel's file under it) of a key (`moduleKey`: lower case, no extension, no platform infix),
  asked of the file's own prefixes against a Set of the keys (review 2: a page thirty roots deep had ninety keys, each
  asked of every exporting file), by the exported name (`byName`),
  a default import by the file's base name (`byBase`) and its `defaultName`. A provider's tag is the part it names when
  the file gives one so (`exportsOf` — a candidate part too, hung on what an alias stands on, review 2 —: `Tooltip.Provider`
  of `Object.assign(Root, { Provider })`; in its own file by the local name or the exported one, `TipRoot.Provider`
  rendered as `<Tip.Provider>`, review 2), else its root used as a context; a member read settles a part alone (a component's static, `UI.Badge.displayName`, is none). The verdict:
  a candidate is a component when rendered and never a context; a weak one is none when a context, or called / read as
  an object and never rendered; an unproven one only when rendered. A STRONG one is never asked. Every file's names are
  rows before any candidate (a barrel's re-export took the row of the file that declares it, review 1). The bound
  ends the search WITHOUT A WORD — evidence looked for, as the global stylesheets are (review 5 of 1.35.0): said
  (review 1's `usage-files`) it put mui, mantine and gutenberg out of sync for good, and what lies past it is a name its
  file's rules settle alone, 1.35.2's reading. A feature's report reads none of it — nor the exports (`scanCode(root,
  false)`). Cost: the reads (on Windows about half a millisecond a file — a big monorepo's report takes seconds more);
  the views are linear (the cost fixtures, each a ratio: runs of tags, of members, an import clause that never closes,
  lines of `(/` with a backtick, 2,000 undeclared parts under 2,090 names, a page that names nothing asked, one name of
  a thousand kits through a hundred namespaces, a barrel's 500 re-exports of the project's own file). 1.35.4 adds:
  - **The governing config** (`aliasReader`, `inProject`; `configs`: every folder's `tsconfig.json`, else
    `jsconfig.json`, the walk's bound alone — `jsconfig.json` sorts first, a folder's `tsconfig.json` stands): the nearest
    folder at or above the importing file that holds one governs it (esbuild's rule — `include`, `files` and `references`
    are not evaluated: a union over `references` would over-match without `include`). JSONC through `jsonPlain`, then
    `JSON.parse`. `extends`: a string or a list, each over the one before it, the config's own options last; a relative
    path alone (`./`, `../`), `.json` added when that path is MISSING; a package's (`@tsconfig/…`, `astro/tsconfigs/…`,
    `.cfg/base.json` with no `./`) applies nothing; a rooted one, or one above the project, is UNKNOWN; a circle applies
    nothing (TypeScript's "Circularity detected"); the stack is popped after each entry (a diamond applies the shared
    config again). A written `paths` (any value: `null`, a list — none) REPLACES the chain's, resolved against the folder
    of the config that wrote it; a written `baseUrl` replaces the chain's (a string from its writer's folder;
    `${configDir}…` the governing config's folder; rooted, another `${`, or above the project: UNKNOWN; not a string:
    none). A key: the exact one first (case-sensitive), else among the `*` keys the longest prefix that fits with its
    suffix (a tie keeps the first written; a key of two `*` never fits); every string target of it, DS_TS_TARGETS, the
    first `*` replaced (a `*` left — an empty match's, a second — names no file: dropped); `${configDir}` from the
    governing folder; rooted or `${…}`: dropped; else from `baseUrl` when known, the writer's folder otherwise; above the
    project: dropped. An entry `…/index` also stands for its folder (Nx's library entries; a relative `./x/index` keeps
    naming the file: there the importer chose it). A key that matches adds only its targets and stops the `baseUrl`
    fallback (TypeScript's `{ value: undefined }`); with none, a name of two segments or more below `baseUrl` (never a
    rooted one). A read resolves the REAL path (`realpathSync.native`) and asks `isInsideDir(realRoot, …)` —
    `projectFileInside` checks the last link alone, and an `extends` crosses folders the walk never entered (a hidden
    `.svelte-kit/tsconfig.json`). UNKNOWN anywhere in the chain — not JSON once its comments are out, a link out of the
    project, past DS_TS_CONFIGS reads (100), DS_TS_LINKS entries (32), DS_TS_STARS patterns (100), a key, a target or a
    `baseUrl` longer than DS_PATH_CHARS (1,024: no file system holds such a path, and each import built keys from it
    again — review 1, 240 KB of targets took 500 pages 114 s) — makes the folder's
    config tell NOTHING: it keeps 1.35.3's reading (an abstention where TypeScript's reading cannot be reproduced).
    Memoised per governing folder (`tables` — a cost guard, timed), a config's own table once a FILE (`owned` /
    `tableAt` — review 1: sixty folders over one chain of thirty configs rebuilt every table, 52 s), the keys once a
    governing folder and a spec (`said`), DS_ALIAS_CHARS of them in a scan (review 2: every distinct spec kept up to ten
    1 KB keys — 9.5 MB of pages ran a scan out of memory; past it the configs tell nothing more); an `extends` longer than
    DS_PATH_CHARS is UNKNOWN too, and every target is measured, not the first ten alone (review 2). The keys are ADDED before the package lookup and the guess, both unchanged. A
    default import looks up EACH key of the place with its own base (`lookup`, `keyBase`): a config's target, a map's,
    need not share the guess's last segment — and a target's base under the guess's folder is a place TypeScript never
    resolves to (review 1: the union of bases checked against the union of keys settled such a file). The keys are
    grouped by base once a place (`at.bases`), each base's files walked once against its own keys (review 2: once a key,
    400 packages of one name × 1,000 pages took ×26). Review 3 of 1.35.3 had taken a first reading out
    (a `..` target as text, no bound, short of TypeScript's rules three ways — a `*` catch-all returned early, two configs
    in a folder, the first key not the longest); each is answered by a rule and a fixture.
  - **A workspace package's `exports` map** (`exportsMap`, `reachTargets`, `targetsOf`, `exportedPaths`, `refused`): read
    as Node's resolver reads one (lib/internal/modules/esm/resolve.js), sorted once as `readOne` reads the manifest's
    `name` (no second read: ×2 to ×2.4 measured; targets reached once a key — compiled at read time cost ×3.6 on misses).
    All keys subpaths (`.`), DS_EXPORT_KEYS at most — all or none: the longest key wins, a map read in part could pick a
    shorter one. The subpath as written (`own`: case kept) — the exact key, else the first pattern by the longest base,
    then the longest key, its match free to hold `/` but no refused segment (`.`, `..`, `node_modules`, `%`-encoded, split
    on `/` and `\`); a key's value alone decides (`null`: nothing, never a shorter pattern). Its targets: a string that
    starts `./` with no refused segment; a condition object's branches up to its `default` (past it while the `default`
    may give nothing: Node goes on to the next key, review 4), any condition (what the module MAY be: Chakra's `dev`); a
    list to its first accepted entry (a refused one, a `null`, an object that resolves nothing passed — Node's code, not
    its spec prose; three ways, REACH_ENDS / REACH_NONE / REACH_NULL: an object ends a list when its `default` resolves
    and no branch before it may give `null` or a refused target — a nested object or list that matches nothing gives
    nothing, and Node tries the next key; a list holding a `null`, or empty, gives `null` —, a list that ends at a target
    ends the one around it, reviews 1 to 4); DS_EXPORT_DEPTH (a
    crash guard: 100,000 nested lists overflowed), DS_EXPORT_TARGETS; every `*` replaced, a target the match would make
    longer than DS_PATH_CHARS not taken (review 1: 200,000 `*`s × a long subpath ran a scan out of memory); an index
    target is its folder. Kept up to DS_MAP_CHARS of manifests (a memory bound); the paths the maps give, DS_ALIAS_CHARS
    of them in a scan (`given`, as the configs' keys — review 3). The bare `.`, `main`, `module`, `source`
    are never read: the folder covers them for a name looked for, but the FOLLOW starts at `src/index` / `index` alone
    (another root entry is a row by hand — review 1). The map ADDS keys beside the subpath and `src/`.
  - **What a module's own file passes on** (`filesOf`, `passesOf`, `closureOf`, `through`, `reach`, `look`; `mains`): the
    follow starts at the files the module IS (a key's own, `<key>/index`, a package root's `src/index`) and goes on
    through `export { … } from` links and `export *` closures to the file that declares the name; the evidence is noted
    there, under the name it exports. A file's re-exports are read once (the files read before the search are prefilled),
    up to DS_PASS_FILES / DS_PASS_CHARS of its own; a closure is indexed once a file (a walk once a name was quadratic:
    90,000 steps on Chakra, 6,063 indexed); a query is memoised once a file, a name and a tail; DS_PASS_STEPS is charged
    where the work happens — every star or link looked at (`step`: one of no project's module too — review 1, such stars
    were walked free in every closure that reached them, 83 s), a named entry indexed, a module a star or a link reaches
    (1 + its keys + its files, checked BEFORE it is followed), each candidate a lookup compares; a file's identical stars
    are kept once; an answer is kept once a [path, name] (`once` — review 1: a name passed on by many links to one place
    gave as many copies, each copied into every importing folder's answer: memory out). A file's own explicit link hides
    its stars where the query starts (ES's ResolveExport applies it in every star target too: there the follow
    over-approximates, knowingly — review 1), a star never passes a default, a cycle ends at a file seen. The follow is NOT filtered by the search's
    names (Gutenberg's `__experimentalTreeGridItem as TreeGridItem` was lost by a guard); the prefilter (`wanted`) gains
    the namespaces (`export * as NS`) the files read before the search pass on, and nothing a file read later passes on
    (a verdict must not depend on the order). No name is ASKED because a file passes it on.
  - **The markup files** (`markupRegions`, `markupComments`, `withoutCodeSpans`, `markupUses`, `tagsIn(…, true)`,
    `RE_KEBAB_TAG` / `pascalOf`): an `.mdx`, `.vue`, `.svelte`, `.astro` file's SCRIPT (MDX's top-level ESM — column 0,
    `import ` / `export `, where a block may start, never a paragraph's next line: micromark-extension-mdxjs-esm —; Vue's
    and Svelte's `<script>` blocks; Astro's front matter) goes to usesOf, blanked elsewhere so line numbers hold and
    trimmed of its indent (prettier-plugin-svelte indents a block's); its MARKUP to the tag loop with the comparison guard
    off (in markup a word before a tag is text). Never read: fenced code (`fenceStep` — MDX has no indented code, so
    `stripFencedCode` would be wrong), inline code spans (`backtickRuns`), front matter, `<!-- -->` / `{/* */}` across
    lines, `<style>`, a Vue block but its script and root `<template>` (its depth counted; a tag that closes itself —
    `<template #trailing />`, the empty slot eslint-plugin-vue writes, `<script src="…" />` — opens nothing: review 1, a
    template before the script held to the file's end — `tagEnd`: a tag ends at its first `>` outside quotes (each closed
    by its own mark alone) and outside `{…}` (an arrow stands in either; a bare `=>` ends it as HTML's parser ends it —
    review 4 dropped a rule no tag reached), the quotes followed from the tag itself — review 2
    counted each mark apart, then followed them from the line's start, where an apostrophe in the text before the tag
    opened one: review 3 —; a tag's text is passed once read), an Astro `<script>` (a client script). An opening tag's end is
    looked for once a line where it is known (`tagEnd`: a line of openers with no `>` after them was quadratic, review 1). In `.vue` alone a kebab tag with a dash is the component Vue resolves (`<my-button>` → MyButton; one word,
    `<card>`, needs Vue's own element list: never). Read after every script, one queue, the same counters (markups first
    or counted apart lost a script's reading).
  - **Read ahead** (`readFileHeads`, files.js): the exports read and the usage queue take their files through it — the
    first AHEAD_PROBE in sequence and timed; when they average AHEAD_SLOW_US or more and AHEAD_MIN remain, AHEAD_WORKERS
    worker threads (`worker_threads`, Node core) open the rest, worker j the files j, j + W, …, each at most AHEAD_WINDOW
    ahead of the one taken (a SharedArrayBuffer of counters and a stop flag; the main thread waits with `Atomics.wait`); a
    worker silent for AHEAD_STALL_MS, or none that starts, leaves the rest to readFileHead. The text is readFileHead's
    exactly (the same bounded read, `decodeText`, the same cut, the same order). Why: on Windows with on-access
    antivirus an OPEN costs ~0.65 ms (stat 47 µs; no read API helps — only fewer or overlapped opens); 5,000 files read
    in sequence took 3.2 s, sixteen at a time 0.64 s. Where opens are fast the probe never starts a worker. The workers'
    env holds no NODE_OPTIONS (`execArgv: []` keeps no flag, but a worker reads NODE_OPTIONS again: `--input-type=module`
    made its source ESM, a preload ran in it — one that refused workers stalled each pool 2 s, one that wrote to fd 1
    wrote into an MCP server's JSON-RPC: review 1), and a worker's 'error' is heard (`w.on("error", stop)` — unheard,
    it is thrown on the main thread and ends an MCP server once the scan has answered).
  - **A barrel's other names** (exportedComponents' `also`, `aliased`, `from`; scanCode's `sourceRow`, `ownRow`): a
    candidate the file gives under more than one name — the same local (`export { Root, Root as Card }`), the same
    re-exported binding — is no row of its own when the binding comes from a COMPONENT FILE of the scan (`from` resolved:
    relative, or through placeOf — `$lib/…`; a component folder's `index` too) that holds its own name's row: that file
    is the row. One that lost its name to another (`popover/root.tsx` beside `dialog/root.tsx`: one `Root` row) is none,
    so its binding's names given with `as` that the page renders stand for it where their name is free (`Popover`) and
    its bare ones stay none (review 4: asked only "a component file?", such kits lost every kit name — 1.35.3 listed
    them in `.tsx`). The module the import names is asked alone: a binding taken through another barrel (`./card` →
    `card/index.ts` → `card.tsx`) is not followed, said in the CHANGELOG. Review 2 had asked whether a sibling
    name's row was the binding's — a row anywhere dropped `Pane as ResizablePane` beside another `Pane`, a folder's took a
    `Panel` below a root barrel —, and review 3 found the winner of the name the wrong question: a second install, an
    alias import, an app's own `Table.svelte` listed the bare parts again. Of a package's binding's names (paneforge's
    `Pane`), a bare one gives way to one given with `as` the page renders too — within the binding: run over every file,
    review 2's two passes moved unrelated rows (chakra-ui/ark's `ErrorText`), review 3; a binding given more than DS_ALIAS_NAMES (16) names asks none of
    them (the corpus has 3 at most; 12,000 names were walked once a rendered candidate, ×31). Review 1 of 1.35.4: on a SvelteKit checkout
    that ran `svelte-kit sync`, `$lib` resolves through `.svelte-kit/tsconfig.json` and shadcn-svelte's barrels listed 75 bare parts, `Root`, `Content`, `Link`, beside `Card`,
    `CardContent` — the fresh clones of the corpus have no `.svelte-kit`, and the first measure of `$lib` was made on
    them. A name given once stays (`export { default as Toaster } from "./Sonner.vue"`; Gutenberg's
    barrel names for its inserter listbox's parts — a guard on every barrel name for a component file's default lost
    seven of its public names).
  What it cannot see, said in the user docs: a name no file renders where the reader sees it (a kit consumed elsewhere;
  past a bound; a default import under another local name in a file that writes none of the names asked; an alias only
  a config's `references`, a package's config, `package.json`'s `imports` or a bundler's alias writes; a name passed on
  under another name by a file that is neither a component file nor a component folder's barrel, rendered only by files
  that write no asked name; a re-export through CommonJS; a markup file's component with no import — Nuxt's, MDX's
  `mdx-components.tsx` —, a one-word Vue tag, a Pug template, a dynamic component; a factory not imported from its
  library, compiled CommonJS, a factory render only in a `.ts` file when no weak name is asked), a component the project
  only calls; a helper, a part on a name that is none, a call whose function renders, while the project never calls them
  nor reads them as objects; a top-level alias of an import that is none; a call given a string or a capitalised name
  first, or a method beside an element, whose JSX is an element handed over (`t("hint", …)`, React's element cloner
  given a component first); a call given an object with a `render`, or curried around an import; a class that renders
  JSX and that the project never constructs.
- **A design value is THE gate on what is read out of a token file** (`designValue` → null · weak · strong). The scan picks
  files by NAME, a name is no proof of what a file holds, and what is read here is printed by the report and WRITTEN into a
  steering file a team commits. No list of credential key names is ever complete (review 4: 14 of 19 shapes passed one),
  so NOTHING is shown by exclusion: a value is shown only when it has the SHAPE of a design value — parts separated by
  blanks, commas or slashes, each a hex colour, a number with or without a unit, a `{reference}`, a keyword of the list
  (`DV_KEYWORDS`), an arithmetic sign alone, or a function of ANY name — or none, a group — whose ARGUMENTS are design
  values themselves, read the same way (`dvScan`, recursive, `DV_DEPTH` levels): what guards a function is what it
  holds, never its name (`var(FAKE)` always passed a name list, which only hid `map-get()` and `math.div()`; review 6:
  "any characters of a set" let `ENC(Xk29…)`, `url(//host/v1/KEY/x)` and `(SecretValue1)` through). Never `url(…)`.
  Inside the arguments a custom property's name (`var(--x)`) is a value, and plain lower-case words beside a part that is
  more than a bare number, or alone in a function CSS or Tailwind knows (`RE_DV_DESIGN_FUNCTION`, `RE_DV_CSS_FUNCTION`:
  `linear-gradient(to right, …)`, `env(safe-area-inset-top)`, `steps(4, end)`, `theme(spacing.16)` — never `rate(5 minutes)`,
  `unquote(hello world)`); a NAMED function holds something (`name()` is a name alone). In a stylesheet also a
  variable's name (`$brand`, `-$gutter`, `--brand`, Bootstrap's `--#{$prefix}radius`), an interpolation (`#{$x}` —
  `maskInterpolation` keeps its braces while a line is cut at `{ }`), a dotted path as an argument (`RE_DV_PATH`) and,
  beside a part that is more than a bare number or a word, plain lower-case words (`opacity .15s linear`; never `hunter two`,
  `Hunter 5px`). A secret is a free string, and a free string has
  no such shape; a quote is never accepted. **Adding a value form? It must be one no secret can take** — a `$word` is
  accepted in a stylesheet, never in JSON. STRONG = a part that SAYS design: a 3 / 6 / 8-digit hex (a 4-digit one is a
  value and no evidence: `#feed`, `#face` are words), a length (never CSS's `q`: "1Q" is a quarter), a design function
  (`RE_DV_DESIGN_FUNCTION`), a `{reference.path}` (`{name}` alone is a template's placeholder: weak), a function holding
  one of them; a time, a percentage, a bare number are weak — shown, but no evidence of what a file is.
- **A NAME is printed too** (review 5: a map keyed by the secret — `{"ghp_…": 1700000000}`, `{"sk-…": {"rate": 100}}` — put
  the secret in the report as a token's name). Two layers. (1) `jsonSource` decides on the FILE: a JSON file is read only
  when it holds no credential and SHOWS it is a design file — the design-tokens format (`$value`, whose `$type` — if the
  node has one — is ONE word, `RE_TYPE_WORD`: a token tool's, whichever it is (`other`, `float`), while a
  qualified name is a serializer's — `$type` / `$value` are Json.NET's too, and a dictionary keyed by GUIDs was seeded
  through its `$type` alone, review 7; asked to be a type of the LIST, `{$value: 4, $type: "float"}` was dropped,
  review 8; or `value` beside a `type` that is a token type, `RE_TOKEN_TYPE`, and no word any data holds,
  `RE_GENERIC_TYPE` — time, size, number…: beside `type: "hash"` the pair is a database dump's, review 6) or a
  STRONG value. The price, said in the user docs: a plain file of bare numbers (`{spacing: {sm: 4}}`) is not read.
  (2) A KEY is WORDS (`wordShaped`): cut at whatever is no letter or digit, each part is letters, digits, or the two
  with at most `DS_NAME_SWITCHES` switches between them (gray900, 2xl, a11y, 8dp) — or a colour's own 6-digit hex, a
  palette keyed by its values (`0d6efd`) — and no blank-separated word reaches `DS_KEY_MAX` (40). A key that is
  none is left out WITH ITS SUBTREE; a `$`-key is never walked (`$extensions`). Asked of a {reference}'s path too
  (`DS_REF_MAX`: it names such keys — a braced GUID is none) and of NOTHING ELSE: a stylesheet's identifiers —
  `$color-f5f5f5`, `--w1280h720`, a function's name — are their author's, and review 7, asking them to be words,
  dropped half of a hex-named palette with every value that referenced one (review 8). The layer is STATISTICAL and the
  docs say so: the shorter a key shaped like an API key, the more often it passes — about one in ten at 32 characters, one in
  four at 16 – 20, half at 12; a GUID one in fifty; a 32-digit hash, a JWT, a `ghp_` token never (reviews 8 and 9: 900
  keys a shape) — what stands first is layer 1. What it cannot tell at all: a
  secret that is a word. Under both
  …password(s), api_key(s), secret_key, credential(s), jwt; camelCase split; never the plural `tokens`, a design file's
  wrapper) — guards everything AT and BENEATH it: only a LITERAL that says design (`designValue(v, false, true)`: no
  variable, word or function of a name of its own — `var(--…)` could wrap anything) or a `{reference.path}` is listed
  there, never a numeric password under `password: {admin}`; and a FREE string AT one — its own key, never a token of a
  format — makes the file a credentials file (`secret`). pin · otp · passcode guard the same way (`guardKey`) and NEVER
  refuse a file: `map-pin` is an icon's name, and with them among the credential words an icon token dropped its whole
  file (review 6). A stylesheet's token is listed by its NAME, its value only when it is one; a token
  of a format whose value is free text (a font stack, `Semi Bold`) by its name alone, and so a COMPOSITE one — `$value` an
  object or a list: a shadow, a typography, a font-family list, a cubic-bezier (`composite`; DTCG's colour and dimension
  objects by their `hex` / `value + unit`, when that IS a design value). The whole document is walked (a credential past
  the 1,000th leaf still counts); a BOM is dropped. What stays printed, knowingly: an identifier the author chose — a
  function's, a variable's or a reference's name — with the value it is part of (a team's own px-to-rem function and a
  wrapper built on
  purpose have one shape). And a token's name is compared as the registry's reader gives it back (`registryName`: its
  cell cleaned; a slot word is no row — `dsNameSlot`: TBD, `[component]`, never a word that only says "pending", a component
  can be called Pending (review 8) —; a `|` the pasted row escaped is unescaped by the reader) — what the seed writes
  must read back, or its own report is never in sync (review 7).
- **Bounds of the token read** — `DS_TOKEN_FILES` (20 SOURCES) of at most `DS_TOKEN_READS` (100) candidates read: a
  candidate that turns out to be no source takes no source's place, the global stylesheets are read by name first
  (`sheetRank`: `globals.css`, then a name an app gives its one stylesheet, then `index.css`), then root-most (a
  monorepo's 100 `Widget/index.css` never stand before the one `styles/globals.css`), and their search ENDS at the
  read bound without a word — they are candidates, not "files
  named like a token file"; `DS_TOKENS_MAX` (1,000 — what the registry's reader reads, as `DS_SEED_COMPONENTS` is 500); a
  file read up to
  `DS_READ_CHARS` (one character further is asked for: a file of exactly that length is not "longer"; a cut JSON file
  does not parse: no source). `capped` → a `limits` code, each set ONLY when something
  was cut: `tokenFiles` when a file that IS a source finds them full, `candidates` when files named like one are left
  unread, `fileSize` (the file's path) for a token file by its name or a stylesheet that qualified — never for a
  candidate that is none (review 5: a 330K built stylesheet, 120 components' `styles.scss` said a bound of a project
  that had lost nothing, and a report that names one is never in sync).
- **Surfaces** — `spec_scan {designSystem: true, name?}` (a mode on spec_scan's THIRD key — mcp.md → Arguments by mode) =
  `dev-spec design-system [feature]` (one operation, `design-system`; the human report: `cliOutput.ds*`), read-only. No feature:
  `registry` {file, exists, components, tokens}, `found` (counts + the sources and libraries), `missing` (in the code, not in
  the registry — the CLI prints each as a row to paste), `pending` (in the code and declared New by an unfinished feature's
  design — `pendingNew`: its finish adds it; a row pasted for it would read as already listed), `stale` (`stalePath` —
  below), `newTokens` (against `tokenNames` — every token the file lists),
  `newSources` / `newLibraries`, `inSync`. A feature: `usage`, `problems` (the findings, a localized `text` each), `raw`,
  `counts`, `newComponents`, `uiChecks` (1.37 — UI checks, below). `missing`, `pending`, `stale`, `newTokens` and `raw` hold their first 50 (`DS_LIST`) with a
  total beside each (`missingTotal`, `pendingTotal`, `staleTotal`, `newTokensTotal`, `total`).
- **`limits`** — the bounds that CUT what a report read, `[{code, read, file?}]`: files (the walk's cap) · token-files ·
  token-candidates · file-size (`file`) · tokens · registry-rows (rows past 500 are not checked for a gone path) ·
  component-files (a bound of the export read: `DS_EXPORT_FILES`, `DS_EXPORT_CHARS`, `DS_EXPORT_NAMES` — `read`: the
  files read) · workspace-manifests (a bound of the workspace patterns, or a declared pattern not followed —
  `read`: the manifests read, 0 too) — 1.35.1, the project report's alone ·
  view-files (a feature's 200; its report carries every code but tokens and registry-rows — a stylesheet left out of the
  sources is read for raw values); `truncated` = one of them, and then the report is NEVER `inSync` (said of NAMES: a
  token's value is not compared, nor a token the code no longer declares — `cliOutput.dsInSync` says so, review 7) — what it
  did not
  read it cannot vouch for (the CLI prints `cliOutput.dsLimit[code](read, file)`, never "the registry and the code agree"
  beside one). A new bound gets its OWN code and line in en / pt / es, and is said only when it cut something: a false
  bound is a false alarm for good.
- **A stale row** (`stalePath`) names a CODE FILE OF THE PROJECT that is gone. A reading counts only when its last segment
  has a file extension (`src/components/Card` may be Card.tsx or a folder) that is no document's or image's (`RE_DOC_EXT`: a
  note cites README.md) and its FIRST segment is on disk — `next/link`, `primereact/button`, `~/components/Button.vue`, a
  site, prose and `n/a (custom)` start nowhere in the project. The whole cell on disk → there (a path may hold a blank);
  else its words, each a reading (a markdown link's target, a path beside a note): ONE that is there → there, gone when a
  word names a file and none is (`src/components/Gone.tsx (see README.md)`); no word names one → the whole cell.
  `projectPath` decides on the TEXT before any fs call (a network path, `..` out, an absolute path elsewhere, a glob:
  null); `onDisk` stops at a link. **Every doubt reads as "not judged"** — a wrong "gone" sends a team to fix a registry
  that is right: a root-level file, a path whose first folder is gone as a whole, `_shared/` (`dsCell` drops the
  underscore), a row naming a gone file AND one that is there ("was src/old/Card.jsx, now src/components/Card.tsx" —
  review 3's "the first word decides" called it stale; so `Gone.tsx — replaced by Card.tsx` is not stale either). The
  user docs list them (ui-design-patterns.md → the scan table).
- **The seed** — `steering_scaffold design-system.md` (`scaffoldSteeringFile`) writes the stub with the code's rows in place of
  its slot rows (`designSystemSeed` → `seeded` {components, tokens}); a table the code has no row for keeps its slot; nothing
  found: the plain stub; a project template for the file wins; never over an existing file.
- **Raw values** (`rawValuesOf`, the feature report) — the feature's view / style files (`featureFilesOf`, shared with dupes.js;
  token files — the registry's `_Token sources:_` and `isTokenFile` — and tests aside; ≤ 200 files). A line is read as a
  STYLESHEET's in a .css / .scss… file, inside a `<style>` block — a markup file's (`RE_STYLE_BLOCK_EXT`: .vue / .svelte /
  .astro / .html…, any case) or JSX's (styled-jsx; `RE_STYLE_OPEN_JSX`: never right after an identifier or a quote —
  `useState<style>` is a type, "<style>" a string; `<style` may end its line; a SELF-CLOSING `<style … />` holds no block:
  the opening tag is followed to its `>`, over lines, `styleTagEnd`). A block is looked for on the line WITHOUT its
  comments — `// injects a <style> tag`, `{/* the <style> */}`, `<!-- the <style> below -->` open none (reviews 4 and 5:
  each blinded the rest of the file) —, or when it is
  declaration-shaped
  (`RE_DECL_LINE`: a CSS-in-JS template): piece by piece, a hex or functional colour in a declaration's VALUE only (never a
  selector, a prelude before `{`, a line ending in `,` — unless it reads `prop: value,` with a blank after the colon,
  `RE_DECL_GOES_ON`: a multi-value declaration going on, read by its first line; its further lines are not), and margin /
  padding / gap / font-size / radius in px / rem / em (any literal of the value; never 0,
  a 1px hairline, a value built from a variable or `calc()`). Elsewhere (markup, code): a 6 / 8-digit hex right after a quote
  or one of `[ ( : = ,`, a 3 / 4-digit one only as `[#fff]` or a quoted literal, a functional colour, a Tailwind arbitrary
  size — "Ticket #204518" is prose. Never an anchor or a reference (`href="#abcdef"`, `querySelector("#add")` —
  `RE_HEX_REF_BEFORE`: an attribute that takes an anchor, also under a data- / aria- / hx- prefix or a namespace —
  `data-bs-target`, `hx-target`, `xlink:href`, Vue's `:to="'#add'"` —, never any prop that merely ends so (`gradient-to`);
  a WHOLE word for a key — `invalid: '#dc2626'` and a gradient's `to: "#fff"` are colours; a DOM lookup;
  `RE_HEX_REF_CAMEL`: JSX's `xlinkHref` / `dataTarget` — only Href and Target; `RE_HEX_REF_LOOSE`, for a 3 / 4-digit hex
  only: a selection or tween target, `.find`, `d3.select`, `gsap.to`, `scrollTo` — with 6 digits those take colours,
  `picker.select("#1d4ed8")`), an entity, a
  comment (`withoutComments`: outside a stylesheet a `/*` opens one only at a line's start, after a blank or `{ ( ; ,` —
  `accept="image/*"` holds none). A colour equal to a registry token's value carries `token` (`colorKey`). Not read: a size
  in a JSX `style={{…}}` object. The line walk (1.37) is `viewLines(text, rel)` — rawValuesOf's loop head, the ONE walk of a
  view file's lines its readers share (the raw values, the UI checks): a GENERATOR of `{ n (1-based), src (cut at
  DS_LINE_MAX), l (without its comments), css (a stylesheet's line — a `<style>` block's opening and closing lines too) }`.
  A generator, never a list: rawValuesOf stops at DS_RAW_PER_FILE values and reads no further line (over a list, a
  20,000-line sheet cost every line — CRIT_1: 1.1 → 6.4 ms; mcp/tests/15-quality-design-system-walks.js times the stop as a
  ratio against a sheet with no value). Behaviour-preserving when it came: the raw values of 5,256 real view files
  byte-identical to 1.36's, every earlier assertion unchanged.
- **spec_finish** (`designSystemFinish`; +ui and a registry, never on the `gateOnly` path) — the raw values as a WARNING, never
  a blocker, and only when the registry holds tokens or names token files (`tokens`: else there is nothing to replace them
  with) — `finish.designSystemRaw`: the count, the first 3, the call that lists them. A READY written finish appends the
  design's New components to the registry (`registerComponents`): under the roadmap lock, the registry read AGAIN past the
  call's read cache (`forgetCached` — doctor read it before the lock) and judged by `keys` (past the reader's cap too: no row
  twice); into the component table the file ENDS in when it has a column for the origin (neither the path's nor the
  variants') AND the registry's reader ends in it too — the table is looked for in the READER's lines (`mdTables`':
  comments and fenced code out, line for line), whose last one is the file's last line by POSITION: a note on that
  row hides nothing (`| Button | … | <!-- reviewed -->` — review 1 of 1.35.1: compared as written, it started a
  second table), and a table that is commented out (`| … | -->` as the last line) or inside a fence left open is
  not the reader's — it took the rows where nothing reads them, the finish said "added" and every later one added
  them again (1.35.1; 1.35 review 10; review 2 of 1.35.1: compared as TEXT, with the reader's trailing blanks
  trimmed, a hidden copy that ended in the visible table's last row passed for it) —, else as a new table (`appendSpecText`: BOM and line ends kept); the path = the feature's file
  of that name, or the one that exports it beside its own (1.35.1), the
  origin `_From: <slug>_`; a name that is no plain component name is never written (`RE_SAFE_NAME`); best-effort — a registry
  the write gate refuses is left as it is and the finish stands. Result: `designSystem` {raw, registered, unregistered,
  note?}. A rename follows: `renameRegistryOrigin` (finish.js) rewrites `_From: <old>_` (`designSystemUpdated`). Since 1.37 it
  answers for every +ui feature, a registry or not — its UI checks (UI checks, below).
- **Linear, bounded** (review 1): a cell is cut BEFORE its replaces (`dsCell`, `dsSlot`), a token file's name parts are
  letters and digits only (`(?:[-_.][\w-]+)*` backtracked exponentially on `tokens-a-a-a-…`), `raw.trimEnd()` never a
  `\s+$` replace, every line of a view file capped (`DS_LINE_MAX`; a token file's line is read WHOLE since review 6 —
  nothing there may be more than linear, review 7). Review 2, inside the cap (2,000² per line × 128 lines × 200 files is
  still minutes): a number is `\d+(?:\.\d+)?|\.\d+` (never `\d*\.?\d+` — two ways to split a digit run), the blank run after
  a colon ends at a non-blank, Tailwind's variant prefixes are counted (`{0,4}` of ≤ 24 characters), and what stands before a
  match is read from a 40-character tail — one slice per match, never the whole line again. Review 3: the registry's marker
  entries (`stripEnds`, cut first), a path cell's backticks, `withoutComments` (the next `<!--` looked for once per line).
  Review 4: `withoutComments` again — the next `/*` that opens a comment is cached like `<!--` (the `/*` that open nothing
  were skipped anew after every comment: 142 `<!---->` + 333 `a/*` on a line, 200 files: 55 s); `designValue` is one pass.
  Review 5: and again — a `/*` right where a comment ended overwrote the cached "none left" (`<!---->/**/` runs: 22 s); the
  cache (`nb`) is now a variable of its own, never assigned by that branch. A cache's "none left" must have ONE writer.
- **A fix is proven by a test that fails without it** (review 3 found five that did not: the lock test wrote before the
  call, whose feature lock drops the whole read cache; the "hostile registry" ended in its blank run, where `\s+$` matches
  at once; one timing test covered three patterns under one bound). Review 3 checked each fix by a mutation — undo it,
  the named assertion must fail: 35 of them, one not detectable by design (`isNetworkPath` in `projectPath`: `isInsideDir`
  refuses the same paths) — and each linear pattern has its own fixture and bound
  (mcp/tests/15-quality-design-system-review3.js). Review 4's reviewer ran 36 of its own: 14 survived (the credential key
  list cut to one name, the opaque bound moved, a regex's `i` flag) — fixtures added, 69 mutations checked, each caught. Do
  the same
  for the next fix here: run the test with the fix undone, and ask what ELSE the fixture would let through. Review 5's
  reviewer: 42 more, 6 survived (a fixture whose `<style` line never matched the pattern it claimed to test; the camelCase
  split of `credentialKey`) — and the bound tests gained one fixture per code. Review 6's reviewer: 92, 32 survived
  (each credential word alone, the "no blank" half of `DS_KEY_MAX`, a bound at exactly its value, dev / peer
  dependencies, the word boundary AFTER a library's name, a NOT_UI_DIRS name) — fixtures added; 88 mutations checked
  here, each caught. Three that survived were EQUIVALENT — the code they removed did nothing (a branch for an array
  that has no `hex`, a `strong` set on a file that is a format's already, a `)` check the recursion makes redundant):
  a mutation no fixture can catch is a line to delete, so they were deleted. Review 7's reviewer: 90 of its own on
  that commit, 32 survived — eight more dead branches (the `end` test of a line, `(` in the goes-on rule, `.styl`, an
  early return) and fixtures missing for a whole function-name list, the design functions' strength, the manifest's
  bound; 160 mutations checked on review 7's fixes, each caught — 13 only after a fixture was added (a path shorter than
  the one that should lose, `:is(:root, :host)` passing through its second selector, a value the registry's reader
  drops anyway: a fixture must fail for the REASON it names). Review 8's reviewer: 38 of its own, 27 survived — five
  dead branches again, and whole lists with no fixture (the sheet names, the router's file extensions, `$`-keys); 108
  mutations checked on review 8's fixes, each caught, 12 only after a fixture was added or the branch deleted. And
  before the next reviewer saw it, the round's own differential run: the reviewer's real-shaped projects on the working
  tree AGAINST THE OLD COMMIT, reading every difference (here: 29 Bootstrap values and 34 Less variables newly read, a
  Docusaurus `custom.css` a source, an entry file no component — and nothing lost but a component's own `--bs-btn-*`).
  Review 9's reviewer: 82 of its own on three copies, 8 survived (an explicit entry never weak, a weak alias and
  `packaged`, a blank before a Less colon — each one a finding of that round); 52 mutations checked on review 9's
  fixes, each caught. Not reachable by a fixture, and left: the manifest memo and the "only the roots that matter"
  filter of `dependsOnNext` change time, never a result. Review 10's reviewer: 64 of its own on four copies, 18
  survived — no dead branch this time, all missing fixtures (the scope prefix at its length, `includes` for
  `startsWith`, a scope without its slash, a note partly of the entry's words, each side of `dsCited`'s dash and
  colon, a `&` rule's list and its child, a theme between a third and a half, the parenthesis count under a tab, at
  the margin and after a stray `(`) and one list with a single fixture (`DS_FRAMEWORKS`: five names are pinned now;
  the rest is a list); 52 mutations checked on review 10's fixes and on those rules
  (mcp/tests/15-quality-design-system-review10.js — its last assertion pins rules that did not change, so it passes
  on the previous commit by design), each caught, one only after a fixture was added (`& .card`: a regex that let a
  blank through was caught by nothing in that file). Review 11's reviewer: 57 of its own, 8 survived — the case of
  `had`, a weak note clearing a weakness, the length guard of the framework join, `<` in a range, a `)` nothing
  opened, the separators of the unbalanced cut: fixtures added; 48 mutations checked on review 11's fixes
  (mcp/tests/15-quality-design-system-review11.js), 47 caught — three only after a fixture was added (a parameter
  line must END in `;` to be read as a declaration at all), one after a redundant condition was deleted (a
  framework's stem needs no length guard: the exact name is its own stem), and one mutant of mine was a syntax
  error, not a result: read WHY a mutant fails. Not reachable by a fixture, and left: appending the comment's
  slash only when a `/*` follows — a line that merely ends in ` /` loses nothing a token reader sees. 1.35.1: 93
  mutations of the new readers (mcp/tests/15-quality-design-system-workspaces.js), 83 caught at first; of the ten,
  six wanted a fixture (a nested YAML key, a blank line in its list, two `*` in a segment, a comment right before a
  declaration, a name exported twice, a code block left open), two a timing fixture with a real margin, one showed
  a condition to delete (all-caps names: `FAQ` is a component, and a constant is none by its value), and one is
  the second of two layers (the column-0 rule: the first-letter test and the pattern's anchor) — mutated together,
  caught. Not reachable deterministically, and left: `DS_WORKSPACE_ENTRIES` (which thousand entries a listing gives
  first is the file system's order). Review 1 of 1.35.1's reviewer: 98 of its own, 27 survived — nearly all
  missing fixtures (a flow list over lines, a pattern written with `\`, a manifest that is a file link, `.jsx` /
  `.mjs`, `async function` / `let` / `var` at the margin, a value three and four lines down, a comment inside a
  list, a `_` in a name, the shorter path met LATER by the walk, the feature's own file against an export); 99
  mutations checked on the fix round, 94 caught at first — four wanted a fixture or showed a condition to delete
  (an arrow at no bracket's depth of an annotation; a name that only begins with `styled`; the feature's own file
  sorted BEFORE the exporter; `async`'s word end), and one is told apart on Linux alone (a `\` in a pattern is a
  separator on Windows whatever the code does: the Linux run is its test). Review 2 of 1.35.1's fix round: 46
  mutations, all caught at first — because the fixtures were written from the mutations, not after them: the
  reviewer's nine survivors each named one (a walk bound reaching `limits`, a cut with nothing read, an unreadable
  manifest, a `]` in a flow list's name, `extends ComponentBase`, `X.Consumer`, a feature's report, an `=` in an
  annotation's string), and listing what each new line would do if deleted named seven more before any ran (a
  second-layer guard needs a line with no `;`; a `/*` inside a template, after a `/*` no comment can open at,
  after an escaped quote; a chain of aliases; a base that is a function; an arrow in a class's type parameters).
  1.35.2: 118 mutations of the new rules listed BEFORE the tests ran — listing them deleted six conditions that
  no input could reach (a filter the caller repeats, a guard on an unclosed decorator, a keyword list of fourteen
  where three are ever met) and named a dozen fixtures; 111 caught at first, two more pieces deleted (a fragment's
  `</>` holds `/>`; the order a brace list expands in), five fixtures were under a rule that answered first (a
  plural and a line of text both under a tag: each rule needs the input ONLY it answers). Review 1 of 1.35.2's fix round: 64 mutations, 52 caught at first — eleven of the twelve were fixtures a NEW rule had made blind (a function that returns JSX is a component whoever calls it: every "this is no call" fixture whose component held the text itself was answered by that rule first; one stray backtick switched its file's template state off, and the template fixtures of that file with it), one a line the cap below it repeats, deleted: 63 of 63. A rule added in a fix round changes which input each OLDER rule alone answers — the mutation pass is rerun whole, not on the lines the round touched. Review 2 of 1.35.2's fix round: 39 mutations, 31 caught at first; one alternative was redundant and went (React's wrapper as what a call is given: the call that is given a function covers it), four wanted a fixture, one condition had no observable effect and went, and two of the three I had marked "no fixture" were not equivalent at all — writing their fixtures found a false positive (an element's `render={…}` attribute read as a class's `render` field): a mutant marked unreachable is a claim to check, not a note to file. 38 of 38. Review 3 of 1.35.2's fix round: 176 mutations — the pass WHOLE: this round's fifty and the 126 of the three lists before it that still name a line of the code. 168 caught at first; of the eight, two pieces had no input only they answer and went (a part asked a second time whether it is declared; a template's line skipped where its text is already empty) and six wanted a fixture — four of them rules of EARLIER rounds that this round's simpler call rule had started to answer first (a `)(` at the margin under a line that ends with `}`, an expression's `{` at the margin of a `<pre>`, a cast on what an `Object.assign` with no part is given, a value that is no call: `new Runner(…)`). The second pass found two more (the line that closes a template with a `;` after its backtick starts no statement; the arguments of a list end at its `)`), the third none: 176 of 176. The older lists are RUN every round, not archived — a rule that got simpler changes which input each older rule alone answers, exactly as an added one does. Review 4 of 1.35.2's fix round: the pass whole again — this round's 53 (17 of them review 3's pieces whose lines it rewrote, ported; 13 the reviewer's own mutants) and the earlier lists' 153 that still apply. 199 of 209 caught at first (before the round's last two fixes); of the ten, one is caught by the cost check that now owns it, four wanted a fixture (two later `)(` lists, `render = <Spinner />`, a blank after the `(`, the bound on the blank lines below a `)` — whose first fixture put its `render(` lines at the margin, where each began a statement of its own: a COST fixture that never reached the loop it was written for, until it was timed with and without the bound), three had no effect any input shows (an indentation condition the anchored pattern already answers — removed; a second room check — a labeled break now; an inner break the names' cap makes equivalent — dropped). 204 of 206 on the last pass, run after the last fix; the two left are equivalent on every input: a literal as an `Object.assign`'s FIRST argument (the owner it is given to is never a component, so its parts hang on nothing) and the reviewer's own near no-op.
- **Prose** — spec-implementer builds from the brief's part (a literal kept on purpose: its report's "Raw values kept on
  purpose"); the final / converge reviewer takes the findings and the raw values as candidate findings;
  `references/ui-design-patterns.md` → The registry.

## UI checks (1.37)
A +ui feature's view / style files read for anti-patterns that are wrong whatever the taste — engine/ui-checks.js (LAZY,
after design-system.js), the feature report's `uiChecks` and ONE finish warning. FEATURE level only in 1.37: the project report
reads no view file for them (CRIT_X decision 3 — one shared project pass is 1.38's). Every doubt reads as "not judged": a
wrong finding sends a team to fix code that is right.
- **Rules** — ids English-stable, a level each (`UI_RULES`): `warn` — the feature report AND finish's warning, never a blocker:
  `zoom-disabled` (WCAG 1.4.4), `img-no-alt` (1.1.1), `outline-removed` (2.4.7), `click-no-keyboard` (2.1.1), `paste-blocked`
  (3.3.8 at a sign-in or code step — W3C scopes it to authentication; elsewhere a usability defect, Vercel's "never block
  paste": review 1 of 1.37); `report` — the feature report alone: `transition-all` (certain as syntax, a guideline as a
  finding: shadcn's own
  Button, Switch and Sidebar ship it, so `shadcn add` would warn on kit code).
- **One file** — `uiChecksOf(lines, rel)` over `viewLines`' lines (the ONE line walk — Raw values above: each line cut at
  `DS_LINE_MAX`, its comments out, `cut` when it was longer) → `{findings: [{rule, line, value, silenced}], focus, past, cut}`;
  one finding per rule and line, at a tag's or a declaration's FIRST line (a Tailwind utility's: its class's line),
  silenced or not decided when it is found;
  `DS_CHECK_PER_FILE` (200) kept a file — past it each is still COUNTED (`past`: {byRule, silenced}), never kept (review 1 of
  1.37: 200 report-level findings hid a file's real ones, `total` read 200); `cut`: {lines (cut at `DS_LINE_MAX`), tags (the
  tag reader's failed reads)}. A stylesheet's lines are all CSS; a .tsx / .jsx / .js / .ts file is SCRIPT (its tags read as
  JSX); anything else is MARKUP (an SFC, HTML and its template engines), its `<style>` block's lines CSS (viewLines' `css`).
- **The tag reader** (`tagReader`) — an opening tag, `<` and a name (a letter, then letters, digits, `.`, `:`, `-`) followed by
  a blank, `/`, `>` or the line's end, read WHOLE to its first `>` outside quotes and `{…}`, over lines (a quote carries over
  a line's end; `\` escapes inside braces). In script mode never right after an identifier, `)`, `]` or a quote
  (`useState<div>`, `a<b`), nor inside a string that closes on its line (`blankStrings`); a markup file's `<script>` block
  is not read for tags. The next tag is looked for PAST the previous one's end, and past a read that failed (no `>` within
  `DS_TAG_LINES` — 30 lines — or `DS_TAG_CHARS` — 4,000 characters — counted: `tag-length`; or none before the end of a line
  viewLines CUT — the read ends there, no quote or brace carried into the lines below: review 1 of 1.37, an inline data-URI
  logo hid every tag of the next 30 lines, and minified HTML judged an `<img>` on the attributes before its cut alt): each
  character read once (CRIT_1 must-fix 1 — a reader
  that looked again from the next `<` measured 1,230× plain JSX). What that leaves unjudged, and what else is (said in the
  user docs): a tag nested in an attribute (`icon={<img />}`), a tag starting in the lines a failed read took, a tag of more
  than `DS_TAG_ATTRS` (100) attributes, tags in a one-line template literal (lit, innerHTML), Pug, the JSX of a markup
  file's `<script lang="tsx">`, a named handler's body (never followed: a named paste handler is not judged, a named click
  handler is judged on its element and body alone — the user docs said "a named handler" of both: review 1 of 1.37).
- **Attributes** (`attributesOf`) — a brace token where a name stands is a spread (`{...props}`, `{...getRootProps()}`,
  `{{attrs}}`: it may hold any attribute — img-no-alt and click-no-keyboard excuse it) unless it holds one identifier
  (Svelte's `{alt}`); so is a binding with no argument (`RE_OBJECT_BIND`: Vue's `v-bind="$attrs"`, Alpine's `x-bind="obj"` —
  the object form; review 1 of 1.37, the design's M30–M37 fixture had been dropped); a bound name is its attribute's
  (`boundName`: `:alt`, `v-bind:`, `x-bind:`, `bind:`, `[alt]`,
  `[attr.alt]`); an event (`eventOf`): JSX `onClick`, HTML / Svelte 5 `onclick`, Vue `@click` / `v-on:click` and Alpine
  `x-on:click` with `.modifiers`, Svelte 4 `on:click` with `|modifiers`, Angular `(click)` / `(keyup.enter)`.
- **img-no-alt** — `<img` as written (`<Image>`, `<img-viewer>` are components) with no alt in any binding, no `aria-label` /
  `aria-labelledby`, no non-empty `title` (it names the image, as axe-core's image-alt reads it — review 1 of 1.37: 200
  of cal.com's 202 were titled flags), no `role` presentation / none, rendered (CRIT_1 must-fix 5: not `hidden`, not
  `aria-hidden` — either not literally false —, no `display:none` in its own style: the Meta Pixel's `<noscript>` image),
  no spread.
- **click-no-keyboard** — a click handler on a lower-case element (no `-`, `.`, `:`) the keyboard cannot reach: not focusable
  by default (`FOCUSABLE`: HTML's interactive content, `summary`, `option`; `a` / `area` only with `href` or `routerLink`),
  no `tabindex`, no role whose focus its container manages (`ROLE_REACHED`: ARIA's composite items — option, menuitem*,
  treeitem, gridcell, row, tab, column / row header — and presentation / none), not `aria-hidden` / `inert`, no spread: a role
  or a key handler ALONE reaches nothing (review 1 of 1.37: `<div role="button" onClick>` was excused, the legend said "a
  role, a tabindex and a key handler" and any one silenced it). Never a listener off the element (`RE_OFF_ELEMENT`: `.self` /
  `|self`, Alpine's `.outside` / `.away` / `.window` / `.document`), a bare `@click.stop`, an inline handler holding
  `.focus(`, `stopPropagation` or `target` (CRIT_1 must-fix 6), a self-closing element (a modal's backdrop) or an HTML
  VOID one (`VOID`, the spec's list less the focusable `embed` / `input`: `<img onclick>` has no body — judged at once as a
  self-closing one, never left waiting for a close tag and counted as a read past the bound). Such a CANDIDATE
  is judged by its BODY (`clickBodies`, inside the tag reader — review 1 of 1.37, Laravel's starter kits: a wrapper whose
  slot holds the `<button>`, a backdrop holding its empty overlay layer, 8 of Jetstream's 8 findings): read to its matching
  close tag within the tag reader's bound (30 lines / 4,000 characters from its `>`: past it not judged, counted as
  `tag-length`), it is a finding only when the body holds content a user reads (literal text, an expression that is no slot
  outlet) and nothing that is or may render a control — a tag focusable by default (its click bubbles), a component /
  custom element / member, `<slot>` (and `<ng-content>`), a slot outlet (`{children}`, `{props.children}`, `{@render …}`, a
  Blade `{{ $x }}`), a line cut at `DS_LINE_MAX`: a doubt, clearing every candidate open (the control is in each body). An
  empty body or one of elements alone (an overlay layer, an icon `<svg>`) is a doubt too. Nested candidates each get the
  text seen while they are open (`textMark`); a close tag pops the elements opened since to its own name, an unmatched one
  costs nothing (a count by name); each character read once (hostile bodies ≤ 3×, below).
- **paste-blocked** — any tag (a component passes it down): an inline handler that cancels (`preventDefault`, `return false`)
  and reads no clipboard (`clipboard` — `e.clipboardData`, `navigator.clipboard` — or `getData`), or a bare `.prevent` /
  `|preventDefault`; never a named handler, nor an inline one that hands its event on to a call (`forwardsEvent`: the
  handler's parameter — an arrow's, a function's —, else `$event` / `event`, as an argument: `(e) => { e.preventDefault();
  onPasteCode(e); }` is Vue's excused `@paste.prevent="onPasteCode"` spelled in JSX — review 1 of 1.37). The ONLY rule that
  never follows a named handler: click-no-keyboard judges a named click handler on its element and body alone.
- **zoom-disabled** — a non-CSS line's `user-scalable=no | 0` or `maximum-scale` under 2 (a `<meta>`'s content), Next's
  `userScalable: false` or `maximumScale` under 2 (its viewport export).
- **A stylesheet's structure** (`sheetChecks`) — through styleTokens' events (the ONE CSS walker, Token files above; CRIT_1
  must-fix 2), over a file's CSS lines joined (the others blank: the line numbers hold) — a sheet, a Vue `<style scoped>`,
  styled-jsx; a styled-components template has no block structure (its `outline` is not judged, its `transition:` line is).
  outline-removed CANDIDATES: a removal (`outline: none | 0`, `outline-style: none`, `outline-width: 0`, `!important` too;
  never `outline: 2px solid transparent`, which forced colours show) in a rule with a selector whose last compound is `*` or
  an element focusable by default with no pseudo-class ("element"), or holds `:focus` itself — never -visible / -within —,
  of no type or one focusable by default and never `[tabindex="-1"]` (`RE_TABINDEX_OFF` — review 1 of 1.37: `main:focus`,
  `h1:focus`, `[tabindex="-1"]:focus` hold focus a script moves out of the tab order, a skip link's target) —
  while the rule's extent, nested blocks included, declares nothing else that draws ("focus": Bootstrap's `outline: 0;
  box-shadow: …` replaces it; its `outline: none; box-shadow: none` override does not); never a selector naming
  focus-visible, `@media print`, a class alone, a rule that never closes. An `@apply` in a rule naming a focus pseudo-class
  reads as its bare utilities would as declarations (review 2 of 1.37: `*:focus { @apply outline-none }` was a focus
  style): `outline-none` / `outline-hidden` / `outline-0` a removal of that rule, a `RE_TW_NOTHING` one nothing, any other
  — and one with a variant, as before — draws. Tailwind's `outline-none` / `outline-hidden` / `outline-0` in a class list
  under a variant of the element's OWN focus too (`isOwnFocus`: `focus`, `focus-visible` or an attribute form of them —
  `data-focus`, `data-[focus]`, `ui-focus-visible`; a bare one is not: shadcn puts it on focus-managed containers and
  activedescendant options; a RELATIONAL one — a `group` / `peer` / `has` / `in` part, `focus-within` — is a doubt, as
  `:focus-within` in a sheet: review 2 of 1.37, a popover panel's `focus-within:outline-none` around its buttons, 7 of the
  corpus's candidates). The file's FOCUS STYLE: a rule naming `:focus` / `:focus-visible` / `:focus-within` (or inside one)
  that declares something that DRAWS; a Tailwind utility under a FOCUS VARIANT that is no removal and draws, in a class list
  or an `@apply`. A focus variant (`isFocusVariant` — review 1 of 1.37: Headless UI's documented Button warned): a variant
  holding `focus` as a part delimited by `-`, `[`, `]` or its ends — `focus`, `focus-visible`, `group-focus/name`,
  `peer-focus-within`, `data-[focus]`, `data-focus`, `ui-focus-visible`, `has-focus-visible`, an arbitrary `[&:focus]` —
  never one a `not` part negates (`not-data-focus`); every own-focus variant is one. What draws nothing is decided BY VALUE,
  once for both readers (review 1 of 1.37 — a ring-killing override was a focus style that excused every removal of the
  project): `drawsNothing`, a declaration each of whose comma items has `transparent` as its colour or holds nothing but
  `none` and zeros (`box-shadow: none`, `border: 0`, `outline: 2px solid transparent`), or an `outline-offset` (it moves an
  outline; beside one that draws, that outline is the focus style — review 2 of 1.37: Tailwind v3's compiled `outline-none`,
  `outline: 2px solid transparent; outline-offset: 2px`, in a CLI's `-o src/output.css` excused every removal), and
  `RE_TW_NOTHING`, a utility valued `0` / `none` / `hidden` / `transparent` (`focus:ring-0`, `focus:shadow-none`).
  transition-all: an item that is `all` or names no property, for a
  literal time over 0 (`transitionAll`; a variable or a global keyword is a property or no time, never `all`),
  `transition-property: all`, Tailwind's `transition-all` (variants, `!`, `@apply`), a style object / inline style /
  CSS-in-JS line — never inside `@media (prefers-reduced-motion: reduce)` nor a block nested in one (CRIT_1 must-fix 7).
  Blocks nested past `DS_BLOCK_DEPTH` (64) are not judged, nor what they hold, and their rule is never a "focus" candidate.
  The statement events' `from` (the line a statement's text starts on) places a finding at a declaration's first line.
- **The focus facts** (CRIT_1 must-fix 4) — a candidate stands only while NO focus style exists: in the feature's files read
  (any of them, a .vue `<style>` too), else in the project's stylesheets — ALL of them (`.css .scss .sass .less .styl` among
  the walk's view files; never the name-ranked token candidates: a `focus.css`, an `_a11y.scss`, a .less file count) through
  `uiFocusPass`: the shorter path first, each read WHOLE (never cut at a line nor at a head), `DS_FOCUS_SHEETS` (48) READ
  and `DS_FOCUS_CHARS` (384K) PARSED at most — only a sheet whose text names `focus` (any case) is parsed, every focus style
  does, so a focus-free sheet costs an open and a read, never the parse budget; a sheet longer than `DS_FOCUS_CHARS` (not
  read whole) or one to parse past what is left of it ends the search; stopping at the first that holds one;
  asked ONLY when an UNSILENCED candidate exists (no candidate, no read — a silenced one is counted silenced whatever the
  pass would say), a file the report read never read again. A pass a bound cut judges no removal, and `uiChecks.limits`
  says which (`focus-sheets` / `focus-chars`) NAMING the removals it left unjudged — a bound never hides a KNOWN candidate
  silently (review 2 of 1.37: an Angular app of 60 components, a Next app of 140 CSS modules lost their true warning, the
  report read "nothing"): `count` (the unsilenced candidates, past a file's cap too), `file` / `line` (the first, by file
  then line; no `line` when every one sits past a file's cap), `sheet` (focus-chars: the sheet that ended the search). The
  CLI prints that line in place of `uiNone`; spec_finish says it (below). The bounds are measured, not chosen (History): the highest that kept, in
  every series where an antivirus scans each open (~1 ms), the report with the pass at its sheets bound ≤ 2.5× the same
  report with no candidate, finish's part ≤ 2×, and modules that all name `:focus` at the chars bound ≤ 3×.
  Any focus style excuses any removal: the reader cannot compute the cascade, and a team that wrote focus styles designed
  focus.
- **Silencing** — ONE form: a comment `ui-check-off: <rule-id>[, <rule-id>]` (ids `,`-separated; what follows them, a
  reason, is not read) on the finding's line or the line above, whatever else that line holds (review 2 of 1.37 took
  review 1's "alone on the line above" out: `button:focus { /* ui-check-off: … */` above its declaration, the line a
  stylesheet's team writes it on, stopped silencing while finish and the READMEs said "the line above") — a comment
  viewLines strips (in `src`, absent from `l`: `//`, `/* */`, `<!-- -->`, `{/* */}`), never a template engine's own (Blade's
  `{{-- --}}`, Twig / Jinja's `{# #}`, ERB's `<%# %>`, Handlebars' `{{!-- --}}`: in a template, `<!-- -->`); a
  stylesheet's finding sits on its declaration's line, a Tailwind utility's on its CLASS's line — not its tag's first: in
  a multi-line markup tag no comment fits beside a later line's class (keep the class on the tag's first line, or a `//`
  line inside a JSX tag). Counted in `silenced`, never
  listed, never in finish. Two lines up, another id, a string's text, no id: nothing; a linter's own suppression
  (`eslint-disable-next-line jsx-a11y/…`, `svelte-ignore a11y_…`) is not read (the user docs say so). No project switch in
  1.37 (the `_UI checks off:_` marker is 1.38's).
- **The feature report** (`featureReport`) — the text it reads once feeds the raw values AND `uiChecksOf` (CRIT_X decision 6);
  its token files (a globals.css it edits) are read for the checks ALONE — never for raw values, never in `viewFiles`, within
  `DS_VIEW_FILES` files read in all. `uiChecks` (`uiChecksReport`) = {findings (the first `DS_LIST`: rule, level, file, line,
  value — warn first, then by file and line), total, byRule, silenced, limits}; its limits — EVERY bound that cut a read or
  dropped a finding, one code a bound (review 1 of 1.37: a long line, a file's 200 findings and its 256K read dropped real
  findings with `limits` empty): `view-files` (the feature's file cap cut what the checks read), then with {read, count, file
  (the first)} `view-size` (a file longer than `DS_READ_CHARS`: read DS_READ_CHARS + 1 to know), `line-length` (lines cut at
  `DS_LINE_MAX`), `tag-length` (reads past the tag reader's bound), `file-findings` (findings past a file's 200: counted in
  total / byRule / silenced, never listed), then `focus-sheets` / `focus-chars` (with {count, file, line?, sheet?}: the
  removals they left unjudged, above) — never reach the report's own `limits` / `truncated`. `view-size`, `line-length`,
  `tag-length` and `file-findings` stay in the report alone: they hide no KNOWN candidate (a file-findings finding is
  counted in `total`, and so in finish's warning). Not named (hostile-input guards, no real file reaches them): a tag of more than `DS_TAG_ATTRS` attributes, a
  block nested past `DS_BLOCK_DEPTH` — not judged. The CLI prints it after the raw values (`uiHead` — naming finish's
  warning — for a +ui feature, `uiHeadPlain` for any other: finish reads no other feature's checks, review 1 of 1.37 —,
  what each rule that appears means — `uiRule` —, `uiSilenced`, a bound of the checks' own once: `dsLimit`, with its count
  and file).
- **spec_finish** — `designSystemFinish` answers for a +ui feature WITH OR WITHOUT a registry (CRIT_X decision 5): `uiChecks`
  (`uiFinishChecks`: the warn-level findings — {total, byRule, top: the first 3, limits: the report's}; a warn finding past
  a file's cap is counted, not listed, so `top` may be empty — the warning then reads `— …:`, one ellipsis: review 2 of
  1.37); without a registry `registered` / `unregistered` are `[]` and there is no `raw` / `tokens`, and every reader of
  `raw` guards it (finish.js, the CLI). ONE warning (`finish.uiChecks`), after the raw values', never a blocker — the
  removals a focus search left unjudged its last clause (`finish.uiUnjudged`: the count, the first file:line, why), or,
  with no finding, that clause the warning alone (review 2 of 1.37); `res.designSystem.uiChecks` only when it has findings
  or that limit (the 1.35 shape otherwise). The report's other bounds never reach finish's text.
- **Cost, as ratios** (mcp/tests/15-quality-ui-checks.js, measured at the same moment): ten hostile 256K inputs — unclosed
  tags, a line of tag starts one `>` closes, braces and quotes that never close, a string's tags, runs of focus variants and
  of `ui-check-off:`, a transition of endless items, a sheet of nothing but `{`, and (review 1 of 1.37) four click bodies —
  nested candidates never closed, unmatched close tags, a control in each body, an expression that never closes — each ≤ 3×
  plain JSX of the same size (measured 0.07–2.5×); the checks ≤ 3× the raw-value read of the same files (1.0× on 526 real
  ones); a finish without a registry ≤ 1.5× the feature report it runs (~0.9×); the feature report with the focus pass AT
  its bound ≤ 2.5× the same report with no candidate (the owner's bar after review 1's follow-up; one project, two features
  reading the same views, 1,000 sheets none naming focus: 1.2–1.3× at 48). The sheet of braces is the walker's every block: three allocation-free
  fast paths in styleTokens (`unmaskInterpolation` of a text with no mask, `pageWide` of an empty prelude, `RE_MIXIN` only
  after an `@` — the last a cost guard alone: +45 % on that sheet without it, under the bound) took it from ~5× to ~1.5× —
  tokens, raw values and every event byte-identical on the 2,493 real stylesheets of the F0 corpus.
- **Not in 1.37** (cut — CRIT_1, the decisions): `autoplay-unmuted`, `img-no-size`, `motion-layout`, the `motion` raw kind and
  `no-reduced-motion` (1.38, on one shared project pass), the `_UI checks off:_` marker (1.38), the `addEventListener` paste
  form, a `hint` level.

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
- **1.33 review** — five findings: the +dist / +api skip held at size s, where their owning sections are not scaffolded (a
  `core +api` coupon feature was asked nothing — `criticalOwned()` by size); `withoutOutOfScope()` looked ahead from every
  Out of Scope heading (80k of them: 7.7 s — one pass now, the linear guard in 15-quality-critical-flows.js); the plan check read the
  scaffold's own rows (+ui's "an error with Retry", +data's "twice … no duplicate" passed the full track combination on the
  template alone) and took a bare retry for a repetition; Shadow DOM slots and ES quotations (citas textuales / de los
  autores) fired; the approval stamps were only in gates-and-approvals.md's History.
- **1.33 review 2** — the plan check stripped template descriptions as SUBSTRINGS, so a template row the user extended ("…
  delivered twice … — for the coupon webhook") lost its answer: a cell is template text only when it equals one; the
  narrowed repetition lost the tool's own example (a retried / redelivered webhook, PT reenviado / repetido, "com a mesma
  chave"); track packs' and project templates' rows were never template text. A cell that is only a `{{variable}}` matched
  every cell (found by the new pack test).
- **1.33 review 3** — the review-2 wildcards were regexes built from template text: a `[^,;:!?—–()]` class per variable made a
  punctuated value never match (a verbatim pack row with two ACs or a "Webhooks (Stripe)" title passed on template text), a
  variable beside a short word swallowed real rows ("{{name}} for {{acs}}", "Behavior of {{name}}"), and four lazy variables
  over an 800-character cell took 1.7 s. They are the glossary's linear patterns now, a match giving only the values. The
  repetition words caught a repeated password field, a Resubmit button, a render "at the same time" and "retried after the
  provider fails"; `planFold` left `_italic_` and a final period.
- **1.33 review 4** — simplified: only the Description column is read (a scaffold's `tests/{{slug}}.test.js` File cell beside a
  verbatim description made it pass); the feature's own values are filled before the comparison (a feature named "Duplicate charge
  guard" scaffolded from "{{name}} happy path" passed — the filled name was read as the user's repetition word; it warned at
  b223e62); the slot test ran on the filled cell (a pack row opening with {{marker}} became "[hooks] …" and was dropped); a
  pattern with no literal at either end cut a word out of real rows. Repetition: a provider's retry of a webhook / payment after
  a failure, a repeated button press / link click, PT / ES repetido(a) beyond a password field, a wider window before "at the
  same time" (after a number or an action only) count.
- **1.33 review 5** — one at-once subject list served every language, so ES's "dos" (two) read PT's "dos" (of the): "o
  carregamento dos saldos e do histórico ao mesmo tempo" passed with no repetition row; "both the list and the badge" and "the
  header and 3 widgets … at the same time" counted (a number before UI parts). Now one rule per language (`AT_ONCE_EN` / `_PT` /
  `_ES`), its number quantifying actors or requests only; a repeated field / input / campo repetido never counts.
- **1.33 review 6** — the closed actor lists of review 5 lost rows the old rule caught ("both admins approve …", "two replicas
  consume …", "2 pods process …", PT / ES alike) and ES `envi…` lacked "envían": a quantity followed within three words by an
  action verb counts whatever the actor; a step number ("step 2 …") is no quantity — its lookbehind bounded, since an unbounded
  one read backwards over 3,800 hyphens per position (30 rows: 5 s).
- **1.33 review 7** — review 6's quantity counted rows that repeat nothing: UI / structural parts ("2 columns are edited", "both
  forms save", "dos columnas procesan", "dois botões processam"), steps ("3 steps process"), units and a time's digits ("the 2 MB
  upload", "at 10:00" read "00"), and a noun-like action alone ("2 panels handle the click" — the bare "click"). Now `parts` and
  `UNITS` after a quantity, no digit after `\d[.,:]`, bare actions only in unambiguous verb forms, request nouns plural; the
  phrase-first form and ES cajeros added. The timing guard is relative: `max(250 ms, 4 ×` a same-size plan of words`)`.

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

### Design-system registry
- **1.35** — introduced. Until then the design system was prose only: one guidance line in `[UI] Design System Usage`, one
  slot line in the `ui.md` stub, and nothing a feature could be checked against — two +ui features could each add "their"
  Button. Now: the registry (`.specs/steering/design-system.md`, seeded from the code), the usage table and doctor's
  `ui-design-system` (a gate at size m / l, the Reuse & Integration rule), the brief's part, spec_scan {designSystem} /
  `dev-spec design-system`, the raw-value warning and the registration at finish. Decisions: a steering stub that is NOT a
  track steering file (no approval fingerprint, never quoted whole); the write lives in `steering_scaffold` (create-only) and
  `spec_finish {write}` — `spec_scan` stays read-only, so its report prints the rows to paste instead of writing them; a
  missing registry only warns; the `featureFilesOf` helper left dupes.js's report so both scans resolve a feature's files the
  same way (the duplication guard would have named a copy).
- **1.35 review 1** (three fresh reviewers, before the release) — HIGH, found by all three: a READY finish registered the
  feature's New component, its own approved design still said `New | PriceTag`, so `listed` fired — at size m / l doctor
  FAILED, the execution sign-off was refused and a second finish was not ready (the tests used size s and asserted only
  that a status existed). Two rules came of it: the origin (`_From: <slug>_`, written by finish, followed by a rename) and
  SETTLED (a cleanly approved, unchanged design only warns — also for a row renamed or a registry created later). MEDIUM:
  `(?:[-_.][\w-]+)*` in the token-file names was exponential (24 segments 233 ms, doubling); four quadratic replaces on
  unbounded input (a cell of 80,000 `>` 13 s on every doctor, `!default` 39 s, `\s+$` 5.6 s); the re-read under the roadmap
  lock came from the call's read cache (a row another process appended was lost); past 500 components every finish appended
  the row again (the cap hid the name — hence `keys`); `/*` inside `accept="image/*"` blinded the rest of a file. LOW: the
  origin overwrote a last-column path; `@mui/x-data-grid`, `n/a` and `Button.tsx:12` read as stale paths; a token path with a
  blank was seeded but never read back; `token-form.css` a token file; "Ticket #204518" and `querySelector("#add")` colours;
  `.page:hover #fab {` a colour; `padding: 1px 16px` missed. From the docs review: a kebab-case hook and a page under
  `components/pages/` were components, a PascalCase .js was not; sizes in a `<style>` block went unread; the project report
  never compared tokens ("in sync" with none listed); the finish warning fired with no token to replace a value with; the
  reviewer agent's dispatch text sat under Task mode, where no dispatch carries the scan.
- **1.35 review 2** (two fresh reviewers on review 1's commit) — no HIGH. Review 1's fixes had left their own edges: the
  origin was read from the 500 detailed rows only, so a feature whose row landed as row 506 was "already listed" again
  (hence `origins`); tokens past the 1,000 cap were simply not compared (hence `tokenNames`); `_Libraries: none yet_` named
  a library called "none yet" (the registry was no longer empty: every Reuse row became unknown); a path cell with a blank
  or a markdown link was stale; the first `prop: value,` line of
  a multi-value declaration was skipped as a selector list; `<style` was looked for in .tsx too, where `useState<style>`
  turned the rest of the file into a stylesheet; `invalid: '#dc2626'` was an `id:` reference; `Layout.tsx` a helper,
  `packages/ui/src/index.tsx` a component "Src", `src/ui/auth/tokens.ts` a token file. Three patterns were quadratic INSIDE
  the line cap (40 hostile view files: 9 s → 0.2 s). Strings: the unknown-row hint said "its library" where the registry
  must DECLARE it; the brief's rule forbade every raw value where it means "where a token exists". Test gaps closed (each
  checked by running the new file on review 1's commit, or by a mutation): nothing covered the gate probe's `slug` — drop it
  and a feature's edited design is refused after its own finish —, `forgetCached` under the lock, the hostile registry
  through a written finish, a slug that is another's prefix in a rename. `pendingTotal` joined the other totals.
- **1.35 review 3** (two fresh reviewers on review 2's commit) — two HIGH, both REGRESSIONS of review 2's own fixes. "A
  plain tokens.json counts at the project's root" read Google's OAuth `token.json` (and any saved `tokens.json`) as design
  tokens: `refresh_token` and `client_secret` in the report and in the seeded steering file — hence the content rule
  (`jsonTokens`: `secret`, `design`), the singular name dropped. And "a library is one word" refused a size m design citing
  `TextField (Material UI)` with a hint the user had already followed — hence the first-word none rule. MEDIUM: a stale row
  for `next/link`, `~/components/Button.vue`, prose and `n/a (…)` (as before), and a gone path beside an existing one no
  longer stale (new) — `stalePath` rewritten; a trailing-run replace on a marker value (250 lines: 4.6 s on every doctor);
  "the registry and the code agree" printed when the scan had stopped at 300 tokens or 20 token files — `limits`, the token
  bound raised to the reader's 1,000; doctor's "only the first N components" said of a TOKEN table past its cap. LOW:
  config/index.tsx a component "Config"; `theme.*` anywhere made `src/store/theme.ts` a token file while
  packages/ui/src/tokens.ts was lost; `data-bs-target="#add"`, `xlinkHref="#fade"` and `gsap.to("#face")` colours;
  styled-jsx and `<STYLE>` unread. Five tests passed with their fix removed (25 of 38 mutations caught): rewritten, and
  every fix of the round now has its mutation. Docs: counts gone stale (16 steering templates, 41 operations), the
  unconditional "never a hard-coded colour" beside "where a token exists", the finish flow silent on the registry it
  edits. Lesson, the second round in a row: a fix that WIDENS what is read (the root, any name) needs the question "what
  else has that name?" before it ships — the reviewers asked it, the fix had not.
- **1.35 review 4** (two fresh reviewers on review 3's commit) — HIGH: credentials still reached the report and the seeded
  registry. Review 3's fix was a list of credential KEY names; 14 of the reviewer's 19 shapes passed it (`github`, `pat`,
  `key`, `jwt`, `aws_secret_access_key`, a 40-character run exactly at the "opaque" bound, a credential key as the parent,
  a key past the 1,000th leaf). The exclusion was replaced by an inclusion — `designValue`: only a value with the SHAPE of a
  design value is read out of a token file, JSON or stylesheet. HIGH / MEDIUM, a regression: `NOT_COMPONENT` applied to an
  index file's folder lost `components/layout/index.tsx` — the seed left Layout out, the report said "in sync", a size m
  design reusing it was refused (`HELPER_DIRS`). MEDIUM, regressions: `_Libraries: not yet_` read as a library made a
  registry with no component non-empty (a size m refusal — the check now asks whether the design cites a library); the
  content rule dropped aliases past 40 characters, refused a file for a `password` leaf holding a reference and a plain
  tokens.json of numbers only; `theme.*` narrowed past a WordPress theme inside a site and Expo's constants/theme.ts (wide
  again, with a deny list); a self-closing `<style … />` and a "<style>" string blinded the rest of a .tsx. MEDIUM, older:
  "only the first 20 token files are read" when 24 component stylesheets had taken the candidates' places and nothing was
  cut; a token file past 256K characters read as nothing, "in sync" (`file-size`); `withoutComments` still quadratic. LOW:
  `gradient-to="#9333ea"` a reference (any prefix counted); `todo.css` no token source; "was old/Card.jsx, now
  components/Card.tsx" stale (the first word decided); a token source with a note unrecognised. Tests: 14 of the
  reviewer's 36 mutations survived. Lesson, the third round in a row — and the one that ends the series: **a rule that
  guards a secret or blocks an approval must not stand on a list of names** (credential keys, none-words, helper
  folders: each list was incomplete the day it shipped). Ask what PROPERTY makes the case safe — the value's shape,
  whether the design cites a library — and test that.
- **1.35 review 5** (two fresh reviewers on review 4's commit) — HIGH, a regression: a NAME is printed too. Review 4's
  "a plain tokens.json of nothing but design values" read a token store keyed by the token (`{"ghp_…": 1700000000}`) and
  printed the keys — the value gate never sees a key. Now the FILE must show it is a design file (`jsonSource`), a
  40-character key is no name, and a credential key guards what lies beneath it. HIGH, older: `components/loading.tsx`,
  `providers.tsx`, Angular's `loading.component.ts` were "a framework's special file" (review 4 had fixed only the
  `x/index.tsx` form). MEDIUM, regressions: "the design cites a library" switched the size m / l gate off for a
  library-only registry — `Reuse | Buton` approved, and adding a correct row turned the pass into a refusal (`packaged`);
  Tokens Studio's `value` + `type` tokens with a free-text value vanished; 37 of 100 lines of a Bootstrap-style
  `_variables.scss` were shown blank (arithmetic, `#{…}`, `map-get()`, a property beside its time — the function NAME list
  guarded nothing); `_Token sources: _sass/_variables.scss_` lost its underscore (the label-italic strip), so the seed's
  own line was never in sync; `file-size` and "only the first 20 token files" said of projects that had lost nothing (a
  330K built stylesheet, 120 components' `styles.scss`); `withoutComments` quadratic a third time. LOW: a `<style>` named
  in a comment, `<style` alone on its line, `theme.ts` under store/modules/, `Material UI (@mui/material)`, a library
  matched as a substring. Reverted knowingly: a plain JSON file of bare numbers is no longer read (review 4 had asked for
  it) — printing a secret key is the worse outcome, and the user docs say so. Lessons: (1) the inclusion rule of review 4
  was right and its scope was not — EVERYTHING that is printed needs it, a name as much as a value; (2) a property that
  depends on the INPUT being judged ("the design cites it") makes the gate inconsistent — stand on a property of the
  PROJECT (a package.json dependency); (3) a bound that is said makes the report "not in sync" for good: say it only
  when something was cut.
- **1.35 review 6** (two fresh reviewers on review 5's commit) — the first round with no HIGH. MEDIUM, regressions of
  review 5's own fixes: the list of places a global stylesheet may be in lost six ordinary ones (a Next route group or
  `[locale]` segment, Django's and Flask's `static/`, `public/style.css`, a WordPress theme's `style.css`) — inverted,
  the exclusion became the short list (a set of folder names, gone in review 7); the special-file names taken out of `NOT_COMPONENT` seeded
  Page / Layout / Loading / Error from a route folder called components / ui / design-system (`ROUTE_FILES`, the
  walk's set of route folders). MEDIUM, older: `components/layout/main.tsx` no component (`ENTRY_NAMES`); DTCG's composite
  tokens not listed, a file made of them no source (`composite`). LOW: `pin` / `otp` among the credential words refused
  a whole file for an icon token `map-pin` (`RE_GUARD_WORD`: a guard, never a veto); `value` beside ANY string `type` a
  format — a database dump keyed by secrets printed its keys (`RE_TOKEN_TYPE`); a function's arguments guarded by a
  character set let `ENC(…)`, `url(//host/v1/KEY/x)` and `(Secret1)` through (`dvScan`, recursive); any one-word note a
  library (`antd (deprecated)`); the project's package.json read through a link, unbounded, a BOM unparsed
  (`packageDependencies`); the seed's own `@radix-ui` no package; `theme.*` refused under utils / helpers / docs /
  public; `file-size` said of a file of exactly a read's length; a minified token file cut at the line cap; a
  multi-line declaration shown by its first line — and, found while testing that last fix before it shipped, every
  line of an indented `.sass` file and a block's last declaration (no `;`) shown blank (`styleTokens`: `settle`). Left
  as they are, knowingly: a `|` in a token's name is escaped in the pasted row and not read back; JSON nested deeper
  than 8; a WordPress `theme.json` palette (an array of objects); a monorepo workspace's own package.json; a mixin's
  parameters listed as tokens by name. Docs: six imprecisions, one stale code comment. Lessons: (1) a list of PLACES
  is a name list too — review 4's lesson was applied to credentials and broken the next round for stylesheets; when a
  list is unavoidable, list the SHORT side (what is excluded) and leave the other open; (2) a fix that narrows a rule
  needs the fixture of what the rule was FOR (a route folder), not only of the case that complained; (3) a fix made
  between two reviews gets the same scrutiny as a finding — the `.sass` regression lived one hour, because the new
  fixture was written against real syntaxes rather than against the finding's example.
- **1.35 review 7** (one fresh reviewer on review 6's commit, with re-runnable scripts) — HIGH, a regression: review 6
  took ANY folder holding a `page.*` / `route.*` for a route segment, so a component folder with its own `page.tsx`
  (`src/components/`, Remix's `app/components/`, a `route.ts` beside `error.vue`) lost Loading / Error / Layout / Page —
  `Reuse | Loading` refused, `New | Loading` approved, the report "in sync". A segment now exists only under an app
  router's root, down to a page (`routeSegments`) — which also covers a segment whose page is in a child segment.
  MEDIUM, regressions: the folder list for a component's own stylesheet failed both ways (`ui/Card/index.css` global, its
  tokens seeded and its raw values unread; `modules/web/src/styles/globals.css` unread) — the list is gone, what a
  sheet declares decides (a scope rule); `styleTokens` reading a whole line was quadratic through `\s*:\s*(.*)$` (56 s
  for one 256K file whose tail holds a U+2028). MEDIUM, older: key names of a secret-keyed map still written — through
  a `$type` alone (Json.NET), `value` beside `type: "time"`, a key with a blank at any length (`"Bearer eyJ…"`), and
  weak evidence (`#feed`, `{name}`, `1Q`): a name now has to be WORDS (`wordShaped`), and what says a file is a design
  file was tightened. Not done, on purpose: "in sync" still compares NAMES only (a token's value changed in the code
  is not reported) — the CLI's sentence now says exactly that; flagging a value a team wrote out by hand (`16px` for
  `1rem`, a resolved `var()`) would be a false alarm for good. LOW: `var(--#{$prefix}radius)` and `theme(spacing.16)`
  shown blank (a regression of the recursive value rule); `packages/ui/src/main.tsx` a component (`src/` not looked
  through); notes that became libraries (`antd (PRO)`, `Headless UI (react)`), `antd v5` / `[antd](…)` naming no
  package, `antd` cited by `antd-mobile` (`dsAlias`, the entry's cleaning, `dsCites`' boundaries); a `/*` inside a
  quoted string opening a comment (Tailwind 4's `@source "../components/*.tsx"`: a globals.css read as empty); Less
  variables unread; seeded rows the reader cleans, "not in the registry" for good (`registryName`); a mixin's
  parameters shadowing the variable of the same name (a `name:` inside parentheses). Left as they are, knowingly:
  hostile wrappers (a secret written as a function's or a variable's NAME — no shape tells it from a team's own px-to-rem function);
  a 3-letter hex that spells a word as evidence; more than 100 candidate stylesheets of a likelier name before the
  real one. Lessons: (1) a rule about ONE folder ("it holds a page") is a guess about the project — ask what makes
  the project that kind of project (a router's root) and stand on that; (2) twice now a list of FOLDERS replaced a
  list of folders: when the thing has CONTENT, read the content — the selector says whose a custom property is;
  (3) lifting a bound (the line cap) changes the complexity class of everything behind it: every regex that meets
  the unbounded input must be re-read, not only the one the finding named; (4) "a mutation that survives" is a
  finding about the CODE as often as about the tests — eight of this round's survivors were dead branches.
- **1.35 review 8** (one fresh reviewer on review 7's commit, both copies compared fixture by fixture) — HIGH, a
  regression: "a note names its library only when DERIVED from the entry" was asked of every note, a scoped package
  included — `Design System (@acme/ui)` named nothing, `Reuse | Button (@acme/ui)` was refused with a message telling the
  user to do what they had done, and a library-only registry's gate went off (`dsAlias`: strong / weak / none).
  MEDIUM, regressions of review 7: `:host` taken for page-wide and EVERY stylesheet a candidate — an Angular app's 24
  component sheets, a vendored Bootstrap's 16 dist files, 25 theme files each a source, the 20 filled for good, the
  feature's raw values hidden (candidates by NAME again; a source brings a name of its own); a `globals.css` whose theme
  lives on `[data-theme]` or on classes, a daisyUI `@plugin` theme, shadcn's dark-only names no longer read (a
  `globals.css` counts whole; `@plugin`; a block that overrides a page-wide token; a mixin `:root` includes);
  the scope rule quadratic on nested at-rules — 16 s for one file (`pageWide`, once per block); a `-` beside a library's
  name no longer citing it — `react-bootstrap`, `@radix-ui/react-dialog`, `MUI-X` refused (the word boundary of reviews
  1 – 6 again); `wordShaped` asked of a stylesheet's own identifiers — `$color-f5f5f5` dropped with every value that
  referenced it (asked of JSON keys and references only, a 6-digit hex excepted). MEDIUM, older, narrowed and SAID
  rather than closed: of JSON keys shaped like an API key one in five to ten still passes the words rule — the docs no
  longer say "left out" as an absolute. LOW: a root layout under `app/[locale]/` or `app/(app)/` made no router; a
  single-page app's `src/app/layout.tsx` made one (the router is Next's: a `next` dependency); `Material 3` stripped to
  `Material`; `@use … with (…)` overrides dropped; a Less mixin's `;`-separated parameters shadowing a variable,
  `@page :first` a token; a `$value` beside `$type: "float"` dropped; a brace in a quoted string closing `:root`; a
  component called Pending never read back; `[Material UI (MUI)](…)`. Lessons: (1) review 7 answered three findings
  with three new mechanisms, each applied WIDER than its finding — "derived" to scoped packages, "words" to
  stylesheets, "candidates" to every file: a fix should reach exactly the case that was wrong, and say in its test
  what it must NOT reach; (2) when a rule cannot tell two cases apart (`(SLDS)` and `(PRO)`), do not pick a side —
  find where the difference shows (the cell's parenthesis is where a row CITES) and decide there; (3) the reviewer who
  ran every fixture on BOTH commits found each regression in minutes: the old commit is the cheapest oracle there is,
  and a fix round should run its own fixtures against it before any reviewer does; (4) a probabilistic guard must be
  DOCUMENTED as one — "left out" promised what one key in ten breaks.
- **1.35 review 9** (one fresh reviewer on review 8's commit, every fixture on THREE commits) — HIGH, a regression:
  review 8 kept `Material 3` from becoming "Material" by making EVERY number-less name a parenthesis-only alias —
  `Reuse | antd Table` under `antd 5`, `Bootstrap Modal` under `Bootstrap 5` were refused; a weak alias switched a
  library-only registry's gate on yet could not cite; an entry written after one inherited its weakness (`dsNamed`,
  the explicit entry, `packaged` asked of strong libraries only). HIGH, older — on every commit since the first: a
  usage cell was cut at `,` `;` `·` before its parenthesis was set aside, so `TextField (@mui/material, outlined)` was
  refused as "outlined)" and `New | DatePicker (range, with presets)` read as two components. MEDIUM, regressions: a
  twin stylesheet dropped without a trace — of three apps' identical `globals.css` the two others had their token
  definitions reported as raw values (`twins`); a `.less` file written `@name : value` listed nothing (the lookahead
  that kept `@page :first` out); a component rule that re-points ONE page-wide token became a theme and seeded its own
  variables (at least half must be overrides); `dependsOnNext` read a manifest per root and per folder above it — 36 s
  on 10,000 roots (a memo, only the roots that matter, a cap). LOW: a Next project with no `next` inside the scanned
  folder (`next.config.*`); a parameter list broken inside a nested call re-opening its parameters (the count is no
  longer closed by a line's end — only a stray `(` is undone); `(V5)` and `(@jane)` read as aliases; a note with its own
  version; a Sass partial of a listed name; `& .card` under `:root` page-wide; a code span in a link's text. Said rather
  than changed: `inSync` beside `pending` in the JSON, the honest pass rates of the words rule, `SLDS Button` (no shape
  tells it from `Pro Table`), a remark in capitals cited in a parenthesis. Lessons: (1) the round-8 fix protected ONE
  case (`Material 3`) by weakening a whole class — the test said what the fix must do and not what it must leave
  alone; every fix needs both lists, and this round's fixtures hold the twenty rows that must still pass; (2) an old
  bug survived eight reviews because every reviewer probed what had CHANGED: the comma in a cell's parenthesis was in
  the first commit — a review of a long series should spend part of its time on what nobody touched; (3) three commits
  side by side showed, for each row, which round broke it and which rule was right before — the fix was usually "what
  commit N−1 did, plus the one case commit N was for".
- **1.35 review 10** (one fresh reviewer on review 9's commit, 368 gate rows and real-shaped projects on FOUR
  commits) — no HIGH. MEDIUM, both older: a one-word library with a bare number was cited by name only when the ROOT
  package.json backs it — `antd 5` + `antd Table` passed in one layout and was refused in a monorepo, a pnpm root or
  a project with no manifest, the docs said it unconditionally, and the author's own `Bootstrap 5 (Bootstrap)` could
  not override it (a note that names the library surely clears the weakness now; the rest is said in the docs); the
  scan names ONE component per file, so a real shadcn kit's `CardHeader` and the like are unknown to the
  registry (documented; the `unknown` hint offers to add the row). LOW, six regressions of review 9: a Less
  parameter list separated by `;` and wrapped after its opening line re-opened as declarations (review 9 had dropped
  review 8's Less case with the "line's end" rule); `dsNamed` made a framework's name (`Next 15`, `React 19`) and
  any package that began with the word (`base64-js` for `Base`, `material-icons` for `Material`) a strong alias; a
  note made of the entry's own words was strong before the framework rule was asked (`React Aria (react)`);
  `dsCited` cites after a dash, before a colon and in brackets — wider than review 8's parenthesis, one-sided
  (documented); the "half" theme rule drops a theme whose own names outnumber its overrides (documented: both
  edges); an unclosed `(` swallowed the components after it. LOW, older: a row whose kind word is none of the three
  (documented), a version range without `@`, which twin is the source and the raw-value read of a token file
  (documented), and four doc sentences the code no longer agreed with. Found by this round's own differential run,
  before any reviewer: the first repair of `dsNamed` cut `Flowbite` off `flowbite-react` — the rule is now "the
  name joined to a framework's", a property of the existing list. Lessons: (1) the two MEDIUM were found by building
  the fixture a USER has — real file contents, a manifest that is not at the root — where nine rounds of one-line
  stubs and root manifests saw nothing; (2) four of six regressions were repairs wider than their finding, again:
  state the cases a repair must NOT change before writing it, and run the previous reviewers' rows against the old
  commit; (3) a rule that cannot be right for every project (which manifest, which twin, a threshold) is finished
  when the docs say where it stops and how to say it by hand — not when it guesses better.
- **1.35 review 11** (a SHORT round, one fresh reviewer on review 10's diff alone; 743 gate rows, 21 real-shaped
  projects and the Less shapes on three commits) — no HIGH; ONE MEDIUM, older and outside the diff: a `//* …` line
  comment opened a block comment that never closed (above). LOW, four regressions of review 10: the library's own
  package was backed only as "name + ONE framework" (`carbon-components-svelte`, `evergreen-ui`, `radix-ui`); a
  cell whose parentheses did not balance was torn whole (`TextField (@mui/material, outlined), Card :)`, a cell
  cut at its 400th character inside a parenthesis); in Less a value's stray `(` on a line ending in `;` swallowed
  down to the next brace; a framework's name written with a RANGE became an entry's (`React ^19` — kept: it is what
  `React v19` always was, and said above). LOW, older: a scope that merely begins with the word (`Tailwind` beside
  `@tailwindcss/vite` — a framework's stem now; an icon font's scope left, said above); a name's strength by its
  case and order; a framework's name in capitals; a weak alias in nested parentheses; an unlisted component past a
  long cell's bound; ranges of several parts and a note's bare number. Cosmetic: the `unknown` hint, repeated per
  row, was shortened. The round's own differential — the reviewer's 743 rows and 21 projects on the working tree
  against review 10's commit — shows 55 rows changed, each one named above, and no project. Lessons: (1) the
  MEDIUM was found by building the REAL file a repair was written for (Bootstrap 3's own variables.less) instead of
  the three lines that show the repair works — the cheapest way to meet the bugs beside it; (2) "name + a
  framework" was a property of ONE example (`flowbite-react`): before settling a rule, list ten real packages it
  must hold, not the one that prompted it; (3) a repair that asks its question of a LINE or of a WHOLE cell when
  the fact belongs to a statement or to one entry will be right on the fixture and wrong beside it — twice in this
  round; (4) a short round on the last diff alone, with the previous rounds' rows as its oracle, cost a fraction
  of a full one and found as much.
- **1.35.1** (2026-11-14) — the two limits 1.35.0 shipped with, and its two cosmetics, at the owner's request
  ("resolve all of it"): the project's dependencies are the root manifest's AND its workspace packages'
  (`projectDependencies` — review 6 had left it knowingly, review 10 measured what it cost); a component file gives
  every component it exports (`exportedComponents` — "new machinery" in review 10's words: built on what a
  DECLARATION is, so no suffix list); a registry that ends in a table its reader does not see takes a finish's rows
  in a new one; an `n/a` design is asked before the registry. And the fixtures shaped like a provider's key became
  plain fakes (GitHub's push protection had refused 1.35.0's first push for two Stripe-shaped ones — the word FAKE
  in them counted for nothing). What the build taught before any reviewer saw it: (1) the patterns' first drafts
  held three ambiguous tails (`\s*;?\s*$`, a `(.*)$` after a `\s*`, `function\s*\*?` before a `\s+`) — the classes
  reviews 3 and 7 had named; reading one's own new regexes AGAINST that list found them, and the line cap alone
  would not have saved a scan of 500 files (0.7 s a file); (2) a timing fixture one mutant passed at 1.7 s against a
  1.5 s bound is no fixture — it now costs a mutant 2.6 s against 1 s; (3) the guards a pattern "obviously needs"
  (a `!`, a brace list, a drive letter) were all equivalent to "that folder does not exist": deleted, the one that
  is not (`..`) kept.
- **1.35.1 review 1** (one fresh reviewer on the commit above; real kits and real monorepo layouts, the earlier
  rounds' 743 rows and 21 projects on both versions) — no HIGH, nothing read outside the project, no pattern that
  backtracks. MEDIUM, both in the new readers: a `**` pattern spent the "100 manifests" on folders that are no
  packages, silently (the bound counts manifests READ now, and a bound that cut is reported); an arrow component
  was found only when its `=` was the first of its line and its value began there (shadcn's FormField, a typed
  `React.FC<{ onDone: () => void }>`, one Prettier broke over lines — `declaredValue`). LOW: the report of a
  project with 520 component files could never be in sync again, and 500 large ones cost seconds (a budget in
  characters; in sync whenever everything was read); the union of every first-level manifest took a docs site's
  kit for the app's (one level down only when the root is no package of its own); a hostile pattern threw out of
  every registry read or cost 11 s (bounded in characters, segments and folders asked); a BOM, a flow list over
  lines and a quoted key in pnpm-workspace.yaml; seven non-components listed on six kits — `z.lazy(…)`,
  `cache.memo(…)`, `Infinity`, an enum's member, `(1 + 2) * 3`, `class LoginError extends Error`, and `Botão` cut to
  "Bot" (a wrapper is React's own, an alias is of a name the file imports, a `(` is a parameter list's by what
  follows its `)`, a class extends React's, a name is read whole); the 50 names a file was cut at, silently; a
  string holding `<!--` or ` /*`, or a BOM, hid the rest of a file. Cosmetic: a note on the registry's last row
  started a second table. The fix round's own differential on the reviewer's kits: 204 of 218 found (197), two
  PascalCase helper functions listed (7 non-components before — review 2 corrected "none" here), the 14 missed all
  of the kinds the docs name — and two shapes the tighter rules had
  dropped, found by that run before the commit (an arrow in parentheses that is cast, a context's `Provider`).
  Lessons: (1) "100 manifests" was written as "100 folders named" — a bound must count the thing its name says, and
  its fixture must hold what a real tree holds (a package has `src/` and `dist/`); (2) every first draft of a
  reader took the FIRST `=`, the FIRST `(`, any dotted prefix: the precision came from asking what each token IS —
  the same lesson as the registry's reader, relearned in a new file; (3) a list of what a reader misses belongs in
  the user docs in the reader's own words, complete — "wrapped by another function or declared indented" hid five
  more kinds.
- **1.35.1 review 2** (one fresh reviewer on review 1's fix commit, the previous commit as its oracle) — no HIGH,
  no MEDIUM; seven LOW, every one a regression of that fix round, and four cosmetic. The registry's end was told
  by TEXT (the reader's text trimmed, its last line compared with the file's): a hidden copy of the table that
  ended in the visible one's last row passed for it, and its rows were added, unread, on every finish — by
  position now, in the reader's own lines. `packages/**/*` looked inside every package and spent the folders
  listed (a project that had lost nothing told it was cut; with the patterns the other way round, `apps/web`
  unread): `**` does not look inside a package. The bounds review 1 had added dropped a declared pattern without a
  word (the 51st, one past 200 characters or 12 segments): said now, with the manifests read — 0 too, where the
  count had said "only 1". Shapes the commit before had found and the tighter rules lost: a class header over
  lines or with a `>` in its type parameters, a class extending a component class of the file (`classHeader`), an
  alias of a name declared or imported below it (asked once the file is read), a `)` in a default's string,
  `styled<Props>(…)`. A line that starts with `import` and holds no quote (`import Dialog = Radix.Dialog;`,
  `import.meta…`) took the lines below it for its clause. The stylesheet's quote rule, reused for scripts, let an
  apostrophe of JSX text quote the rest of its line — a real `/*` after it opened nothing, and a comment's lines
  were read as code. A file of declarations whose annotation never closes read sixty lines for each (2 s for
  4 MB): the file's length in all. Cosmetic: the `component-files` message said "the first N files" when the bound
  was one file's names; the notes said "lists none" of a run that listed two helpers; Lerna's default applied
  beside declared workspaces; a flow list cut at a `]` inside a name. On the reviewer's 24 registry endings: 24
  right (21); on its three new kits: 144 of 152 found (142), no non-component listed. Lessons: (1) a fix round is
  where regressions come from — every LOW here was one — and the differential that would have caught them existed
  (the reviewer's edge shapes on both commits) but was run on the KITS alone: replay the previous round's edge
  list against the commit before, not only real files; (2) "is this line the reader's last?" is a question of
  POSITION — answering it by comparing texts is answering another question, and a copy of the text passes; (3) a
  bound that drops an input in silence is the defect of a bound that cuts in silence: whatever the project
  DECLARED and went unread is said; (4) a rule borrowed from another language's reader (a stylesheet's quotes for a
  script) brings that language's assumptions: an option that switches a reader on must say whose rules it reads by.
- **1.35.2** (2026-11-14) — the owner, on 1.35.1's report of what it still did not read: "can you resolve these
  limits?". Six of nine went entirely — a brace list, rush.json, a workspace package's own workspaces, a decorator
  on the class's line, a part hung on a component, an indented export — and three could only be narrowed, because
  the reader reads one file's text with no parser and no types: a component wrapped by another function is told
  by what the wrapped function SHOWS (JSX, a dynamic import, a known component as its argument), a class with an
  imported base by what it does (`render` and JSX), a PascalCase helper by what the file does with it (calls it)
  or what it takes (a component; three parameters). The step that made them possible was not a rule but a view:
  the reader went from a declaration's LINE to a statement's EXTENT, and the extent is taken from the formatting
  (the next line at the margin that starts a statement), never by matching brackets — the one robust property a
  text reader has. What the build taught: (1) the first line-start rule for a call ("its line ends with `)` or
  `;`") was four alternatives and still took `Total(USD)` for one; asking what FOLLOWS the `)` — and what the line
  above ends with — is one question each; (2) a template literal needs state, and state can break (one stray
  backtick): the fallback is the old behaviour for the whole file, decided at its end, not a guess per line; (3)
  a fixture named after a helper file (`helpers.tsx`) was never read at all — the first run passed with every
  helper rule untested: a fixture's own file must be one the scan reads, and the mutation pass is what said so.
- **1.35.2 review 1** (one fresh reviewer on the feature commit, v1.35.1 as its oracle: 15 kits of real-shaped files,
  85 rule cases, 9 monorepo layouts, 150,000 fuzz inputs, 89 mutations of its own) — 3 HIGH, 6 MEDIUM, 8 LOW, 4
  cosmetic; nothing 1.35.1 found was lost (0 of 222) and nothing was read outside the project. All three HIGH sat
  in the one piece written last and tested least — the parts reader: a nested `Object.assign(` inside the literal
  re-read the statement it stood in, forever (the report, the seed and a +ui feature's finish threw); every part
  under every exported name was a product with no bound (a 56K file killed the process: out of memory is not
  caught); every entry walked the whole statement again (12 s a 256K file). MEDIUM: the one-argument rule took any
  imported word for a component (`createContext(DefaultTheme)`, `Object.freeze(IconSizes)`), the JSX rule any call
  that holds JSX (a table's column, a router), the template state was computed AFTER the comment reader (a
  template holding ` // ` lost its closing backtick — the docs-site case the release was for), the literal was
  read for 60 lines and the cut never said, pnpm's list past its 500th line had lost the bound that used to say it,
  a destructuring that never closes re-read 200 lines a line. What the fix round did, each by a property: a call
  is a component by the FUNCTION it is given; a single call's argument must be declared, a curried one's may be
  imported (`withStyles(…)(TableCell)` — the reviewer's own kits said the first fix was too strict: 3 of 17 lost);
  an entry is asked of its own text; the parts are a Set, the names capped while they are made; the lines are read
  with the template state, and read again without it when it breaks; a helper is one the file calls AND that
  renders nothing. On the reviewer's kits: 213 of 222 found (202 at the feature commit, 157 in 1.35.1), none lost,
  no non-component gained (4); its 85 rule cases: 22 still differ from what a person lists, each of a kind the
  docs name. Lessons: (1) the piece added last got one happy-path fixture a rule and no hostile one — every new
  loop needs its product written down (what × what) before it ships, and a recursion its second level; (2) an
  unbounded intermediate is a bound's absence wherever the final list is capped: cap where the thing is MADE; (3)
  a rule that accepts "a name the file imports" accepts every word of every import — an import says a name
  exists, never what it is; (4) two readers of one text must share its state: the comment reader and the template
  reader each assumed the other had run; (5) the first fix of a finding is as likely too strict as the bug was too
  loose — the oracle is the reviewer's kits on BOTH sides of the fix, and they were run before the commit.
- **1.35.2 review 2** (one fresh reviewer on review 1's fix commit; three versions side by side — v1.35.1, the
  feature commit, the fix — and 15,000 real files found on the machine) — no HIGH; nothing throws, nothing is
  super-linear, nothing outside the project is read, stylesheets read exactly as before (on random lines — NOT the
  1.76 M it claimed: review 3 found its generator repeats after 10,466 draws). 2
  MEDIUM, both the PRICE of review 1's fixes, both against the feature commit (v1.35.1 read neither): "the function
  it is given" was asked only of the first thing after the first `(` — MobX's own `inject("store")(observer(() =>
  …))`, a function after another argument, one after a curried list that closes on a later line were no longer
  components; and `Object.assign(Root, { displayName })` — no capitalised key — returned before it recorded what
  the const stands on. 9 LOW: a block comment that opens on the line a template opens on and closes inside it
  never ended (the one new loss against v1.35.1); the script-only `//` rule kept a comment when an apostrophe of
  JSX text paired with one in the comment; the `render` pattern, tightened against calls, missed a brace below, a
  list over lines, a class on one line; any margin line that was no closer started a statement (text under a
  `<pre>` ended a class's extent); the literal of an `Object.assign` was its FIRST `{`; a HOC's argument on a line
  of its own; parts of a component exported through an alias; an alias of an import passed for a component of the
  file. The round, each by a property again: the arguments of the call's last list, each asked whether it is a
  function or a call given one (`givenArgs`, and an asker of each that review 3 removed); `own` — a component by a
  declaration of the file —
  beside `declared`; `renders` asks what FOLLOWS the `)`; a statement starts at a non-name line only when the line
  above ended one; an apostrophe after a letter opens no string. The notes' and the commit's claim that the 22
  differing rule cases were "each of a kind the docs name" was wrong for seven — the two lists in the user docs
  are now written FROM the reviewer's cases, both ways (missed, and taken for one). Lessons: (1) a rule made
  stricter in a fix round is tested only by the case that prompted it — write the five nearest REAL shapes it must
  still take before tightening (the MobX pattern was one line away from the fixture); (2) an early `return` for
  "this is none" skips whatever bookkeeping stands below it: record first, decide after; (3) two state machines
  over one text (comments, templates) must agree at the line where both change state — fix one and re-ask the
  other; (4) a pattern that matched a call (`render(`) is not fixed by anchoring what follows on its line: ask the
  question ("what follows its `)`") with the tool that answers it (the paren matcher), over lines too; (5) a
  sentence about one's own results ("each of a kind the docs name") is a claim like any other: count before
  writing it.
- **1.35.2 review 3** (one fresh reviewer on review 2's fix commit alone — the short round the owner chose; four
  versions side by side, a grammar of 4,200 call shapes, 15,168 real files of the machine's package caches) — no
  HIGH; 4 MEDIUM, 12 LOW, 5 cosmetic. Three of the MEDIUM were once more the PRICE of the round before: asked
  whether an argument IS a function, the call rule cut the arguments apart — a comma in a wrapper's type arguments
  (`observer(forwardRef<El, Props>(…))`), a generic arrow, a wrapper whose own list goes on below were no longer
  components; `Object.assign(hoc(Root, "Name"), { parts })` decided before it recorded, and lost a menu with its
  twelve parts (a real kit's); and `renders`, following a list left open, read the sixty lines below once per
  `render(` of a line (8.8 s a scan of hostile files). LOW: an alias of a member took its owner's parts
  (`TabList.List`); a `render` field that is no function literal; a ternary's `render(…)`; the literal of an
  `Object.assign` had to be its last argument; parts hung on a root AND on its alias; a line of blanks joined two
  statements; a component exported twice spent the parts' room of the next one, silently. The round is NOT a
  fourth refinement of "the function it is given": the call rule went back to the feature commit's — a call whose
  statement holds JSX, which lost nothing in any corpus — MINUS the one shape that had prompted review 1 (what the
  call is given first is an object, a list or an element); `assigned` records, then decides; `renders` follows a
  line's open lists once. Left, and said in the user docs: a quote right after a word (minified `return'…'`),
  margin text that begins with a letter, a HOC given a component and another argument (`contextConnect(Root,
  "Name")`: 41 components of one kit, read by no version). The second review's "1.76 M random lines" was wrong — its
  generator repeated after 10,466 draws. Lessons: (1) three rounds each fixed the last one's cases and broke their
  neighbours — when a refined rule keeps losing real shapes, stop refining: go back to the older rule that lost
  nothing and SUBTRACT the one shape that was wrong; (2) the oracle for "lost nothing" is every earlier version run
  side by side on a grammar and on real files, kept as a tool and re-run after each edit — the fixtures hold only
  what someone thought of; (3) a random test is as wide as its generator's period: count the distinct draws before
  quoting a number; (4) a cost fix needs a hostile input for EACH loop it bounds (a line of `render(`, and a column
  of them); (5) a guard no input can reach is not kept "to be safe" — it is deleted, or its input is found (an
  expression's `{` at the margin of a `<pre>` was one).
- **1.35.2 review 4** (one fresh reviewer on review 3's fix commit alone — the short round the owner chose again; the
  first reviewer was stopped by a usage limit and a second one finished from its files; five versions side by side,
  32,122 real files) — 2 HIGH, 0 MEDIUM, 12 LOW, 4 cosmetic; no real shape lost. Both HIGH were costs the round
  before had MADE, each by a simplification: `renders`, rewritten to follow a line's open lists once, read the blank
  lines below the closing `)` to the statement's end once for EVERY `render(` above it (an unbounded walk the old
  code had stopped at once — 318 s a scan of hostile files); and the main loop's skip of a line that starts inside
  a template, removed by the mutation pass as "no observable effect" — its effect was a COST: such a line, asked as
  a statement, has the file for its extent (250 s). LOW: the call rule asked the declaration's line for the LAST
  list, so a curried call over lines was judged by its first (`withStyles({ … })((props) => …)` lost,
  `createFileRoute("/a")({ component })` listed) — `curriedFirst` reads a later `)(` line at the statement's own
  margin; an `Object.assign` around no call made a component of its parts (`{}`, `new Emitter()`); a member first
  stood on its owner's parts (and, checked against d83914e, a root cast in parentheses or a generic arrow first —
  `Object.assign(<T,>(p) => …, { Option })`, whose `<T,>` comma cut the argument — had lost theirs); a type's `<` counted inside a function given (`/a<b/`); a generic arrow as a `render`
  field or on a line of its own; a local `const render` read as a field; the parts' room spent by keys hung on a root
  AND its alias, and by statics that are no component (the "declared" filter the round before had removed as
  answering no input — it answered the room); five mutants of the reviewer no fixture caught. Left, and said: an
  element first (`createSvgIcon(<path />, "Home")`), an object first with a function after it, the calls it named
  that only look like a component's (three of its five are the docs' examples), margin text after a line that ends with `;` or `}` (a line of blanks between
  them passes that on: it ends and starts nothing). Corrected: the round before's
  grammar ("none lost") and differential fuzz were measured against 78860d5, not the parent — against fd971cc,
  420 of 4,200 shapes were lost (an object first, then a function: the subtraction's price, said in the docs); and
  the docs' "called after a comparison or another operator" had been stale since the feature commit. Lessons:
  (1) a mutation pass sees only what the tests assert — a piece "with no observable effect" may be a COST guard: before
  deleting one, time the hostile inputs without it; (2) a bound moved into a helper must keep its every caller
  bounded — the walk below the `)` lost its bound when the line it started from changed; (3) compare a fix round
  with its PARENT first, and say which version a number is against.
- **1.35.3** (the owner's "resolve all of that" after 1.35.2's report: what it left to add by hand and what it listed
  knowingly). Four releases had refined what ONE file's text tells; what was left is what it cannot tell — so the scan
  asks the project's other files (What the project's files settle): a component is rendered, a helper is called. Beside
  it: a call is one only when it is given a function (an element handed over, a promise of a module are none), two
  parts on one line, CommonJS, a component folder's barrel, a regex's backtick, a string after `return`, a workspace
  `!negation`, two levels down when nothing is declared. What the first draft got wrong, found before the commit:
  candidates × parts asked once per exported name (8 million joins for a file of 2,090 names and 4,000 statics: 4.9 s —
  `looseOf` settles an owner once, and a literal is no candidate); barrels counted against the component files (a kit of
  `index.ts` + component per folder would have hit the bound at half its size); a `.ts` file read when only candidates
  were asked (it can never render: an Angular monorepo would have read thousands for nothing); `module.exports = { … }`
  cut at a value's first `}` (the export-list reader never expects braces — now its literal is read by depth); a
  workspace file that names nothing read as "declares none" (rush.json with no project, a pnpm list that never closes).
  The mutation list was written before the fixtures: 93 mutants, 85 caught at first; of the eight, three were code no
  input reaches — deleted (a `type` import's skip: what only a type names is neither rendered nor called; `pointsTo`'s
  `/index`, which a file under the folder already is; one of two `full` guards, each enough alone) — and five wanted a
  fixture (an arrow with and without JSX the project calls, an `exports.X` alone, the parts cost in a project of its
  own, a page that names nothing asked: never parsed). 90 of 90 on the last pass.
- **1.35.3 review 1** (one fresh reviewer on the feature commit; 17 public repositories cloned shallow — 106,069 files,
  8,847 names compared with 6571453 —, 25 rule cases, 9 workspace layouts, 7 cost probes, 44 mutants) — 1 HIGH, 6
  MEDIUM, 10 LOW, 2 cosmetic, all but four regressions. HIGH: a workspace package's `!negations` had no bound and a
  matcher was built for every folder (103 s for ten manifests) — now each alternative is one RegExp compiled once,
  200 of them, said past it. MEDIUM: React 19 contexts listed (rendered as their own provider, read with `use`: now
  `createContext` is never a name to settle); six real components of a kit dropped (`withContext(Ark.X, …, { …
  <Y /> })`: a component's name or a string first keeps the verdict, and a method's shorthand is a function given);
  a weak root dropped by its own `Provider` part's tag; another package's module settled the project's names (its
  segments matched anywhere: now an alias goes from the project's roots, a bare or scoped module only to a workspace
  package's manifest `name`); `usage-files` put three of the repositories out of sync for good (now the search ends
  without a word, as the global stylesheets' — the precedent of review 5 of 1.35.0); one name exported by a thousand
  kits walked their list for each tag (`resolve` is memoised). LOW: a re-export took the row's path (names before
  candidates), a component's static read through a namespace and a story's call dropped weak components, the guess
  read a library's `examples/` and a `web/` app's `fixtures/` (a published root is a package of its own; the second
  level only when the first holds none), negations ignored the order npm reads them in, the barrels' bound count, the
  docs' lists. Beside them, found re-running the reviewer's tools: a top-level alias of an import asked for nothing
  but cost (no longer asked), a statement's JSX asked once an entry (cached). (Said here, at first, that "the corpus
  ratio fell from ×2.5–×8.7 to ×1.0–×4.0": one run on a quieter machine — review 2 measured ×1 to ×9 against 1.35.2 and
  no fall against the feature commit; the user docs give the measured range.) After the fixes, on the same corpus: no name a real component lost, 0 `usage-files`, Chakra's 6
  drops and Mantine's 14 contexts gone; the reviewer's rules 0 failing. Lessons: (1) a module's NAME is no path —
  resolve it the way a bundler would (roots, workspace names) or not at all; (2) evidence searched for ends without a
  word, as a candidate search does — a bound said there makes every big project a false alarm; (3) when a new rule
  (a function given) drops real shapes, find what the shapes share (a component or a tag first, a method) before
  narrowing the rule's reach.
- **1.35.3 review 2** (the short round the owner chose: one fresh reviewer on review 1's fix commit, three trees side
  by side — d6e00d1, 69a2765, 6571453 —, the 17 repositories again, 60 mutants) — 1 HIGH, 2 MEDIUM, 8 LOW, 3
  cosmetic. HIGH: review 1's own fix — the negations compiled into one RegExp over the path — backtracked exponentially
  (13.8 s for one line of `**` and two-`*` names; the feature's dynamic program was linear): the segments are compiled
  once and matched by `globMatch` again. MEDIUM: the widened "a package of its own" switched off the first guessed
  level for any `npm init` root (a `name` and a `main`): the library's signs now block the second level alone; a weak
  root rendered as its own `<X.Provider>` part in its own file, the part hung on the root's local name, was still taken
  for a context (`exportsOf` asked too). LOW: aliases of a tsconfig's `paths` (`~/*` → `./app/*`, `@components/*`) and
  its base URL were guessed, never read (then read, `jsonPlain` — review 3 took the reading out again); the root
  package's keys began with a `/`; workspace
  names lost behind 520 manifests (`packageOf`, lazy); a page thirty roots deep cost ×2.8 (`pointsTo` by prefixes); `new`
  had been dropped from the literals as "no input reaches it" — it was a cost guard (an instance asked read the pages:
  restored, with a fixture); the docs' ratio claim; pnpm negations read in npm's order (now put last); 16 mutants of the
  reviewer survived — fixtures for each that is reachable. Found while fixing: a candidate part hung on what an alias
  stands on was never one (the names' expansion followed `stands`, the candidates' did not); and, re-running the
  corpus, a regression of this round's own — a folder's default import written `"../"` was looked up by its TEXT's last
  segment (none) instead of where it resolves: gutenberg's block title component, rendered in its own test, was lost. Lessons: (1) a fix that
  compiles a matcher must keep the matcher's complexity — "compile once" is no licence to change the algorithm;
  (2) widening a rule to cover one layout (`examples/`) must be checked against the layouts the old rule served
  (`npm init`'s root); (3) "no input reaches it" is a mutation's verdict on the TESTS — a cost guard needs a timed
  fixture before it is deleted.
- **1.35.3 review 3** (the third short round: one fresh reviewer on b86a52f; four trees side by side; `globMatch`
  against a reference matcher on 200,018 cases, no mismatch; the corpus identical to d6e00d1's) — 1 HIGH, 2 MEDIUM,
  7 LOW, 4 cosmetic, each HIGH and MEDIUM made by review 2's fixes. HIGH: the candidates' new `stands` chain asked a part
  no name could take (`P_1`, a lower-case alias) once a name — never stopped by the 500, 13.6 s for one file: a part's
  key and a name that can take one are one-segment names (`RE_NAME_SEGMENT`) before anything is asked. MEDIUM: the
  tsconfig `paths` reading review 2 added took a `..` target as text (chakra's own `apps/www` configs) and read every
  `tsconfig*.json` with no bound — together with three LOWs on its semantics (a `*` catch-all, two configs in a folder;
  and, noted, the longest prefix), the reading was taken out, not refined: the guess from the roots, `src/` and `app/`
  covers React Router's `~/*` → `./app/*`, and what it cannot see is said. LOW: `packageOf` scanned every manifest's
  folder for each miss and shared one budget with the walk's reads (an index, two budgets); a provider root matched by
  an exported name could be another binding (the local one only); pnpm's negations moved last let Lerna's default in;
  15 of the reviewer's 50 mutants survived — fixtures for the reachable ones (a `**` across two folders, a `*` name that
  must not match, `module` / `exports`, two aliases away, a jsconfig.json root). Found replaying the reviewer's probes
  on the fix: `app/`, guessed for every alias, took a file a `@/*` → `./src/*` config never points to — narrowed to a
  `~/` alias's (review 4 restored it). Lesson, the series' own: a LOW of review
  2 answered with a new mechanism (the configs) brought review 3's two MEDIUMs — a fix's reach must stay the finding's;
  when the cheap answer (`app/` in the guess) covers the case found, the larger one waits for a release of its own.
- **1.35.3 review 4** (the fourth short round: one fresh reviewer on 7ab042a; the corpus identical to b86a52f's, report
  time ×0.76 to ×1.08; the HIGH's file 1,634 → 16 ms) — no HIGH, no MEDIUM; 4 LOW, 1 cosmetic, fixed without a round of
  their own, as agreed. LOW: a package name's folder hung on which import asked first — a miss (`next/link`) walked to
  `examples/a`, named `@acme/ui` too, before `packages/ui` was asked, and only the first of shadcn's seven
  `@workspace/ui` templates was a package: every folder named like the name's last segment is one of its, and wins over
  any other (already so in review 2's tree); each miss walked the manifests again and read its folder name's group again
  (×4 to ×8 isolated, tens of ms on the corpus's largest): a cursor, a group once; review 3's narrowing of `app/` to `~/`
  lost shadcn's React Router monorepo (`@/*` → `./app/*`, a layout its CLI writes) to spare a match that needs the same
  file under `app/` and `src/` — restored, and "the guess that lost nothing" said of the corpus alone; test gaps — a bare
  path into `app/`, a folder in capitals. Cosmetic: the project's own folder is a root with no manifest. Survivors kept,
  each a bound of reads linear in what the walk already met: the folder-name group's own budget (with the roots kept
  bounded: a group of 5,000 costs ×1.5 to ×1.8, no fixture tells it from load) and the walk's restart and the group read
  at each ask (tens of ms at the corpus's scale). Lesson: a narrowing is a change of rule like any other — review 3's
  was checked against the probe that prompted it and the fixtures, never against the layouts the wider rule served;
  ask "who writes this alias?" of the starters (shadcn's, Laravel's, T3's) before taking a shape out.
- **1.35.4** (the owner's "resolve all of that" after 1.35.3's report: the rows it left by hand, and its cost). Five
  items, each designed and PROTOTYPED by its own agent on a copy of 50a4fae — its rules checked against the tool it
  imitates (TypeScript 5.8's moduleNameResolver / commandLineParser, Node's esm/resolve.js and require.resolve on 15
  shapes, micromark-extension-mdxjs-esm, Vue's compiler-sfc, React's and Vue's jsx-runtime sources), its mutation list
  written before its fixtures (42, 43, 58, 34 and 40 mutants; every one caught but equivalents and timed cost guards) —
  and a sixth that rebuilt the 19-repository corpus and profiled the cost: 70 to 90% of the settle step was the OPEN
  of each file (Windows Defender's on-access scan, ~0.65 ms; stat 47 µs; no read API helps), which is why the read-ahead
  exists. The five were merged with `git merge-file` one at a time (the exports agent's repo copy was a variant it had
  rejected — ×2 to ×2.4 — and was rewritten from its design instead); where two met, the wider rule won (the default
  import's base of EVERY key covers the map's keys and the config's). Corpus against 1.35.3: 15 lists identical, chakra
  +261, ant-design −1 (a context), Laravel's Vue starter +1, shadcn-svelte +3 (a namespace's parts, listed knowingly);
  report time ×0.3 to ×0.5 on the big repositories, small `.svelte` / `.vue` kits a few hundred ms more. Integration
  catches: the export list's lookahead re-scanned its growing text for each new line and its lines were read again by
  the next `export {` (quadratic on a file of lists that never close) — a list's lines are now its entries, read once;
  the prototypes' code came without the file's comments, written back from the designs. Rejected after measuring:
  reading every `.ts` file for candidates (×5 to ×8 on Vue / Svelte kits, no row), a guess of SvelteKit's `$lib` from
  markup (+75 part rows — the config reader came to follow it anyway, through `.svelte-kit/tsconfig.json`: review 1),
  a guard on the follow by the search's names (lost a real lower-case alias), a cross-call cache (breaks the one-call
  read-cache rule).
- **1.35.4 review 1** (eight fresh reviewers, one dimension each — the five items, the read-ahead, a corpus of 19 + 13
  more public repositories, the docs and tests — and a skeptic for each HIGH / MEDIUM) — no HIGH; 7 MEDIUM, every one
  made by this release: costs no bound bounded — a config's long targets resolved again for each import (AL-1) and its
  chain's tables rebuilt for each governing folder (AL-2), a map target's `*`s × a long subpath (EXP-1), stars of no
  project's module walked free in every closure (RX-1) and an answer copied once a link into every importing folder
  (RX-2), a line of block openers with no `>` (MK-2) —, and shadcn-svelte's barrels listing 75 bare parts on a
  checkout that ran `svelte-kit sync` (CORPUS-1: the corpus's fresh clones have no `.svelte-kit`). The fixes: DS_PATH_CHARS,
  a table once a file, keys once a folder and a spec, a step for every star and link, answers once a [path, name],
  `tagEnd`, and a barrel's other names (`also`). Two MEDIUMs the skeptics made LOW (a self-closing `<template>`, a
  line's trailing blanks trimmed once a call) and the LOWs worth a line were fixed too — a default import's base
  paired with its own key, an object's `default` ending a target list, a list's closing line read on, the workers'
  env without NODE_OPTIONS (a preload reached them) —; the rest is said (a root entry other than `src/index`, a cast in a factory's argument, the follow's over-approximation in
  star targets, the markup cost of an MDX docs site). Two absolute times of earlier releases that miss under a parallel
  run became ratios. Lesson, again: the corpus measures what a fresh clone holds — a generated file a developer's
  checkout always has (`.svelte-kit/`, `.next/types`) changes what a reader of configs sees.
- **1.35.4 review 2** (the short round the owner chose: four fresh reviewers on the fix commit 0a1782d, review 1's repro
  tools replayed against it — every review-1 finding fixed — and a skeptic for each HIGH / MEDIUM) — no HIGH; 3 MEDIUM,
  two made by review 1's fixes: the default import's pairing walked each base's files once a KEY (×26 on 400 packages of
  one name), and the barrel rule asked whether a sibling name was a row ANYWHERE (another `Pane` dropped
  `ResizablePane`; in shadcn-svelte's order the bare name won); the third older — the keys a config gives, bounded a
  spec, not a scan (memory out on 9.5 MB of pages). Fixed: `at.bases`, a sibling's row asked to be the binding's
  own — the barrel's, or its source file's: the barrel's folder, the first answer, still took a `Panel` below it; since
  replaced by the binding's source file, review 3 (`sourceRow` since review 4) — + the `as` names first, DS_ALIAS_CHARS. LOWs fixed too: an object ends a target list only when every branch up to `default` resolves, a
  `/>` closes a tag only outside quotes (the line's quotes followed, each closed by its own mark: counting each mark
  apart, the first answer, missed `"it's"`), an `extends` and every target measured against DS_PATH_CHARS, a binding's
  names kept as one group and none asked past 16, the read-ahead test proving again that the CLI and the server
  start workers, and the remaining absolute times of the design-system tests, coarse hang ceilings aside, made ratios. Lesson: a fix that pairs or
  groups (review 1's per-key loop, its "a row already" test) is a new rule — ask it of the place it replaces AND of
  the project around it (another component of the same name, a hundred packages of one name).
- **1.35.4 review 3** (the third short round the owner chose: three fresh reviewers on f5bb14d, review 2's tools replayed
  — every review-2 finding fixed —, a skeptic for each HIGH / MEDIUM) — no HIGH; 2 MEDIUM: the map's keys were not in a
  scan's budget as the configs' were (one 16 KB manifest ran a scan out of memory — older, from the feature), and the
  barrel rule asked whether the row that WON a sibling name was the binding's (two installs, an alias import, an app's
  own `Table.svelte` listed the bare parts again — made by review 2's fix). Fixed: the map's keys budgeted
  (`given`), the rule asked of the binding's source (`sourceRow`, as review 4 named it). LOWs: the `as` preference within a binding
  (it moved rows between files), `reachTargets` three ways (a nested object matching nothing gave a list's next entry),
  a tag's end from the tag itself, outside quotes and `{…}`, a review-7 twin that shared the cost it was to catch,
  thin ratio slacks under the pre-push run, stale test wording. Lesson: when a rule keeps needing a narrower test of
  "is this the same thing" (a row anywhere, in the folder, the winner's), ask the thing itself — here the binding's
  source file — rather than what another lookup happened to keep.
- **1.35.4 review 4** (the fourth short round: three fresh reviewers on e57872b, review 3's tools replayed — every
  review-3 finding fixed —, a skeptic for each HIGH / MEDIUM) — no HIGH, no MEDIUM: the release bar met. LOWs fixed
  without a round: a component file that lost its own name to another made its binding's kit names none (generically
  named parts, `popover/root.tsx` beside `dialog/root.tsx` — made by review 3's rule: the source now holds its row or is
  none, `ownRow`), `reachTargets` three ways for lists too and past a `default` that may give nothing (Node's code), the
  `=>` rule of `tagEnd` dropped (no tag reached it), fixtures for a component folder's `index` (relative, `@/…`), the
  rendered-group cost check made eight files (the cap's absence had fallen under its slack), the CHANGELOG's count
  (nine), the user reference's barrel rule; the barrel taken through another barrel is said. The corpus (32 repos and
  the synced shadcn-svelte) lists the same rows as review 3's fix. Lesson: a rule that asks "is this X?" must ask it
  of the case where X lost to another (a file shadowed by a namesake) — the corpus had one such source, with no row lost.
- **1.37** (the owner's "doctor warns when a Reuse / Extend row names a deprecated component" — item 2(a) of the 1.37 "UI
  checks" list, cut by its critique and the integration critique to the marker and the check) — `_Deprecated: use X_`
  read beside `_From:_`, past the cap; doctor `ui-deprecated`, a warn with no stamp and no gate (folding it into
  `ui-design-system` would have entered that check's gate / legacy / settled states and `designSaveCheck`). Kept for
  1.38: the files that still render a deprecated component (the project scan — it needs one shared read pass; a second
  read of every script cost 25–90× the report). The settled reader was touched in one place (the marker's read and cut,
  and the path / variants cells read after the cut): every earlier `15-quality-design-system*` test passed unchanged.
  The mutation list came before the fixtures: 41 of 41 on the reader, 20 of 20 on the check (one — the silence's word
  bound — only after a fixture with the replacement past the notes' twentieth word).
- **1.37.0 review 1** (the registry and the brief: 2 MEDIUM, 6 LOW) — RB-1 (MEDIUM): ui-deprecated was silenced by any word of
  the notes whose KEY was the replacement's, and component names are common nouns: `| Reuse | Modal | the delete-confirmation
  dialog |` hid a deprecated reuse. The notes name it now AS A COMPONENT, in the letters the registry writes it with
  (`dsLetters`). The owner's rule read "in the registry's letter case, or inside a code span / as a JSX tag"; the narrower
  reading was taken — the letters keep their case inside a code span or a tag too (every one of the owner's examples is in
  the registry's case, and `why` is dsCell'd: a span's outer backtick and a tag's `<` are gone, so a code-only rule would
  have needed the raw cell). RB-3: `_Deprecated — use X_`, `_Deprecated. Use X._`, `_Deprecated, use X_`, `_Deprecated in
  favour of X_`, `_Deprecated (v3): use X_` were plain notes with no feedback; the marker is the emphasis whose first word
  is Deprecated whatever follows it that is no letter (a digit continues the word — the narrower reading), one regex, and
  the label-alone form is read by a property (no letter or digit in the emphasis after the word), not a `:_` case; the
  notes show the text as written, so the shown bound counts from the word (`: ` included — the 1.37 fixture moved by two
  characters). RB-6: the marker was found in the cell's `toLowerCase()` and read in the cell — every `İ` before it shifted
  the index; the regex reads the cell itself. RB-7: a later row of a name listed twice was skipped before its marker was
  read; deprecated is a property of the name, and the entry's notes carry the later row's marker so the brief agrees with
  doctor. RB-8: doctor warned of a component past the 500-row cap that the brief quoted without its marker — a subtraction
  from doctor: the marker is read on the rows read in full only. RB-5: the replacement was a pair across a sentence (`use
  Card. Header…` named CardHeader), a fragment of a package (`@mui/x-data-grid-pro` named DataGrid) or a retired component
  (`use Popup`); pairs only across blanks, a hyphenated / slashed / dotted / snake name whole (`data-grid` still names
  DataGrid; a path no longer names its file's component), never a deprecated one. RB-4 (prose): the marker retires the
  whole component — the user docs say to write a retired variant or prop without it. The reviewer's scripts replayed on
  457d3da and on the fix: every difference is one of the findings (the scaffold, old-block and complete-feature scripts
  identical). The mutation list came before the fixtures: 34 mutants (19 reader, 7 replacement, 4 silence, 4 brief), 33
  killed (the brief's reuse-section guard by 15-quality's R review 2 fixture); the survivor — `dsLetters`' NFD
  normalization (no case asked accents to fold) — deleted as dead.
- **1.37** (the base the UI checks read through, before them) — `viewLines`, rawValuesOf's loop head as a GENERATOR (CRIT_1
  must-fix 3: over a list, the 200-value early exit still read every line), and styleTokens' walker handing its structure
  to an observer (block / statement / close events — CRIT_1 must-fix 2: no second prelude tracker). Both proved
  behaviour-preserving on a corpus of real files: the raw values of 5,256 view files (39,700 values) and the tokens of 2,493
  stylesheets (27,663) byte-identical against 1.36, with and without an observer; the UI checks' chain added the
  statements' `from` and three allocation-free fast paths with the walker's 206,379 events unchanged (one sha1). Cost:
  rawValuesOf alone 1.03–1.28× the parent on a 20,000-line sheet (within the 1.5× bound); the walker without an observer
  0.94×. Mutation passes: 10 of 10 (one equivalent in output — the pre-existing blank-line skip, a cost guard: 6× on
  20,000 blank lines) and 14 of 14.

### UI checks
- **1.37** (item 1 of the owner's 1.37 "UI checks" list: a static scan for what is wrong whatever the taste, after four
  public design-skill collections — Vercel's Web Interface Guidelines for the rules) — designed with eleven rules; the
  critique (CRIT_1) cut five on real shapes and the integration critique (CRIT_X) moved the project-level read to 1.38:
  `autoplay-unmuted` (browsers refuse unmuted autoplay, so 1.4.2 cannot fail) and `img-no-size` (CSS-module and styled
  sizing are invisible to a line reader; Lighthouse measures the layout shift), `motion-layout` and
  the `motion` raw kind (they need item 2's raw-value redesign), `no-reduced-motion` and the `_UI checks off:_` marker (a
  project fact — one shared project pass, 1.38), the `addEventListener` paste form. `transition-all` stays at `report`:
  shadcn's own Button / Switch / Sidebar ship it. The tag reader resumes past the previous tag's end or a failed read's
  horizon — the design's re-scan from the next `<` measured 1,230× plain JSX; ten hostile 256K inputs now run at
  0.07–1.5× it (bound 3×), the sheet of braces from ~5–17× to ~1.5× with the walker's three fast paths. The focus facts
  read ALL the project's stylesheets, and only when a candidate exists (CRIT_1 must-fix 4: the name-ranked token
  candidates miss a `focus.css`). A real-file survey before release (4,612 view files, 13 roots, tests and stories out):
  img-no-alt 11 and zoom-disabled 2, all real; outline-removed 0 of 99 candidates (each root holding one also holds focus
  styles); paste-blocked 0; click-no-keyboard 50 unique, 45 real and 5 debatable (backdrops that wrap their dialog, a
  trigger wrapper whose child is the control, a div wrapping its `<label>`) — left to the review. `res.designSystem.uiChecks`
  only when it has findings: the 1.35 key shape an assertion pins. Mutation passes: 126 of 126 on `uiChecksOf` (three dead
  branches deleted, eleven fixtures added that only one rule answers), 41 of 41 on the report / finish / CLI; one survivor
  kept by design, the `RE_MIXIN` fast path — a cost guard alone (+45 % on the sheet of braces, under the bound).
- **1.37.0 review 1** (four reviewers — the shapes on ten public UI repositories, the engine's cost and bounds, the registry
  and the brief, the docs; this area's fix round) — E1 (HIGH): the focus pass at its bound (1,000 sheets / 4 MB) made the
  feature report 8.2× slower on 3,000 CSS modules — and at the bound it judges nothing. Now asked for an UNSILENCED
  candidate alone (a silenced one is counted silenced whatever the pass says), a sheet parsed only when its text names
  `focus` (a cost guard alone: the pass 18–30 ms with it, 35–98 ms without), each sheet read whole within the budget, and
  the bounds MEASURED down until the report with the pass at either bound is within 2× the same report with no candidate
  (interleaved fresh processes, the median of 3 warm calls): 32 sheets → 1.5–1.6× (finish's part 1.5×), 128K characters →
  1.44× on modules that all name `:focus` (256K measured 1.8–2.15× there), Angular's 900 components 2.1× → 1.16×; a ratio
  test owns it (1.1–1.3×; 4.4× on the parent). The open is the cost (~1 ms a file where an antivirus scans each one), not
  the parse. E2 + D2: "every read is bounded and says what it dropped" was false — a line cut at 2,000 carried its open
  quote 30 lines down (an inline data-URI logo hid the `<img>` below it; minified HTML judged an `<img>` on the attributes
  before its cut alt), 200 report-level findings hid a file's real ones (`total` 200), a view file's 256K read and a
  project sheet's 256K head cut silently (the last a false outline warning): one limit code a bound, with its count and
  first file, finish carrying them; the hostile-input guards (100 attributes, 64 nested blocks) left unnamed. S1 + D1:
  click-no-keyboard warned on Laravel's starter kits — Alpine's `.outside`, a wrapper whose slot holds the button, a
  backdrop's empty overlay layer — and a role or a key handler alone silenced it (the legend said "a role, a tabindex
  and a key handler"): the target modifiers read like `.self`, a candidate judged by its BODY (clickBodies, inside the tag
  reader: each character once, four hostile click inputs within 3×), reachability by focusability (ARIA's composite items
  reach the keyboard through their container). S2 `v-bind="$attrs"` / `x-bind="obj"` spreads (the design's dropped
  fixture). S3 what draws nothing decided BY VALUE (Bootstrap's `outline: none; box-shadow: none` override, `focus:ring-0`
  were focus styles excusing the project's every removal); S4 ONE focus-variant predicate (Headless UI's `data-[focus]`,
  Tailwind 4's `has-focus-visible`). LOWs by subtraction or one line: S5 a trailing marker silences its line alone, S6 a
  paste handler that hands its event on is not followed, S7 a titled `<img>` is named, S9 `main:focus` / `[tabindex="-1"]`
  is no candidate, E3 the plain head off +ui. Prose: D3 ("a named handler" is never judged only for paste), D5 (3.3.8's
  scope), D8, S10, S11. The review's corpus again (2,591 view files of ten repositories): click-no-keyboard 35 → 11, all
  eleven real (clickable spans, list items and cards with text) — three real ones lost to the body rule (an icon COMPONENT
  in a clickable card may render a control: a doubt); img-no-alt 217 → 17, all real (cal.com's 200 titled flags gone);
  zoom-disabled 3, real; no outline-removed finding (each root holding a candidate holds focus styles); paste-blocked 0.
  A project sheet's `button:focus { -webkit-tap-highlight-color: transparent }` no longer excuses a reset (it draws
  nothing). Not fixed: `outline-offset` beside a transparent outline still draws (no value says it), an HTML void element's
  click (`<img onclick>`) waits for a body it never has (not judged). Mutation pass: 107 mutants, the list written before
  the fixtures — 99 killed at first; six wanted a click-body fixture, one line was dead and went (judgeTag's `/>` check:
  clickBodies opens no self-closing tag), one is the cost guard above, timed with and without; the whole pass again after
  the fixtures: 105 of 106 (the cost guard the one survivor; the logic mutants run the file without its three timed
  blocks, the cost mutants the whole file).
- **1.37.0 review 1, the follow-up** (the owner) — 32 sheets / 128K judged outline-removed on almost no project of more than
  32 stylesheets (gen-angular's correct warning was lost): the cost bar relaxed to keep coverage — the report with the pass
  at its sheets bound ≤ 2.5× the same report with no candidate (proj-d), finish's part ≤ 2×, modules that all name `:focus`
  at the chars bound ≤ 3× — and `DS_FOCUS_CHARS` now counts the characters PARSED (a sheet naming `focus`), not read: on
  3,000 focus-free 20K modules it reads 48 sheets instead of 18 at the cost the sheets bound already allows (1.7–1.9× vs
  1.3–1.5×), so it was taken. Candidates, interleaved fresh processes, the median of 7 warm calls, in series under an
  antivirus that scans each open (~1 ms) and one quieter series (~0.15 ms an open): 64 / 256K finish 2.09–2.16× (over);
  56 / 384K finish up to 2.04×, 56 / 448K 2.11–2.3× (over); 48 / 384K feature 1.1–1.85×, finish 1.0–1.81×, the chars
  bound 2.0–2.75× on 13K and 20K modules naming `:focus`; 48 / 448K the chars bound up to 3.89× on 20K modules (over);
  95–100 / 512K finish 2.51× (over); in the quiet series 128 sheets measured 1.45× / 1.32× — the bound is the slow-open
  series' (a reviewer's machine). Chosen: 48 / 384K. gen-angular's 900 components still end at `focus-sheets` (they would
  need ~900 sheets read, ~8×); a 40-component app is judged again (its correct warning stands, excused with a deep focus
  style). A click on an HTML void element is judged at once as a self-closing one (`VOID`): `<img onclick>` no longer waits
  for a close tag and is counted as `tag-length`. Mutation pass of the new lines: 22 of 22, the list written first — the
  focus pre-test among them, killed now: with the budget counting parsed characters it changes a result, no cost guard alone.
