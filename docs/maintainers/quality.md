# Spec quality — steering amendments, cross-feature criteria, glossary, design weighing, reuse

Maintainer notes, one topic of the map in [CLAUDE.md](../../CLAUDE.md) — the index and the hard constraints.
The 1.16 Q quality checks, the design's trade-offs / risks / reuse sections and their doctor warnings, the constraint
nudge, the TDD micro-cycle.

## Spec quality (1.16 Q)
- **Steering amendments** — `approvePhase` records `steering` {file: sha1} on a requirements / design approval and its
  history record (`STEERING_GOVERNED`; `governingSteering()` = constitution.md + the active tracks' steering files (a track
  pack's too) + `inclusion: always` files + EVERY `fileMatch` file, its patterns recorded in `steeringMatch` {file:
  [patterns]} — requirements / design are approved while tasks.md is still the template; `steeringFingerprints()` — CRLF /
  BOM are encoding). `steeringChanges(root, approvals, dir, tracks)` → stable codes `modified` | `removed`; a `steeringMatch`
  file counts only while the feature's CURRENT `_Implements:_` match its recorded or current patterns (a record without
  `steeringMatch` counts every file it holds). Doctor warns
  `steering-changed-since-approval` (+ `steeringChanged` [{phase, approvedAt, files}]); next_action appends
  `quality.naSteering` to its step — never a step of its own. `spec_impact {phase: "steering"}` → `steeringImpact()`: name
  optional (the MCP schema has no `required`; the engine refuses a missing name for every other phase), read-only (`reopen`
  refused), `untracked` = approvals without `steering` (pre-1.16 — never flagged).
