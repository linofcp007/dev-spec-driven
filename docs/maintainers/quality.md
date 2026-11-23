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
  any cell after the name — an `_…_` emphasis whose first word is Deprecated and whose first NON-BLANK character after the
  word is no letter or digit, a punctuation mark (`_Deprecated — use X_`, `_Deprecated—use X_`, `_Deprecated - use X_`,
  `_Deprecated. Use X._`, `_Deprecated (v3): use X_`): `_Deprecated_` alone, `_Deprecated<text>_`, the label alone italic
  (`_Deprecated:_ <text>`, `_Deprecated._ <text>` — the emphasis holds no letter or digit after the word: the text runs to
  the cell's end, as `_Libraries:_ a` does) or never closed (to the cell's end). A WORD after it, past any blanks, makes a
  note: an italic phrase about something else (`_deprecated props removed in v3_`, `` `dense` prop (_deprecated in v2_) ``,
  a successor's `replaces the _deprecated Table_` — read as a marker, it retired the successor and voided every `use
  DataGrid`), and so `_Deprecated in favour of X_` and `_Deprecated since 2.0: use X_` too (the cost; the user docs say a
  word makes a note). ONE case-insensitive regex over the cell as written (`RE_DS_DEPRECATED`): it starts the cell or
  follows a blank, `(` or `*` (never `snake_deprecated_flag`, `config_deprecated: true`), and a letter or a digit right
  after the word (`_deprecatedness`, `_deprecated2`), a `_` that does not close it (`_deprecated_flag`) or a `-` / `/` /
  `.` before a letter or digit — the name reader's joiners: `_deprecated-flag_`, a path cell `_deprecated/Table.tsx` or
  `_deprecated.tsx`, whose path stays a path — makes another word; its closing `_` is one the
  cell's end, a blank or one of `.,;:)*` follows (`use Data_Grid now` keeps its `_`); the row's first marker counts, a later
  occurrence after one that is none is still looked at. Deprecated is a property of the NAME: a name listed twice is marked
  by its first row that carries the marker (the replacement from that row, the marker put first in the entry's notes —
  `entries`). Read on the rows read in full only (the 500-row cap — doctor and the brief read the same rows): `deprecated`,
  a Map — the key → its REPLACEMENT, the first component the file lists (`keys`, past the cap too) that is not deprecated
  itself (`use Popup` while Popup is retired names none — the next one named is) and that the marker's text names among its
  first `DS_DEPRECATED_WORDS` (20) words, a word or two adjacent ones (`dsNameIn`) — the pair first, and only when blanks
  alone part them: `use Data Grid` is DataGrid even beside a `Data` row, `use Card. Header` is Card; a word is a hyphenated
  / slashed / dotted / snake name WHOLE (`RE_DS_NAME_WORD`: `data-grid` is DataGrid, `@mui/x-data-grid-pro` and
  `@/components/ui/dialog` name none — and so neither do `Dialog/Sheet`, `Dialog.Root`, `src/DataGrid.tsx` or
  `DataGrid-based`: the user docs say to name the replacement by its name alone, `use Dialog`, and the notes' silence the
  same), read in NFC (an accent written as a combining mark split the word) —, as written there; "" when it names none (no
  word list says which word is the replacement: a listed name is). The marker is cut out of whichever cell holds it — a
  path stays a path, a variants cell stays the variants — and the notes show it FIRST as one text, `_Deprecated<the first
  DS_DEPRECATED_SHOWN (120) characters after the word, as written>_` (`dsDeprecatedShown`): `dsCell` drops a closing `_`
  after a letter and the notes' 200-character bound cuts what comes last, so the brief quotes the marker whole. Linear:
  each `_` looked at once, each blank run after the word once (a hostile-vs-plain ratio check: 1,000 cells of
  `_Deprecated: ` and 190 `_a`). A token row's marker is not read; nor
  `__Deprecated__` (bold), `*Deprecated*` or a marker in the NAME cell (`Table _Deprecated_` is a name); `_Deprecated_: x`
  is the bare marker (the colon outside the italics, as the other markers never read it). The marker retires the WHOLE
  component, wherever it stands: a deprecated variant or prop is written without it (the user docs say so — a
  `ghost (_deprecated_)` variants cell retires the component).
- **`_UI checks off: <rule-id> (reason)[, …]_`** (1.38, `dsChecksOff`) — a line of its own like `_Libraries:_` (`RE_DS_MARKER`,
  the same `DS_MARKER_LINES` count, never inside a comment or a fence; a list item or a bold line is none — the user docs say
  so, review 1 of 1.38), the project's switch for a UI check (UI checks →
  The marker). Its entries cut by `dsEntries` (at `,` / `;` outside parentheses): `<id> (<reason>)` (`RE_DS_OFF_ENTRY`, any
  case — the id folded) → `{id, reason}`, the reason what the outer parentheses hold, commas and nested parentheses kept,
  trimmed, cut at `DS_CELL_MAX` ("" for none, `()` or `( )`) — an id in ONE balanced code span reads as bare (1.39, UP-7); any
  other shape (`transition-all: kit code`, `outline-removed — modality`, a lone or doubled backtick) → `{entry}`, as written,
  cut; past `DS_MARKER_ENTRIES` (50) ONE more `{entry, past, read}` and no further one (a
  later marker line too). The registry's `checksOff`. quality.js names NO rule id: engine/ui-checks.js `uiOff` validates them.
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
  is a WARN naming its replacement as the registry writes it — the replacement's row name, the marker's spelling for one past
  the rows read in full (`quality.dsDeprecatedItem`: `'Table' (use DataGrid)` for `_Deprecated: use data-grid_`, the name
  alone when the marker names none): the name the warn prints is the one that silences it, ONE expression for both. Silent
  when the row's notes name that replacement AS A COMPONENT — `dsNameIn` over the WHOLE notes, a word or two adjacent ones,
  in those letters (`dsLetters`: letters and digits as written, case and accents kept, in NFC — an NFD `á` is the
  registry's `á`): `Dialog lacks a sheet`, `` `Dialog` ``, `<Dialog />`, `the Data Grid lacks grouping` silence — the team
  keeps this one on purpose and says why —, `the delete-confirmation dialog` does not (component names are common nouns);
  never with no replacement. A code span or a tag is no exception to the case (`<data-grid>` does not silence DataGrid): the
  letters are kept wherever they stand — and a capitalised word reads as the name wherever it stands too, a sentence's or a
  cell's first one (`Dialog to confirm the delete`, `Select a country` silence: no sentence-start rule — the user docs say
  to write a component kept on purpose in a code span or a tag); the notes name it by its name alone, as the marker does
  (`kept: Dialog.Root lacks a sheet` does not silence: the word is `Dialog.Root`); once
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
  names). 1.39: the registry's units table (The units table, below) after the token line — its first rows whose text
  (`props: units` and the ` · ` between) fits `DS_BRIEF_UNITS`, 400 characters, a bound of its own (the components' 1,500
  untouched; a prefix: the first row that does not fit ends the quote, never cut; a FIRST row too long is said as the first —
  "the first row is too long to quote here — N rows in the registry: read them there", 1.39.0 review 1, BU-4: it had said
  all N were too long), `more` the
  rows left out plus the table's `past`; the null gate counts `reg.units` (a registry holding only the table opens the
  part); the result's `designSystem.units` {rows, more}, only with a table (1.38's JSON otherwise).
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
  a prelude), `on.close({ id, line })` when a `}` closes a block (a stray one closes none), and (1.39, the Sass map reader)
  `on.open({ name, value, block, line })` when a token declaration's LINE leaves it open — no `;` / `}` ended it there (a
  multi-line map, a value below its name, each override of `@use … with (`): its name, what the line holds after the colon
  (flags kept, its FIRST DS_PRELUDE characters), its block; built only when `on.open` exists, never in an indented .sass (a
  line's end ends a declaration there). Each handler is optional and is
  given a fresh object of plain values: nothing it does reaches the tokens. The events read the walker's state, they never
  steer it — so they inherit its view: a `;` inside parentheses (a Less mixin's parameters, an unquoted `data:` URL) ends no
  statement and what stands before it is not kept; after a token declaration left open at its line's end the next statement
  starts below it — its rest is the VERY NEXT event when that is a statement of the same block, and is lost when any other
  event comes first: in `@use … with (` mode every override is a declaration of its own and resets the walker's pending
  text, so a map another override follows is never delivered (CRIT_3 §1 — Dashticz's loader.scss yields `)` alone, and with
  `$container-max-widths` last its `sm: 540px, md: 720px ) )` would have read as breakpoints); a reader of `open` voids it then
  (breakpoints.js: one unread); an indented .sass file has no block. Behaviour-preserving when it came: the tokens of 2,493 real
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
  skip for settle: what only a type names is neither rendered nor called; TypeScript's modifier before `{` or `*` is
  dropped (`RE_TYPE_MODIFIER`, 1.39 review 1: read as a default binding, `import type { X } from "./button"` was an import
  of the folder's Button for the deprecated uses), `import type X from` stays unbound —;
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
  - **Read ahead** (`readFileHeads`, files.js): the exports read and the usage queue take their files through it (the UI
    checks' focus search and the project inventory too) — the first AHEAD_PROBE in sequence and timed; when they average
    AHEAD_SLOW_US or more, AHEAD_MIN remain AND the files left × the probe's average reach AHEAD_START_US (the pool's own
    start, measured once — 32 + 64 missing paths, pool on vs off: 68–81 ms; review 1 of 1.38: a pool started for the 64–300
    files of a small tree's UI pass cost more than reading them all), AHEAD_WORKERS
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
- **Deprecated uses** (1.39 — `deprecatedWatch`, design-system.js; the project report's `deprecatedUses`) — while the registry
  marks a row `_Deprecated:_` (`reg.deprecated`; scanCode's 4th argument — a watch only with `withComponents`, so the
  project report's alone: a feature's report passes the registry with `withComponents` false, the seed and finish pass
  none — finish's `scanCode(root, false)` builds no watch), the files that still import each row the code holds a
  component file for. Settle's follow is a function of its own, `followOf(scripts, project, index, prefill)` →
  {`resolve`, `placed`, `spent`} (lifted out of settle, byte-identical scans against 1.38.0); the watch runs a SECOND instance
  with its own index, caches and budget and its OWN `projectPlaces` (its config reads spend none of settle's DS_TS_CONFIGS),
  so settle's verdicts are a scan's with no row. `settle(…, watch)`: with a watch it never returns early — its follow, its
  places and its tells run only when it asks; the watch sees every component file read for its exports (`result`, whatever
  settle asks), then each file of settle's queue as read (`see`: the uses settle parsed, or its own parse of the text — the
  queue, order and bound are settle's: with nothing asked, the JSX scripts and the markup files), and where the bound stopped
  (`cut`) — unless it is `idle` (no row located: settle reads nothing for it, `read` 0). Two rules, two predicates: a row named by its FILE — every namesake, RE_JSX_FILE ∪ RE_MARKUP_FILE only (an Angular
  `*.component.ts` is imported by `.ts` files: `unlocated`) — is its MODULE: a binding whose module IS the file counts
  (`byKey`, indexed: the key exactly, an index's folder, an SFC's key without its extension — the `TWIN` entry, its platform
  infix dropped as moduleKey drops it, none when a script of the project has that key (`scriptHas`, 1.39 review 1: `./sheet`
  is sheet.ts beside Sheet.vue in every resolver) —, `X/index.vue` by its folder; never `pointsTo`'s prefix: a folder import
  is not every file under it), and through the follow its components (`byName`, the SFC's `defaults`); a component a file
  exports — its own too, a result IS a component file — counts by its NAME (`nameRow`), and by a default import when it is
  the file's default export (`defaults`, `byBase`, `bases` as a module row's file: List/Item.tsx's `export default
  ListItem` — 1.39 review 1). A row NO component file locates is located by the component folders' barrels that give its
  name (`nameRows(r, keep)`, the barrels after the files: vben's `export { default as VbenButton } from './button.vue'` —
  the row the seed writes with the barrel's path —, outline's `List/index.ts` default; 1.39 review 1) — never a row a file
  locates (input-group's `export { Button }`, its own button, is no namesake of the kit's: located rows' importers are
  1.39's) —, each a namesake as files are while the barrels give the name to ONE file. To more than one (`givenTo`, of the
  names `nameRows` reads: a relative re-export's module, the barrel itself when it declares the name — `const Trigger =
  Primitive.Trigger` —, no file for another package's re-export — vben's common-ui `export { VbenButton } from
  '@vben-core/shadcn-ui'`), only the barrel the row's path names locates it (`rowAt`: the path read as an `_Implements:_`
  reference is, `implementsRel`, then `moduleKey` — the barrel's key or its folder's; 1.39 review 2: a kit's parts,
  shadcn-svelte's `Content` in 31 barrels, 13 of its 889 importers the picker's). The names a component folder's barrel
  gives a row's file or a watched name (a relative module) are watched too, DS_ALIAS_PASSES deep. A namespace's member resolves by
  its first part (`<UI.Table.Row>` is UI.Table's). A file is never its own importer. An .mdx / .vue tag with no dot that no
  import binds, whose key is a LOCATED row's, is `unbound` (`unboundAt`: the first by path). The cost guard: a text naming
  no watched name (RE_CAPITAL_WORD; a .vue file's kebab tags) and no row file's base (RE_PATH_SEGMENT) is not parsed, a
  binding naming neither is not followed — it hides an import whose binding and module name neither (`export { Table as
  Grid }` outside a component folder's barrel, a `#ui` alias straight to `table.tsx`). The report: the rows still imported
  first, each group in the registry's order, then the DS_LIST cut (`rowsTotal`; 1.39 review 1: past 50 rows a used one was
  cut), `use` = `dsReplacement` (quality.js — doctor's `ui-deprecated` prints the same, ONE
  expression), DS_DEP_SHOWN files and paths by path, `unlocated`, `read` (the in-scope files seen), `limits` — the walk's
  `files` and the exports loop's `component-files` repeated, `usage-files` (settle's read stopped with a file the watch
  reads left), `deprecated-follow` (the follow's `spent.cut`: a refused read or step; settle's own cut stays silent) —, and
  the report's localized `note` (what is not seen; no import found is not unused). Never the report's `limits`,
  `truncated` or `inSync`. Not counted: a `.ts` file, a dynamic `import()`, tests / stories / mocks, a tag in a .tsx /
  .svelte / .astro file with no binding. The CLI (`dev-spec design-system`, no feature) prints it after the stale rows:
  `cliOutput.dsDepUsesHead` (the rows listed that are imported, of `rowsTotal` — "at least" when every listed row is
  imported and some are not listed), a row each (`dsDepUsesRow` — the files, `… +N` past the listed —, `dsDepUsesNone` with
  the files read: no import found is no proof), `dsDepUsesUnbound`, `dsDepUsesUnlocated` (no component file the scan reads —
  a component folder's index among them, the one the row's path names when several give the name to different files — gives
  the name), the note, then its limits the report's own do not already say
  (`dsLimit`).
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
  `newSources` / `newLibraries`, `drift` / `gone` / `unitsTable` (1.38 — Token values, The units table, below), `inSync`, and
  (1.38) `uiChecks` — the project's UI checks, an inventory, when the OPERATION asks (`{uiPass: true}`: the engine's default
  runs none — UI checks → The project inventory). A feature: `usage`, `problems` (the findings, a localized `text` each), `raw`, `counts`, `groups` and `units` (1.38 — Raw values
  against the scale, Groups, The units table, below), `newComponents`, `uiChecks` (1.37 — UI checks, below). Both shapes end
  in `breakpoints` (1.38 — Breakpoints, below). `missing`, `pending`, `stale`, `newTokens`, `drift`, `raw` and `groups` hold
  their first 50 (`DS_LIST`) with a total beside each (`missingTotal`, `pendingTotal`, `staleTotal`, `newTokensTotal`,
  `driftTotal`, `total`, `groupsTotal`).