- **Cross-feature criteria** — `crossFeatureAcs(projectDir, {only})` over `xacTable()` (memoized per read-cache scope in
  `XAC_MEMO`, dropped by forgetCached / invalidateReadCache; ACROSS calls `XAC_FEATURE_CACHE` — per feature kind / lang /
  tracks by the .state.json lstat signature + the context (packs, template files, project lang), its rows by the
  requirements.md signature too; `XAC_TABLE_CACHE` = the whole table + `table.results` (the pairs) while nothing changed and
  no `_Supersedes:_` exists; a file modified < 2 s ago is never trusted (`XAC_RACY_MS`, git's racy-clean rule); features with
  inferred tracks or `packMarkers` are never cached; the others' rows and the table are keyed by the call's sorted ghost-marker
  set too — a removed feature took a deleted pack's last ghost with it, 1.16 verify NEW-2). `specsFileContained` is memoized per scope (`CONTAINED_KEY`). Doctor's
  check runs last (spliced back in place); `opts.lean` (next_action's and finish's own doctor) skips it once another check
  warns / fails — the verdict can't change. A criterion's shape (`acShape`) = accents folded, lower-cased, `XAC_STOP` (EN/PT/ES
  stop words + EARS keywords) out, `xacStem`, split at the modal (`RE_XAC_SYS_MODAL` "system/sistema (não/no) SHALL/DEVE/DEBE",
  else `RE_XAC_MODAL` — the negator before it belongs to the response) into `trig` / `resp` word sequences (document order,
  deduped); polarity = `RE_XAC_NEG` on the RESPONSE only; trigger negators (`XAC_TRIGGER_NEG`, "no" outside PT, n't / cannot /
  non- rewritten to "not") mark the next content word "!w" — `xacOpposed()` (w vs !w) = complementary conditions, never a
  pair; numbers with the word after them (`numKey`, "5 attempt"; `nums` in document order for display). Clause similarity
  `xacClauseSim()` = LCS (LIS over positions) / union — order-aware. `near-duplicate`: trig AND resp each > 0.8 (strict), same
  polarity, same numKey; conflict: word Jaccard ≥ 0.7 (the index gate), trig ≥ 0.5 and resp ≥ 0.5 (`XAC_RESPONSE`) —
  `opposite-modal` | `different-numbers`. Never compared: a criterion with a template slot left or < 3 words, any
  built-in / track-pack / project template criterion's words (`builtinTemplateAcs()`, `projectTemplateAcs()`, and two light
  edits of one), criteria retired by a shipped `_Supersedes:_`, declared pairs (pending ones too). Candidates from a
  prefix-filter inverted index (exact for the threshold); caps 4000 criteria / 200k comparisons / 200 pairs. Doctor warn
  `cross-feature-acs` (names the other feature's AC), `spec_catalog.crossAcs` {pairs, truncated}, a SPECS.md section when
  a pair exists, agents/spec-critic.md.
- **Glossary** — the steering stub `glossary.md` (steering_scaffold; init never creates it): `- **Term** — definition.
  _Avoid: a, b_` (`_Avoid:_` English-stable, same line, a sub-line or an indented paragraph after a blank line).
  `glossaryEntries()` (→ `total`, `truncated` past 300: doctor warns `quality.glossaryTruncated`, clarify returns
  `glossaryTruncated` {read, total} + `glossaryNote`) / `glossaryHits(dir, gl, {projectDir, lang})` (terms masked before the
  avoided words are searched — "End user" never reads as "user"; code, comments and `_Marker:_` tags skipped; `_client_`
  underscore emphasis read, snake_case not; ≤ 20 words per entry, ≤ 200 hits) never reads TEMPLATE text: `glossUserParts()`
  matches each line against line patterns of the templates (`glossBuiltinLines(lang)` — requirements / design of every
  track combination, track design blocks, bugfix texts; pt-BR via `toPtBr` per distinct line; process-wide — plus
  `glossProjectLines()`: .specs/templates/ files and the packs' requirements / design blocks): key = whitespace folded,
  lower-cased, numbers "#"; top-level `[…]` / `{{…}}` = wildcards (an untouched slot is skipped, a filled one read); a
  template heading also matches without its " (…)"; exact keys in a Set, wildcard patterns indexed by 8 head / tail
  characters. Template placeholders left in a read part are blanked. `briefGlossary()` (≤ 8 entries / 1500 characters;
  `refs.glossary` with write). Clarify asks one question per avoided word with file:line (≤ 10) + `glossary`; doctor
  `glossary` (warn with the count).
- Messages: `i18n.msg(l).quality` (QUALITY_MSG). CHECK_PHASE: glossary 1, cross-feature-acs 1,
  steering-changed-since-approval 2.

## Design trade-offs and risks, the constraint nudge, the micro-cycle (1.17 A)
- The core design builder scaffolds `## Alternatives & Trade-offs` (after Architecture: the options per key decision with
  pros / cons / cost of being wrong, the chosen one and why) and `## Risks` (before the Constitution Check: likelihood,
  impact, mitigation, owner) — EN / PT / ES; the slots join the placeholder corpus automatically, so a fresh scaffold's
  design approval is refused on `placeholders` like any template section. Doctor `design-tradeoffs` / `design-risks` are
  WARN only (CHECK_PHASE 2), never in `approvalChecks`: `designWeighChecks()` over `activeDesign()` → a state missing ·
  template · empty · few · filled (`designWeighState`). Skipped for a bugfix, a spike and a later-phase template design
  (`ph.later`); a design-first feature warns at once. Details `msg(lang).designWeigh[id][state]`. `designSaveCheck` returns
  `weigh` + ▲ notes (never unclean — kept for a pre-1.17 approval too: an edit means a re-approval, which asks); `templates
  check` warns `tradeoffs-missing` / `risks-missing`. No artifact is ever edited.
- **Pre-1.17 approvals are never flagged (review 3).** `approvePhase` stamps `weigh: true` on a design approval (and its
  history record) since 1.17; `designApprovedBeforeWeigh(approvals)` = an approvals.design without it. Then doctor turns
  what would warn into a PASS whose detail says so (`designWeigh.legacyApproval`): only a design not approved yet, or
  approved by 1.17+, is warned — a finished feature following the advice would re-open re-review, changed-since-approval,
  a stale finish and the execution sign-off (the 1.16 `steering` precedent). spec_upgrade lists the two ids under
  `doctor.warnings` but never counts them toward `attention` (`DESIGN_WEIGH_IDS`).
- **Headings (review 6)** — `weighSection()` (not extractSection): after the heading lead, a `TRADEOFFS_SYN` / `RISKS_SYN`
  synonym must be the WHOLE heading or be followed by a separator (`: , ; ( [ / & + | — – .`, a spaced hyphen) or a
  connector word (and / or / vs / for / of … e / ou / de … y / o / en — `RE_WEIGH_HEADING_REST`): "Risks & Mitigations",
  "Riscos e mitigações" match; "Risk-based rate limiting", "Options parser", "Riskiest assumptions" don't. An unmarked
  heading wins over a `[MARKER]` one; never the H1. Synonyms include Trade-off(s) / Tradeoff(s) / Trade-off analysis,
  Alternatives considered, MADR's Considered Options, Key / Design Decisions, Options (EN / PT Opções / ES Opciones), PT
  Decisões e alternativas / decisões-chave, ES Compromisos / Decisiones clave, Risk register / assessment / analysis and
  twins. A plain **"Decisions"** heading is NOT one: the execplan / fluidplan imports write `## Decisions` — a decision LOG
  (what was chosen), not the options weighed; its entries would read as options.
- **Counting (review 6)** — `designBody()`: table data rows (a header + separator alone is no row) + list items at the
  section's OUTERMOST level (indented up to 3 spaces; deeper ones are pros / cons) — or, when more, sub-headings / bold-led
  paragraphs (`**Option A — …**`); units holding only a generic slot word (a bare TODO / TBD) → `template`; nothing else →
  `empty`. Trade-offs: ≥ 2 entries, OR no option list and a written paragraph of ≥ `WEIGH_PROSE_WORDS` (3) words — the
  options weighed in prose, or "No key decision here: …" (the escape Risks has; detail "written as prose"); one listed
  option → `few`. Risks: any entry or any prose ("None." counts — an honest answer).
- **Constraint nudge** — `constraintNudge(projectDir, …)`: reads only the USER's text of requirements.md + design.md
  (`userSpecText()`, review 1): visible lines minus every line that IS template text — `glossUserParts()` over the glossary
  check's line patterns (`glossBuiltinLines`: every track combination's requirements / design + the track blocks, the
  feature's language, pt-BR derived; `glossProjectLines`: .specs/templates + track packs), so a pristine scaffold of any
  track in any language never fires it, nor does a template criterion kept as written (+sec's "record a security audit
  event") — minus a section still holding `> **TODO**`, with template slots and code spans blanked. Signals by concept
  (`CONSTRAINT_SIGNALS` {en, pt, es} × strong / queue / event / async / concurrency / transaction / retry — English in every
  spec + the feature language's own; "fila" is a queue in PT but a table row in ES, "cola" the reverse): it fires on TWO
  distinct concepts or ONE strong phrase (message queue, event bus, publish … event, domain event, background job / worker,
  concurrent writes / updates, race condition, double booking, distributed transaction, two-phase commit, webhook, Kafka,
  RabbitMQ, SQS, saga — PT / ES twins), review 7 — "click event", "Retry button", "Images load async" alone never do.
  Answered (review 2) ANYWHERE in that user text — /clarify folds the answer into requirements.md, /grill asks in Phase 1
  while the design is a template — by a multi-word phrase only (`RE_CONSISTENCY_ANSWER`: eventual / strong consistency,
  consistency model, idempotent / idempotency…, at-least / at-most / exactly-once, isolation level, optimistic / pessimistic
  locking, outbox, dedup…, atomicity / atomically, two-phase commit; PT / ES twins; `ACID` upper-case) — never a bare
  "consistent", "eventually", "atomic" or "isolation" ("tenant isolation"). → `nudges [{code: "consistency-unstated",
  signals ≤ 3}]` (one word per concept, each strong phrase); plain features only, never with +dist. /grill has the matching
  "Constraints round" (atomicity, ACID / isolation, race conditions, consistency model, delivery + idempotency, dependency
  failure, volume, a measurable business outcome). **1.21 F5 P6 — one question bank:** /grill skips a constraint question an
  active track's design sections own (+dist: atomicity … dependency failure; +saas: volume; +api: idempotent creates and
  concurrent updates) — clarify's rule (no nudge under +dist) — and a sized design's Error Handling points at the IF…THEN
  criteria instead of asking again (prose + the sized builders; no engine check).
- **The merged section (1.21 F5 — size S)** — a sized-S design writes ONE `## Decisions, reuse & risks` section (Reuse ·
  Decision · Risk bullets) instead of the three. `designWeighChecks` reads it (`WEIGH_MERGED_SYN`, EN / PT / ES) for a check
  whose own section the design lacks, with min 0 (one line of prose or a bullet answers each: "nothing to reuse", "no
  alternative worth weighing", "no material risk"); the brief's Reuse part reads it too. A design with its own section is
  judged on that section as ever.
- **The TDD micro-cycle** (adapted from obra/superpowers' test-driven-development, MIT) is prose only —
  references/test-patterns.md "The micro-cycle inside a task", agents/spec-implementer.md (a hard rule), spec-reviewer,
  /executeTask, AGENTS.md, SKILL.md Phase 6: one behaviour at a time, fail for the right reason, minimal code, refactor only
  on green, code written before its test is deleted and redone; the rationalizations table and red flags. It lives INSIDE a
  task — never a new T-ID, never an edit of a planned assertion. The red flags (a test green on its first run, a test
  written after the code → delete the code) are scoped to a NEW behaviour's test (review 4): a guard test (a bugfix's
  T-02 — references/bugfix.md), a characterization test of existing code (references/improvement-specs.md) and a planned
  T-ID an earlier task already turned green pass on their first run by design — never forced red, nothing deleted. The
  reviewer flags production behaviour that no test exercises (a target T-ID, committed in Phase 4, or a helper test in
  the diff) — never "no test in the diff" (review 5).

## Reuse & Integration and clean code (1.19 R)
- **The section** — the core design builder (every plain feature, EN / PT / ES; pt-BR derived) scaffolds `## Reuse &
  Integration` between Architecture and Alternatives & Trade-offs: a Kind · What · Where (path) · Why table (Reuse / Extend /
  New rows) + a `**Module boundaries:**` line — slots, so the placeholder corpus knows them and a fresh design's approval is
  refused on `placeholders` like every template section. Guide: `references/code-reuse-and-quality.md`.
- **Doctor `design-reuse`** (WARN only, CHECK_PHASE 2, never in `approvalChecks`) is the third `DESIGN_WEIGH` entry
  (`engine/quality.js`: `[id, synonyms, min, stamp]`) — the 1.17 A pattern exactly: `designWeighState` over `weighSection(…,
  REUSE_SYN)` → missing · template · empty · filled (min 0: any row / item / line of prose — "greenfield: nothing to reuse"
  counts); skipped for a bugfix, a spike and a later-phase template design; `designSaveCheck` returns `reuse` (its state) + a ▲
  note (never unclean); `templates check` warns `reuse-missing`; spec_upgrade lists it but never counts it toward `attention`
  (`DESIGN_WEIGH_IDS`). `REUSE_SYN`: Reuse (& / and Integration…), Code reuse, Existing components / code / modules /
  services / helpers, Integration points, Integration with the existing system / code, PT Reutilização / Reaproveitamento /
  Reúso / Componentes existentes / Pontos de integração / Integração com o sistema existente, ES Reutilización /
  Aprovechamiento / Componentes existentes / Puntos de integración / Integración con el sistema existente… — never a bare
  "Integration" or "Existing" (the heading must NAME the section: `weighHeadingMatches`). **Brownfield:** when the design's
  section is missing or empty and `integration-plan.md` → Integration Points (a REUSE_SYN heading) is filled, the check passes
  with state `integration` (`designReuseFallback`); a template section still warns.
- **The stamp scheme** — `approvePhase` stamps a design approval (and its history record) `weigh: true` (1.17) AND `reuse:
  true` (1.19). Each DESIGN_WEIGH check names the stamp it needs; `designWeighChecks(design, lang, {approval, integrationPlan})`
  treats a check as legacy when the design approval lacks its stamp → a pass with `designWeigh.legacyApproval(detail,
  DESIGN_WEIGH_STAMPS[stamp])` ("approved before 1.19"). So a 1.17 / 1.18 approval (weigh only) is still held to trade-offs /
  risks, never to reuse; an unstamped one to none. `opts.legacy: true` (the 1.17 form) still makes every check legacy. A new
  design check → a new stamp key (additive: an older engine reading the state keeps its own rules).
- **The brief (R2)** — `briefReuse(projectDir, design, implements, acIds)` (quality.js) → `{state, total, entries, omitted, files,
  more, truncated?}`: the section's units (`reuseUnits`: table data rows, outermost list items with their deeper lines, prose
  lines; a unit holding a template slot is none) that name the task — its file, a sibling in its folder, the folder, a folder
  above it (`RE_REUSE_PATH` path tokens through `implementsKey`; the look-behind makes a long slash-less run linear), a
  ≥ 5-character basename word-bounded, or one of its AC IDs — ≤ 8 entries / 1,500 characters; and the existing source files
  (`GUARD_CODE_EXT`, dot files / SCAN_IGNORE folders / the task's own files out) next to its `_Implements:_` targets: ≤ 5
  folders, each read by ONE bounded `opendirSync` of at most 1,000 entries (`readDirBounded` — a 100,000-entry folder costs
  what its first 1,000 do), a `Set` of names, then the first 15 in (non-test, path) order — `isTestCodePath` asked only until
  15 non-test files are found — + `more`; `truncated: true` (only then present) when a folder held more entries, so `more` is a
  lower bound ("…and at least N more", "possibly more" when none is counted — `reuseFilesMore(n, atLeast)`). `taskBrief`
  renders it after Files (`BRIEF.reuse*`, i18n) when there is an entry, a section to point at (`reuseNoMatch`) or a file.
  Result `reuse`; with `write: true` only `refs.reuse {entries: <count>, files}`.
- **Paths from spec text (R review 1 / 3)** — `reuseTargets` keeps only a reference INSIDE the project, decided on its TEXT
  before any fs call (`reuseInsideRel`): a network path (`isNetworkPath` — the 1.19 code stat'ed `//host/share/x.ts` and
  opened an SMB connection to the host a spec named: 4.7–7.2 s on an unreachable one, NTLM credentials on Windows), an
  absolute path elsewhere, a `..` out of the project or the root itself names nothing (no target, no entry match); an absolute
  path into the project reads as its relative spelling. Inside, `reuseProbe` lstat's each segment below the project root
  (memoized per call, iterative) and a symlink or a junction on the way stops it — never followed, so a link out of the project
  (or to a share) lists nothing; stricter than templates / import's realpath check (a link that stays inside isn't listed
  either: the list is a hint, and following a link could reach a share).
- **Design context (R review 2)** — only the ONE section weighSection picks (`weighSectionHead` → {level, title, body}) can
  leave the brief's "Design context", and only when the Reuse section quotes ALL of it (`reuseQuotedSection`: a `##` heading,
  every unit of the body Design context would show, in order, none omitted, no fenced code). Every other section — an
  "Integration Points" beside it, "Existing code", a 1.18 design's contract section whose bullets aren't entries of their own —
  keeps the 1.18 needle rule (the r19 exclusion of every REUSE_SYN heading dropped whole sections; mcp/test.js "1.19 R review
  2" diffs it against a copy of the 1.18 rule). `_Emits metrics:_` also pulls an +obs feature's `[OBS] Telemetry` section
  (marker + the Telemetry synonyms, `trackSectionTable("obs")`), beside the `[SaaS] Observability` rule (T review 6).
- **Backlog names (R review 5)** — `spec_backlog add` of a name already in the backlog (case-insensitive) keeps its entry and
  spelling and APPENDS a new note to its note (`BACKLOG_NOTE_SEP` " · ", one line; a note it already holds, or none, changes
  nothing; the whole note ≤ `BACKLOG_NOTE_MAX` 2,000 characters — past it add is refused, nothing written) → `exists: true`,
  `appended`, a localized `note` (`featureOps.backlogAppended` / `backlogKept` / `backlogNoteFull`); the CLI prints that note
  instead of "✓ added". It answered "✓ added" and kept the old note, so a second refactor candidate filed as the same
  `refactor-<topic>` was lost; the prose asks for one name per candidate. A NEW entry's note has the same cap (1.19 verify 5 —
  a first add stored any length): past it add is refused, nothing written (`featureOps.backlogNoteLong`), MCP and CLI alike.
- **Prose (R3)** — agents/spec-implementer.md: "Search before you write" is Before-you-begin step 3 (a hard step: the brief's
  Reuse section, concept + three synonyms, shared folders, `.specs/SPECS.md`; reuse → extend → create, the rule of three, no
  copy-paste) + a hard rule + the report's `### Reuse` block (Reused / Extended / Created + searched / Duplicated on purpose /
  Refactor candidates); agents/spec-reviewer.md: Code quality = duplication against the EXISTING codebase (a new unit
  duplicating one is Important), the guide's smells Minor; the controller files refactor candidates with `spec_backlog add`
  (`refactor:` note) — subagent-execution.md, /executeTask; red-flags rows; SKILL.md, AGENTS.md, /design. No engine gate reads
  the Reuse block (R5: prose only — the SubagentStop gate is unchanged). Extending a unit OUTSIDE the task's `_Implements:_`
  files is never a silent edit (R review 6): NEEDS_CONTEXT → a converge task (`spec_append_tasks`, re-approved) or the
  controller's go-ahead, or create locally and name it in the report — the scope guard (`meta.guard: "scope"`) would otherwise
  stop a subagent mid-task on a permission prompt; spec-implementer step 3 + hard rule, the guide ("Extending a unit outside
  the task's files"), subagent-execution.md (NEEDS_CONTEXT), /executeTask and the brief's `reuseRule` (EN / PT / ES).
- **Steering (R4)** — the `structure.md` stub gains Module Boundaries and Shared Code slots, the constitution stub a fifth
  example principle ("Search before you write: extend an existing module before adding a new one") — EN / PT / ES.