- **`limits`** — the bounds that CUT what a report read, `[{code, read, file?}]`: files (the walk's cap) · token-files ·
  token-candidates · file-size (`file`) · tokens · registry-rows (rows past 500 are not checked for a gone path) ·
  component-files (a bound of the export read: `DS_EXPORT_FILES`, `DS_EXPORT_CHARS`, `DS_EXPORT_NAMES` — `read`: the
  files read) · workspace-manifests (a bound of the workspace patterns, or a declared pattern not followed —
  `read`: the manifests read, 0 too) — 1.35.1, the project report's alone ·
  view-files (a feature's 200; its report carries every code but tokens and registry-rows — a stylesheet left out of the
  sources is read for raw values) · font-values / motion-values (1.38, a feature's: a file's fonts / motion values past their
  own `DS_RAW_PER_FILE` — `file`, the first it cut); `truncated` = one of them, and then the report is NEVER `inSync` (said
  of NAMES: a token's value is not compared — 1.38's `drift` lists the values the code holds otherwise, beside it, never in
  it —, nor a token the code no longer declares — `cliOutput.dsInSync` says so, review 7) — what it
  did not
  read it cannot vouch for (the CLI prints `cliOutput.dsLimit[code](read, file)`, never "the registry and the code agree"
  beside one). A new bound gets its OWN code and line in en / pt / es, and is said only when it cut something: a false
  bound is a false alarm for good.
- **Breakpoints** (1.38 — engine/breakpoints.js, LAZY after ui-checks.js: `breakpointWatch`, `breakpointsReport`) — the widths
  the visual review captures: `breakpoints` {widths, from: `ui.md` | `code` | `default`, partial, at (the source's first place,
  file:line; null for the default set), unread, unreadTotal, limits}, the LAST key of both shapes, the same in each. Built by
  designSystemReport alone — never in featureReport, which finish calls too —, and its observer rides only the report's scan
  (`scanCode(root, withComponents, withBreakpoints)`): finish's scan and the seed's carry none (CRIT_3 must-fix 4: they ran it
  and dropped it — V8 coverage of a child proves no breakpoints.js function runs there: "BP-never" in
  mcp/tests/15-quality-design-system-breakpoints.js). The first source that gives a width in [320, 3840] decides:
  - `ui.md` — `.specs/steering/ui.md`'s FIRST `- Breakpoints:` line: a list item (`-`, `*`, `+`), the label in any case, `**` /
    `_` around it; outside the front matter, fenced / indented code and HTML comments — read line for line (`commentLines`,
    then `codeBlockLines` over what it leaves), so `at` is the file's own line. Its value runs to the first `·` that no length
    follows (`RE_UI_END`: blanks skipped — a space, a tab and, 1.39 (R2-BS-3), the two no-break spaces a thousands group
    takes, U+00A0 / U+202F; never another space character —, then a digit or `.` and a digit — `320 · 390 · 768 px`, the
    widths as the CLI prints them, is a list; the stub goes on: ` · text expansion · RTL · locale` ends it; so a note led by
    a number reads as more widths and a name before a width ends the list — `sm 640 · md 768` is 640:
    ui-responsive.md says to start a note with a word and to write `640 (sm) · 768 (md)`) and is read up to `BP_LINE` (200)
    characters — past them `breakpoint-line` {read, at}, and a number the cut halves is dropped (`12800` is never `1280`) —; a `[…]` slot,
    closed or not, is not read: the +ui stub's own `[360 / 768 / 1280 px]` gives the default set — but (1.39, BS-6 as CRIT_3
    must-fix 5 narrowed it) a CLOSED one at the slot's own place, opening the value after the label's closing emphasis marks
    and blanks (`RE_UI_FILLED`), whose text is no template's (`isTemplatePlaceholder` — the placeholder gate's own predicate,
    under the project's template scope: the stub's slot is one in every language) is the team's filled value: its lengths are
    read with the rest of the value (`[576 / 768 px] · text` → 576, 768); every other bracket keeps the rule, so an aside after
    the widths (`480 / 960 px [1200 in print]`, `[see Figma frame 1440]`) is never a width. A length: px, rem / em × 16 (`BP_EM` — a media query's em is the initial font
    size), a bare number in the unit written NEXT (`360 / 768 / 1280 px`, `30 / 48 / 80 rem`) else px; a thousands group
    (`1.280`, `1,440`, a no-break space — one digit before it: a width is ≤ 3840) before px or none is an integer, before rem /
    em a decimal (`1.250rem`); a plain blank is never a group (`360 768 1280` is a list), so `1 280` reads as 1 and 280. A width
    is a min edge, its fraction rounded up (767.5px → 768). Why ui.md and not design-system.md (DECISIONS D3): every stub holds
    the line in EN / PT / ES under that label, +ui creates it, and it is fingerprinted into the approvals — editing it re-flags
    the approved designs, which is right (a design says what each view does per breakpoint); design-system.md holds what the
    code scan compares.
  - `code` — Tailwind 4's `--breakpoint-<name>` among the OWN statements of a TOP-LEVEL block whose whole prelude is `@theme`
    and its options (`RE_THEME`: inline, static, reference, default; a nested @theme is not read — Tailwind 4 declares its theme at the top level), read through the
    observer the token walk already carries (the token loop and the global-sheet loop, in their order: token files, then the
    sheet candidates; a sheet that is no source counts too) — never a second walk (CRIT_3 must-fix 5); an observer only for a
    text holding `@theme` or (1.39) a .scss one holding `breakpoints` — below — (else the walk builds no event). The last
    declaration of a name is kept; `--breakpoint-<name>: initial` drops it; `--breakpoint-*: initial` / `--*: initial` drop
    the file's earlier ones and set `reset`. `partial` = a Tailwind width read (320 or more) and no reset anywhere: Tailwind
    keeps its own five, which the engine never holds (stale data) — the default set fills the places the theme's widths
    leave (below). A value other than `0` or a px / rem / em length, or wider than 3840 → `unread` {name, value, at} (the
    first 5, `unreadTotal` — of the sources asked: never the code's beside a deciding ui.md; `cliOutput.bpUnread` points to
    ui.md's line, never "rewrite the value" — must-fix 6). Counted, never all kept (1.39.0 review 1, BU-1): `codeBreakpoints`
    keeps the first `BP_UNREAD` and the count, a Sass record its own first `BP_UNREAD` and `badTotal` (no entry past a
    record's first five can be among the report's), and `breakpointsReport` joins each source's one by one — never a spread
    (`push(...list)`: V8's arguments end near 125,000, and a hostile tree holds more — RangeError, the whole report lost).
    What is kept grows with the assignments and declarations the walk reads, one record each (as 1.38's `decls`), and
    with a map's LENGTHS, one number each — never with its unread entries past five (review 2 of 1.39, R2-BU-2: 100
    hostile sheets of one-line maps of 230 lengths keep 3.2M numbers, +67 MB, 4.8× their twin; 1.40 backlog with the
    records cap). What it inherits from the walk: the sheets the token scan reads —
    a token file by name, a global sheet by name (`sheetRank`) up to `DS_TOKEN_READS`, where that search ends without a word
    (its own rule, review 5); a Tailwind 4 project's `@theme` is in its entry sheet (globals / app / index / tailwind.css),
    which ranks first. And (1.39, the Sass map reader) a TOP-LEVEL assignment, in a .scss sheet the same walk reads (the
    observer's pre-test: `.scss` ∧ the text holds `breakpoints`, lower case as the name rule reads it), of a variable whose LAST `-` /
    `_` word is `breakpoints` (`RE_SASS_NAME` — a convention, not a name list: `$grid-breakpoints`, Bootstrap 6's and sass-mq's
    `$breakpoints`, `$mq-breakpoints`; never `$spacers`, a 0-led map of lengths a value property would take, nor
    `$grid-breakpoints-custom`): plain, `!default`, or an override of `@use … with (…)` / `@forward … with (…)` (on one
    statement: the `with` group's entries; over lines: each override is the walk's own `open`). Its value (`sassValue`): a
    literal map, to its own `)` (`parenGroup`: one pass, depth-1 commas, quotes skipped; one that never closes — a stray `}`
    ended its statement — one unread) — each `0` / px / rem / em entry a min
    edge, any other entry (`md: $tablet`, a unitless `750`, `5000px`) `unread` as `$name.key` (a quoted key unquoted); an entry
    that opens a map (Bulma's `"mobile": ("until": $tablet)`) makes it no breakpoints at all (nothing, nothing unread); a list
    (`$show-breakpoints: (mobile, tablet)` — no key in its first entry; `"a" "b"`) nothing; anything else holding `$` or `(` (a
    variable, `map-merge(…)`, `map.merge(…)`) one `unread`, as the Tailwind reader's (CRIT_3 must-fix 2 — "nothing" was a
    silent drop). Over lines (the walk's `open` — its contract in The code, the walk's EVENTS above): a map its line closes is read at once (an
    override's `(…),`); otherwise it is PENDING, completed only by the very next event when that is a top-level statement —
    any other event first (another open, a block; a close or a nested statement always follows a block event, which voided it
    first — no close handler is built) or the file's end voids it: one `unread` `{name, value: "( …"}` at its line (CRIT_3
    must-fix 1: Dashticz's `with (` map then `$container-max-widths` — never 540 / 720 read). A part of DS_PRELUDE characters
    is one the walk may have cut → one unread, never misread; a one-line map that long loses its name to the walk's tail cut
    and is silent. Precedence (`codeBreakpoints`): per name, a plain or `with` assignment sets aside the `!default` ones,
    read or not (a plain `map-merge` leaves the default set and its unread line); otherwise all count; names unite; `at` = the
    first KEPT declaration with a length (must-fix 3: a vendored `_variables.scss` walks first and is set aside) — the files
    in the walk's order, a file's Tailwind declarations before its maps (no sheet holds both). A map is whole: `partial`
    stays Tailwind's (a Tailwind width read), so no default width fills a map. ui-responsive.md says the two silent shapes
    (1.39.0 review 1, BU-2 / BU-3 — prose): a map of maps (Bulma's, a hand-written `'small': (min-width: 767px)`) is
    neither read nor listed, and two `!default` maps of one name (a library copy beside the theme's own) both count — the
    widths go into ui.md's line then.
    Not read: a map in a file the walk does not open by name (`_config.scss`, `_settings.scss`, `_vars.scss`, `core.scss`,
    `mixins.scss` — 14 of the designer's 26 sampled assignments; ui-responsive.md: paste the line), a .sass file, a .css one.
  - `default` — `[320, 390, 768, 1024, 1440]`.
  The widths: 320 first (WCAG 1.4.10's reflow width — 1280 at 400 %; a narrower edge is the floor's), ascending, once each,
  `BP_WIDTHS` (6) at most — one dispatch of images per view (ui-review.md's 16) —, past it the narrowest 5 and the widest of
  the SOURCE's own widths; `breakpoint-widths` {read, count, first — the narrowest left out, the sixth} counts and names
  only those (`cliOutput.bpLimit` names the count and that width, never the rule). Then, under `partial` alone, the default
  set FILLS the places left (1.39, BS-2 — `BP_FILL`): 768, 1024, 1440, 390 in that order, each not already there, up to
  six — a theme's declared width is never one left out for a default one, and a default width the fill had no room for is
  never said (shadcn v4's 1600 / 2000 → [320, 768, 1024, 1440, 1600, 2000], no limit; Tailwind's five restated →
  [320, 640, 768, 1024, 1280, 1536]; 1920 alone → [320, 390, 768, 1024, 1440, 1920], 1.38's). The order: under any
  Tailwind theme 390 is the floor's own layout (Tailwind's narrowest is 640), so it fills last; tablet / laptop / desktop
  before it (History → 1.39.0, the table of 308 real themes). Not partial (ui.md, a reset theme): no fill.
  `breakpoints.limits` never feed the report's `limits`, `truncated` or `inSync`
  (they bound the widths, not the registry's comparison — CRIT_X D5d; a fixture: an in-sync project whose ui.md line is cut
  stays in sync). Not read (or never): `@custom-media` (cut in 1.39 — History), a file named for breakpoints, a JS config
  (Tailwind 3's `screens` — and `container.screens`, a max width, the trap), `@container`. CLI: `cliOutput.bp*` (`bpHead`,
  `bpFrom` per source and partial, `bpUnread`, `bpLimit`), after the project's counts (`dsFound`) and after a feature's UI
  checks.
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
  user docs list them (ui-code-scan.md → the scan table).
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
  `accept="image/*"` holds none). What a raw value IS against the project's tokens: Raw values against the scale, below
  (1.37: a colour equal to a registry token's value TEXT carried `token`). Not read: a size
  in a JSX `style={{…}}` object. The line walk (1.37) is `viewLines(text, rel)` — rawValuesOf's loop head, the ONE walk of a
  view file's lines its readers share (the raw values, the UI checks): a GENERATOR of `{ n (1-based), src (cut at
  DS_LINE_MAX), l (without its comments), css (a stylesheet's line — a `<style>` block's opening and closing lines too) }`.
  `rawValuesOf(text, rel)` reads it as a generator: it stops at DS_RAW_PER_FILE values and reads no further line (over a
  list, a 20,000-line sheet cost every line — CRIT_1: 1.1 → 6.4 ms; mcp/tests/15-quality-design-system-walks.js times the
  stop as a ratio against a sheet with no value). The FEATURE REPORT (1.38, CRIT_X D5c) walks each file once into a list
  — `[...viewLines(text, rel)]` — that its readers share, `rawValuesIn(lines, kinds, cut)`, `uiChecksOf(lines, rel)` and
  `unitsOf`: the UI checks read every line anyway, so the list costs no line the report did not walk (1.37 walked twice).
  A stylesheet line's piece split is `declarations(l, cb)`, the ONE copy the raw values and the units table share.
  Behaviour-preserving when it came: the raw values of 5,256 real view files byte-identical to 1.36's, every earlier
  assertion unchanged (1.37); the list and `declarations` — rawValuesOf / uiChecksOf of 1,962 real view files, 15 feature
  reports and their finish parts — byte-identical to the F0 tip of 1.38.
- **Raw values against the scale** (1.38 — engine/design-values.js: the lazy tier's, before design-system.js; pure — no fs,
  no require, nothing linked) — the feature report judges each raw value against the project's OWN scale, `tokenScale(the
  registry's rows read with their values, the code's tokens the registry does not name)`, built once a report: the
  registry's rows first (a value both hold names the registry's token; a name the registry holds keeps the registry's value
  — the code's is not on the scale). COLOURS (`parseColor`: hex 3 / 4 / 6 / 8, rgb / rgba, hsl / hsla, oklab, oklch —
  comma or space syntax, % channels, an alpha after `/` or as a 4th argument, a hue in deg / turn / rad / grad, `none` = 0
  as CSS Color 4 says: Tailwind 4 writes `--color-neutral-900: oklch(20.5% 0 none)`) → OKLab. `token`: the NEAREST token
  of the SAME colour (of equals the first: the registry's) — exact within one notation (ΔEOK ≤ 1e-4: float noise, a
  powerless hue), across two within the rounding of the PAIR as written (0.011 with an HSL side: integer HSL's as CRIT_2
  measured it — `#05787d` = `hsl(183 92% 25%)` at 0.0106; 0.001 otherwise: a hex written as 3-decimal oklch is within 0.0007) — CRIT_2 must-fix 2:
  one 0.011 for every pair made Tailwind's zinc (`#18181b`, `#09090b`, `#e4e4e7`, `#f4f4f5`) shadcn v4's neutral tokens,
  0.003–0.008 apart; alphas within 0.01. An HSL side against a hex / rgb one (1.38.0 reviews 1 and 2) is ALSO judged by
  the pair's rounding BOTH ways (`roundTrip`, `sameAt`) — the same colour when EITHER holds: (1) the sRGB triple, written in
  HSL as precisely as the HSL side is, gives its numbers (`roundsTo`) — each channel within half a unit of its last written
  digit (`halfDigit`: `96.1%` 0.05, an exponent counted; the hue's in its own unit, `.5turn` 18°), the hue moot at s 0, s at
  l 100 (at l 0 the HSL paints black, the one hex within 0.011 of it — (2) decides; review 2 took the dead `l === 0` out),
  a hue's turns and sign never matter; CSS's clamps first (`rgb(300 0 0)` = `#f00`, `hsl(0 150% 50%)` too):
  `#05787d` = `hsl(183 92% 25%)`, which paints `#05757a`; (2) the HSL as written, painted at the hex's 8 bits a channel
  (`hsl.paint` — the clamped triple parseColor already computes for `ok`), IS the triple: each channel within half a unit
  of 1/255, so a channel painted at exactly n.5 has both neighbours (`hsl(0 0% 10.0%)`, 25.5: `#191919` and `#1a1a1a`):
  cal.com's `hsla(220, 14%, 94%, 1)` paints `#eeeff2`, whose own HSL (225 13.3% 94.1%) does not round to it — the colour a
  picker, devtools' Computed pane (`rgb(238, 239, 242)`) or a palette's docs give. Neither holds for Tailwind's zinc hexes
  against shadcn's `hsl()` neutrals, nor for cal.com's `#efefef` (its `--cal-bg-subtle` paints `#eeeff2`): `near`. The 0.011
  stays the CEILING — the round trip only narrows 1.38's rule, never widens it: integer HSL is NOT within 0.011 of every
  hex (479 of the 16.7M hexes are farther from their own integer HSL: `#020200` = `hsl(60 100% 0%)`, black, at 0.084 —
  OKLab's L is steep near black —, saturated yellows to 0.013; and 76 of the 3.56M integer HSL tokens' painted hexes, all
  at l 1–2 %: `hsl(236 93% 1%)` paints `#000005` at 0.0136), and those stay what 1.38 said. HSL against oklab / oklch keeps
  the 0.011 alone — so Tailwind 4's `oklch()` zinc IS shadcn's `hsl()` neutral (0.0082 apart — as far as zinc's hex, which
  the round trip keeps `near`): said, ui-code-scan.md. `near`
  (a hint, `{token, delta}`): the NEAREST token within the JND (0.02 ΔEOK), never the first. hwb / lab / lch / `color()` / a
  named colour are not parsed: the same TEXT names the token (1.37's rule, `colorKey`, moved here; a hex is always parsed
  now, so its 3-digit spelling-out went). FONTS: a `font-family` STACK (`fontStackOf`: its LAST family a generic one — CSS
  Fonts 4's closed list —, one that is not, nothing built: `var(`, a Sass / Less variable, an interpolation) by its primary
  family, against the font tokens of the REGISTRY's rows only — `designValue` drops a code token's stack and the value
  gate stays (CRIT_2 must-fix 3), so a code `--font-sans` alone reads no font; a stack ending in an emoji font (`…,
  sans-serif, "Apple Color Emoji"`, Tailwind's own) is none, knowingly. MOTION: a transition / animation declaration
  (`RE_MOTION_PROP` — the properties that HOLD times and easings; item 1's "motion declared" is another predicate, never one
  for two rules) or a Tailwind `duration-[…]` / `delay-[…]` / `ease-[…]` (`RE_TW_MOTION`: variants counted, no bracket
  inside — `ease-[` written 300 times on a line costs one short look each) holding a literal time above 1 ms (`timesOf`:
  the reduced-motion reset `0.01ms` is never raw, the 1px hairline's precedent) or an easing function (`easingsOf`: a
  cubic-bezier of four numbers, steps(), linear(); a keyword is none — never asked); `token` when EVERY literal is a
  duration / easing token's (s → ms; the first time's name), never a nearest (CRIT_2: a loop's period on a 150 / 250 ms
  scale read as a fixed-duration rule). Nothing built is read (`RE_SIZE_BUILT`: shadcn's `duration-[calc(var(--x)*400ms)]`).
  A kind is READ only when the scale holds such a token (fonts: a registry row's stack; motion: a duration or easing token,
  the registry's or the code's): `counts.font` / `counts.motion` exist only then — without them the report is 1.37's shape.
  SIZES stay raw, never judged (DECISIONS cut size families: on every real shape checked — shadcn's calc() radii, Tailwind's
  base `--spacing`, Bootstrap's named Sass, Breeze, Tailwind 3's JS config — they decided nothing). Each new kind has its OWN
  per-file bound, `DS_RAW_PER_FILE` values (a transition-heavy sheet never hides its colours — CRIT_2 must-fix 5), said in
  the report's `limits` (`font-values` / `motion-values`, the first file it cut); with kinds the early exit waits until
  each kind is past its bound. Only the LISTED rows and groups are judged (≤ 100 × the scale: no window, no sort).
  `rawValuesOf(text, rel)` (no kinds) is 1.37's reader, value for value.
- **Groups** (1.38, the feature report's `groups` / `groupsTotal`) — every value read (past the 50 listed rows too), keyed by
  what it IS (`groupKey`: a colour notation-free — `#1E40AF`, `#1e40af`, `rgb(30 64 175)` and a `text-[#1e40af]` are one;
  a stack by its families; a Tailwind utility without its variants; the rest as written), those read twice or more, the
  most frequent first (a tie in reading order), each `{kind, value (as first written), count, files, at}` judged like a row.
  Sizes live here: Breeze's `#FF2D20` ×147 in 7 files, `rounded-[10px]` ×10 — the finding a size scale would have made.
- **Token values — drift and gone** (1.38, the project report's `drift` / `driftTotal`, `gone`) — `registryValues`: a code
  token whose registry row holds another value IN THE SAME NOTATION (`tokenDrift`: one parsed colour each in one notation,
  `sameColor` there — `#3b82f6` and `hsl(217 91% 60%)` are not compared, nor zinc's hex and an oklch token: DECISIONS'
  "differs within a notation", the narrower reading —; or one quantity each with one unit, s → ms — 16px and 1rem are not
  compared); a reference, several parts, a stack: never. The code's value is its FIRST declaration, and a name the code
  declares with two values or more is `multi` (scanCode's `firstValue` Map, `again`: a theme's `:root` / `.dark`, two
  sources, a TWIN global sheet — CRIT_2 must-fix 1, review 7's `order`: a registry written from the second app's main.css)
  — never compared. Every registry row's value is kept, past the reader's 1,000 (`tokenValues`, as `tokenNames` keeps
  every name): no registry-tokens limit (CRIT_2's cut). `gone`: the `_Token sources:_` files that are gone, judged as a
  row's path is (`stalePath`: every doubt not judged — a root-level file, a path whose first folder is gone, one out of the
  project). NEITHER is part of `inSync` (DECISIONS: what "in sync" compares stays the names, and `dsInSync` says so); the
  CLI prints a drifted token as the row the code has, then the registry's value and the file.
- **The units table** (1.38 — the team's convention, a report, never a default) — in design-system.md, found by its header
  wherever it stands: the first cell Property / Propriedade / Propiedad (`RE_DS_PROPERTY_HEAD`), a column whose header
  STARTS with Units / Unidades / Unidad (`RE_DS_COL.units` — by its header only, never by place), else (1.39, 1.38.0 review
  1's T3) the first whose header holds the WORD (`RE_DS_UNITS_WORD`: `Allowed units`; its edges any script's letters,
  digits or `_` — never `Community`, `Unitless`, PT `Valor unitário`, which `\b`, ASCII, would end at its `á`) — the 1.38
  tier first, so every 1.38 table reads the same; no polarity (`Units to avoid`, `Avoid units` read as the allowed ones:
  steering-templates.md says the column lists the ALLOWED units, CRIT_4 must-fix 11) — holding at least one CSS unit
  (`CSS_UNITS`: the
  CSS Values 4 lengths, `%`, `fr` — a closed list in quality.js, the eager reader's) — a component's props table
  (`| Property | Type | Default |`) is none (CRIT_2). `dsUnitsTable` → the registry's `units` {rows: [{props (a property or `prefix-*`;
  never `--x`), units}], unread (a row with no CSS unit or no property, by its first cell), past (rows past `DS_UNIT_ROWS`,
  50: a count)}, several tables adding up; null without one. The feature report's `units` {findings (50), total,
  byProperty} — null without a table; never finish or doctor (the brief quotes the rows: The brief, above): `unitsOf` over
  the file's ONE walk — a declaration
  whose property has a row (`unitRows`: the exact row, else the LONGEST `prefix-*`; `margin-*` covers `margin`), its FIRST
  top-level length the row does not allow (`offUnit`: never inside calc() / clamp() / var() — an unclosed one holds the
  rest —, never 0, a unitless number, a hex colour's digits, a word's — `a-12px`, `$gap-8px`, `--12px`; 1.39, T2: a
  negative length IS one, `RE_UNIT_LITERAL`'s second lookbehind — a minus at the value's start or after a blank or a comma
  signs it: `margin: 0 -8px`, `-.5em` —; one finding a declaration; a custom property or a Sass variable has no row), and
  a Tailwind arbitrary size in any unit, negative ones too, by the property it sets (`twProperty`) — 1.39's `RE_TW_UNIT`,
  the table's own pattern (`-mt-[12px]`, `md:-mx-[8px]`, `mt-[-12px]`, `text-[2vw]`, `py-[3pt]`, `rounded-[50%]`: m[1]
  the utility, m[2] its value; a unit of at most 5 letters, CSS's longest — `text-[3inches]` is none); 1.37's `RE_TW_SIZE`
  stays the raw values' (px / rem / em, what a size token replaces):
  never one predicate for two rules; every finding counted, the first 50
  made into rows. The third reader of the one walk measured 0.9–1.0× the report without a table on the real corpora,
  1.0–1.4× on 60 component sheets and ≤ 1.5× when every declaration is a finding (mcp/tests/15-quality-design-system-cost.js:
  ≤ 1.5× and ≤ 3×); a digit and a "names a property of the table" prefilter measured no gain (1.2× either way) and went.
  The project report's `unitsTable` {rows, unread, past} | null —
  never in `inSync`. On the real corpora with a rem / px table: shadcn's typeset.css `em` paddings, Bootstrap's
  `border-radius: 50%`, Breeze's `rounded-[10px]` — each true to the convention it was given (why it is a report).
- **DESIGN.md: deferred again** (1.38, and 1.39 — DECISIONS, CRIT_4: it changed again on 2026-11-17, and read as the
  registry's it renamed tokens 1.38 reports) — the spec is `version: alpha` and changed after 1.37's design (a `motion` group,
  nested colour groups, dimensions px / em / rem only); a YAML subset reader is a review series of its own. Its own CLI
  exports what is read today: `npx @google/design.md export --format css-tailwind DESIGN.md > theme.css` (a token file by
  name) or DTCG JSON.
- **spec_finish** (`designSystemFinish`; +ui and a registry, never on the `gateOnly` path) — the raw values as a WARNING, never
  a blocker, and only when the registry holds tokens or names token files (`tokens`: else there is nothing to replace them
  with) — `finish.designSystemRaw`: the count, the first 3, the call that lists them. Colours and sizes alone (1.38: the
  report is called with `{finish: true}` — no font or motion kind, no group, no units walk —, so its total, counts and the
  four prose files' "raw colours / sizes" stay true: CRIT_2 must-fix 4); its top rows carry the judgment (`token` / `near`).
  A READY written finish appends the
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
after design-system.js), the feature report's `uiChecks` and ONE finish warning; (1.38) the project's view files too, as an
INVENTORY of counts in the project report when the operation asks (below), with one project fact (`no-reduced-motion`) and the
project's switch (the `_UI checks off:_` marker). Every doubt reads as "not judged": a
wrong finding sends a team to fix code that is right. The user docs: `references/ui-code-scan.md` (the scan table — what the
code scan reads and what it doesn't — and the UI checks section; ui-design-patterns.md keeps one pointer line to it, its
registry table's pointers name it), its rule ids read by 17-docs from `UI_RULES`.
- **Rules** — ids English-stable, a level each (`UI_RULES`): `warn` — the reports (a feature's, the project inventory) and
  finish's warning, never a blocker:
  `zoom-disabled` (WCAG 1.4.4), `img-no-alt` (1.1.1), `outline-removed` (2.4.7), `click-no-keyboard` (2.1.1), `paste-blocked`
  (3.3.8 at a sign-in or code step — W3C scopes it to authentication; elsewhere a usability defect, Vercel's "never block
  paste": review 1 of 1.37), `font-size-viewport` (1.4.4, failure F94 — 1.38); `report` — the reports alone, never finish:
  `transition-all` (certain as syntax, a guideline as a finding: shadcn's own
  Button, Switch and Sidebar ship it, so `shadcn add` would warn on kit code).
- **font-size-viewport** (1.38) — text sized in viewport units ALONE, which zooming does not enlarge. `viewportOnly(value)`:
  ONE hand pass (a regex of alternations under `+` backtracks on `calc(1vw + 1vw …)`), lower-cased — numbers, the 24
  viewport units (`vw vh vi vb vmin vmax`, each with `s` / `l` / `d`: CSS Values 4's closed list), `calc( clamp( min( max(`,
  `( ) , + - * /`, blanks, a last `!important`; any other term (rem / em / px / %, `var()`, `math.div`, a word) → false; one
  viewport length at least (`font-size: 0` is none). F94's own note — "if media queries were used to adjust the size of text
  … it may not be a failure" — makes three NARROWINGS (CRIT_3 must-fix 1–3; the design judged the enclosing block alone and
  warned on six real shapes): (1) outside a stylesheet ONLY an element's own `style` attribute, read in `judgeTag` through
  `attributesOf` (`styleFontSize`: `font-size` / `fontSize`, quoted or not, its value a quoted literal or read to `;` / a
  quote / `}` — JSX `style={{}}`, HTML / Blade `style=""`, Vue `:style`, Angular `[style]`), never a component's prop (`sx`,
  `style` on `<Heading>`), never past a spread, never a free `fontSize:` line (vanilla-extract `style({})`, emotion
  `css({})`, MUI `sx` nest their media queries where no line reader sees them); (2) a stylesheet's `font-size` (a sheet, a
  `<style>` block, styled-jsx — `sheetChecks`) is a CANDIDATE outside any conditional block (an at-rule block but `@layer`'s,
  inherited: `@media`, `@container`, `@supports`, a Sass `@include` / `@if`, a nested `@media`) and the candidates are added
  when the walk ENDS, only if the file declared no font size inside one (`font-size`, the `font` shorthand, an `@apply` holding
  a `text-` utility), no block past `DS_BLOCK_DEPTH` went unread and the file was read WHOLE (review 1 of 1.38: `uiChecksOf`'s
  `over` — its caller read `DS_READ_CHARS` of a longer file — or a line cut at `DS_LINE_MAX` makes it `partial`, and
  `sheetChecks` starts with `condSize` set: a theme's 270K style.css, a minified sheet, held their override past the cut) — a
  cross-file override (`style.css` + `responsive.css`)
  is not seen (the user docs say so: silence it); the declaration is read inside a reduced-motion block too, transition-all
  alone skipped there (behaviour-preserving); (3) Tailwind (`utilities` — `RE_TW_PICK` widened by `text-\[`): a BARE
  `text-[<v>]` (`RE_TW_TEXT`, anchored — a variant's token is none; `length:` hint, a `/<line-height>`, `!`; a value holding
  `(` — any arithmetic — is cut by the split) whose value is viewport-only is a CANDIDATE (the first of a line, pushed on the
  caller's list) decided when the FILE ends, by (2)'s property — a font SIZE the file sets under a condition (review 1 of
  1.38: decided by the line, a class list split over lines — `cn("text-[8vw]", "md:text-7xl")`, a cva base with its
  responsive variant below, a wrapped JSX `className` / Vue `class` — warned): none stands once a non-CSS line of the file
  held a SIZE under a variant (`RE_TW_TEXT_VARIANT`, after `:` / `:!`: a type-scale step — `md:text-6xl`, `sm:text-xs`,
  `lg:text-base/7`, `md:text-6xl!` — or an arbitrary length — a digit or `.` first, a `length:` hint in `[…]` or Tailwind 4's
  `(…)`, `clamp(` / `calc(` / `min(` / `max(` — or (1.40, R3-UI-1) what Tailwind's own `text-[…]` types a font size
  (utilities.ts `functional('text')`, infer-data-type.ts): a `percentage:` / `size:` / `absolute-size:` / `relative-size:`
  hint in either bracket (`size:` and the `(…)` form are Tailwind 4's — v3.4 emits nothing for `text-[size:…]`, a dead class
  that still silences; no real file holds one), a keyword of CSS's closed `<absolute-size>` / `<relative-size>` lists read
  whole to its `]` — ONE keyword group, one `]`: `md:text-[x-large]`, `lg:text-[small]`, `md:text-[larger]`; a named colour
  (`[mediumseagreen]`) or `[smallish]` is none —; Tailwind 3's `[theme(fontSize.2xl)]` is not taken); never a colour —
  `dark:text-white`, `hover:text-[#111]`, an untyped
  `[var(…)]`, which Tailwind reads as one, daisyUI's `text-base-content` —, an alignment (`md:text-center`) or a wrap; review 2
  of 1.38: any variant `text-` did, a colour's too, so a hero beside a nav link's `hover:` colour was silent, ~70 % of
  Breeze's and Jetstream's view files), nor in a `partial` file. The trade-off: a project's own size key under a variant
  (`md:text-hero`) is no size here — the bare one warns, the team silences it (ui-code-scan.md says so); and 1.38's limit,
  R3-UI-1's too: a size under a variant on ANOTHER element silences the file's bare one (`lg:text-[small]` as `md:text-lg`,
  per file). A sheet's `@apply`
  sizes are decided over its `@apply` statements by the same const (their variant size drops the `@apply` sizes, never the
  sheet's declarations), a markup file's class lines and its `<style>` block apart (as before; deciding them as one — 1.39's
  D1, 1.40's A2 for the variant flag alone — cut twice: History → UI checks, 1.40.0). A conditional `@apply`
  holding ANY `text-` utility still sets (2)'s `condSize` (`RE_TW_TEXT_ANY`, F0c's — a colour in a `@media` drops the sheet's
  sizes: designed in 1.39 inside D1 and cut, cut again in 1.40 — none of the 163 real files holding an `@apply … text-` holds
  one in a conditional block, History → UI checks, 1.39.0 and 1.40.0). An element's own `style` is
  decided on its tag, never deferred. Never: the `font` shorthand, a custom property
  (`--font-size-fluid-3`), a CSS-in-JS template line of a script. The walker keeps a statement's last 2,000 characters, so a
  longer declaration's property is not seen (a hostile shape only). `width-viewport` (`100vw` / `w-screen`) was cut to prose
  (ui-responsive.md): 1 real defect in 16 corpus hits — fixed overlays, compiled utilities, clipped decorations. (1.39) That
  prose said "the visual review measures the sideways scroll instead" — false: its captures hide scrollbars (ui-review.md's
  `--hide-scrollbars`, Playwright's every headless launch — ITEM_2 measured Chrome's scroll width 1258 over a client width
  of 1243 with them, 1258 / 1258 without), so a `100vw` box scrolls nothing there; it now says nothing measures it — check
  an in-flow one by hand at a desktop size, scrollbars shown (a 17-docs row pins the capture line's flag, the reason).
  Keeping the scrollbars in `floor-zoom` was cut (CRIT_2 cut 3: scrollbars shrink the client width, "the width got"
  undefined — again in 1.40: 625 against 640 on every tall page), and `width-viewport` stays prose (ITEM_2: 22 boxes in 18
  clones, 15 left after the best property, 1 likely defect; 1.40: 78 boxes in 15 of 38 repos, 46 `fixed`, the rest decided
  by the page's height, a clipping ancestor, the platform's scrollbars — no syntax: History → UI checks, 1.40.0).
- **One file** — `uiChecksOf(lines, rel, over)` over `viewLines`' lines (the ONE line walk — Raw values above: each line cut at
  `DS_LINE_MAX`, its comments out, `cut` when it was longer; `over`, review 1 of 1.38: the file is longer than the text read —
  featureReport's two calls and the inventory's `feed` pass it) → `{findings: [{rule, line, value, silenced}], focus, past, cut}`;
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
  `DS_TAG_LINES` — 30 lines — or `DS_TAG_CHARS` — 4,000 characters — counted, `tag-length`, when the tag could have held a
  finding (`mayFind`: an element, or one whose read part names a click or paste handler — review 2 of 1.37: a component's
  30-line props, shadcn's `<DayPicker classNames={{…}}>`, were a limit line on 6 % of cal.com's view files); or none before the end of a line
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
  `tag-length`; one still waiting at the file's end — an end tag HTML lets one omit, `<li onclick>…</ul>` — counted too,
  review 2 of 1.37), it is a finding only when the body holds content a user reads (literal text, an expression that is no slot
  outlet) and nothing that is or may render a control — a tag focusable by default (its click bubbles; a `<label>` is none,
  never focused itself: review 2 of 1.37), a component / custom element / member, `<slot>` (and `<ng-content>`), a slot
  outlet (`{children}`, `{props.children}`, called too — `{children(state)}`, `{children?.()}` —, `{@render …}`, a Blade
  `{{ $x }}` or `{!! $x !!}`: review 2 of 1.37), a line cut at `DS_LINE_MAX`: a doubt, clearing every candidate open (the control is in each body). An
  empty body or one of elements alone (an overlay layer, an icon `<svg>`) is a doubt too. Nested candidates each get the
  text seen while they are open (`textMark`); a close tag pops the elements opened since to its own name, an unmatched one
  costs nothing (a count by name); each character read once (hostile bodies ≤ 3×, below). (1.39, D4) Vue's `<component>`
  — no HTML element has that name — is judged as what its `is` names (`judgeTag`'s `name`): a BOUND `is` (`:is`,
  `v-bind:is` — any `boundName` form; `bound`) is a component — no click candidate, its own `style` not judged (vben's
  alert.vue, `<component :is="… || VbenButton" @click>`: 2 of the corpus's 25 click-no-keyboard findings, both false) —
  yet in a click body it stays what 1.38 read (no CONTROL: `kind` undefined): ITEM_2's design made it a control there, and
  the oracle replay found that silencing two TRUE findings the design had not counted — vben's preset tiles
  (`blocks/layout/content.vue`, `blocks/theme/theme.vue`: a `<div @click>` holding a preview's or an icon's
  `<component :is>` and the tile's name); the narrower reading keeps them, and a `<div @click>` whose `<component :is>` IS
  a button warns as in 1.38 (a fixture); a STATIC `is` is the element its literal names (`RE_ELEMENT` on the value as
  written, its quotes off — `is="MyCard"` is a component, a control in a body as any component; `is="button"` focusable, a
  control in a body too; `is="img"` void); with no `is`, and an `is` on any other tag (a customized
  built-in, `<div is="x-panel">`), the tag as written; img-no-alt (`<img` as written) and paste-blocked (any tag) never read
  it (no widening: `<component is="img">` is no img-no-alt).
- **paste-blocked** — any tag (a component passes it down): an inline handler that cancels (`preventDefault`, `return false`)
  and reads no clipboard (`RE_READS_CLIPBOARD`, the API — `clipboardData`, `navigator.clipboard`, `getData` —, never the
  word: review 2 of 1.37, a handler's own "Pasting from the clipboard is disabled" excused it), or a bare `.prevent` /
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
  of no type or one focusable by default and never one REQUIRING `[tabindex="-1"]` (`RE_TABINDEX_OFF` outside a pseudo-class's
  arguments, `outsideParens` — review 1 of 1.37: `main:focus`, `h1:focus`, `[tabindex="-1"]:focus` hold focus a script
  moves out of the tab order, a skip link's target; review 2: `:not([tabindex="-1"]):focus` is every reachable one) —
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
  corpus's candidates; the token's variants cut at `:` OUTSIDE brackets, `variantsOf` — a named variant's arbitrary value
  read whole, so `has-[:focus-visible]`, `group-[:focus]`, `peer-[:focus]` are relational too (review 3 of 1.37: cut at its
  `:`, the value's `focus-visible]` read as the element's own), an arbitrary variant (`[&:focus]`, `[&_*:focus]`: `&` is the
  element) by its `:`-cut pieces as before; a token the class split cut inside its brackets — at a quote or a `=`,
  `has-[[data-slot=x]:focus-visible]` — reads as before). The file's FOCUS STYLE: a rule naming `:focus` /
  `:focus-visible` / `:focus-within` (or inside one)
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
  A markup file's `<style>` block: its opening tag's line is a CSS line (viewLines), so the block's FIRST rule carries it in
  its prelude — read without it (`RE_STYLE_TAG`, 1.38: an at-rule there read as none since 1.37, a print / reduced-motion /
  conditional block — outline-removed, transition-all, font-size-viewport false positives on an SFC; a first rule's value
  named the tag); a SECOND block's first prelude carries the first's `</style>` line before its own tag — stripped with it
  (review 1 of 1.38: Vue's documented global + scoped pair, `@media print` / a condition / keyframes there). Not Astro's
  `<style define:vars={{…}}>`: the walker opens blocks on its braces and the next prelude reads `> @media …` (the user docs
  say to silence it; designed in 1.39 as D2 and cut, cut again in 1.40 — 0 of 103 real blocks change a verdict; a local
  form measured then, and its gaps: History → UI checks, 1.40.0).
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
  report read "nothing"): `count` (the unsilenced candidates, past a file's cap too), `file` / `line` (the first LISTED
  one, by file then line — one past a file's cap has no line and is named only when none is listed: the first file, in the
  report's order, holding one, no `line`), and for focus-chars `sheet` (the sheet that ended the search), `chars` (the
  bound, `DS_FOCUS_CHARS`) and `alone` (that sheet alone is longer than it, else the characters parsed before it would
  have taken the search past it — review 3 of 1.37: the clause named no bound, nor that one compiled sheet was the cause). The
  CLI prints that line in place of `uiNone`; spec_finish says it (below); (1.38) each of the three clauses (`dsLimit`
  focus-sheets / focus-chars, `finish.uiUnjudged`) points to the project inventory, which judges them over every view file
  (The project inventory, below — the feature report and finish keep these bounds: CRIT_1 must-fix 1, the owner's ≤ 2×
  finish bar). The bounds are measured, not chosen (History): the highest that kept, in
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
  (`eslint-disable-next-line jsx-a11y/…`, `svelte-ignore a11y_…`) is not read (the user docs say so). The project's switch
  for a whole rule is the `_UI checks off:_` marker (1.38, below); a finding both silences counts as silenced (the comment
  first).
- **The feature report** (`featureReport`) — its view files are those `uiViewFile` takes (1.38: THE view-reader predicate, the
  project inventory's too — a view or style file that is no test (`isTestFile`: 1.38 adds `__mocks__/`, `__fixtures__/`,
  Cypress's `*.cy.<script>`), story, mock / fixture by name, type declaration); the text it reads once feeds the raw values AND `uiChecksOf` (CRIT_X decision 6);
  its token files (a globals.css it edits) are read for the checks ALONE — never for raw values, never in `viewFiles`, within
  `DS_VIEW_FILES` files read in all. `uiChecks` (`uiChecksReport`) = {findings (the first `DS_LIST`: rule, level, file, line,
  value — warn first, then by file and line), total, byRule, silenced, off?, offIgnored? (1.38 — the marker, below), limits}; its limits — EVERY bound that cut a read or
  dropped a finding, one code a bound (review 1 of 1.37: a long line, a file's 200 findings and its 256K read dropped real
  findings with `limits` empty): `view-files` (the feature's file cap cut what the checks read), then with {read, count, file
  (the first)} `view-size` (a file longer than `DS_READ_CHARS`: read DS_READ_CHARS + 1 to know), `line-length` (lines cut at
  `DS_LINE_MAX`), `tag-length` (reads past the tag reader's bound), `file-findings` (findings past a file's 200: counted in
  total / byRule / silenced, never listed), then `focus-sheets` / `focus-chars` (with {count, file, line?}, focus-chars {sheet, chars, alone}: the
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
  removals a focus search left unjudged its last clause (`finish.uiUnjudged`: the count, the first file:line, why — at the
  characters bound, the bound and whether one sheet alone passes it), or,
  with no finding, that clause the warning alone (review 2 of 1.37); `res.designSystem.uiChecks` only when it has findings
  or that limit (the 1.35 shape otherwise). The report's other bounds never reach finish's text. A rule the project
  switched off (1.38) never reaches it: finish reads a report that holds none — its code is unchanged.
- **The project inventory** (1.38 — item 1 as the DECISIONS cut it) — spec_scan {designSystem: true} / `dev-spec
  design-system` WITHOUT a feature, when the OPERATION asks: operations.js passes `{uiPass: true}`, the engine's default runs
  no pass (the 204 direct `designSystemReport(` calls of the suites keep their result and their timings — CRIT_X D4; never an
  MCP or CLI argument; a feature report ignores it). `uiChecks` = {read, total, silenced, byRule, rules: {id: {level, files,
  file, line?}}, off?, offIgnored?, facts, limits} — COUNTS, never a list (no `findings` key: it never reads as a clean
  list), never finish. `uiProject(scan, reg)` (design-system.js) reads AFTER scanCode, on its own (sharing settle's and the
  exports loop's reads saved the bare read alone — parsing is 70–85 % of the pass — and threaded the read through settle:
  cut, CRIT_X D4), the walk's view files that pass `uiViewFile`, the stylesheets first (a pass a bound cuts has read the focus
  styles it could), then the shorter path; each file's first `DS_READ_CHARS` (one more asked for: `over`), `DS_UI_FILES`
  (5,000) files / `DS_UI_CHARS` (32 MB) characters at most. A STYLESHEET past the read (`over` and `RE_STYLE_EXT` — a
  compiled bundle) is fed with no line (review 1 of 1.38, UP-1: Bulma's 13 were most of its pass): counted in `read` and in
  `view-size` (which names the first over-long file by path, maybe not it — the CLI line says the project's checks skip such
  a sheet), never parsed — its rules, focus styles and motion unseen: a removal elsewhere only its focus styles would have
  excused stands, where a feature report may excuse it (its focus search reads a sheet whole up to `DS_FOCUS_CHARS`; none
  on the clones: Bulma's and cal.com's other files hold focus styles; ui-code-scan.md says it — review 2 of 1.38, R2-UP-2;
  designed in 1.39 as D5 and cut, cut again in 1.40: 0 of the 15 repos with such a sheet). A feature report and finish keep 1.37's read of its first `DS_READ_CHARS` (a fixture). `uiProjectPass(bounds, offs)` (ui-checks.js) is fed each file ONCE
  and keeps counts — its memory bounded by the rules, never the files: per rule its count (past a file's `DS_CHECK_PER_FILE`
  too — CRIT_1 must-fix 7), the FILES holding one (never the findings), its first place by file then line (a place past a
  file's cap has no line and is named only when no listed place exists — the feature report's unjudged rule); an
  inline-silenced finding in `silenced`; `byRule` / `rules` in `UI_RULES`' order (warn first). outline-removed under the 1.37
  excuse rule at PROJECT scope (CRIT_1 must-fix 2): any focus style in any file read — a class-list focus utility in another
  view file too — excuses every candidate, the feature report's rule over every view file, so the removals its focus search
  leaves unjudged past `DS_FOCUS_SHEETS` are judged here (a parity fixture: the inventory and the feature report agree on the
  same files); a pass a bound cut with no focus style read judges none. On the same files only: a feature report looks in its
  own files and the project's stylesheets alone, so a focus style only in a view file outside the feature (a Button's
  `focus-visible:ring-2`) excuses a removal in the inventory, never in that feature report or its finish (review 1 of 1.38,
  UP-6 — kept: a class-list search project-wide reads every view file; ui-code-scan.md says it; cut again in 1.40: the
  feature reports would lose 91 warnings, ≈ 55–60 % of them certain defects — the inventory's excuse hides about as many, a
  1.41 count). `limits`, its own — never the report's `limits`,
  `truncated` or `inSync`: `ui-files` {read, count?, file?, line?: the removals it left unjudged}, `view-size`, `line-length`,
  `tag-length` {read, count, file: the smallest path}, (1.39) `motion-scripts` (the fact's script search, below) (the pass
  builds them; featureReport builds the feature's). The CLI
  prints it after the registry part (`uiProjectHead`, `uiProjectRule` a rule — `uiReportTag` for a report-level one —,
  `uiProjectNone`, `uiSilenced`, the off lines, the fact, its limits; never "nothing" beside a `ui-files` count). `uiProject`
  is exported for its fixtures (a truncated walk takes 20,001 view files: a scan of the same files marked truncated; 1.39: the
  script search's bounds and order over scans built in the test — `{views, scripts, truncated}`).
- **Motion and the fact `no-reduced-motion`** (1.38, `UI_FACTS`) — `uiChecksOf`'s `motion` {count: the LINES declaring
  motion, line: the first}, never a finding, from its OWN predicate (CRIT_X D5b: never transitionAll's, never item 2's
  `RE_MOTION_PROP` — the properties that hold times): `@keyframes` (a vendor prefix; `RE_KEYFRAMES`, anchored, on the
  prelude `sheetChecks` reads — a `<style>` block's first rule without its tag line, `RE_STYLE_TAG`), `motionOf`: `animation`
  / `animation-name` naming one (never `none`, a global keyword, a lone `var()`), a `transition` item naming `transform` /
  `translate` / `rotate` / `scale` for a LITERAL time over 0 (the first time is the duration: `transform 0s 1s` is none;
  never `transition-property` — it holds no time —, opacity, a colour, `all`), `scroll-behavior: smooth`; `twMotion`:
  Tailwind's `animate-*` but `animate-none` (tailwindcss-animate's `animate-in`), `transition-transform`, `scroll-smooth`,
  under any variant (`RE_TW_PICK` widened; a motion utility under a focus variant still DRAWS — `focus:animate-pulse` stays a
  focus style); a script line's style object / inline style (`scriptTransitions` reads `animation` / `animation-name` /
  `scroll-behavior` too — an `animation: 1s` value never reads as transition-all). The FACT, the inventory's alone (never a
  feature report's or finish's; WCAG 2.3.3 is AAA): the files read declare motion and NONE of the texts read mentions
  reduced motion — `RE_REDUCED_ASK` on each WHOLE text as read, never its lines cut at `DS_LINE_MAX` (a minified sheet's
  media query sits past the cut) — and NO view read was cut (CRIT_1 must-fix 6: the walk, `ui-files`, a file's `view-size`
  — a mention may sit in what was not read). `facts: [{code, count, file, line}]`; the CLI's `uiFact[code]` ("none of the
  project's view files and scripts read mentions"). framer-motion props (`animate={{x}}`) are not motion — the fact is said
  less, never wrongly. (1.39, D6 — CRIT_2 must-fixes 5–7) THE SCRIPT SEARCH: only where the fact is about to be said —
  `uiProjectPass`'s `wouldSay(cut, truncated)` is THE `said` predicate, named and asked twice (by `uiProject` before `done`, by
  `done`), so a view's mention, no motion, a cut view pass, a truncated walk or a view-size cut read no script (a spy
  fixture on each entry's `full`) — `uiProject` reads `scan.scripts` (scanCode's every-script list, the one settle reads,
  returned as a key since 1.39 — no read shared with settle: CRIT_X D4) that are no view file (each file read once), no test
  (`isTestFile`: an `e2e/` helper), no story / mock / declaration (`RE_NOT_COMPONENT_FILE`), the shorter path first then by
  path, each to `DS_READ_CHARS`, and hands each text to `pass.mention(text)` (`RE_REDUCED_ASK` again — the views' own
  predicate, never a second one) until the first mention (the read ends there: a cost guard, timed — 400 scripts whose first
  mentions ≤ 0.5× the same 400 with none) or `DS_MOTION_SCRIPTS` (2,000) files / `DS_MOTION_CHARS` (8 MB) characters, the
  next past either unread. A mention takes the fact back; it can never add one. A search a bound ended, or that read a script
  only in part (past 256K), keeps the fact, and the inventory's `limits` gain `motion-scripts` {read, bound? (files · chars:
  WHICH bound ended it — CRIT_2 must-fix 5), count?, file? (the scripts read only in part, the first by path — not the first
  read)} beside the fact or its off count (an off fact is searched too: its `off` count is the fact as it would have been
  said); a search that read every candidate whole says nothing. Never the report's `limits`, `truncated` or `inSync` (1.38
  D5d). The CLI line (`dsLimit["motion-scripts"](read, file, count, bound)` — the inventory's limit loop passes `l.bound` as
  its 4th argument) says "the first N, the shorter path first" only when a bound ended it. The two reads — the views', the
  scripts' — are ONE loop, `readHeads(list, files, chars, take)` (design-system.js: read ahead, each file's head and `over`,
  the bounds, `cut: null | files | chars`; CRIT_2 must-fix 7: a second copy trips 16-conventions-duplication). Said less,
  never wrongly: a test SETUP is no test by name (`jest.setup.js`, `vitest.setup.ts`, `playwright.config.ts`'s `use:
  { reducedMotion }` — it only EMULATES the preference for the tests, so a true fact can go with it —, `setupTests.ts`), so
  its mention takes the fact back, outside a test folder (`src/test/setup.ts` is a test file, never read; ui-code-scan.md: "a
  test setup's outside a test folder included"); so does a comment or a vendored script outside `vendor/`
  (`assets/fontawesome/js/all.js` — the walk skips `vendor/`). The fact is said on 4 of the 18 clones in 1.38
  (motion-primitives, sakai-vue, taxonomy — true; outline — false, its reset in a styled-components
  `shared/styles/globals.ts`). Measured on the implementation (review 1 of 1.39, one process, interleaved): the search stops at
  outline's 207th script (+174 ms, loaded); taxonomy +11 ms, motion-primitives +1, sakai-vue ≈ 0; a search that reads every
  script or reaches its bound ~1.2× (outline with its mention edited out ×1.20, +280 ms; a 158-view tree with 3,400 scripts
  ×1.23 quiet, ×1.5–1.7 / +240–350 ms re-measured by review 2 — accepted as said) — CRIT_2's prototype said +1 to +27 ms;
  cal.com itself never searches — its views mention; the 8 MB bound is
  reached on no clone (cal.com's first 2,000: 4.9 MB). What the bound hides: a mention past the
  2,000th script or 8 MB (cal.com's first sits at its 1,002nd). (1.40, R2-UD-1 — the owner KEPT `DS_MOTION_SCRIPTS` 2,000)
  Its cost is the scripts it OPENS (Windows scans each open): on a LARGE real tree too — naive-ui, 2,031 views, 1,108 scripts
  read, none mentions: the project report ×1.48 on Windows (1,032 against 696 ms with the search off; ×1.51, +726 ms, in a
  second loaded series), ×1.03 on node:22 (+23 ms, at noise); at the bound, 2,000 scripts beside a 158-view pass, +412 ms on
  Windows, +82 / +106 ms on node:22 / node:24-alpine. It runs on 8 of 38 real trees, and a 500 bound would change no fact on
  any (the one mention among them sits at outline's 207th script; carbon's, vben's and cal.com's deeper ones are in trees
  whose views mention — never searched), adding a `motion-scripts` limit on canvas-kit and naive-ui.
- **The marker `_UI checks off: <rule-id> (reason)_`** (1.38 — the registry's `checksOff`, Design-system registry above) —
  `uiOff(reg)` → {off: Map(id → reason), ignored: [{entry, why, read?}]}: an entry is APPLIED only when its id is a rule's
  or a project fact's (`UI_RULES` ∪ `UI_FACTS`, at call time — F0c's font-size-viewport is one: CRIT_X D7.4) and it gives a
  reason in parentheses; else it is not applied and the reports say why — `no-reason`, `unknown-rule`, `unreadable` (not
  `<id> (<reason>)`: CRIT_1 must-fix 10), `past-bound` (the entry past `DS_MARKER_ENTRIES`, with `read`); an id named twice:
  the first. An applied rule is hidden PROJECT-WIDE — counted, never listed: the inventory's `off` (the fact too: its count
  when it would have been said; an off outline-removed counts its unsilenced CANDIDATES — no focus excuse is asked of an off
  rule, in either report), every feature report's `off` (`offKeys`: the RULES alone; an inline-silenced finding stays
  `silenced`, the comment first; a finding past a file's cap counted there; the focus search never runs for an off
  outline-removed) and so finish, which reads that report. `off` / `offIgnored` appear only when the marker holds an entry (a
  project without one keeps the 1.37 shape). Its spellings, in the user docs (review 1 of 1.38, UP-7 — prose alone): a line
  of its own, as `_Token sources:_` (`RE_DS_MARKER`, anchored: a list item or a bold `**UI checks off:**` is no marker — read
  as nothing, said nowhere), each id bare or in ONE balanced code span (1.39, UP-7 — `RE_DS_OFF_ENTRY`'s two branches: the
  docs write ids in one, so the 1.38 docs' own spelling read `unreadable`; a lone backtick on either side or a doubled pair
  is another shape — `unreadable`; the list item and the bold line stay unread: the anchor is `_Token sources:_`' and
  `_Libraries:_`' too — 1.40: no public design-system.md holds any registry marker; a reader, on a user's report, is one for
  all three). The CLI prints the off line (`uiOff`: rule, the findings it hid, its reason)
  and each entry not applied (`uiOffIgnored[why]`) after the silenced count. A design-system.md written only for the marker
  enrols the project in the registry (`ui-design-system`, finish's New-component append — the user docs say so, CRIT_X D3);
  what-input's modality removals (`[data-whatintent='mouse'] { *:focus { outline: none } }`: no syntax tells a modality
  scope from a page scope — a name list) are judged as written: the inline `ui-check-off: outline-removed` on that rule is
  the narrow answer, the marker switches every removal of the project off (1.40: 18 such removals stand in 147 what-input
  repos — 15 modality-only, false; 3 on `input:focus, textarea:focus` lists).
- **Cost, as ratios** (mcp/tests/15-quality-ui-checks.js, measured at the same moment): ten hostile 256K inputs — unclosed
  tags, a line of tag starts one `>` closes, braces and quotes that never close, a string's tags, runs of focus variants and
  of `ui-check-off:`, a transition of endless items, a sheet of nothing but `{`, and (review 1 of 1.37) four click bodies —
  nested candidates never closed, unmatched close tags, a control in each body, an expression that never closes, and (1.38)
  four for font-size-viewport — runs of `text-[`, class lists of bare viewport sizes a variant one ends, a sheet of
  line-long `calc(1vw + 1vw + …)` values, inline styles of non-viewport sizes — each ≤ 3×
  plain JSX of the same size (measured 0.07–2.5×) — a file whose every line is a finding is not one of them and is not
  bounded: ~4× (review 2 of 1.37, hostile3: a 256K HTML file of an `<img>` a line 4.0–4.3×, a TSX one 3.3–3.6×, a sheet
  of removals 2.7×, the same on the parent); the checks ≤ 3× the raw-value read of the same files (1.0× on 526 real
  ones); a finish without a registry ≤ 1.5× the feature report it runs (~0.9×); the feature report with the focus pass AT
  its bound ≤ 2.5× the same report with no candidate (the owner's bar after review 1's follow-up; one project, two features
  reading the same views, 1,000 sheets none naming focus: 1.2–1.3× at 48). The sheet of braces is the walker's every block: three allocation-free
  fast paths in styleTokens (`unmaskInterpolation` of a text with no mask, `pageWide` of an empty prelude, `RE_MIXIN` only
  after an `@` — the last a cost guard alone: +45 % on that sheet without it, under the bound) took it from ~5× to ~1.5× —
  tokens, raw values and every event byte-identical on the 2,493 real stylesheets of the F0 corpus. (1.38) Five motion
  inputs join them — runs of `animate-`, class lists of motion utilities, a transition of endless transform items, a sheet
  of keyframes, a style object's endless animation list: 0.08–1.34× (`RE_TW_PICK`'s widenings, F0c's `text-[` and these,
  in ONE set — CRIT_X D4). G1′ (mcp/tests/15-quality-ui-project.js): the project pass — the report with it less the report
  without — ≤ 1.5 × (a bare read of its files + `uiChecksOf(viewLines)` of the same texts in memory), on 400 real-shaped files
  ~70 % Bootstrap-like Sass by characters (parsing unminified CSS is a Sass tree's cost), interleaved: 0.96× measured. The
  project report with the pass is NOT bounded against 1.37's: it opens and parses every view and style file the pass reads,
  so its ratio is high where 1.37's report read almost nothing (a small CSS / Vue tree) — the measured spread per clone is
  in History (1.38.0 review 1, the cost).
- **Not in 1.37, 1.38, 1.39 nor 1.40** (cut — CRIT_1, the decisions): `autoplay-unmuted`, `img-no-size`, `motion-layout`, the
  `motion` raw kind (item 2's), the `addEventListener` paste form, a `hint` level; 1.38's cuts — deprecated uses (1.39),
  sharing settle's reads, the 5,000 / 32 MB focus bound in the feature report and finish, `DS_FOCUS_*` printed in MB (Vue's
  `:is` / `v-bind:is` and the reduced-motion script search came in 1.39: D4, D6); 1.39's cuts, designed again in 1.40 on a
  corpus built to hold findings and cut AGAIN (History → UI checks, 1.39.0 and 1.40.0 — R3-UI-1 alone came in, above) — D1
  (a markup file's template and `<style>` decided as one file for font-size-viewport: it hid three true findings 1.38
  caught; 1.40: 144 real ones in one repo), A2 (D1 for the Tailwind variant flag alone: a true and a doubtful shape flip
  together), `RE_TW_TEXT_ANY` narrowed (no real conditional `@apply … text-`), D2 (Astro's `define:vars`: 0 of 103 real
  blocks), D3 (`:is()` / `:where()` / `:not()` / `:has()` focus selectors: 0 of 661, then 1 of 4,026 candidates — Svelte's
  `:global()`, the element's own), D5 (a skipped sheet's focus styles: 0 cases), the floor-zoom capture keeping
  scrollbars, `width-viewport` as a rule, S12 (harness folders as test files: 0 findings; ~300 code files would turn
  tests), UC-1 (a bound `:is` holding one literal: 1 in 504 `<component>` tags, 0 verdicts), the marker's list-item / bold
  spellings, S9 and UP-6 (prose: a modality-scoped rule — 15 false of 18 in 147 what-input repos —, a feature report's
  focus search over every view file — it would hide true removals).

## UI state matrix (1.38)
+ui's `[UI] UI States` scaffold ends in a state matrix (the template — markdown-and-trace.md → Readers, tracks.md): `State` ·
a column per view · `Announced · focus`, a row per listed state (16 English-stable ids — languages.md). Doctor's `ui-states`
reads it: quality.js `uiStatesCheck` over `uiStateMatrix`, the `DOCTOR_CHECKS` entry right after `ui-deprecated` (phase 2, the
same `uiDesigned` feature, never once `state.finished` is recorded). The user docs: ui-design-patterns.md → The states every
view needs (the detail points there), tooling-reference.md's id.
- **The anchor** — a table of the section (`extractSection` with the UI States synonyms, the section ui-sections reads, then
  `mdTables`: comments and fences out — a table under another h2, a contract's, is never read) is a matrix when one header
  cell's words ARE a localized `quality.uiStateA11y` (`usWords`: accents folded, lower case, the whole cell — `Announced`,
  `Announced · focus (WCAG)` are none). Never by its rows: a state machine (`State | Event | Next state`) or a component's
  own states table carries no such cell. Lost: a hand-built matrix without the column — read as prose (`usNone`).
- **The views** — the columns strictly between the first (the state) and the anchor; a header holding no letter or digit, a
  `[slot]` or a generic word is none (`dsSlot`); no view → no matrix. The a11y column and every column after it (a `Notes`)
  are never judged — what they say is the critic's and the reviewer's; judged, deleting the column silenced the warn.
- **The rows** — `uiStateOf`: the first cell's words begin with a label's — the label's LAST word may be the start of a longer
  one (`Errors`, `Error — recoverable`, `Loading (skeleton)`, `Exito`), every other word whole (`Nothing found` is not Not
  found) — in EN / PT / ES / pt-BR (`uiStateNames`, below). No synonym list: a renamed row (`Spinner`) names nothing and the
  warn names the label to use. A state's rows are joined: a view is answered when one of them answers it.
- **The cells** — `uiStateCell`: open (`dsSlot` — nothing, a mark, a `[slot]`, TBD —, or an n/a whose reason is under four
  words: `naAnswer` `na-short`), `na` (`naAnswer`, markdown.js, exported for it — the sized-section rule), designed (any other
  words). A row whose ONLY view cell holding a letter or digit is an `na` answers every view (one "n/a — why" says the state
  does not exist here); another worded view cell, TBD included, is judged on its own; the a11y cell never counts.
- **The verdict** — the section's own state first (`sectionState` at size m, as ui-design-system reads its section):
  missing / unfilled / template → a pass, `usUnfilled` (ui-sections and the placeholder gate own it — the untouched matrix is
  template lines by F0b's row key — a matrix of `TBD` / dashes is not: its cells are written for that key, so ui-sections and
  the m / l gate pass it and only this check says each is open, the owner's ruling in 1.38.0 review 1, BS-3 — and the gate
  judges the SECTION: once a line of it is written, its TODO gone, an untouched matrix passes it too and this check warns about
  every cell, R2-DOC2); `na` → a pass,
  `usNa`; no anchored table → a pass, `usNone`. The gaps — `no-row` (once per table: each anchored table is a matrix of its
  own, two never share their rows — ui-design-patterns.md says a row per state in each, BS-4) and `open` (per view and
  state), counted together — WARN at size m / l and with no size (`usOpen`: per table its
  no-row item, then each view's open states — `US_SHOWN` (5) named per item, six items, the rest counted; `usTable` names the
  table's place in the section when it holds several matrices); at size s the same detail is a pass (`usSmall`); none →
  `usOk(views, states)`. The labels in the feature's language; detail only (`{id, status, detail}` — `state` for the tests).
- **No gate, no stamp** — never a fail, not `warnsOnly`, not in `GATES`, not in the save hook, finish or the brief. No stamp:
  no design approved before 1.38 can hold the anchored header (gates-and-approvals.md → Gates). spec_upgrade lists it as
  ADVISORY — `UI_STATES_CHECK` beside `DESIGN_WEIGH_IDS` / `CRITICAL_FLOW_IDS` in upgrade.js: no `warnings` attention.
- **Bounded** — `US_TABLES` (10) tables, `US_ROWS` (60) rows each, `US_VIEWS` (12) view columns, the anchor looked for in a
  header's first `US_HEADER` (64) cells (1.39, BS-5 — past them, none found, the table is none and `truncated.views` says a
  bound cut: no new flag, CRIT_3 must-fix 6; found within them, the cells after it are never read, nothing said); every
  cell cut to `US_CELL` (400) before any regex; a bound that drops input appends `usTruncated(US_TABLES, US_ROWS, US_VIEWS,
  US_HEADER)` to the detail (`usNone` too): it names every bound — the tables, the rows, the view columns and (1.39.0 review
  1, BU-5) a header's first 64 cells, so an anchor past them is said by its own bound, not by the view columns'. Linear:
  the section reader dominates — `uiStateMatrix` costs ~0.1–0.35× `sectionState` on the
  same text (a 5 MB cell, 200K rows, 20K tables, a 1M-word label, and since US_HEADER a header of 200,000 cells, the anchor
  last: ~0.3×, 1.38's 2.1–2.8× — each header cell's words were read for the anchor before `US_VIEWS` applied); 1 MB cells
  cost what a same-size prose section does (15-quality-ui-states.js, ratios).
- **Every language, from the corpus** — the labels and the anchor cells of EN / PT / ES / pt-BR come from the corpus key
  `uiStateNames` (markdown.js `uiStateNames()` / `renderUiStateNames()`: `<id>\t<label>` lines, `UI_STATE_A11Y` — `a11y` — as
  the anchor's id; architecture.md → The build): an English doctor loads no pt.js / es.js (a child-process fixture). The
  state ids order the gaps: the feature language's `uiStateLabels` keys.

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
- **1.37.0 review 2** (the registry: 4 LOW, two of them review 1's own regressions) — R2-1: RB-3's "whatever follows the
  word that is no letter" let a BLANK open the marker, wider than the docs' "punctuation after the word": `_deprecated props
  removed_`, `` `dense` prop (_deprecated in v2_) `` and a successor's `replaces the _deprecated Table_` retired their rows
  (the successor's voided every `use DataGrid`, and a 1.36 project's doctor and spec_upgrade gained an unsilenceable
  warn), `_deprecated-flag_` and a path cell `_deprecated/Table.tsx` too (the path emptied). Narrowed to the docs: the first
  non-blank character after the word is no letter or digit, and the name reader's joiners (`-`, `/`, `.`) before a letter
  or digit make a longer name — the owner's decision named `-`; `/` and `.` were taken with it, the narrower reading,
  because 457d3da read the path cell and `_deprecated.tsx` right and the joiners are one property (RE_DS_NAME_WORD's), not
  a list. The cost, documented: `_Deprecated in favour of X_` and `_Deprecated since 2.0: use X_` are notes again (the
  `favour` fixture moved to "not a marker"). R2-3: the warn printed the marker's spelling (`use data-grid`) while only the
  registry's (`DataGrid`) silenced it; it prints the one expression the silence compares. And review 1's survivor came back
  as a regression: with `dsLetters`' NFD step deleted, notes writing `á` as `a` + a combining mark warned (457d3da's folded
  key silenced them) — and the mark is no letter, so `dsNameIn` split the word in two: the fix is NFC in `dsNameIn` (one
  form for the words, which also gives a marker written so its NFC row back) and in `dsLetters` (a registry name written
  so); accents and case are still kept. R2-2 (prose): RB-5's whole-name word drops `Dialog/Sheet`, `Dialog.Root`, a path
  and `DataGrid-based` as replacements and as silencing notes — the user docs say to name the replacement by its name alone.
  R2-4 (prose): a capitalised sentence start silences (`Dialog to confirm the delete`) — documented with the advice to
  write a component kept on purpose in a code span or a tag; no sentence-start rule. The reviewer's scripts replayed on
  0753c76, 457d3da and the fix: every difference from 0753c76 is R2-1's (the notes and paths 457d3da read, `favour` /
  `since` / `_Deprecated in favour of Card_` notes) or R2-3's (the warn's spelling, the NFD notes); a 1.36 project passes
  doctor and spec_upgrade as on 457d3da. The mutation list came before the fixtures: 16 mutants (9 on the regex — the blank
  run, each joiner, a joiner across blanks or before no letter, an em dash joined —, 3 on the printed name, 4 on the NFC
  steps), 16 killed, each by its own fixture. Lesson: a mutant that survives is a shape no fixture asks for — before
  deleting its line as dead, ask the parent tree whether that shape was right there.
- **1.37** (the base the UI checks read through, before them) — `viewLines`, rawValuesOf's loop head as a GENERATOR (CRIT_1
  must-fix 3: over a list, the 200-value early exit still read every line), and styleTokens' walker handing its structure
  to an observer (block / statement / close events — CRIT_1 must-fix 2: no second prelude tracker). Both proved
  behaviour-preserving on a corpus of real files: the raw values of 5,256 view files (39,700 values) and the tokens of 2,493
  stylesheets (27,663) byte-identical against 1.36, with and without an observer; the UI checks' chain added the
  statements' `from` and three allocation-free fast paths with the walker's 206,379 events unchanged (one sha1). Cost:
  rawValuesOf alone 1.03–1.28× the parent on a 20,000-line sheet (within the 1.5× bound); the walker without an observer
  0.94×. Mutation passes: 10 of 10 (one equivalent in output — the pre-existing blank-line skip, a cost guard: 6× on
  20,000 blank lines) and 14 of 14.
- **1.38.0** (item 3 of the owner's 1.38 list, "Responsive": the widths the visual review captures — Breakpoints, above) —
  designed with three code readers (Tailwind 4 `@theme`, `@custom-media`, a Sass map named `…breakpoints`), a loop over files
  named for breakpoints, 8 widths and a `declared` list; the critique (CRIT_3) and the ruling (DECISIONS) cut the last four —
  a framework's own breakpoints sit in node_modules or in files the scan never opens, Bulma's map is nested, a file-name list
  is a name list — and moved the `@theme` reader onto the token walk's events (no second walk; the critic measured one at
  +0.2–3 % of the report: a should). Must-fixes kept: computed for spec_scan {designSystem} alone (4 — finish and the seed
  had run it and dropped it), the walk's observer (5), `bpUnread` pointing to ui.md's line (6), 6 widths (16 images a
  dispatch), `at` for `declared`. Real shapes: shadcn v4 (`apps/v4/app/globals.css:44`: `@theme inline` adding 3xl / 4xl —
  partial, the default set and 2000, 1600 left out and said), shadcn-svelte (the same), tailwindcss.com (two `@theme` blocks,
  no breakpoint — the default set; `@media (width <= theme(--breakpoint-sm))` declares nothing), Tailwind's own reset example
  (complete), Breeze / Jetstream / taxonomy / sakai-vue / Bootstrap / Bulma / Open Props (nothing read — the default set).
  The project report and the seed on those clones are the parent's byte for byte but the new key. Writing the mutation list
  first showed five shapes no fixture could tell (the length regex's lookarounds — greedy left-to-right matching never starts
  inside a number —, rounding a rem × 16, the emphasis marks after the colon, a word pre-test on ui.md, a null text): taken
  out before the pass. Mutation pass: 76 of 76 — one survivor at first (the no-break-space group had no fixture: added).
  Cost, ratios at the same moment: the `@theme` pre-test is a cost guard (the report on 100 candidate sheets without one
  1.14× with it); 100 sheets of 400-declaration `@theme` blocks 1.30× the same as `@themx` (≤ 1.5); the hostile inputs of the
  suite's K2 ≤ 3×. On the clones the machine (three other chains' suites) swung parent against chain 0.74–2.26× either way
  with the roles swapped: no difference to measure — without an `@theme` the added work is an `includes` per walked sheet and
  one ui.md read.
- **1.38.0 review 1** (Breakpoints — BS-1, BS-2, BS-6, BS-7) — the CLI prints the widths joined by ` · ` and its messages
  say to list them in ui.md's line, but the value ended at the FIRST `·`: the printed list pasted read as [320], nothing
  said (MEDIUM). It ends now at the first `·` that no length follows (`RE_UI_END`; the stub's ` · text expansion` still
  ends it, `480 / 960 px · max content width 1200 px` too). Past six widths under `partial`, the default set's 390 / 1440
  were kept over a project's own 1600 (shadcn v4, cal.com, shadcn-svelte): the default set's give way first now — those
  three clones capture [320, 390, 768, 1024, 1600, 2000], 1440 said; `cliOutput.bpLimit` lost "the narrowest 5 and the
  widest" (no longer the rule) rather than gain a second message. A filled value kept in brackets stays the stub's slot
  (prose: ui-responsive.md says to write the widths without them; listing it as unread would be a new mechanism for a LOW
  — 1.39 backlog). K2 times each pair interleaved, the median of 5 rounds of tens of ms, ≤ 3× + 50 ms — over 3 calls the
  ui.md denominator was ~5 ms and the full suite failed it under load; its line pair ≤ 5× + 50 ms (a list line is captured,
  searched and cut, a prose line refused at its first character: 1.5–3× at rest, 4.6× seen under four suites' load). The reviewer's replay (bp-shapes.js, bp-lines.js) against the parent differs in
  the two dot lists and one partial shape (Tailwind's five overridden without a reset: [320, 480, 768, 1024, 1280, 1536],
  390 and 1440 said — was 1280 dropped for 390) and nothing else. Mutation pass (the list before the fixtures): 18 of 18,
  one a timing mutant (the end searched in a 2,000-character window per `·`: K2's line pair 609 ms against 34). Cost, both
  engines in one process, interleaved, medians of 7: the stub, the printed line, prose and 50,000 lines 0.6–1.2× the
  parent (noise); the hostile 256K `1 · 1 · …` line 1.5–2.2× (+2–2.7 ms a report: the parent stopped at its first `·`,
  the fix reads the whole line, linear — K2's line pair holds it); a partial report of 3,000 declared widths
  1.3–1.4× (+0.5 ms).
- **1.38.0 review 2** (Breakpoints — R2-BS-1, made by review 1's BS-2: a subtraction; R2-BS-2, R2-BS-3: prose) — review 1
  filled the places a theme's widths left with the default set's NARROWEST first, so 390 — under any Tailwind theme the
  floor's own layout again (Tailwind's narrowest is 640) — was kept over 768 / 1024 / 1440, and a theme adding three widths
  or more lost the tablet / laptop range (480 + 1600 + 1920 → [320, 390, 480, 768, 1600, 1920]; 1600 / 1800 / 2000 / 2400 →
  [320, 390, 1600, 1800, 2000, 2400], md to 2xl never captured; 400 / 480 / 560 / 600 → nothing above 600). Of the
  reviewer's two ways — a widest-first fill (the same cap changed a second time) or the parent's — the owner took the
  parent's: 9c6185aa's cap byte for byte (the narrowest five and the widest of the union, whatever their source; BS-1's
  `RE_UI_END` kept), said in ui-responsive.md (a declared width may be one left out — list the widths in ui.md's line to
  choose them). Which widths should stand for a framework's live layouts under `partial` (the default-first order, a
  widest-first fill, a width per live layout) is 1.39 backlog. `bpLimit` stays as review 1 left it: "the first X px — the
  review takes 6" is true of the restored rule. Replays against both parents: cap-probe.js on this tree is 9c6185aa's line
  for line (nine shapes); cap-layouts.js 9c6185aa's widths on its six (5 distinct layouts each, as on both parents);
  real-themes.js (shadcn v4, cal.com coss-ui, shadcn-svelte, tailwindcss, tw_site, Bootstrap) 9c6185aa's on all six;
  bp-shapes / bp-lines / dot-probe equal review 1's tree but for one partial shape (Tailwind's five overridden without a
  reset: [320, 390, 480, 768, 1024, 1536] again, 1280 the first left out) and 9c6185aa's but for BS-1's dot lists;
  bs1-cli.js differs from review 1's tree only on shadcn's partial line (1440 kept, 1600 said) and from 9c6185aa's only by
  BS-1 and bpLimit's dropped clause. R2-BS-2 / R2-BS-3: the `·` rule goes on past a `·` a length follows, so a note led by a
  number (`· 1200 px max content width`) is more widths — on a full Tailwind line it pushes a declared width out, said —,
  and a name before a width (`sm 640 · md 768`) ends the list at its first `·`, as a no-break space after the `·` does (the
  same on both parents): prose — ui-responsive.md item 1 (a note starts with a word; `640 (sm) · 768 (md)`); continuing over
  a segment of lengths alone, or a wider blank class, are mechanisms — 1.39 backlog. 17-docs runs each example through the
  engine. Mutation pass (the list before the fixtures): 22 — 14 on the four restored lines (the default set joining or
  always joining, the floor, the Set, the sort, the cap's slice and its widest, the count, `first`, the limit's guard, and
  review 1's order and a widest-first fill put back: each killed by the partial-cap fixture, shadcn's `real` row and the
  CLI's partial row) and 8 on the prose (each 17-docs clause and the examples it runs): 21 killed, one equivalent left (`>`
  → `>=` in the cap: at exactly six, the narrowest five and the widest ARE the six). Cost (bp-ab.js, both engines in one
  process, interleaved, medians of 7): against review 1's tree 0.88–1.06× on every ui.md shape, a partial report of 3,000
  declared widths 0.78× (review 1's fill was the added work); against 9c6185aa the partial report 0.94× (the same code).
- **1.38.0** (item 2 of the 1.38 round, "tokens against the scale", as DECISIONS cut it — chain T) — first the D5 refactor,
  behaviour-preserving and alone in its commit (the base chain P rebased on): the feature report walks each view file ONCE
  into a list its readers share (1.37 walked twice; a units reader would have made three), rawValuesOf keeps its generator,
  `declarations(l, cb)` is the one copy of a stylesheet line's piece split; its oracle replay against the F0 tip —
  rawValuesOf and uiChecksOf of 1,962 real view files, 15 feature reports and their finish parts on copies of shadcn v4,
  Bootstrap 6, Breeze and Tailwind 4 — byte-identical. Then engine/design-values.js, raw values against the scale, groups,
  drift and gone, the units table (the bullets above). What the critics changed (CRIT_2, CRIT_X): ONE 0.011 tolerance for
  every notation pair made Tailwind's zinc shadcn's neutrals — the tolerance follows the pair as written; size families on /
  off / nearest cut (they decided nothing on every real shape checked — ~5 % on the best, cal.com's rem radii — and touched
  three settled readers); motion `off` / `nearest` cut; the brief's units line cut (it spent the components' budget); fonts
  from the registry's rows only; finish counts colours and sizes alone; twins feed `multi`; a props table is no units
  table; drift and gone kept OUT of `inSync` (DECISIONS: 56 assertions pin it, nobody changes it in 1.38); every row's value
  kept past the reader's cap instead of a registry-tokens limit; DESIGN.md deferred again. tools/list −9 ("raw values").
  The mutation pass listed its mutants before the fixtures: 121 on the first pass, 109 killed at first — four survivors
  wanted a fixture (Tailwind's `gap-x` → column-gap and the other utility mappings, `1.005s` = `1005ms` — `1.1s` × 1000 IS
  1100 in floats —, a motion-only scale for the early exit: a font kind with no value held the loop open, a slot row of a
  units table), five lines went as equivalent (a hex is always parsed — `colorKey`'s 3-digit spelling-out; a lone family
  can never be a stack; a motion value always holds a literal; tokenDrift's empty-side check; a units column not found
  leaves no row), and so did the colour / quantity length bounds (the patterns are anchored, the inputs bounded before
  them), a utility's bracket slice and the units reader's digit / "names a property of the table" prefilters (timed: 1.2×
  with or without — no gain). Kept and timed as cost guards: `RE_TW_MOTION`'s bracket-free value (4.4× without, on
  `ease-[` × 330 a line), finish's `{finish: true}` skipping the units walk and the groups (1.04× / 1.07×). Equivalent and
  kept: `RE_MOTION_PROP` widened to `transition-property` (no other property holds a time — the closed list DECISIONS
  names; its anchor IS tested: a custom property `--transition-duration` is never motion). The final replay on the last
  tree: 125 mutants, 121 killed, the two finish cost guards and that equivalent left. And the 1.37 readers the split moved
  (declarations' piece rules, rawValuesIn's 1.37 lines, take()) mutated again — 14, 12 killed by the area's older files at
  first; two wanted a fixture no file had (a value written twice on one line is one value; a colour in a selector's
  attribute — what a `{` follows — is none): 14 of 14.
- **1.38.0 review 1** (tokens: T1 MEDIUM; T2 / T3 LOW, prose) — T1: one 0.011 for every pair with an HSL side absorbed
  any colour that close, however precisely the HSL side was written: once shadcn's Tailwind 4 upgrade wraps its neutrals in
  `hsl()`, Tailwind's zinc hexes were its tokens again (`#18181b` → `--primary: hsl(0 0% 9%)`, 0.0083 — what CRIT_2's
  must-fix 2 had taken out for oklch), cal.com's `#efefef` its bluish `--cal-bg-subtle: hsla(220, 14%, 94%, 1)`, 51
  Tailwind v3 hexes ANOTHER palette colour's token against a 1-decimal hsl palette; and the judge returned the FIRST colour
  within tolerance, so an exact token listed after an HSL one lost. Now an HSL side against a hex / rgb one also round-trips
  at its written precision (`roundsTo`) and the judge keeps the nearest. The 0.011 stays the ceiling — the narrower reading
  of the owner's decision, said: the round trip alone would have WIDENED 1.38 where the HSL is coarser than the 0.011
  (CRIT_2's 0.0106 was one hex's distance, not integer HSL's worst: measured over all 16.7M hexes, 479 are farther from their
  own integer HSL, `#020200` = `hsl(60 100% 0%)` at 0.084 — a token past the JND —, 0.013 at l 10–95), so every judgement
  the fix changes goes token → near or none, never the other way. Trade-off: Tailwind v3's 286 hexes against their own hsl
  as shadcn's _legacy-colors.ts writes it (1 decimal) — 240 stay `token`, 46 become `near`: those hsl values are not their
  hex's rounding (mauve / olive / mist / taupe derived from oklch; slate-950's hue 222.2 against its hex's 228.6); each
  hex against its own HSL rounded ONCE (0, 1 or 2 decimals): 286 of 286; another palette colour's token: 51 → 0. Replays
  against the parent: the 12 real clones' reports identical but cal.com's `#efefef` and `#eee` (→ near); finish's part on
  7 clones identical; the CLI's EN / PT / ES lines differ only on the `#18181b` row the fix meant, `--json` = the engine;
  cal.com's tokens.css, hex by hex: 37 token → near, 0 differences with the reviewer's prototype. Cost, ratios at the same moment: the hostile judge — 100
  hexes against 2,000 HSL tokens all within 0.011, where 1.38 returned at the first — 1.5× 1.38's own worst case (the
  full scan with no token: 24 against 15 ms); a feature report of 100 files × 200 such hexes 1.03×. The mutation list came
  before the fixtures and took three lines out as dead (the saturation's `d = 0` guard, the hue's sign and turn
  normalisations — the circular distance covers both —, the judge's `else` between its two trackers): 45 of 45 killed (39
  in design-values.js, 6 prose clauses), one equivalent left (`within`'s `<=` against `<`: the epsilon absorbs the
  boundary). T2 / T3, said and the readers left to 1.39's backlog: a negative length (`margin: 0 -8px`, `-mt-[12px]`) and a
  Tailwind size outside px / rem / em (`text-[2vw]`) are not judged; the units column's header STARTS with Units, so
  `| Property | Allowed units |` is no table and nothing says so — ui-code-scan.md says both, 17-docs pins each clause
  against the engine (offUnit, RE_TW_SIZE, RE_DS_COL.units).
- **1.38.0 review 2** (tokens: R2-T1 MEDIUM, made by review 1's fix; R2-T2 LOW, prose) — R2-T1: review 1's round trip
  asked ONE way (the hex written in HSL rounds to the HSL's numbers), never the other (the HSL as written, painted at the
  hex's 8 bits, IS the hex), so an HSL token's own painted colour — what a picker, devtools' Computed pane or a palette's
  docs give — was `near`, "close, not the same colour": cal.com's `#eeeff2` against its `hsla(220, 14%, 94%, 1)`, 49.6 %
  of all integer HSL tokens' painted hexes, ~99–100 % of 1- and 2-decimal ones; cal.com's tokens.css 24 of 74 near, Radix
  Colors 0.1.9 260 of 336; and fix 1's `prec` fixtures pinned three HSL values that PAINT their hex as near. Review 1's
  trade-off line had measured one direction (hex → HSL); of its 46 shadcn pairs gone near, 39 paint their hex. Now both
  ways (`roundTrip`: painted OR roundsTo, still under the 0.011 ceiling — parseColor keeps the painted triple it already
  computed for `ok`). The reviewer's prototype, re-derived (+5 lines; on its 38 HSL spellings, identical). Both directions
  measured against the parent (9c6185aa, the 0.011 alone): every integer HSL token's painted hex is its token, 3,563,924 of
  3,564,000 — the parent's own count, the 76 left the ceiling's (l 1–2 %) —, 50,000 random 1- and 50,000 2-decimal ones
  all; new `token` where the parent said none: 0 — the fix is never wider than 9c6185aa; cal.com 49 own + 25 another token
  (24 the same value, one whose value paints the same hex: `hsla(33, …)` and `hsla(34, 100%, 92%)` are both `#ffedd6`),
  0 near; Radix 334 + 2 (identical values), 0 near; shadcn's own 1-decimal pairs 279 of 286 (the 7 left neither round
  from the hex nor paint it: slate-950, mauve-100 / 600 / 950, olive-200, mist-200, violet-950). What T1 fixed stays:
  zinc's hexes against shadcn's hsl() neutrals near (0.0083 / 0.0032 / 0.0046 / 0.0058), `#efefef` near, cal.com's 292
  Tailwind hexes 0 differences from the release, another palette colour's token 0, an exact token after an HSL one wins;
  the 12 real clones' reports identical to the release's; the CLI's EN / PT / ES lines and `--json` too. The fixtures:
  `prec`'s three replaced by values a decimal off that paint ANOTHER hex (`hsl(183.0 92.3% 25.5%)` paints `#05777d`, not
  `#05787d`; `#3c82f5`, `#19191c`); `paint` — the painted hex and rgb() from either side, Radix's `#ffb224`, a channel
  painted at exactly n.5 (both neighbours: `#191919` needs the epsilon), a clamped HSL, the next hex over (0.56 off) near,
  a painted hex past the ceiling near. Mutation pass, listed before the fixtures: 20 of 21 (16 in design-values.js, 5 prose
  clauses; `<` for `<=` equivalent — the epsilon absorbs the boundary); fix 1's 45 re-run on the fix: 38 at first — the
  painted direction absorbed every fixture whose HSL paints its hex (the hue sectors' `#ff8000` / `#80ff00` / `#008000`,
  `#808080`, `#fff`, a hue two turns round, `3.14159rad`, the reviewer's own `prec.s`, 1.02 off its hex's s where the
  half is 0.05 or 0.5 alike): each replaced by a pair the HSL does NOT paint (`#ff8100`, `#81ff00`, `#008100`, `#818181`
  against `hsl(217 0% 51%)`, `#fefefe`, `hsl(903 92% 25%)`, `.6turn` ± 18°, `#2563eb` against `hsl(221.2 83.5% 53.3%)`),
  and roundsTo's `hsl.l === 0` taken out as dead (at l 0 the HSL paints black, the one hex within 0.011 of it — `#000001`
  is 0.037 away): 44 of 44. Cost, both engines in one process, interleaved, medians: the hostile judge (100 hexes against
  2,000 HSL tokens all within 0.011) 0.97–1.25× the release's, median 1.05× (12–13 ms); ÷ 1.38's own worst case (the full
  scan with no token) 1.59–1.63×, the release's 1.51–1.84× in the same runs; a spread scale 1.01–1.03×. R2-T2:
  "Tailwind's zinc is not shadcn's neutral, in oklch or in hsl()" — Tailwind 4's own `oklch()` zinc IS the `hsl()`
  neutral (an HSL side against oklch / oklab keeps the 0.011, the owner's T1 scope): said — zinc's HEXES are not the
  neutral, its oklch is (ui-code-scan.md, pinned by 17-docs against the engine); making the claim true (the oklch / oklab
  side's sRGB triple against the HSL's written precision) is 1.39's backlog. Lesson: a round trip is checked BOTH ways —
  the parent is the oracle in each direction (review 1's fix measured hex → HSL alone; review 2 ran every HSL token → its
  painted hex) —, and a new direction re-runs the old mutants: it absorbs the fixtures that only the old one decided.
- **1.38.0 review 3** (tokens, two LOWs fixed without a round) — R3-T1: the painted check put its half-unit window around
  the HSL's exact paint, not the 8-bit colour an rgb() with decimals paints, so rgb(237.1 239 242) (#edeff2) was
  `hsla(220, 14%, 94%, 1)`'s token while #edeff2 itself was near, and rgb(238.4 239 242) (#eeeff2) was near — the triple is
  now taken at 8 bits (`Math.round`), a hex unchanged (the reviewer's corpora — every integer HSL token, cal.com, Radix,
  shadcn's pairs — identical). R3-T2: no fixture pinned the painted check's blue channel (`#eeeff3` → near now). Fixtures
  `paint.decimals` / `paint.blue`; the old window and a blue-blind check each fail them.
- **1.39.0** (item 4 of the 1.39 round, "the scale, round 2" — chain E, as DECISIONS cut it: T2, T3 and the brief's units
  line; the size families — `token` / `off` / nearest / a whole scale / the package scope: 0 judgments on the six common shapes, 282 of 291
  from one app —, DESIGN.md's reader, motion off / nearest and R2-T2 cut — DECISIONS, CRIT_X's cut list) — T2: a negative
  length is one (`RE_UNIT_LITERAL`'s second lookbehind: a minus at the value's start or after a blank or a comma; a word's,
  `$gap-8px`'s, `--12px`'s never), and the units table reads Tailwind's sizes through its OWN `RE_TW_UNIT` (any unit of at
  most 5 letters — CSS Values 4's longest, `svmin`; the designed `{1,6}` was an equivalent mutant, `text-[3inches]` now
  none —, a leading or bracketed minus — m[1] the utility, m[2] its value), `RE_TW_SIZE` left the raw values' (the raw list is 1.38's
  on every fixture, the oracle's run pinned). Re-measured with the DESIGNED regex (CRIT_4 must-fix 10 — the designer's
  `[\s(,]` reads the same: `offUnit` takes a value's parentheses out first) over the clones of dsd-139d-1 / -2 / -4 (52
  checkouts) under steering-templates' example table, against the 1.38.0 oracle: ADDITIONS ONLY, 0 findings dropped —
  codecaine +278 (165 `…-[…cqw]` in its device mocks, 41 `vw`, 32 `vh`, 23 `svh`, 16 Tailwind negatives — `-mb-[0.22em]`,
  `lg:-mr-[12vw]` —, 1 stylesheet negative), pico +119 (its themed copies' `margin-top: -0.125em`), outline +66, bulma +40,
  cal.com +21, mantine +20 (`margin-left: -1px`), Bootstrap +4 (d4) / +7 (d1, d2: `_visually-hidden.scss:12`'s `-1px
  !important`, the examples' `-25px`, `-.5em`), vben +3, Starlight +2 / +3, magicui +2 (`leading-[100%]`, `text-[40pt]`),
  runwithbee +2 (`text-[11vw]`), sinhong +2 (`-ml-[3px]`), nuxt/ui +2, podman +1 (`py-[3pt]`), hyper-tube +1
  (`-ml-[8.5px]`), open-props, contai, skill-deck, tailwindcss.com +1 each; shadcn v4 / svelte, Breeze, Sakai, Foundation,
  motion-primitives, taxonomy, astro-paper and the other apps identical — each addition true to the convention it was given
  (a report). T3: a units column by a WORD of its header (`RE_DS_UNITS_WORD`) when no header STARTS with it — the 1.38 tier
  first, so every 1.38 table reads the same (a fixture of its four shapes); its edges any script's letters (a deviation
  from the designed `\b`, which is ASCII: PT `Valor unitário` would end at its `á` — the narrower reading); no polarity,
  said (steering-templates.md: the column lists the ALLOWED units; a 17-docs row runs `Units to avoid` through the reader —
  CRIT_4 must-fix 11). The brief: the table's first rows within `DS_BRIEF_UNITS` (400, its own bound — a prefix; one row
  too long alone is said, never cut), `more` the rows left out plus the table's `past`; the null gate counts `reg.units`
  (CRIT_4 must-fix 7: a units-only registry got nothing); the result's `designSystem.units` {rows, more} — a NEW JSON field
  (CRIT_X D6), only with a table: the oracle's brief, text and JSON, byte-identical without one, and with one only the
  line and the field added. The table's shape moved from ui-code-scan.md to steering-templates.md (ui-code-scan.md 29,871 →
  29,634 B); 17-docs re-pointed (the T2 clause against offUnit / RE_TW_UNIT / RE_TW_SIZE, the headers against
  RE_DS_PROPERTY_HEAD / RE_DS_COL.units / RE_DS_UNITS_WORD, "never finish or doctor" and the brief's 400 in both files —
  CRIT_4 must-fix 8). Cost, the feature report with a table, 1.39 against the oracle in one process, interleaved, medians of
  9 (60 files × 300 lines, ≥ 1.1 s a call): Tailwind sizes as written 0.94×, every utility a finding (143,940 against 0)
  1.12×, hostile lines (`-mt-[` never closed, `md:` chains) 1.00×, stylesheets whose every declaration is negative (19,800
  against 0) 1.11× — no suite guard added: `RE_TW_UNIT` is `RE_TW_SIZE`'s linear shape, K2 guards the reader. The
  mutation list came before the fixtures (%TEMP%/dsd-139-e/MUTATIONS.md): 49 of 49 killed in a copy — 17 on T2's two
  patterns and unitsOf (the raw reader reading `RE_TW_UNIT` among them), 8 on T3, 15 on the brief (the bound at 4,000, a
  `>=` for `>` — a 20-row table of exactly 400 —, the separators left out of the size, `continue` for `break`, `past` left
  out of `more`, the components' budget charged), 9 prose clauses; one survivor of the first pass, the unit's designed
  `{1,6}`, was equivalent on every CSS unit — the bound became `{1,5}` with a fixture each way (`pt-[2svmin]`,
  `text-[3inches]`), the 52 checkouts identical under it.
- **1.39.0** (item 3 of the 1.39 round, "Breakpoints and states, round 2" — chain B, as CRIT_3 and the DECISIONS cut it) —
  BS-2, the fill under `partial` (Breakpoints, above): the theme's own widths first, capped and said as any source's, then
  `BP_FILL` = 768 · 1024 · 1440 · 390 where room is left; `breakpoint-widths` counts and names only the theme's own widths
  (CRIT_3 must-fix 4 — the design's "the narrowest left out" named 390 on shadcn, a width not the project's). The order, on
  308 real Tailwind 4 partial themes (a width's layout = the widest live breakpoint ≤ it, Tailwind's five counted unless
  overridden — oracle data in the designer's probe, never in the engine): 1.38's cap captured 1,493 live layouts, review 1's
  ascending fill 1,570, a widest-first fill 1,632, this order 1,645 (11 themes with no tablet layout, 19 with no laptop);
  dropping 390 altogether captures the same 1,645 — it fills last so that an uncapped theme keeps 1.38's widths byte for
  byte; the 36 themes still losing a declared width declare six or more of 320 px and up. Oracle replay against 1.38.0 (36
  clone reports, 670 sampled sheets through the observer): only `partial` shapes differ — the clones with an adding theme
  (shadcn v4, cal.com coss-ui, shadcn-svelte, magicui) [320, 768, 1024, 1440, 1600, 2000] where 1.38 had 390 and said 1600,
  and 161 of the theme sample's sheets, each 390 out; the rest of every report identical. `cliOutput.bpFrom.partial` reworded
  (the declared widths first, then the default set where room is left). R2-BS-3: `RE_UI_END`'s blank class takes U+00A0 and
  U+202F (the ones `RE_UI_LENGTH`'s thousands group takes — French typography puts the narrow one before and after `·`),
  written as escapes; `\s` would take U+2009 and line ends too (the fixture's thin space ends the list). R2-BS-2's
  number-led note stays prose (ui-responsive.md item 1): telling `· 1200 px max content width` from `360 phone · 768 tablet`
  is meaning, not syntax, and a lengths-only narrowing would end `640 (sm) · 768 (md)`, the form the docs recommend. BS-6
  (1.38.0 review 1's LOW, prose until now): the design read every closed bracket whose text is no template's; CRIT_3's
  probe (bs6.js) showed it misreading asides — `480 / 960 px [1200 in print]` +1200, `640 / 1024 px [see Figma frame 1440]`
  +1440 — so it reads only the slot's own place (must-fix 5): the replay's ui.md lines differ in the filled brackets alone
  (`[576 / 768 / 992 / 1200 / 1400 px] · text`, its bold-label twin, `[576 / 768 px] 1200 px [1600 in print]` → 576 and 768
  joining 1200); the stub in EN / PT / ES / pt-BR, `[TBD]`, the asides and an unclosed `[` unchanged.
  The Sass map reader (the chain's LAST commits, droppable — DECISIONS): first the walk's `open` event alone
  (design-system.js: built only when `on.open` exists, never in a .sass; the F0c sheet's events and every token
  byte-identical with an open handler — mcp/tests/15-quality-design-system-walks.js), then the reader. The design read "open
  + the next top-level statement"; CRIT_3 showed it false in `@use … with (` mode — each override resets the walker's pending
  text, so Dashticz's loader.scss delivers `)` alone and, with `$container-max-widths` last, `sm: 540px, md: 720px ) )` as
  the map's rest (540 / 720 read as breakpoints; the designer's sass.js had filed it "nested-or-fn"): the void rule
  (must-fix 1), "nothing" for a variable or `map-merge` made `unread` (must-fix 2), `at` the first KEPT (must-fix 3). The
  shapes on the designer's 100-file sample (repos/sass): 23 sheets now give widths (Bootstrap 5 overrides and copies —
  multi-line, a trailing comma, `!default`, one-line), 5 give an unread
  line and the default set (Dashticz's voided `with` map; `$breakpoints: $grid-breakpoints` ×3, a variable; matise-gryd's
  unitless `750` entries), every other sheet unchanged, every token list identical; of the clones only sass-mq moves —
  its `examples/custom/custom.scss` (`@use '../../mq' as responsive with ($breakpoints: (…))`, an app's override shape) →
  [320, 640, 800, 1024, 1600]; Bootstrap 6's `_config.scss`, Bulma's nested map, sass-mq's `_mq.scss` are no files the walk
  opens by name — the libraries, rightly. Mutants CRIT_3 §8 added (V1 / V2 / P1 / P2 / A1 / L1 / B1 / N1) each have their
  fixture; K5 went with BS-3. Two handlers were left out as provably dead: a `close` one, and the pending path's "a nested
  statement voids" — after a top-level open, any nested event follows a block event, which voided it. Cost (K3c, medians of
  5 interleaved, ratios against the `breakpointz` twins the pre-test skips, with other chains' suites running): 100
  Bootstrap-sized sheets with a map 0.96–1.35×; 256K hostile sheets — an open per line 1.0–1.17× (the first opens a
  parenthesis the walk never sees closed: the rest are map keys, one unread), a one-line map per line 1.67–2.3× (the first
  `sassValue` built its parts through `map` / `filter`: 2.7×; one loop now), a voiding list per line 1.35–2.2×. The project
  report against 1.38.0 (both engines in one process, interleaved, medians of 5 — the whole chain: the fill, the line
  rules, the reader): shadcn-ui 0.98×, mantine 1.05×, cal.com 1.03×, vben 1.09×, bootstrap 1.08×, starlight 1.11×,
  bulma 1.05×, breeze 1.05×, taxonomy 1.25× (+44 ms on 178 — no sheet the reader observes: noise of the loaded machine),
  sass-mq 0.80× — within the DECISIONS bar (≤ 1.25× at ≥ 700 views, ≤ +150 ms below). `@custom-media` CUT (CRIT_3 / CRIT_X cut 3): an alias list, not a set — of
  47 sampled files 10 define one width (median 2), so a single `--md` would capture [320, 768] where 1.38 captured five;
  PostCSS / Lightning only; its seven mutants the largest block. Tailwind 3's `screens` stays cut (41 of 104 sampled keys are
  `container.screens`, a max width).
- **1.39.0** (item 1 of the 1.39 round, "deprecated uses" — chain A, with CRIT_1's must-fixes 1–10) — 1.38 had kept the
  files that still import a deprecated component for later (they need settle's read). Lifted first, its own commit: settle's follow, `followOf`, moved
  verbatim (CRIT_1 must-fix 8: the prototype COPIED it, so its A/B said nothing of a lift) — proved against the 1.38.0 oracle
  (92c44e0a, extracted): the full scanCode JSON, settle's verdict included, byte-identical on 21 clones (the design's 9 —
  cal.com, h5bp, shadcn-svelte, Breeze, nuxt/ui, shadcn-ui, Bootstrap, vben, Starlight — and 12 more) and on every scanCode
  call the area-15 suite makes (1,036, the DS_PASS_* / DS_PACKAGE_NAMES / DS_TS_CONFIGS fixtures among them); its mutation
  replay found one survivor — the resolve cache keyed without the FOLDER (no fixture had two apps importing the same
  `./components/kit`): a fixture now (15-quality-design-system-usage.js). Then the watch (`deprecatedWatch`, above): the
  differential — each clone's first 60 components marked, every other key and settle's verdict byte-identical on the 8
  clones that hold components; the CRIT_1 shapes each a fixture (Vue CLI's extensionless SFC and `index.vue`, an Angular row
  unlocated, the note in EN / PT / ES, results seen with nothing asked, `.ts` files crowding a `.vue` past DS_USAGE_FILES,
  the namesake over-count with a kit's `chart.tsx`, the follow's three bounds). Cut or not built: a `.ts` file's
  registration (`app.component`), a dynamic `import()`, a bundler's alias, a barrel's non-component export (the index holds
  components only), the walk's `files` repeat's fixture (20,001 files: 13 s to write, 6 s to remove — checked in a scratch
  run, not in the suite), the UI pass's read shared (CRIT_1: +63–108 ms where settle asks nothing does not pay for 1.38's D4
  coupling). The cost, chain A alone against 1.38.0 (scanCode + the UI pass, one row marked, interleaved medians of 5):
  trees of 700 view files or more 1.00–1.19× (shadcn-ui 1.06 · cal.com 1.04 · vben 1.19 · shadcn-svelte 1.09 · nuxt/ui 1.04 ·
  outline 1.00 · mantine 1.18), smaller ones +2 to +108 ms where a row is located (Bootstrap +2, taxonomy +37, Breeze +89,
  motion-primitives +95, Starlight +108 — the watch's read where settle asks nothing); a row no file holds read +51 / +117 ms
  for nothing until the watch went `idle`; finish's scan 0.81–1.15× (the same code path). The mutation pass (85 mutants: the
  lift's 8, the watch's 77): 78 killed — 17 of them by fixtures the first pass showed missing (a namesake's non-component
  export, a folder's index, a candidate's name row, two name rows in a file, a renamed import by its imported name, a
  member's part, a .js-written module, four namesakes out of path order, 51 unlocated, a cut in `reach`, the follow's own
  budget, an .mdx part tag, the idle watch) and the cost guards sharpened (G2q: 500 rows over pages that name none ≤ 1.25×
  one — the `includes` prefilter 2.49×; a feature's report 2.95× with a watch built); the 7 left: an equivalent memory guard
  (`unbound` for located rows only), the walk-cap repeat (scratch-checked) and five cost guards timed with and without on
  shadcn-ui / cal.com / Starlight — the binding filter 1.43–1.46×, the text prefilter 1.01–1.13×, the module check's index,
  the namespace-binding and member filters within noise (0.93–1.07×).
- **1.39.0 review 1** (the deprecated uses, fix round 1 — R1-DEP-1…8, R1-DOC-1) — each MEDIUM fixed by the property its
  reviewer named, from the reviewer's fix copies re-derived and checked against b5e95372 and 92c44e0a both ways. R1-DEP-1: a
  row the seed writes with a component folder's barrel (`| VbenButton | …/button/index.ts |`, `export { default as
  VbenButton } from './button.vue'`) was `unlocated` — vben 55 of its 349 rows, cal.com 8, shadcn-svelte 6, outline 2 — and
  the reason printed was false. The reviewer's fix made EVERY result a source of name rows; checked both ways it also made a
  barrel's part a namesake of a LOCATED row (input-group's `export { Button }` of its own button, select's `Item`):
  shadcn-svelte +2,367 pairs on rows 1.39 had located (Item +348, Label +239, Input +117, Button +30) — wider than the
  finding, the 1.38 lesson. Cut to the rows NO file locates (`nameRows(r, byFile)`, the barrels after the files): every gain
  is on a newly located row (shadcn-svelte +1,412 on its 6 — Content, Group, List…, each a name many barrels give, all in
  `paths`: the namesake rule), no located row moves; vben's VbenButton 45 importers of the 46 grep finds. The unlocated
  line says only the property (no component file the scan reads — a component folder's index among them — gives the name),
  ui-code-scan.md and tooling-reference the same. R1-DEP-2: a file whose DEFAULT export is the row's name binds its default
  importers (`defaults` / `byBase` / `bases`, as a module row's file) — outline ListItem +19, LoadingError +2,
  NavLinkWithChildrenFunc +2, PdfViewer +1, Separator +2; cal.com DisableTwoFactorAuthModal +2, BookingListItemWithProvider
  +1; motion-primitives GitHubIcon / XIcon +2 each — each read in its clone. R1-DEP-3: `RE_TYPE_MODIFIER` — 6 pairs leave
  (vben PaginationItem.vue, ToggleGroup.vue; cal.com's two app-store KeyInput.tsx and DisconnectIntegration.tsx; outline
  Collaborators.tsx — those two render another component and import only a type through the folder: the note's "a type
  through a barrel"), and `import type * as` the row's own file now counts (the module rule); importClause is settle's: the
  scanCode JSON with no registry is byte-identical to 1.38.0 (settle's keys) and to b5e95372 (all of it) on 21 clones, and
  every row marked against none too. R1-DEP-6 (a subtraction): `scriptHas` — vben's SheetContent.vue leaves; of the
  reviewer's 51 shapes two move, both to their stated want (`vue-twin-ts`, `vue-index-vue-and-ts`: 0). R1-DEP-4: the rows
  still imported first, the CLI head's total `rowsTotal` — and, past the brief, "at least" when every listed row is imported
  and some are not (else 50 is said where 70 are). R1-DEP-7 (prose): the note's sixth "not seen", a tag an auto-import names
  by its folder (Nuxt's `<BaseCard>`). Every row of the 16 component clones marked, the release against the fix: 7 pairs
  leave (the six types, the twin), the gains above, nothing else. Left for 1.40: a file importing the file a barrel renames
  (vben icon-button.vue's `import VbenButton from './button.vue'` — the 46th), the CLI row line calling a barrel-located
  row's barrels "component files", a row used only through `unbound` tags ordered with the unused. R1-DEP-5 / R1-DOC-1, the
  watch's cost re-measured (cost139.js: 1.38.0's report and the fixed engine's in one process, interleaved, median of 7; the
  increment = the fixed scanCode with the row less without): ONE used row on trees of 700 view files or more 1.00–1.18×
  1.38.0 (cal.com 1.00, mantine 1.01, vben 1.04, nuxt/ui 1.06, shadcn-ui 1.13 +236 ms, outline 1.15, shadcn-svelte 1.18);
  every row marked (≤ 500) 1.04–1.43× (cal.com / mantine 1.04, vben 1.06, nuxt/ui 1.25, shadcn-ui 1.26 +482 ms,
  shadcn-svelte 1.35, outline 1.43 +429 ms); on the smaller trees, where the scan otherwise reads no script for its
  components, +27 to +144 ms — up to 2× a report of 30–250 ms (sakai-vue 44 → 86 ms 1.97×, astro-paper 1.89×, Starlight
  122 → 222 ms 1.83×, magicui 1.78× +144 ms, motion-primitives 1.61×, taxonomy 1.38×, tailwindcss.com 1.36×, Breeze 1.24×,
  Bootstrap and Bulma at noise); the reviewers' loaded runs of the same shape gave Starlight +141 to +239 ms (2.4–2.8×),
  magicui / tailwindcss.com 1.6–1.8×, and chain A's own two runs +2 to +108 ms and up to +374 ms: the small-tree range is
  +25 to +240 ms, up to ~2.8×. Foundation, open-props, pico hold no component (idle, nothing read). The no-registry report
  at the same moment 0.78–1.15× (outline 1.08×; review 2 measured outline 1.05–1.11× with the script search on and
  0.97–0.99× with it off — its ~+90–110 ms IS outline's increment, the 1.21× the noise around it). The fix
  against the release as reviewed 0.93–1.03× (shadcn-svelte's 1.11 / 1.14 re-measured alone: 71 → 62 ms, 130 → 137 ms).
  R1-DEP-8 (tests): ONE tree for the count bounds (6,012 files, two reports — every cut, then every bound; 8,004 files and
  five reports before), each folder made once, G2q on 50 pages (the `includes` mutant 1.42–1.47×, 2.2–2.6× on 200: a
  linearity ratio). Each file alone, 1.38.0 · the release · the fix interleaved, 2 rounds: the deprecated file 6.7–6.8 ·
  17.2 · 15.5–16.9 s (2.3–2.5×; the count bounds' tree is ~7 s of it — 2,001 + 3,010 + 1,001 files are the bounds' floor, read
  twice), the cost file 14.5–16.0 · 38.0–38.9 · 35.8–36.2 s (2.2–2.5×: G1–G3's trees), the CLI's 15-quality-design-system
  2.6 · 3.6 · 3.8 s — about a tenth less than the release, not the 2× the finding asked: a smaller count bound needs the
  bounds injectable (an engine change: 1.40). Mutation pass: 37 mutants, 37 killed (one re-formed: dropping `filesOf(at)` crashed before the
  fixture ran); M3d equivalent, M6b not applicable.
- **1.39.0 review 2** (the deprecated uses, fix round 2 — R2-DEP-1 MEDIUM, made by round 1's fix of R1-DEP-1; R2-DEP-2 and
  R2-DEP-3 LOW) — R2-DEP-1: round 1 located a row no component file locates by EVERY component folder's barrel that gives its
  name, so a kit's part names counted every other component's parts: shadcn-svelte's `Content` (the picker's, as the seed
  writes it) 889 importers, 13 of them the picker's; `Group` 399 / 13; `List` 114 / 1 — 1,375 false pairs, the CLI saying
  "migrate each". The owner's ruling, a narrowing by a property: how many FILES the barrels give the name to (`givenTo`) —
  more than one, only the barrel the row's path names (`rowAt`); one, every barrel, as before. From the reviewer's prototype
  (relative re-exports only, every entry of the barrels' re-export maps), re-derived: the names `nameRows` reads, so a
  same-name `export { X } from './x'` — which locates nothing — counts nothing; a name the barrel declares is the barrel's own
  file (bits-ui's older `const Trigger = Primitive.Trigger`: 0 pairs on the clones, the property's own case); another
  package's re-export places no file (vben's common-ui `export { VbenButton } from '@vben-core/shadcn-ui'` — counted as a
  file, it narrowed VbenButton to that barrel); the path read as `_Implements:_` is, then `moduleKey`, the barrel's key or
  its folder's (`./…/picker`). The unlocated line names the path's index (EN / PT / ES), as ui-code-scan.md and
  tooling-reference do. Every row marked (cmp.js: 490 rows a clone, in slices of 50), against c63bcfcb: shadcn-svelte
  −1,375 (Content 876, Group 386, List 113; Picker.Content 13, Picker.Group 13, DocTabs.List 1 left — the reviewer's
  prototype pair for pair), vben, cal.com, outline and the 17 others 0 (VbenButton 45 importers); against b5e95372 round 1's
  deltas unchanged (vben −3 / +243, cal.com −3 / +12, outline −1 / +48, motion-primitives +4), shadcn-svelte +37 on its six
  newly located rows (was +1,412). The 889 need `$lib` resolved: the clone's copy without `docs/.svelte-kit/tsconfig.json`
  (no `svelte-kit sync`) moves 0. R2-DEP-3 (a subtraction): `RE_TYPE_MODIFIER` takes the modifier with no blank after it,
  `import type{ X }`; settle-diff on 21 clones (+ that second copy): settle's keys = 1.38.0, the scanCode JSON with no
  registry = b5e95372 = c63bcfcb, every row marked = none; four constructed shapes (`import type{` before `type(…)` among
  them) as 1.38.0. The comment had said the brace list's names are bound "as an inline `{ type X }` is": that entry binds a
  local named `type` and X is never followed — the comment says so now (prose; the behaviour kept). R2-DEP-2 (prose):
  ui-code-scan.md says an index locates a row only when no component file gives its name, and only the path's index when
  several give it to different files. The fixture (15-quality-design-system-deprecated.js, "review 2"): the reviewer's
  parts shape (card / dialog / picker barrels) — Content, Group (two files, the folder spelling), Trigger (declared twice),
  Footer (a path naming none: unlocated), VbenButton (one file, two barrels and a package's), VbenTooltip (packages'
  re-exports alone), `import type{` / `import type  {` / `import type X from` the row's file; with the fix reverted five
  of its eight checks fail. Mutation pass: 18 mutants, 16 killed; the two left are equivalent — `givenTo`'s guards (a
  located row's count and a name no row marks are never asked: they bound the loop's work). The cost, against c63bcfcb (one
  process, interleaved, median of 7, a loaded machine): one used row 0.91–1.15×, every row marked 0.91–1.15× (shadcn-svelte
  0.91: fewer name rows), within the noise the same run shows (cal.com's increments came out negative); the hostile tree
  (1,000 barrels × 500 marked names, every name narrowed) 2.47–2.69 s against 2.46–2.71 s, heap 107–119 MB against
  113–136 MB. Review 1's 51 shapes and 13 hostile files: no difference. Left for 1.40 (with round 1's three): a file
  importing the file an index renames (vben's icon-button.vue), and a located row's namesake through a package's index
  (cal.com's atoms/index.ts, which re-exports its BookerPlatformWrapper as Booker: 1 pair) — the docs say an index
  locates a row only when no file does.
- **1.39.0, the Linux run** (the release's Docker run, four images — a test's yardstick, no engine change) — G1's `asks`
  check (15-quality-design-system-cost.js) failed on all four Linux images at 1.69–1.83× while Windows gave 1.02×: its
  yardstick was the same report with no row marked, where settle parses its 50 pages alone, so the ratio was the watch's
  300 parsed pages against a report the reads dominate — on Windows they weigh (~155 ms a report), on Linux they are cheap
  (~45 ms) and the parse IS the report: a read-speed ratio, +19–24 ms, the small-tree increment the CHANGELOG states.
  The yardstick now parses the same pages: the report with none where every page the watch reads also names settle's
  candidate — 1.01× Windows, 1.06–1.07× Linux (node 22 / 24), under the same 1.5× bound. What it hides, measured with a
  stand-in (every Button page naming Table: 600 parsed for 300): a watch that parses pages naming no marked row, 1.05×
  Windows, 1.30× Linux — the bound catches a second read of the tree, never that (nor did the old yardstick on Windows,
  1.06×). The mutants the cost guards kill (M38's prefilter, the feature report's `withComponents`) are the `prefilter`
  and `feature` checks', unchanged.
- **1.39.0, the release as merged** (the docs pass, after the four chains merged E → B → C → A; this summary is the 1.39
  round's for every area — the UI checks' and the state matrix's own entries below) — the ruling (DECISIONS) built ~15 of
  the ~29 mechanisms the four designs held (A 5, B 4–6, C 3, E 3; 1.38 shipped ~17 and needed three review rounds), to one
  bar: nothing 1.38.0 judged right is silenced, nothing it passed is refused — 1.39 adds no refusal. CUT, each with the
  number that cut it (the 1.40 backlog): the size families — `token` / `off` / nearest / a whole scale / the package scope
  (0 judgments on the six common shapes, 282 of 291 from one app of 12; the sole reason for an observer fan-out, a scanCode
  rename and two scan keys); DESIGN.md as a token source (an alpha spec that changed again on 2026-11-17; read as the
  registry's it would rename tokens 1.38 reports); motion off / nearest; R2-T2 (an oklch / oklab value against an HSL token
  by the written precision: `token` lost on 21–82 % of real same-source pairs — 1.38's 0.011 sentence stands);
  `@custom-media` (an alias list: 10 of 47 sampled files define one width, so a lone `--md` would capture [320, 768] where
  1.38 captured five); Tailwind 3's `screens` (41 of 104 sampled keys are `container.screens`, a max width); BS-3 (a
  `TBD` / dash matrix read as template: 1.39's only new refusal, at size s where 1.38 only noted, through
  `sectionLineKey`, which every track's and pack's tables share); BS-4 (tables with the same views one matrix in parts:
  it would silence a desktop / mobile pair where one lacks `Offline`); R2-BS-2's engine change (a number-led note is
  meaning, not syntax); the `uiStates` stamp (nothing in 1.39 makes ui-states warn on a design 1.38 passed —
  gates-and-approvals.md → History); D1 (a markup file's template and `<style>` decided as one file for
  font-size-viewport: it hid three true findings 1.38 caught — R3-UI-1, `RE_TW_TEXT_ANY` and A2 stay documented); D2
  (Astro's `define:vars` in THE shared line walk: no real effect, a bug in its in-tag state); D3 (`:is()` / `:where()`
  focus selectors: 0 of 661 candidates); D5 (a skipped sheet's focus styles: parses one sheet, 0 cases); the floor-zoom
  capture keeping scrollbars (they shrink the client width: "the width got" undefined — ui-responsive.md's `100vw`
  sentence was made true instead); `width-viewport` as a rule (22 boxes in 18 clones, 1 likely defect); S12 (harness
  folders as test files: 0 findings, and it moves the guard, protected tests, coverage, trace and the duplicate detector);
  S9, UP-6 and the list-item / bold marker spellings (prose, as 1.38 left them). Budgets: ui-code-scan.md's cap 30,000 →
  32,000 (F0: its pinned table is 64 % of it; 30,918 B at the end), ui-design-patterns.md 44,379 / 48,000,
  ui-responsive.md 11,210 / 12,000, SKILL.md, tools/list, ui-review.md and spec-ui-reviewer.md +0. THE MERGED TREE'S
  COST (CRIT_X D3's re-run, all four merged): 1.39 against 1.38.0, the project report with the UI pass and NO
  registry (so the deprecated watch idle: its own cost, one row marked, is chain A's entry above), both engines in one
  process, interleaved, median of 5 — shadcn-ui 1.05× (+107 ms) · mantine 0.98× · cal.com 0.96× · outline 1.21× (+249 ms:
  the fact's script search runs there) · vben 0.93× · nuxt/ui 0.96× · shadcn-svelte 0.97× · Bootstrap 0.96× ·
  tailwindcss.com 1.04× · taxonomy 1.12× (+17 ms) · motion-primitives 0.91× · sakai-vue 1.13× (+6 ms) · Breeze 1.02× ·
  Starlight 1.05× · Bulma 1.05× · Foundation 1.06× · open-props 1.03× · pico 0.94× · magicui 0.97× · astro-paper 1.06× —
  within DECISIONS 6's bar (≤ 1.25× at 700 view files or more, ≤ +150 ms below; outline's +249 ms is at 791 views, 1.21×).
  The chains' own figures above were each measured alone on a machine the others loaded; where they differ (taxonomy 1.25×
  in B's run, outline 1.03× in C's) this table stands, and a re-run by the docs pass on a loaded machine (absolute times
  ~2× these) moved the same trees between 0.92× and 1.46× (taxonomy +72 to +123 ms, outline −192 to +216 ms): the
  small-tree increments are at the noise's size. The feature report's and finish's cost are unchanged (finish's
  `scanCode(root, false)` builds no observer, no watch and reads no script); finish's VALUES move through D4 alone (vben's
  alert.vue: its two false click-no-keyboard warnings leave). Merged, before the docs pass: MCP 2957, CLI 703.
- **1.39.0 review 1** (area breakpoints-units: BU-1 HIGH; BU-2 / BU-3 / BU-4 LOW — prose and wording; BU-5 is the state
  matrix's, below) — BU-1: `breakpointsReport` spread each source's unread into `push(...)`, and since the Sass reader a
  `$…breakpoints` map's every non-length entry is one — two 256K sheets of one-line maps of 480 unitless entries (each
  line under DS_PRELUDE) are ~129,600, past V8's ~125,000 arguments: RangeError, and `spec_scan {designSystem}` /
  `dev-spec design-system` lost the whole report, both shapes (1.38.0 threw at the same statement on 14 hostile Tailwind
  sheets, ~147,000 distinct `--breakpoint-*`; the Sass route needs two). The reviewer's one-line fix (a loop for the
  spread) left every record kept; re-derived: the memory sat in the records, not the copy — 100 such sheets (the walk's
  `DS_TOKEN_READS`) held 6.48M bad entries, +778 MB of heap with the spread gone (1.38: +37 MB). So the count plus the
  first `BP_UNREAD`, at both levels: `codeBreakpoints` keeps five and counts (`unreadTotal`), a Sass record its own first
  five and `badTotal` (an entry past them is never among the report's first — the record's five precede it), and
  `breakpointsReport` joins one by one. Measured (both engines in one process): the crash shapes return the report
  (crash2: 129,600 counted, +6 MB; the 14 Tailwind sheets 147,084, +33 MB; 100 wide sheets 6,480,000, +47 MB); what
  stays linear is one record per assignment — 100 sheets of one-line single-entry maps (933,100 records) +479 MB against
  1.38's +65 MB (no Sass reader), the same class as 1.38's `decls` per Tailwind declaration: a cap on the records kept
  goes to the 1.40 backlog (a new limit, not a fix). Cost at the engine, the walk with the observer against its twin the
  pre-test skips, interleaved medians of 7: the Sass shape (three sheets) 24 ms against 5 (+19 ms; 1.38 reads no Sass
  map — its time is the twin's), the Tailwind one (200,000) 437 against 258 ms, 1.70× (1.38: 1.49× to its throw). The
  oracle replay (the reviewer's bp.js on 67 clone trees, the 100-file Sass sample, the 36 fx-sass shapes, fx2, 528
  Tailwind themes): breakpoints and tokens byte-identical to b5e95372 on every one; against 92c44e0a the differences are
  exactly b5e95372's (15 clone trees: the partial fill and the Sass map). `codeBreakpoints` is exported for its own
  fixture (BP-crash, 15-quality-design-system-breakpoints.js: the Sass shape with ui.md's unread first, 1.38's Tailwind
  shape, the record bound, a set-aside hostile `!default` map counting nothing, the scan, MCP and both shapes, a cost
  ratio each ≤ 3× + 50 ms; the CLI's in cli/tests/15-quality-design-system.js — exit 0, the count, `… +N`). BU-2 / BU-3
  (prose): ui-responsive.md says a map of maps is neither read nor listed and two `!default` maps of one name both count
  — ui.md's line chooses (a 17-docs row runs both through the scan). BU-4 / R1-DOC-3 (wording): a FIRST row past the
  brief's 400 said "N rows … too long to quote here" — now "the first row is too long to quote here — N rows in the
  registry: read them there" (EN / PT / ES — the colon a clause start, so pt-BR derives `leia-as`; the prefix rule
  unchanged). The mutation list came before the fixtures (%TEMP%/dsd-139f1-B/MUTATIONS.md): 28 of 28 killed in a copy —
  15 on the bound (1.39's own spread back, 1.38's Tailwind path unbounded, every record kept, the count of the kept only,
  six kept, ui.md's unread dropped or after the code's, ui.md's path spread — first listed as equivalent, it is not
  without the final slice: a fixture of six ui.md unread —, the record bound off, `badTotal` ignored or counted for a
  set-aside map, a single-entry record's `badTotal` left 0 — two fixtures gained `unreadTotal`), 9 on the two wordings
  (EN / PT / ES each, the header bound's argument, the plural, the pt-BR clause start), 4 prose clauses and pins.

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
- **1.37.0 review 2** (four reviewers again; this area's fix round) — three of the four MEDIUMs were review 1's own fixes,
  each wider than its finding. R2-S1 (regression): S4's ONE predicate also widened the removal side — a `focus-within:` /
  `group-focus:` / `peer-focus:` / `has-focus:` removal on an element nobody focuses was a candidate (7 of the corpus's
  candidates, cal.com's popover panels and inputs' wrappers, Headless UI's comboboxes); a removal is judged now only under
  the element's OWN focus (`isOwnFocus`), as the sheet reader judges `:focus` and never `:focus-within`, the focus-style
  side keeping `isFocusVariant`. R2-S2 (S3's remainder): `outline-offset` draws nothing — Tailwind v3's compiled
  `outline-none` (`outline: 2px solid transparent; outline-offset: 2px`, in the CLI's `-o src/output.css`) excused every
  `focus:outline-none` of its own project — and an `@apply` in a focus rule reads by its bare utilities (`*:focus { @apply
  outline-none }` was a focus style, its own excuse). R2-E1 (regression) + R2-E2: past 48 project sheets (an Angular app
  of ~47 components, a CSS-modules app) the rule could never fire, and the report said "nothing" — a bound never hides a
  KNOWN candidate silently now: the pass's limit names the removals it left (count, first file:line, focus-chars' sheet —
  R2-D2), the CLI prints it in place of "nothing", finish says it (the warning's last clause, or alone — `uiUnjudged`);
  the reviewer's 60-component Angular and 140-module Next apps: a finish note now. The other bounds stay in the report:
  none hides a known candidate. R2-D1 (regression of S5): S5's "alone on the line above" taken out — a stylesheet's team
  writes the marker after the rule's `{`, and finish's own text said "the line above"; 457d3da's rule is back (two
  branches had each pinned its own wording: the user-facing sentence is the rule's test too). LOWs by subtraction: R2-S3
  the clipboard API, not the word (a blocking handler's message excused it); R2-S4 `[tabindex="-1"]` only where the
  compound requires it (`:not(…)` skipped every reachable one); R2-S5 `<label>` no control in a body, a candidate whose
  end tag HTML omits counted at the file's end (it was dropped silently); R2-S7 render-prop `{children(…)}` and Blade's
  `{!! $slot !!}` are outlets; R2-D3 one ellipsis; R2-D4 `tag-length` only for a tag that could have held a finding (shadcn's
  `<DayPicker>` props were a limit line nobody could act on). Prose: R2-S6 (a component or an icon alone in a click's
  content is a doubt — the docs said "a control"), R2-D5, R2-F4 (the comment forms that silence), R2-F5 (a finding on
  every line ~4×, unbounded). The corpus again (2,591 view files): the 7 focus-within candidates gone, nothing else moved —
  img-no-alt 17, zoom-disabled 3, click-no-keyboard 11, no outline-removed finding. Mutation pass: this round's 51, the list
  written before the fixtures — 49 caught at first, two wanted a fixture (a `)` before the tabindex the compound requires;
  an outer candidate counted past the bound while an inner one waits at the file's end) — and the whole list again on the
  final tree, 51 of 51; review 1's lists run whole on it: 83 of its 106 as written, 16 ported to the lines this round
  rewrote (all caught), 4 superseded by the follow-up's list, 2 gone with S5's rule, 1 moved into the i18n strings with
  its line (the empty top's ellipsis — this round's D3 mutants); the follow-up's 22 of 22 (one ported).
- **1.37.0 review 3** (two reviewers, a verdict pass; its three LOWs fixed without another round, each the narrowest that
  closes it) — R3-U1 (R2-S1's remainder, a regression against 457d3da): `utilities()` cut a token at every `:`, inside
  brackets too, so `has-[:focus-visible]:outline-none` gave the variant `focus-visible]`, read as the element's own focus — a
  candidate and finish's warning, where the dash spelling is a doubt (`group-[:focus]:`, `peer-[:focus]:`, `in-[:focus]:`,
  `not-[:focus]:` the same). The removal side alone: `variantsOf` cuts at `:` outside brackets, a named variant's arbitrary
  value read whole, an arbitrary `[&…]` by its pieces as before; the focus-style side untouched (`has-[:focus-visible]:ring-2`
  a focus style, as its dash twin). A subtraction: against 2f901c0 only those shapes (and a malformed unclosed bracket) lose
  their candidate — the corpus sweep (2,591 view files, 293 candidates), the real fixtures and review 1–2's replays
  byte-identical. Not done: the sheet twin (`.panel:has(:focus)`, `button:not(:focus)` — the same on all three trees): testing
  `:focus` outside parentheses would also drop `button:is(:focus, :hover) { outline: none }`, an own-focus removal, and
  telling `:is` / `:where` from `:not` / `:has` is a name list; a token the class split cuts inside its brackets (a quote, a
  `=`: `has-[[data-slot=x]:focus-visible]`) reads as before. R3-RD1: pt's tag-length line said European "para lá de" (pt-BR
  derives from it): "além de". R3-RD2: the focus-chars clause said "past the characters parsed at most" — the limit now
  carries `chars` (the bound) and `alone` (that sheet alone is longer than it), and finish and the CLI name the 384K and say
  when one sheet alone was the cause; ES "hasta que … hubiera llevado". This file said the unjudged removals' first was "by
  file then line": it is the first LISTED one, a past-cap file only when none is listed. Mutation pass, the list written
  before the fixtures: R3-U1 10 of 10 (the guard that keeps a stray `]` from taking the depth negative caught by the
  quote-cut token above); R3-RD1 / RD2 26 of 26 — 25 at first, the survivor (`alone`'s `>` as `>=`, the comparison the
  search's end shares) a shape no fixture asked for: a sheet of exactly 384K characters is read and parsed whole (its focus
  style counts), now pinned — it also catches the budget comparison's `>=`.
- **1.37.0, the release's Docker run** — the hostile-cost check failed on node:18-alpine alone (`nested`, a sheet of nothing
  but `{`: 6–7× plain JSX under the suite's load, 3.2–3.9× quiet), and 457d3da measured the same there (3.6–3.9× quiet: the
  first Docker run had passed on its one re-measure). Not the checks: on Node 18 `styleTokens` alone walks that sheet at ~3×
  plain JSX and the checks add nothing over a walk with a do-nothing observer (46–53 ms vs 47–52 ms). A stylesheet's ratio is
  now to the larger of plain JSX and that shared walk (≤ 3×), with a coarse ≤ 10× plain JSX for a walk that stopped being
  linear; a mutant that pays O(text) on every block past the depth bound still fails it. The CHANGELOG says so.
- **1.38.0** (F0a, the UI references split — CRIT_X D1 / D2) — ui-design-patterns.md (59,965 B against its 60,000 cap) could
  not take 1.38's prose: its code-scan table (19,201 B) and its UI checks section moved WHOLE to the new
  `references/ui-code-scan.md` (cap 30,000), its Responsiveness section to the new `references/ui-responsive.md` (cap
  12,000), each byte-identical (17-docs pins the table's whitespace-folded sha1; the 1.37 docs pass reads the checks there,
  its registry slice ending at the next h2); the pointers that said "below" name the new file, and so do
  tooling-reference's spec_scan row and index.md's +ui line. Mutation pass 10 of 10.
- **1.38.0** (F0c, item 3 of the owner's 1.38 list as CRIT_3 and the DECISIONS cut it) — `font-size-viewport`, the seventh
  rule. The design judged a vw-only size by its enclosing block alone and warned on six real shapes F94's note excuses (a
  sibling `@media` override, CSS nesting, a Sass `@include`, vanilla-extract / emotion / MUI objects) and on R16's
  `text-[5vw] sm:text-[1.2vw]`; the three narrowings (the element's own `style` only; the file's conditional font sizes; a
  variant `text-` on the line) made all of them silent while the inline styles, `:root { font-size: calc(1vw + 1vh +
  .5vmin) }`, a Svelte `<style>`'s `3vw` and a lone `text-[5vw]` still warn. `width-viewport` was cut (CRIT_3: 16 corpus
  hits, ~12 unique, one plausible defect — Headless UI's documented Dialog, compiled `.w-screen`, clipped decorations), and
  with it the `-screen` pick. Oracle replay (15,636 view / style files of the designers' clones, 1.37.0 against F0c): the
  six 1.37 rules byte-identical, no font-size-viewport finding (no raw vw font size in the corpus at all). Hostile 256K
  inputs (`text-[` runs, bare-size class lists, line-long vw `calc()` values, long inline styles): 0.1–1.3× plain JSX.
  Mutation pass — 66 mutants, the list written before the code: F0a's 10, F0b's 9, F0c's 32 and a replay of 1.37's list on
  the lines F0c touched or shares (15 — 1.37's own list was not kept on disk) — 64 killed at first; the two survivors
  wanted a fixture: the row key on a line STARTING with `|` let a pipe-less copy of the untouched matrix read as written
  (the key now reads any line holding `|`; tracks.md), and a PT key renamed fell back to EN's text unseen (each language's
  text asserted). Three lines went before the pass as having no input of their own: a `font` pre-test before the style
  reader (no effect, no cost), `_` read as a blank in a Tailwind value (any arithmetic needs `(`, which the class split
  cuts), the `@apply` wrapper's own conditional test (an `@apply` in a conditional block holding a `text-` utility drops
  the file's candidates anyway). Two `else`s are equivalent by structure (a vw size in a conditional block, a variant
  `text-[…vw]`: each is dropped by the rule beside it).
- **1.38.0** (chain P, item 1 of the owner's 1.38 list as CRIT_1 and the DECISIONS cut it — the design was L, ~31 mechanisms
  across the four items; CUT TO M+) — the project inventory, the fact `no-reduced-motion`, the `_UI checks off:_` marker.
  The design shared settle's, the exports loop's and the token `head()`'s reads with the pass and threaded deprecated uses
  through settle (`watch`); CRIT_X D4 measured that sharing saves the bare read alone (parsing is 70–85 % of the pass) and
  CRIT_1 that the shared budgets let a watch move a verdict (`DS_PASS_STEPS`), so the pass reads on its OWN after scanCode and
  settle is untouched; deprecated uses went to 1.39. The pass is OPT-IN (the operation's `{uiPass: true}`): the design's
  `{uiPass: false}` seam would have touched 54 `remeasure(` calls, two child-process probes and the `pair()` helpers (CRIT_1
  must-fix 9). The feature report and finish keep 48 / 384K (CRIT_1 must-fix 1 over CRIT_X D4 — 5,000 focus-free CSS modules
  made the feature report 13.5× the no-candidate one, sheets naming `:focus` 12 s at 32 MB parsed), and their unjudged clauses
  point to the inventory, which judges past 48 under the 1.37 excuse rule at project scope — the design's per-file excuse
  narrowed the rule (CRIT_1: `reset.css` + a `focus-visible:ring-2` Button gave 1 where every feature report gives 0). The
  separate reduced-motion script search was cut (it never changed the answer on the nine clones); the fact is said only when
  no read was cut (CRIT_1 must-fix 6). The marker's unreadable entry has a `why` of its own (CRIT_1 must-fix 10); `past-bound`
  says the 50-entry bound. Cut too: the `:is` narrowing (backlog), the MB rendering and the `DS_FOCUS_SHEETS` rename.
  Found while building: a `<style>` block's first rule carries its `<style scoped>` line in its prelude, so `@keyframes` there
  was missed — and so, since 1.37, was every at-rule the rules test with `prelude[0] === "@"`: an SFC whose FIRST block is
  `@media print`, a `prefers-reduced-motion` one or a conditional block (`@media`, `@supports`) gave outline-removed,
  transition-all and font-size-viewport false positives. Fixed in this chain, a droppable commit the owner kept (c9b4e322,
  then 128054e9 took out its pre-test — no output, no measurable cost): `sheetChecks` reads every block's prelude without a
  leading `<style…>` tag (`RE_STYLE_TAG`) — the at-rule, the selector and the keyframes alike, `RE_KEYFRAMES` back to its
  anchored form (A stylesheet's structure, above).
  Measured: on the nine clones no fact (six declare motion — 21–449 lines —, each mentions reduced motion in a view file);
  cal.com's inventory 59 in 1,117 files (zoom-disabled 3, img-no-alt 2, click-no-keyboard 11, transition-all 43 — the
  design's numbers), vben 60, shadcn-svelte 65, shadcn-ui 89 (transition-all alone), Bootstrap and Foundation 0. G1′ (the
  pass ÷ a bare read + the checks in memory): the test's 400 files 0.88–0.96; the clones 0.63–1.36 over two series
  (a throwaway probe over the designers' clones — shadcn-ui, cal.com, vben, Bootstrap, Breeze); the report with the pass ÷ the 1.37 report: shadcn-ui
  1.64–1.72, cal.com 1.22–1.23, vben 1.42–1.58, Bootstrap 1.85–2.24, Breeze 2.84–2.88 (+38–255 ms on Bootstrap's and
  Breeze's 43–303 ms base; on those five alone — review 1 of 1.38 measured every clone of the designers: below). Oracle replay — `uiChecksOf` of the clones' 8,478 view / style files (findings,
  focus, past, cut), their nine project reports at the engine's default, six feature reports and finish parts on copies of
  three trees: byte-identical against 1.37.0 and the chain's parent, before and after the `<style>` fix. Mutation pass, the
  list written before the code (MUTATIONS.md, 95) plus two for the fix: 91 killed at first; three wanted a fixture (a
  limit's first file by path, the one character past the read, the fact under the pass's bound alone — view-size had masked
  it), now killed; one line deleted (the `<style>` strip's pre-test: no output, no measurable cost); one equivalent — the
  bound's `>=` as `>` (the read-ahead's slice holds the same 5,000: the 5,001st reads as nothing and cuts one step later).
- **1.38.0** (the docs pass, after the five chains merged) — ui-code-scan.md took the release's user prose (the project's UI
  checks and the fact, the marker, raw values against the scale, token values, the units table, DESIGN.md's export route,
  the breakpoints' and ui-states' pointers), steering-templates.md the units table's example and the marker's line,
  tooling-reference.md one rewrite of the spec_scan {designSystem} row. mcp/tests/17-docs.js's "1.38.0 Z docs" block reads
  every rule / fact id, limit code, bound and `why` code from the engine's SOURCE and runs each prose example through the
  engine (the steering example IS a units table and an applied marker to the registry's reader; the tooling row names every
  key both report shapes return on a project built to fill each 1.38 part). Where chain D's prose and the merged engine
  disagreed, the prose was corrected: ui-design-patterns.md's matrix paragraph (a row's n/a alone among its VIEW cells, the
  label in any language and never after a word, a dash / TBD open, every anchored table, the columns from the a11y one on
  unjudged) and its registry table (a colour that IS a token's in any notation; "in sync" of names, drift and gone beside
  it), ui-responsive.md's breakpoints (the first source with a width ≥ 320, ui.md's first line outside code and comments,
  its slot, a top-level `@theme`, the two resets, past six, who prints them, the values not read).
- **1.38.0 review 1** (area ui — the UI-project reviewer's UP-3 … UP-7; the cost findings UP-1 / UP-2 are another fix
  agent's) — UP-3 (MEDIUM): the bare `text-[…vw]` narrowing was decided by the LINE, and shadcn / Next class lists are
  routinely split over lines (`cn("text-[8vw] font-bold", "md:text-7xl")`, a cva base with its responsive variant below, a
  wrapped JSX / Vue class attribute): each warned, finish too, while the same classes on one line were silent. It is decided
  per FILE now, as a stylesheet's size is: `utilities` pushes the candidates on its caller's list (its own variant test
  gone — `RE_TW_TEXT`, anchored, takes no variant's token, so `variantsOf` left that branch), and the caller drops them all
  once any non-CSS line held `:text-` / `:!text-` (`RE_TW_TEXT_VARIANT`, Tailwind 3's important too); a sheet's `@apply`
  sizes the same over its `@apply` statements — never its declarations: a colour-variant `@apply` beside `font-size: 5vw`
  keeps the finding. UP-4 (LOW, a subtraction): a sheet read in part (its override past the 256K read — a theme's 270K
  style.css — or past a 2,000-character line cut — a minified sheet) was judged as if whole; `uiChecksOf` takes `over`
  (featureReport's two calls, the inventory's `feed`) and a `partial` file — past the read or a line cut — judges none of
  the sizes the rest of the file decides (the sheet's `condSize` starts set; the bare `text-[…vw]` too, as UP-3 made them
  per file — the same property; in a markup file a cut template line counts, a doubt read as not judged); an element's own
  `style` is decided on its tag and stands. UP-5 (LOW, the minimal form): `RE_STYLE_TAG` also strips a leading `</style>`
  (a second block's first rule); Astro's `define:vars` documented for the user (silence it) and left to 1.39. UP-6 / UP-7
  (LOW, prose): ui-code-scan.md says a feature report's focus search is narrower than the inventory's, and the marker's
  spellings (ui-code-scan.md, steering-templates.md: a line of its own as `_Token sources:_` — a list item or bold is not
  read —, each id bare); a 17-docs row runs the four spellings through the registry's reader and `uiOff`. Oracle: the
  parent against the fix, `uiChecksOf` of the 20 clones' 17,590 view / style files read as the reports read them (22 past
  the read, 75 with a cut line): byte-identical (no vw text size in the corpus). Cost: the fix's `uiChecksOf` ÷ the
  parent's, one process, interleaved with the order alternated, median of 10 — five clones 0.87–1.08, hostile 256K inputs
  aimed at the changed lines (runs of `text-[`, bare sizes a variant ends, lines of `:text-`, a sheet of `@apply` sizes,
  two-block SFCs) 0.74–1.04. Mutation pass, the list written before the fixtures (%TEMP%/dsd-138f1-ui/MUTATIONS.md, 34):
  32 killed at first; the first candidate a line (`size === null`) a cost guard — a line of 60 bare sizes 1.9× without
  it, kept; a `text-[` pre-test before the anchored `RE_TW_TEXT` output-equivalent and no effect beyond noise in three
  series: deleted. R1-DOC4 (LOW, prose): the levels' current rule still read 1.37's ("`warn` — the feature report AND
  finish's warning", "`report` — the feature report alone"); since 1.38 the project inventory counts both levels (tagged
  `report`), so `warn` is the reports (a feature's, the project inventory) and finish's warning, `report` the reports alone,
  never finish; a 17-docs row pins both clauses and each `UI_RULES` id under its level.
- **1.38.0 review 1, the cost** (UP-1 HIGH, UP-2 and DOC1 MEDIUM) — the report with the pass was 4–10× 1.37's on five of the
  designers' own clones, against the "1.2–2.9×" the release note said of five others. UP-1: the owner kept the pass on the
  operation and narrowed it by a property — a stylesheet past the read (a compiled bundle) is fed with no line, counted and
  named in the existing `view-size` entry (it could carry it: count and first file; only its CLI line gained "the project's
  UI checks skip a stylesheet that long"); a feature report and finish keep 1.37's read. On the clones only Bulma (13 such
  sheets) and cal.com (one generated `globals.css`) hold one: Bulma's pass ~940 → ~440 ms, cal.com's inventory 59 → 57
  (that sheet's two transition-all); line-length no longer counts the skipped sheets' lines. Not fixed, said above: a skipped
  sheet's focus styles excuse nothing (no clone affected — 1.39 backlog). UP-2: on Windows the pass's probe often averaged
  past 200 µs (each read followed by a parse), so 8 workers started for 64–300 files and cost more than reading them all;
  readFileHeads now also asks the files left × the probe's average to reach AHEAD_START_US (80 ms, the pool's start
  measured once). Taxonomy's pass started the pool in 2–5 of 7 runs before, none after (its report ×2.0–3.2 → ×1.3–1.4
  1.37's); cal.com / shadcn-ui / shadcn-svelte / vben still start it. DOC1: re-measured on every clone the two reviewers used, both
  engines and 1.37 in one process, interleaved, the order rotating, median of 7, a Windows machine shared with other runs
  (opens 1–2.7 ms each), two series — the report with the pass ÷ 1.37's, the ms it adds, [the parent's ratio]: sakai-vue
  (47 view files) ×9.2–14 +129–260 [×10–12]; open-props (85) ×6.3–7.8 +88–98 [×6.6–8.5]; Jetstream (110) ×2.8–3.5 +48–59
  [×2.8–3.3]; Foundation (123) ×10–11 +369–410 [×8.4–10] — its 1.37 report reads almost nothing (43 ms) and each of its
  opens cost ~2 ms then —; Breeze (168) ×3.8–4.0 +287–636 [×4.4–5.1]; taxonomy (97) ×1.3–1.4 +39–63 [×2.0–3.2];
  Bootstrap (254) ×2.1–2.2 +524–597 [×1.6–3.3]; Bulma (544) ×4.2–5.6 +485–553 [×7.7–8.2]; vben (721) ×1.4–1.6 +426–536
  [×1.6–1.8]; cal.com (1,108) ×1.25–1.33 +547–787 [×1.2–1.4]; shadcn-svelte (2,174) ×1.65–1.67 +682–1,106 [×1.6–1.8];
  shadcn-ui (3,562) ×1.9–2.0 +1,341–1,471 [×1.9–2.2]. G1′ (paired, median of 7): 0.79–1.53 (Bootstrap's 1.53 one
  series, 1.27 the other) but sakai-vue's 2.21 in the second (the parent 2.27 at that moment; 1.31 the first — review 2
  of 1.38's R2-DOC6: the range had dropped it); 15 reps on the eight small and mid trees: medians 0.86–1.16 (sakai-vue
  1.09), upper quartiles ≤ 1.23. The read-ahead's 1.35.4 gain kept: shadcn-ui's report 1.71× slower with the pool off, 1.04× the parent's rule. The pass
  scales with the view and style text it reads and the files it opens: the ratio is high where 1.37's report read almost
  nothing; Foundation shows the bound's price on a quiet moment (start 32 ms: the pool would have saved ~30 ms there).
  Fixtures: a sheet past the read, one of exactly 256K and an HTML page past it, the feature report and finish over the
  sheet (15-quality-ui-project.js); both read-ahead bounds hit exactly, 1 ns a read either side (…-read-ahead.js); the
  prose against uiProject's feed (17-docs.js). Mutation pass, the list first (MUTATIONS.md): 17 / 17 killed.
- **1.38.0 review 2** (area ui — R2-UP-1 MEDIUM, made by fix round 1's UP-3; R2-UP-2 / R2-DOC1, R2-DOC6 LOW, prose) — UP-3
  decided the bare `text-[…vw]` per file with the per-line predicate unchanged, `:text-` after any variant: a nav link's
  `hover:text-gray-900`, a `dark:text-white`, an `md:text-center` anywhere silenced a hero's `text-[8vw]`, while the same
  design in CSS (a `:hover` colour) warned — not (2)'s property, a font size under a condition. The reviewer's probe (a hero
  line on top of every view file of the 20 clones, the drops classified with a cut line first): 1,333 of 14,512 markup files
  dropped by a non-size variant (Breeze 238 of 334, Jetstream 72 of 109), 266 by a size one. `RE_TW_TEXT_VARIANT` now takes
  a SIZE alone (a type-scale step, an arbitrary length — UI checks above) — the reviewer's prototype (`\[` for any arbitrary
  value) narrowed: `hover:text-[#111]` and an untyped `[var(…)]` are colours. The probe after: 0 by a non-size variant, 266
  by a size one, the 54 cut and 6 over-read files unchanged. One shape beyond 9c6185aa's per-line rule, meant: a colour
  variant on the hero's OWN line (`text-[8vw] dark:text-white`) warns now (it was silent there too). Trade-off, in
  ui-code-scan.md: a project's own key (`md:text-hero`) no longer silences. Fixtures: S3.dark moved to the warning rows with
  the reviewer's four Hero* shapes, a wrap, `hover:text-[#111]`, `[var(--brand)]`, daisyUI's `text-base-content`,
  `md:text-hero` and a sheet's `@apply` sizes beside a colour-variant `@apply`; one silent row per shape the const takes; a
  17-docs row runs the prose's two examples through the engine. Oracle: `uiChecksOf` of the clones' 15,630 view / style
  files, this tree against cf72f0cd — identical (no vw text size in the corpus); the reviewer's shapes / twostyle /
  parity / bundlefocus / marker / proj scripts identical but next-dark.tsx (the line above, now warning). R2-UP-2 / R2-DOC1:
  ui-code-scan.md said a sheet past 256K is "named" in view-size (only the first file by path is) and that any focus style
  in any file read excuses (a skipped sheet counts as read, its focus styles excuse nothing): it now says counted, and the
  inventory may warn of a removal a feature report excuses by such a sheet (the mechanism stays: 1.39 backlog, above);
  ui-code-scan.md stays ≤ 30,000 by two examples cut (`calc(1vw + 1vh)`, the UP-6 sentence's `focus-visible:ring-2`).
  R2-DOC6: the cost entry above names sakai-vue's G1′ 2.21. Left as found (pre-existing since F0c, 1.39 backlog): a
  conditional `@apply` of any `text-` utility sets `condSize` (`RE_TW_TEXT_ANY`). Cost, this tree ÷ cf72f0cd, one process,
  interleaved: `uiChecksOf` over six clones' real view files (median of 9) 0.87–1.09; hostile 256K inputs aimed at the
  predicate (median of 11) 0.86–1.36 — runs of colour variants, `md:text-[#111]` / `[var(…)]` — and 4.0 on lines of
  `:text-` + 1,900 digits (0.9 ms against plain JSX's 13: the `\d*` backtrack, linear); a file whose colour variants no
  longer drop its 5,000 bare sizes 1.31 (the findings it now counts). Mutation pass, the list written before the fixtures
  (%TEMP%/dsd-138f2-ui/MUTATIONS.md): 29 / 29 killed, each by its rule's fixture — every branch of the const (each step,
  `\d*`, the end guard, the `length:` hint in both brackets, a digit / `.`, each math function, `!?`, the `:`), the sheet's
  and the class list's tests, the prose (three) and uiProject's feed.
- **1.38.0 release (Docker)** — the 1.37 cost check "the checks cost at most 3× the raw-value read" failed once in
  node:24-alpine (4.7) and passed alone 3×; 1.37.0 and 1.38.0 measured in one process inside that image: medians 1.75 and
  1.69 (node:22 1.60 and 1.79), both spiking to 3–4× — a ~1.3 ms denominator (120 files) a GC pause moves. The check now
  reads 1,200 files (a ~13 ms denominator), its bound unchanged.
- **1.39.0** (chain C — item 2 of the owner's 1.39 list as CRIT_X and the DECISIONS cut it: ~29 mechanisms designed across
  the release, D1 · D2 · D3 · D5 and the floor-zoom capture change cut, ITEM_2's other six kept) — D4: Vue's
  `<component :is>` is a component (its click and style unjudged); the design also made it a CONTROL inside a click body,
  and the oracle replay (`uiChecksOf` of the 27 clone checkouts' view / style files, this tree against 92c44e0a) showed the
  design's count wrong — 4 findings left, not 2: alert.vue's two (false) and vben's preset tiles (`content.vue:40`,
  `theme.vue:71`, true — a mouse-only tile around an icon's `<component :is>`); the narrower reading (CHAIN-BRIEF) keeps
  1.38's body rule, so 2 leave, 2 stay. UP-7: `RE_DS_OFF_ENTRY`'s code-span branch (the 1.38 docs' own spelling read
  `unreadable`). D6: the script search (Motion and the fact, above) with CRIT_2's must-fixes 5–7 — the limit says WHICH
  bound (`bound`), the CLI says "the first N" only then, ONE read loop (`readHeads`, the views' and the scripts'), the
  `.stories.ts` / `e2e/` / 8 MB fixtures, the prose that a test setup's mention counts. The `100vw` sentence of
  ui-responsive.md made true (width-viewport, above). Oracle, both corpora (`%TEMP%/dsd-139d-2/clones`,
  `%TEMP%/dsd-139d-1/repos`): the project report without the pass byte-identical on all 27 (scanCode's new `scripts` key
  never reaches it); the inventory differs on three — outline's fact withdrawn (1.38's was false), sakai-vue's gains
  `motion-scripts` {read: 10, count: 1, file: `src/service/CustomerService.js`} beside its true fact, vben's
  click-no-keyboard 9 → 7 (alert.vue's two; the same in both corpora's copy of it); every other finding, fact and limit
  identical. ui-code-scan.md −15 bytes net (CRIT_2 must-fix 8: the fact's sentence +39, its example and two spellings
  shorter); ui-responsive.md +151. Mutation pass, the list written before the fixtures (%TEMP%/dsd-139-c/MUTATIONS.md):
  56 / 56 killed, each by its rule's fixture — D4's twelve (the bound / static split, each predicate's `name` vs the written
  tag, the quotes, the case), UP-7's five, D6's 29 (the gate's inputs by the spy, the three filters, the sort and its
  tiebreak, each bound and its off-by-one, the limit's three conditions, the off fact, the shared loop's `over` and `cut`,
  both constants through the prose; the stop at the first mention a cost guard, killed by its timed ratio), the CLI's four,
  the prose's six (a test setup read as a test among them). Cost, this tree ÷ 92c44e0a, one process, the two engines side
  by side, interleaved in alternating order, median of 7, on a machine three other chains loaded (%TEMP%/dsd-139-c/cost.js):
  the project report with the pass — mantine (4,340 views) 1.00, outline (791, the fact said: the search runs) 1.03 (+56
  ms), vben (729) 1.01; motion-primitives +15 ms, sakai-vue +3, taxonomy +71 (all 35 scripts read), breeze −21 (no search:
  noise) — within DECISIONS 6's bar (≤ 1.25× at 700 views or more, ≤ +150 ms below); `uiChecksOf` over the same clones'
  view files (the feature report's and finish's per-file part, D4) 0.89–1.03.
- **1.39.0 reviews 1 and 2** (the UI checks' prose; no engine change) — review 1: the registry's marker bullet still listed a
  code-spanned id as "another shape" (UC-2: an id in ONE balanced code span reads as bare since UP-7); THE SCRIPT SEARCH's
  current rule quoted CRIT_2's prototype cost and a vendored example under `vendor/`, which the walk skips (UC-3); "a test
  setup's included" was true only outside a test folder (UC-4 — `src/test/setup.ts` is a test file, never read); the doubt
  sentence of ui-code-scan.md now says a bound `<component :is>` in a click body is none (R1-DOC-4 — the D4 narrowing that
  keeps vben's true tiles). Review 2 re-measured the search at its 2,000-file bound on a small UI (158 views beside 3,381
  scripts): ×1.5–1.7 (+240–350 ms; CPU ×2.05) — past DECISIONS 6's +150 ms for small trees; the owner ACCEPTED it as said
  (the CHANGELOG states it), as the deprecated uses' watch; a smaller `DS_MOTION_SCRIPTS` is 1.40's question.
- **1.40.0** (chain C — items 3 and 4 of the owner's 1.40 list, "everything, the cuts included", as CRIT_3 / CRIT_4 and the
  DECISIONS cut them: every backlog entry designed again and critiqued on FRESH numbers; one mechanism kept, R3-UI-1). THE
  CORPUS, built to HAVE findings (1.38's and 1.39's held no font-size-viewport finding: every D1 verdict had rested on
  synthetic shapes) by GitHub code search, depth-1 clones of public repos: 22 of the standard shapes, 255 found by
  `"text-[5vw]"` … `"text-[20vw]"`, 270 sampled from `font-size <N>vw` in CSS / SCSS / Vue / Svelte / Astro / HTML, 25 by
  `"text-[x-large]"` and its kin, 150 by `not / has / where / is` + `focus outline none` — 722 repos, 50,043 view / style
  files as the inventory feeds them: 3,921 font-size-viewport findings, 4,026 outline-removed candidates (the design's 4,072
  counted 46 in sheets past 256K, which the inventory never feeds); plus 147 what-input repos (S9) and item 4's 38 repos
  (1.39's 18, ten Vue / Astro apps, nine with Playwright / Cypress harnesses) with 193 `.astro` files.
  KEPT — R3-UI-1 (UI checks above: what Tailwind's own `text-[…]` types a font size under a variant silences, as
  `md:text-lg` does). It moved 0 of 3,921 findings either way: the oracle replay, `uiChecksOf` of the 50,043 files under
  8ec6ca52 and this tree in one process (%TEMP%/dsd-140-c/both.js — CRIT_3's), every rule's count identical, 0 lost, 0
  gained, 0 focus flips; by construction it can only set `tw.variant`, never add a finding. The shapes are real but never
  beside a bare viewport size — 3 of 105,771 text files hold one only the new const matches (`max-[425px]:text-[small]`,
  SkillANA's `sm:text-[large]`, `*:text-[x-small]`), all in the keyword-searched corpus; no file holds `size:` /
  `percentage:` / `*-size:` under a variant. Its case is Tailwind's own typing at 0 bytes of user prose (ui-code-scan.md's
  "no size under a variant" is now true of keywords), not a count. CRIT_3 must-fixes: ONE keyword group with one `]` (the
  measured form, fewer mutant sites); `size:` and `(…)` named Tailwind 4's (v3.4.17's fontSize types are absolute-size /
  relative-size / length / percentage), `[theme(…)]` named as not taken; 16 silent rows (37 in all) and 8 warning rows —
  SkillANA's `[large]`, `[xx-large]`, the named colour `[mediumseagreen]` and `[smallish]` among them. Cost, the const
  alone over the same 2,059,973 lines of 15,764 real view files (12,959 matches each side), interleaved, median of 11, with
  an A/A control (the old const against a fresh copy of itself): Windows 0.945 (A/A 1.008), node:22-bookworm-slim 1.033
  (A/A 0.993), node:24-alpine 0.901 (A/A 1.022) — noise; each alternative a literal of ≤ 14 characters after `:text-[`; no
  cost guard (CRIT_X D5: CRIT_3's optional hostile row not added).
  CUT AGAIN, item 3. D1 (a markup file's template and `<style>` decided as one file) on a REAL repo: it drops 144 of the
  3,921, all in harshchovatiya/Durvasha-Infoteech's four pages (`accordion.html:193` `<p class="text-[5vw]">` silenced by a
  slideshow's `@media (max-width:300px){.prev,.next,.text{font-size:11px}}` at :148-154) — true F94 failures, 0 doubts
  fixed; a hero probe in each of the 5,000 real markup files holding a `<style>` block is silenced anew in 589 (11.8 %;
  1.38's rejected R2-UP-1 was 9.3 %). A2 (the Tailwind variant flag alone crossing the halves): 0 findings move; 57 of the
  5,000 probes flip, and a true / doubtful pair flips together — `<h1 class="hero text-[8vw]">` beside `.hero{@apply
  md:text-6xl}` and `<h1 class="text-[8vw]">` beside `nav a{@apply sm:text-sm}`: telling them apart is matching a tag's
  classes to a rule's selector. `RE_TW_TEXT_ANY` narrowed: 163 real files hold an `@apply … text-`, none of them in a
  conditional block; the size-const narrowing re-makes 1.39 CRIT_2's app.css false positive (Tailwind 4 resolves a named
  `text-<key>` colour-first, then `--text-*`: the theme decides, never the syntax). D3 (`:focus` inside `:is()` /
  `:where()` / `:not()` / `:has()`): 1 of 4,026 candidates — a-sharapov/eile's `.card :global(.cms-form-sent:focus)`,
  Svelte's scope wrapper, the element's own focus, which 1.39 ITEM_2's allow-list form would have DROPPED; the
  negation-strip form moves 0. D5: 32 sheets past 256K in 15 of 722 repos, 6 with a focus style, 0 removals only such a
  sheet would excuse. UP-6: the feature reports would lose 91 warnings (37 repos) that the inventory excuses by a focus
  style in another view file; split by WCAG Understanding 2.4.7's Examples (a text field's caret is a visible focus
  indicator) — of 16 read, 9 certain (`button{outline:none}` "excused" by an input's ring, Pricing / navbar / error-page
  controls), 4 text fields (taxonomy's `editor.tsx:154` title textarea among them), 3 false (tailwindcss.com's dialog
  panel, a vaul drawer, a `<section onClick>`): ≈ 50–60 certain of the 94 split files, not the design's "≈ 73 true". S9's
  mechanism: 1,663 `[data-whatin…` selectors in 146 of 147 repos; 212 removals name one — 173 excused by their file's own
  focus style, 21 by the project's sheets, 18 stand: 15 modality-only, false (`[data-whatintent='mouse'] *:focus`, in
  reactjs/translations.react.dev's `a11y.css:7`), 3 on `input:focus, textarea:focus` lists, text fields — only one
  library's attribute name tells them apart (1.39's "0 in 18 clones" corrected).
  CUT AGAIN, item 4 (no engine change; the oracle the identity). D2 (Astro's `<style define:vars>`): 103 blocks in 102
  files of ~100 repos, 4 opening with an at-rule, 0 verdicts change (3 files by a line shift). A local form on file, not
  shipped — `.replace(/^>\s*(?=@)/, "")` beside `RE_STYLE_TAG` in sheetChecks, viewLines untouched: the four synthetic shapes
  fixed, 0 of 31,884 files differ with the findings' VALUES compared (the plain `^>\s*` rewrote every nested child rule's
  finding — taiga-ui's `input-inline.style.less:40` "> input { outline: none }"); it misses `define:vars={{…}} is:global`
  and a styled-jsx `<style jsx>` template opening on `@media` (cal.com's `DataTable.tsx:132`, 0 verdicts). `width-viewport`: 78
  boxes in 15 of 38 repos — 46 `fixed` within four lines, 3 `absolute`, 1 `sticky`, 28 in flow, 15 of those under a root
  that clips horizontal overflow; Chrome 157 and the headless shell 158 at 640 × 360 @2: an `absolute` 100vw box overflows
  as an in-flow one does, only `fixed` does not, `scrollbar-gutter: stable` takes it back (ui-responsive.md's sentence
  re-verified). The floor-zoom capture keeping scrollbars: client width 625 against inner 640 on every tall page (15 CSS px
  of scrollbar), so it needs two new definitions — "the width got", a reflow only where the root scrolls — in
  ui-review.md (282 B left) and spec-ui-reviewer.md (4 B left). S12: `.storybook/` is never walked; 28 view / style files
  under `playwright/` / `cypress/` / `storybook/` folders in 9 of 38 repos hold 0 findings and 0 motion lines, while those
  folders in `TEST_DIRS` would turn 298 code files in 10 repos into test files for every `isTestFile` reader (carbon 139,
  cal.com 79, blockscout 42, canvas-kit 17 …). UC-1: 504 `<component>` tags in 11 Vue repos, 1 bound to one literal
  (primevue's TreeSelect.vue:51, its `:is` bound to a quoted icon component's name — a component either way), 0 verdicts.
  The marker's list-item
  / bold spellings: no public design-system.md holds any registry marker; a warn-only reader would cover one of the three
  markers `RE_DS_MARKER` anchors (`_Token sources:_` / `_Libraries:_` miss the same way) — prose, on a user's report a
  design for all three. R2-UD-1: the owner KEPT 2,000 (THE SCRIPT SEARCH above says the cost: naive-ui ×1.48 / ×1.51 on
  Windows, ×1.03 on node:22; +412 ms at the bound on Windows, +82 / +106 ms in Linux); ITEM_4's "500 would cut three real
  first mentions" was false (CRIT_4 must-fix 1) — carbon, vben and cal.com never search, their views mention; 500 changes
  no fact on the 38 trees. Out of the items, 1.41: the inventory's 1.37 excuse hides ≈ 50–60 certain removals in 94 files
  (a report-only count); cal.com's 53 `apps/web/playwright/*.e2e.ts` are no test files (`RE_TEST_NAME` has no `.e2e.`); the
  floor's reflow measure reads overflow a clipped root cuts as a sideways scroll. Mutation pass, the list written before
  the fixtures (%TEMP%/dsd-140-c/MUTATIONS.md): 41 / 41 killed, each by the font-size block's fixture — R3-UI-1's 24 (each
  hint, the `(…)` bracket, each keyword's prefix and its count, the one `]` and its two partial forms — `[mediumseagreen]`,
  `[smallish]` —, `xlarge`, any `[\w-]+:` hint, the `:`, the sheet's `@apply` on the old const, D1's declarations guard)
  and 1.38's 17 replayed on the new const (each step, `\d*`, the end guard, both brackets, the `length:` hint, a digit /
  `.`, each math function, `!?`, the `:`, the class-line test, any arbitrary value).

### UI state matrix
- **1.38.0** (item 4 of the owner's 1.38 list — chain S) — designed (ITEM_4) with a reader that took any State-headed table
  holding two listed rows, judged the a11y column, and an approval stamp (a uiStates key, never built) with a `legacy` branch. The critique
  (CRIT_4) ran that reader on real shapes: a data-fetching state machine (`State | Event | Next state`) read 13 no-row, a
  trailing Notes column 15 gaps, the Worst case's empty a11y cell one — so the matrix is the scaffold's own table, anchored by
  its localized a11y header cell, the views between, the a11y column unjudged; the stamp went (no 1.37 design can hold that
  header: the legacy branch protected nothing). The ruling (DECISIONS) kept it a warn at m / l / no size, a note at s, outside
  every gate, advisory in spec_upgrade (the critique: any warn outside the advisory ids added `warnings` attention), and moved
  the brief's design budget to 6,000 with it (tasks-and-evidence.md → History). The corpus key (`uiStateNames`, CRIT_4 must-fix
  6) keeps every language's labels out of an English doctor. The oracle replay (the same 32 +ui features on 1.37.0, the F0
  tip and this chain): the only differences are the new check — a pass with `usNone` on every 1.37 shape (prose, the guide's
  own table, a state machine), `usOk` on a full matrix at 1–3 views, the gap a warn at m / l / no size and a note at s — and
  spec_upgrade listing it (attention unchanged). Mutation pass (the list written before the fixtures): 50 of 50 killed, each
  by the fixture of its rule — one only after a fix (the no-size fixture passed `undefined` to a helper whose default size
  was m: "no size warns" was never asked); one cost guard timed apart, not a mutant: the cell cut (`US_CELL`) — without it
  the matrix reader is 2–4× slower on 1 MB cells and the check ~1.8× (269–307 ms vs 143–165 ms, a 3 MB section), linear
  either way, so the 2× ratio fixture holds both. Two fixtures in 16-conventions-build own the corpus key: a corpus without
  it renders; `localeLoaded` drops the cached labels with the corpus.
- **1.38.0 review 1** (BS-3, BS-4, BS-5 — prose, the owner's ruling) — a matrix of `TBD` / dashes read as written, so the
  m / l gate passed it though the CHANGELOG said it never passes an empty matrix: the docs now say the gate refuses the
  untouched matrix and `ui-states` warns about each such cell (markdown-and-trace.md → History; a cell key of the answering
  cells — the reviewer's prototype — set aside, a 1.39 candidate). Two anchored tables splitting the 16 states warned 16
  `no-row` gaps while the user doc said "a state's rows count together … every table": the doc now says each table is a
  matrix of its own, a row per state in each (the rule unchanged — counting across tables is 1.39's to weigh). The cost
  note named 0.1–0.35× but a header of 1,000,000 view cells costs ~2.1× `sectionState` (measured again: 2.1 s against 1.0
  s, 2.6 against 1.2; the other hostile shapes 0.07–0.32×): said above, with the bound that would close it (a length
  pre-test before `usWords`) left for 1.39 — a LOW fixed by prose, not by a new test of the header.
- **1.38.0 review 2** (R2-DOC2 — prose) — review 1's docs said the m / l gate refuses the untouched matrix; it refuses a UI
  States section left as the template, and the gate reads the SECTION: write the scaffold's reference line (its TODO line
  gone) and the untouched matrix passes, `ui-states` warning about its 16 rows — the end a `TBD` matrix comes to (9c6185aa
  and this tree alike: the engine unchanged, in EN / PT / ES). ui-design-patterns.md and the verdict bullet above say so;
  17-docs runs a written line over the untouched matrix (filled, `ui-states` warns) and over the scaffold with its TODO
  (unfilled).
- **1.39.0** (item 3 of the 1.39 round — chain B; BS-5 alone of the matrix's three) — `US_HEADER` (64): the anchor looked
  for in a header's first 64 cells, `t.header.slice(0, US_HEADER)`, the cut folded into `truncated.views` (CRIT_3 must-fix
  6: no fourth `usTruncated` argument, so the three languages and 1.38's bound fixture stay as they were). The design's
  length pre-test did not fix the measured shape — 1,000,000 cells of 4–8 characters each pass "≤ the longest label" —,
  and a `dsSlot` pass over the columns before the anchor costs as much as the word read. Measured: 200,000 cells, the anchor
  last, 0.29× `sectionState` (1.38: 2.1–2.8× over the recorded runs — 2.25–2.84× the designer's header.js re-run by the
  critic, 2.1–2.75× the chain's own). Lost: an anchor past cell
  64 — no real header has one; said when it happens. BS-3 (a row keyed by its answering cells, so a matrix of `TBD` /
  dashes / ticks reads as template and the gate refuses it) is CUT (CRIT_X cut 4: 1.39's only new refusal, at size s where
  1.38 only noted, through `sectionLineKey`, which every track's and pack's tables share, and four approved-design
  surfaces — spec_upgrade's attention, the roadmap's list, status' `filled`, the save hook): 1.38's prose stands. BS-4
  (tables with the same views one matrix in parts, its detail prefixed "tables 1 + 3 ›") is CUT (CRIT_3: a narrowing that hides a real gap —
  desktop / mobile matrices with the same views, one lacking `Offline`, would go silent): 1.38's prose — a row per state in
  each table — stands. The `uiStates` stamp stays cut: nothing in 1.39 makes `ui-states` warn on a design 1.38 passed.
- **1.39.0 review 1** (BU-5 / R1-DOC-5 — LOW, wording) — an anchor past a header's first 64 cells gave `usNone` and the cut
  in the view bound's words ("only the first 10 tables, 60 rows each and 12 view columns were read"): a user looked for a
  view-column problem. `usTruncated` takes a fourth argument, `US_HEADER`, and its EN / PT / ES text a fourth clause — a
  header's first 64 cells (the number from the constant, not written into the three languages); the status, the state and
  `truncated` unchanged (CRIT_3 must-fix 6 had kept the text to spare its 1.38 fixture: both `cut()` helpers of
  15-quality-ui-states.js now pass 64, and the BS-5 fixture asserts the clause in PT and ES too). One 1.38 range for the old
  header cost, 2.1–2.8× (the CHANGELOG, the current rule above, the test's comment); re-measured with the fix (h1.js, the
  H1 shape, medians of 5, three runs): 1.38 2.59–2.75×, the fix 0.26–0.28×.
