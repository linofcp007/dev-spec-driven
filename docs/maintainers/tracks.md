# Tracks and the Phase 0 classifier

Maintainer notes, one topic of the map in [CLAUDE.md](../../CLAUDE.md) — the index and the hard constraints.
The track registries, the built-in tracks (+tdd … +dist, +api, +ui, +obs, +data), track packs and the classifier's rules —
the user-visible reading of each track's keywords, cues and worked examples is the last rules section, "The classifier's
signal rules, track by track". The rules come first; how they came to be — the releases and review findings — is in
History at the end.

## The track model
`core` is always on. `+tdd`, `+saas`, `+ai`, `+sec`, `+privacy`, `+dist`, `+api`, `+ui`, `+obs`, `+data` are independent and
composable, chosen in Phase 0 by `spec_classify` (a keyword heuristic with negation and confidence) and confirmed by the
human. The track set drives which artifacts / sections / loops apply. The agent's side is
`skills/dev-spec-driven/references/classification-matrix.md` (the decision procedure, each track's "turn it on if" table;
GDPR / RGPD / LGPD / CCPA / HIPAA are +privacy signals, not +saas).

- **Tracks are data-driven registries — never a hard-coded `saas`/`ai` list.** `VALID_TRACKS` → `OPTIONAL_TRACKS`
  (everything but core: the classifier's, add_track's and every per-track loop's list); `TRACK_MARKER` (`[SaaS]` … `[DATA]`
  → `MARKER_TRACKS`, the tracks with mandatory design sections — every optional track but +tdd); `TRACK_SECTIONS`
  (`SAAS_SECTIONS` … `DATA_SECTIONS` — the ONE table doctor `<track>-sections`, the design gate, status, the roadmap and the
  design-save hook read); `TRACK_STEERING` (the steering files a track brings); `SIGNALS` (the classifier's tables) — all in
  `engine/tracks.js`; the classifier code is `engine/classify.js`.
- **Adding a track:** a built-in marker track needs `VALID_TRACKS` + its `SIGNALS` entry (EN / PT / ES), `TRACK_MARKER`,
  `MARKER_TRACK_ORDER` and `TEMPLATE_ACS` (i18n/common.js), a `TRACK_SECTIONS` table, `TRACK_STEERING`, `TRACK_ALIASES`
  (reserved pack names), `RE_STABLE_BRACKET`, `RE_PACK_MARKER_RESERVED`, `TRACK_RESERVED_SINCE`, its i18n builders (criteria
  under `#### [Marker]`, the design block with the `> **TODO**` sentinel, template tasks, test rows, checklist items,
  `finishChecks`, steering stub) and the hand-written per-track lists — finish, the brief and the RTM (tasks.js / trace.js,
  before `...packTracks()`), status, gates, removeTracks, the CLI status loop, `templateCorpus()`'s sample `signals`. The
  `RE_TRACK_RUN` / heading-lead regexes build themselves; MCP descriptions and CLI help by hand; `npm run build`; a `T19`
  entry in mcp/tests/04-tracks-builtin.js (the same eight checks per built-in track) and a corpus of positives and hard
  negatives. **Sizes are data:** a section's `tier` (`"extended"` = optional at size s; absent = core — keep ≥ 1 core
  section, one per criterion's concern); `TRACK_OVERLAPS` (`{drop: [track, name], by: [[track, name]…]}`) /
  `TRACK_TASK_OVERLAPS` when a section / template task duplicates another track's; a `CORE_SUPERSEDED_BY` key when its
  sections own a core design section; template tasks are trimmed at size s by rule (`sizeTasksText()`), never by a
  per-track list (gates-and-approvals.md → Right-sized rigor). No two sections one heading can answer: `sectionOverlaps()`
  stays empty for every built-in table (04-tracks-packs-lang.js). A TEAM's own track is a track pack (see Project-defined
  tracks).
- **The placeholder corpus.** `templateCorpus()` renders every set of at most two optional tracks plus all of them (the
  builders' only interplay is pairwise — quadratic, not 2^n) plus the sized builders, once, into
  `engine/corpus.generated.json` (`npm run build`; architecture.md → The build) — a new built-in track means a rebuild. T10
  in 04-tracks-builtin.js bounds it relatively (≤ 1650 texts, ≤ 60× one all-tracks scaffold).
- **Readers go through the accessors, never the constants.** The constants are the BUILT-IN tables; `allTracks()`
  (VALID_TRACKS + the project's valid packs, in name order after the built-in ones), `optionalTracks()`, `markerTracks()`,
  `trackMarker(tr)`, `trackSectionTable(tr)`, `trackSteeringFiles(tr)`, `trackSignalTable(tr)` add the track packs of the
  project the current engine call works in. The regexes built from the registries have pack-aware twins (`trackRunRe()`,
  `headingLeadRe()` — cached per marker set; names / tokens are validated `[a-z0-9]` / `[A-Z0-9]`, regex-safe). Deliberately
  built-in only: `templateCorpus()` / `templateTaskSet()` (process-wide caches — the packs' blocks join the per-call corpus,
  `packCorpusSets()`), the built-in rows of `spec_tracks list`, and the exported `VALID_TRACKS` / `OPTIONAL_TRACKS` /
  `TRACK_MARKER` / `trackSections` / `trackSignals` (the CLI's classify line reads the result's `confidence` keys).
- **Tracks are persisted in `.state.json` `tracks`** (create / add_track / add_track --remove write them) and `detectTracks()`
  reads them first. A feature without a saved list falls back to its files, where a `[SaaS]`/`[AI]` marker counts only on a
  real markdown heading (never a Mermaid node `X[AI]` or prose). A saved name shaped like a pack's (`^[a-z][a-z0-9]{1,19}$`)
  the project lacks now is kept in the list and dropped from the active tracks (`track-pack-missing`).
- **Track input goes through `parseTracks()`**: arrays or strings split on space/comma/`+` (`'tdd,saas'`, `'+saas +ai'`),
  case-insensitive; an unknown token is a localized error with a did-you-mean. The MCP `tracks` schemas carry **no enum on
  purpose** — an enum would refuse `'tdd,saas'` before the engine could split it or suggest a fix.
- **Removal is non-destructive** (`spec_add_track {remove:true}` / `add-track --remove`): files stay, listed as inactive;
  doctor / status / next_action / roadmap / trace_check stop requiring them (`activeTasks()` drops the track's task section;
  trace_check requires the ACTIVE requirements' ACs, `activeDesign`, and an inactive criterion a task cites is no phantom —
  markdown-and-trace.md → Readers). `core` can't be removed; a bugfix keeps +tdd. Removing +tdd or +ai drops a gate (the test
  / eval plan, Phase 4 — gates.js `phaseActive`), so with `meta.approvalGuard` on an agent's removal naming one
  (`APPROVAL_GATED_TRACKS` in engine/guards.js — no other track or pack adds a phase) is a guard-down, asked / refused with
  the `add-track <f> <track> --remove` line the human runs (claude-code-integration.md → Human approval guard); adding a
  track, or removing one without a phase, never is.
- **Markers are case-sensitive tokens** everywhere (`headingHasMarker`, `inactiveMarkerLines`, `trackAcIds`,
  `extractSection`, the brief): `### Timeout [sec]` is prose, never +sec. `RE_STABLE_BRACKET` lists every built-in marker.
  `inactiveMarkerLines` also needs the marker to LEAD the heading (`headingLeadMarkers`: "## [AI] 7. Fallback…", "### 3. [AI]
  …"; never "### US-2 (P1): API notes [API]") — trace_check warns `inactiveAcs` for what it hides.
- **Track section names — strict and `loose`.** A table's ordinary design words are `loose` (marker-bound):
  `extractSection(md, syn, marker, loose)` accepts them only on a heading carrying the track's marker or an unmarked heading
  nested under one (`inTrackContext`) — a core `## Processors and queues`, `## Accessibility`, `## Ownership` or `## Fallbacks`
  never satisfies a deleted track section. The strict names (full compound names, unmistakable terms) keep the unmarked
  fallback anywhere (hand-written and marker-less PT / ES designs) — except inside ANOTHER track's section
  (`inOtherTrackContext`: the nearest enclosing marked heading carries another track's marker, built-in or a pack's): "###
  Qualidade dos dados" under "## [PRIVACY] …" is +privacy's text, never the deleted `[DATA] Qualidade dos Dados`. Only for a
  track section (a `marker`), never a core one. `SEC_SECTIONS` never lists a bare "security" (the core "Security
  Considerations" is no `[SEC]` section); `AI_SECTIONS`: `fallback` / `degradação` / `degradación` alone are loose.

### The classifier's tables and machinery
- **Signal tiers** (`SIGNALS[track]`): `strong` turns a track on alone; `weak` (an anchor) needs a second signal — alone a
  "possible" note; `generic` (app-level words) adds to the score but never turns a track on without a strong or weak signal
  (`classify.genericOnly` names what an anchor would be); `context` is corroborating-only — evidence beside another
  non-negated strong / weak signal of the track, alone no signal, no note. Score = 2 × strong + weak + generic; ON at ≥ 2 with
  a strong or weak signal, `high` confidence at ≥ 4. A track kept off with weak words reads `classify.offWeak` ("+api: off —
  weak signal only ('endpoint')…"), never "no signals matched" beside a "Possible" note. Keep the three languages aligned.
- **Concepts, hazards, cues — data.** `SIGNAL_CONCEPTS`: the weak / generic keywords of one concept count once, an anchor
  member first; a keyword belongs to a concept in one track only. `SIGNAL_HAZARDS`: a failure written negated by nature —
  never negated, no "kept off" note. `everydayAnchors` (`SIGNAL_EVERYDAY`, read by `backedBy`): anchors with an everyday
  sense back no context word. `cues`: rules `{kind, on, ifTier?, then, …word lists / windows}`, tried in order — the first
  that fires decides (`then`: a tier, "none", or "keep" = unchanged, no later rule). Tuning signals never edits
  `engine/classify.js`; a new cue MECHANISM is a `CUE_KINDS` entry there (near · sentence · text · clause · ownership · all —
  every sub-rule fires; kinds checked at load time). classify.js derives `SIGNAL_CUES[track](hit, text, cased, lang)` → a
  tier, "none" or null — built-in tracks only, after shadowing and before the context rule, each reading a bounded window
  (`CUE_SPAN`, 200 characters of the hit's clause / sentence) with linear regexes compiled on first use. A track pack has
  strong / weak / context keywords only.
- **Matching** — WORDS, never substrings (Classifier gotchas). Built-in keywords only: a GAP keyword (`KW_GAP` " … ",
  `KW_GAP_RE`, linear) matches its parts, each via `keywordPattern()`, with ≤ 3 words between, never across `. ! ? ; : ,`;
  `IRREGULAR_FORMS` gives one signal per word (retry / retries / retried; an exact `2PC`; the noun only: request, form,
  page); `VERB_STEMS` need a listed ending (`public`, `envi`). A pack's keyword is a literal word (`keywordRe(kw, true)`,
  cached apart) and keeps its exact case. A keyword written with capitals (`STRIDE`, `NATS`, `UI`) is case-sensitive; one
  mixing lower-case words with an ALL-CAPS acronym (`mixedAcronyms()` — the BI phrases, `CDC pipeline`) matches its words in
  any case and the acronym case-sensitively ("BI Dashboard"; "o relatório de bi" is no BI). `keywordLiteral()` is a literal
  precheck: a text without the keyword never compiles its regex.
- **Shadowing and the first match.** A weak / generic hit inside a longer strong phrase — another track's (`model` in "threat
  model") or its OWN ("mensagens" in "fila de mensagens") — is shadowed (a linear sweep over the strong hits by start); equal
  spans never are (a phrase may serve two tracks). Negated keywords are deduped by containment like matched ones.
  **Gotcha:** within a track the first keyword matching at a position wins it (`seenSpan` — strong, weak, generic, context
  in that order): list a longer phrase before its prefix ("backoff exponencial" before "backoff", "analytics engineer"
  before "analytics"), and never list a plural `pluralize()` and the inflections already reach — the self-match sweeps (A2
  and the per-track ones in 04-tracks-builtin.js, 04-tracks-data.js) fail on a keyword that can never win its place.

### Negation
The rules and their examples are in How `spec_classify` weighs a signal; the code that decides them:
- **Lists** — `coordinatedNegation()`: items are the non-shadowed matches (overlapping ones are one item, across tracks),
  linked by `listLink()` (a conjunction with ≤ 1 other word, or a comma with articles only that a conjunction closes later);
  never across . ! ? ; : or a line break, `LIST_CONTRAST`, "and" / "e" / "y" or a gap over `LIST_GAP_MAX` (80 characters,
  ≤ 4 words); a comma before an article (`LIST_ARTICLES`) joins only a same-track item. A list opens only at an item a negator
  BEFORE it excludes (`negatorBefore()`; a hit keeps `negBy` before / after / list). `NEGATORS` hold nor / neither / nem / ni
  and "cannot"; `conjExcluded()`: a nor / nem / ni item no list carries keeps its negation unless its clause's other negator
  negates a VERB. Linear (each gap read at most twice); a quote's apostrophes are skipped.
- **Exclude or keep** — `negationOf()` / `negationKind()`: an exclusion needs `NOMINAL_NEGATORS` + only `GOVERN_NEUTRAL` words
  (or ONE modifier), a list, `GOVERN_ADOPT` (+ the 3rd-person future: *no añadirá*), or `GOVERN_AUX` / `GOVERN_WANT` — the
  negator ≤ `GOVERN_MAX` words back in the comma-free stretch; anything else is "require" / "none": `GOVERN_DEONTIC` /
  `NEVER_WORDS` + a verb, `PTES_GOVERN_WORDS` (a short PT / ES text the guess reads as English), `HAZARD_MODS`,
  `negationBlocked()` (`REL_PRONOUNS`, `COND_BEFORE` /
  `RE_COND_AFTER`, a double negation — never for nor / nem / ni), `protectedHead()` (`PROTECTED_HEADS` by the object's HEAD —
  not a `PROTECTED_MODIFIED` modifier, not after a PT / ES head + de / do / da, not `NOT_PROTECTED`; `GOVERN_EXPOSE` reads any
  protected word; never by the keyword's track), `NO_MORE`, `insufficientAfter()` (`INSUFF_COPULA` — ≤ 2 adverbs — +
  `INSUFF_ADJ` / not + `INSUFF_NOT`, within 10 words). A negator negates the whole phrase it precedes, inner keywords too ("sem
  iniciar sessão"), never one starting where it starts; a hazard phrase keeps its inner keywords and opens no list.
  `RE_NEG_NEAR` is a cheap precheck; the list opening reads `negationGoverns()`.
- **After a nominal negation** — `nominalFollowRequires()` (`SUBJECT_INTRO`; `SUBJECT_AUX` / `SUBJECT_VERBS` within 4 words;
  `ADOPT_PARTICIPLES` keep the exclusion unless the item is data to protect; `SUBJECT_END`; `PLACE_PREPS` / `SCOPE_WORDS`) and
  `negativePredicate()` (`WITHOUT_WORDS` + a `RE_DENY_VERB` before it, or a denying predicate ≤ 6 words after). Known edges kept
  for the human: "No password or Kafka is needed" keeps both, "Without Kafka, the export must not lose messages" keeps Kafka.
- **Whose adoption** — `subjectKeeps()` / `subjectOf()`: a verbal exclusion stands for `FIRST_PERSON` (or `firstPersonVerb()`
  — never an adjective in -mos, `MOS_WORDS`), `DESIGN_SUBJECTS` (`DESIGN_VERBISH` only after an article or a possessive) or no
  subject; `ROLE_SUBJECTS` (never the verb "plan (not) to") keep the track, and so does any other subject except a component
  (`componentAt()`: ≤ 3 modifiers after `SINGULAR_DETS_EN` — a noun in -s there is a plural — or `SINGULAR_DETS`, PT "a" in a
  PT text) after `plainNegation()`; a modal, a plural, an EN "a" or a role (checked first) keeps. The subject is the nearest
  listed word back in the comma-free stretch, past a prepositional phrase (an article ends it) and a relative clause; a listed
  noun right before another is its modifier ("the admin page"); a role further back still keeps; after a comma with no
  subject the sentence's earlier words are read. An EN "no" + a verb is verbal; right after an adoption verb it negates its
  noun for certain — only a role subject keeps it.

### Project signal overrides (`.specs/classifier.json`)
- **Learning.** `createFeature` on a NEW plain feature (not a bugfix / spike / import — `cls` not given) with explicit `tracks`
  and a non-empty summary compares the summary's classification with the chosen tracks (`learnSignalOverrides(projectDir,
  clsR, t)`): a track suggested and left off → its driving words vote `off` (the strong ones, else the anchors — generic words
  never drive a track); a track added unsuggested → its lone weak / generic word votes `strong`, two or more generic words
  `weak` each — words from the result's NON-enumerable `tiers` (never in the JSON). A same-direction vote counts up (`count`),
  an opposite one starts over, an agreement resets a pending (count < 2) record, a correction contradicting an APPLIED learned
  override drops it. A learned record applies at `SIGNAL_OVERRIDE_MIN` = 2, a hand-set one (`origin: "set"`) at once and is
  never changed by learning. Words follow `RE_PACK_KEYWORD` (2–60 characters — a gap keyword is never learnable).
- **The file** — `{"signals": [ … ]}`, one record per line `{track, word, effect off|weak|strong, count, origin learned|set,
  lastAt}`, sorted by track and word (two branches merge line by line), ≤ `SIGNAL_OVERRIDE_MAX` = 200 records (a full file
  evicts the oldest pending learned one), ≤ 64 KB, lstat'ed (a link / folder is `not-a-file`). Not roadmap.json meta: its own
  merge story, and a broken one never touches the roadmap. Written only by `writeSignalRecords()` under the roadmap lock
  (re-read inside it); a file that doesn't parse or holds ANY invalid / duplicate / over-bound entry is read without those
  entries (`overridesWarning {code, entries?}` + a note) and NEVER rewritten — set / forget / learning refuse
  (`signalOverrides {error}` + a note; the create still succeeds).
- **Applied** by `classify(…, {projectDir})` (spec_classify, CLI classify, spec_create, spec_import) as a layer
  (`projectSignalLayer()`): `off` drops that track's keyword (case-insensitive; its place stays free for a shorter keyword);
  `weak` / `strong` re-tier it before shadowing and cues; a word no table of that track has is matched as a literal
  (`keywordRe(word, true)`). Never silently: `overrides [{track, word, effect}]` (those that changed THIS reading) +
  `classify.overridesApplied`; spec_create adds `signalOverrides {learned, forgotten, capped?}` + `signals.learned*`. **No
  classifier.json → no layer, byte-identical results.** `explain: true` (`classify --explain`, a `CLI_SWITCHES` entry) adds
  `explain {matches: [{track, keyword, text, base, tier (… / shadowed / none / unbacked), cue, override, negated, negation}],
  overrides: [… + active, applied], min}`.
- **Surfaces:** `spec_tracks {action: "signals", op: list | set | forget, track, word, effect}` (spec_classify stays
  read-only) = `dev-spec signals [list | set <track> <word> off|weak|strong | forget <track> <word>]` (exit 1 on a refusal).
  Stable codes: effects, origins, `invalid-entry` · `duplicate` · `too-many`, file codes `invalid-json` · `invalid-shape` ·
  `too-big` · `not-a-file` · `unreadable` · `invalid-entries`. Messages: `msg.classify` (overridesApplied, overridesInvalid,
  explain*), `msg.signals` (the PT strings avoid the 2nd person). Tests: "1.21 F2b" in mcp/tests/04-tracks.js,
  cli/tests/04-tracks-signals.js (MCP ↔ CLI parity).

### The older tracks — +tdd, +saas, +ai, +sec, +privacy
- **Auth words** (authentication, authorization, RBAC, MFA, SSO, OIDC, SAML) and a password are strong +tdd, weak +sec;
  `sso`, `single sign-on`, `oidc`, `saml` are one concept each in `sec.concepts`. +sec never reads a bare "pci" (a PCI
  slot — +saas keeps its old "pci").
- **+sec's factor words** (`multi-factor`, `multifactor`, `dois fatores`, `multifator`, `dos factores`, `doble factor`) are
  separate weak words — never the whole "autenticação de dois fatores" (it would win its place and shadow the auth word) —
  and count only as authentication: a `near` cue keeps one right next to an auth word or verb (conjugated; before it, a link
  word and one optional PT / ES adjective — forte, obrigatória… — may sit between; after it, of / for / at / ao / al…); a
  catch-all `sentence` rule (every inflection the matcher accepts) makes it none elsewhere. `two-factor`, `2fa`, `mfa` keep
  their reading. Known costs: `entrar` / `acesso` / `verificação` in their everyday sense, a noun phrase between the two
  words, a negated auth noun whose factor word still counts.
- **+sec's two readings run first** in `SIGNALS.sec.cues`: an `all` rule (an auth word right after "without / sem / sin" in a
  denying sentence) and a `sentence` rule (a credential word beside logs — never "log in" —, a repository, plain text, hashing,
  a vault, rotation, a leak, masking; PT / ES "registo" / "registro" only as "nos registos" / "en los registros", a bare one is
  also a sign-up) → strong.
- **+ai's everyday words.** A product name that is an everyday word in lower case is written CAPITALISED, matched
  case-sensitively (Claude, Gemini, Mistral, Copilot, RAG, Cohere, Stable Diffusion, Pinecone; `VERSIONED_NAMES` holds the
  table's spelling); `AI` / `IA` are strong only in capitals (PT "ia" is a verb form), `LLaMA` / `Llama 2-4` only capitalised
  and versioned; the ai cues make the everyday senses none (Claude Monet, a Gemini zodiac page, "IA" as information
  architecture, an "AI" file, a "Whisper" message). Training / predicting with a model are gap keywords (PT / ES through the
  VERB_STEMS trein- / entren-).
- **+saas / +tdd cues:** `tenant` (*inquilino*, pt-BR *locatário*) is strong — none in a sentence about rent, a landlord, a
  lease; credits (photo / film / course), "in charge of", a battery charge, a therapy session, a cron EXPRESSION helper are
  none.

### +dist
- **Registries:** `[DIST]` (distributed systems & data consistency); `DIST_SECTIONS` Consistency Model · Cross-system Writes ·
  Delivery & Idempotency · Concurrency · Failure Modes (their own names strict, incl. Failure Handling / Modos de Falha / Modos
  de Fallo; ordinary words `loose`); steering `distributed.md`; US-1.AC-16..19; reserved kafka / distributed / microservices /
  consistency. Guide: `references/distributed-data-patterns.md`.
- **Tiers:** strong = named brokers / job and workflow platforms (a common word only as its capitalised product phrase: `NATS`,
  `Temporal workflow`, `Celery task`, `Pulsar topic`, `Event Hubs`, `CDC pipeline`) and patterns that only exist across
  systems (`2PC` exact, never "2PCS"); weak = the cross-system ANCHORS; generic = app-level words (two alone stay 'possible',
  named by `genericOnly`); context = transaction / consistency / atomic, backed by strong / weak only. NO signal for a bare
  event / lock / stream / broker. `SIGNAL_CONCEPTS.dist`: retry · backoff · jitter, consumer · producer · subscriber, dedupe ·
  deduplicate, the services, the delivery words; `SIGNAL_HAZARDS.dist`: lost update, oversell, race condition, duplicate
  delivery, write skew, split brain, "overwrite each other". "message queue" / "distributed cache" are +saas weak too.

### +api
- **Registries:** `[API]` (API contracts); `API_SECTIONS` — the core design already has `## API Contracts` / `## Error
  Handling` (`CORE_SUPERSEDED_BY`), so every ordinary name is `loose`, only the full compound names strict; steering `api.md`;
  US-1.AC-20..23; reserved apis / rest / restful / openapi / swagger / graphql / grpc. Guide: `references/api-design-patterns.md`.
- **Tiers** (lists: the last section): strong = contract-level words only; weak = the **ownership-ambiguous** names (the
  ownership cue's `ambiguous`, one concept `kind`) and the compatibility / HTTP-contract anchors; "request" is the noun only.
  `SIGNAL_CONCEPTS.api` folds compatibility, ETag / If-Match, status codes, schemas, the client, the endpoint / route words.
  Hazard: a breaking change; breaking compatibility as a VERB (`API_BREAK_VERBS`) is a weak compat anchor and a hazard in EN /
  PT / ES. An API **key** stays +sec's word.
- **Cues** (`SIGNALS.api.cues`): first an `all` rule — the bare `api` with an own word ≤ 2 words before it AND a version in its
  sentence → strong; then the `ownership` rule decides every other hit: after a third-party owner (`X's` with X Titlecase, a
  third-party noun, "their", PT / ES "do|da|de|del <Name|fornecedor|banco…>", an ALL-CAPS organisation acronym —
  `RE_CUE_ACRONYM`, never one of the cue's `techAcronyms`), governed by a consumer verb (only link words, Titlecase names and ≤
  1 other word between) or right after "the <Name>" → GENERIC, unless the clause says it is ours (our / nosso / nuestro ≤ 3
  words back, an own verb anywhere before it, "Version …" opening the clause, a build verb whose direct object it is); a past
  participle right after a determiner is an adjective, no own verb. An ambiguous name is strong with an own cue, or (the
  API-kind names) when it opens its clause or follows a plain article + ≤ 2 lowercase adjectives; a third party's versioned API
  stays theirs ("Call the Stripe API v2").

### +ui
- **Registries:** `[UI]`; `UI_SECTIONS` Design System Usage · UI States · Accessibility · Responsiveness & i18n · UI
  Performance Budget — every ordinary name `loose` (a core "## Accessibility" or "[SaaS] Performance Budget" never stands in);
  steering `ui.md`; US-1.AC-24..27; reserved frontend / front-end / ux / gui / wcag — **never `a11y` / `accessibility`**: the
  canonical pack example is a team's `a11y` pack, which keeps its name (its signals and +ui's both fire).
- **Tiers** (lists: the last section): a login screen is NOT a page type; `snackbar` is one word (a "snack bar" is a food
  counter); accessibility is weak (alone a venue's); one concept each: `UI` / `UX`, `React` / `Vue` / `Angular` / `Svelte`,
  popup / banner, errors next to each field (`inline`), mobile-friendly (`responsive`); screen / page / form are the nouns
  only. A dashboard is +ui's generic word only, never +obs's.
- **Cues** (`SIGNALS.ui.cues`, in order): `near` — a widget word right after a display verb + an article (+ one word) →
  strong (alone an anchor: "the modal verbs"); `clause` — the backend-only cue (`cueClause()`: `CUE_BOUNDARY` . ! ? ; : or a
  line break; a colon after a short label, ≤ 4 words, joins the label to what follows): a `mention` of backend-only work (an
  HTTP method + path, a handler, an endpoint, the backend, an API — never "API keys", never a PUBLIC API: the `notAfter` /
  `notBefore` PHRASE lists, left letter edge —, a data layer, "already exists") makes a page type and frontend / UI / UX
  GENERIC — not when a negator governs the backend word (≤ 4 words back; PT "no" is em + o: `lang` is the cue's 4th
  argument), nor when it FOLLOWS the page word with a consumer verb between (the rule's `consumers`); `text` — "frontend only"
  / "apenas frontend" / "solo frontend" anywhere keeps everything (`then: "keep"`, tested once per text). "The frontend team"
  is generic; an empty state in a sentence about a state machine is weak.

### +obs
- **Registries:** `[OBS]`; `OBS_SECTIONS` SLIs & SLOs · Telemetry · Alerting & Runbooks · Rollout & Rollback · Health &
  Capacity — none named "Observability" (+saas's), ordinary names `loose`; steering **`observability.md`**, the +saas stub
  extended (one file serves both); US-1.AC-28..31; reserved observability / o11y / monitoring / sre / telemetry /
  opentelemetry. The telemetry task carries `_Emits metrics:_`; at a size, +obs covers +saas's Observability / Performance
  Budget sections and its metrics task (`TRACK_OVERLAPS`, `TRACK_TASK_OVERLAPS`).
- **Tiers** (lists: the last section): `OTel` only in capitals ("Otel reservations"); the gap keyword "page … on-call" shadows
  +ui's "page"; a bare "canary" is weak; a monitoring / Grafana dashboard is listed before "grafana" (it wins its place and
  shadows +ui's "dashboard"); on-call and game day are weak (a hospital's on-call, a match's game day); never a bare "log" or
  "trace". Context: SLA, incident, health check and the technical targets (one concept `target`, `OBS_TARGETS` — never the
  bare business words; the `near` cue drops "customer / room service", "service level"). `SIGNAL_CONCEPTS.obs.watch`
  (monitoring · alert(s) · incident · postmortem · SLA, alertar / avisar): business monitoring is ONE hint; a watch word + a
  technical target is +obs. Hazard: downtime / an outage. observability / SLO / SLA / uptime stay +saas signals too.

### +data
- **Registries:** `[DATA]`; `DATA_SECTIONS` Data Contracts & Schema Evolution · Data Quality · Pipeline Idempotency &
  Backfills · Lineage & Ownership · Retention & Cost — the full names and unmistakable terms strict, every ordinary word
  `loose` (a core "## Ownership", "[PRIVACY] Retention & Deletion" or +saas's Cost Envelope never stand in, and a [DATA]
  Retention heading never satisfies +privacy's); no overlap entry. Steering **`data.md`**; US-1.AC-32..35; reserved etl, elt,
  pipeline(s), warehouse, datawarehouse, lakehouse, dbt, dataquality, dataeng — **never `analytics`** (a team's
  product-analytics pack keeps its name). Guide: `references/data-pipeline-patterns.md`.
- **Tiers** (lists: the last section): context is one concept `sql` (table, column, row, SQL, query, schema); the BI words
  are one concept, never a bare `BI`; hazards: duplicate rows, stale data, schema drift. `everydayAnchors` (lakehouse,
  lineage, ingestion, freshness check, `SCD`, duplicate rows, stale data + PT / ES) back no context word — a table or a query
  is on every screen; a data-term anchor still is backed (a warehouse, a backfill, a BI dashboard, Parquet, *carga
  incremental*). Tied words: `ELT` only as an ELT pipeline / job / tool / process / workflow, `BI` only with its tool /
  dashboard / report / platform / team (`mixedAcronyms()`).
- **Cues** (`SIGNALS.data.cues`) — the DATA sense FIRST, the first rule that fires decides: a lakehouse, freshness check or
  lineage in a sentence about data → strong; ingestion of files / feeds / batches / streams into a lake or warehouse and an SCD
  with its type → strong — unless a `near` rule, tried first, finds what is ingested named right next to the word ("water
  ingestion" → none, even beside a CSV file); then the everyday senses → none (lodging words — never "bookkeeping" —, food
  words, a training plan, animals / families, flooring); last, a lineage of reports, fields or models → strong (after the
  animals: "a horse's lineage in the breeding report" stays none). A warehouse with data words (never tables / columns /
  queries) → keep, with the building's words → none; a backfill with partitions / a pipeline / dbt / history → keep, with a
  schema migration's words → generic; "into / from / via …" + `Snowflake` / `Redshift` → strong, their everyday senses → none.

## Project-defined tracks — `.specs/tracks/<name>/` track packs
- **What a pack is:** `track.json` (JSON with `//` / `/* */` comments — `stripJsonComments()`, one linear pass) + optional
  fragments `requirements.md` · `tasks.md` · `test-plan.md` · `checklist.md` · `steering.md` (`PACK_FRAGMENTS`), a `<lang>/`
  subfolder's winning over the root's (`packFragment()`: lang → its family → root). A VALID pack is a MARKER track: every
  registry reader sees it through the accessors (The track model). Guide: `references/project-tracks.md`.
- **The example pack** `examples/track-packs/mobile/` (+mobile — data only; `mobile` / `MOBILE` are no reserved names) is what
  references/project-tracks.md tells a team to copy to `.specs/tracks/mobile/`. Its `pt/` and `es/` folders hold all five
  fragments; pt-BR reads `pt/` (a pack fragment never goes through toPtBr). 04-tracks-data.js copies it into a project and runs
  `tracks check` + a create.
- **Loading:** `packRegistry()` → `loadTrackPacks(root)` for `TEMPLATE_SCOPE_ROOT` (specsRoot's per-call project; detectTracks
  also calls `useTemplateScopeOf(dir)`), memoized in `PACK_MEMO`, dropped by `forgetCached` under `.specs/tracks/`,
  `invalidateReadCache` and every read-cache scope's start / end. No scope → no packs (a direct engine call outside an exported
  function sees the built-in tracks only); `PACK_LOADING` makes every registry reader answer built-in-only while the packs load.
  Registry: `{packs, names, byName, byToken, problems, entries, legacy, corpus}` — packs in folder-name order; problems `{file,
  severity, code, args, line?, pack?}` are localized only when shown (`localizePackProblem`, `msg.trackPacks.problems[code]`),
  so the memo is language-neutral. **Cross-call caches:** `packScan()` lstats each allowlisted file of a pack's folder and
  `<lang>/` folders → `sig` (size / mtime / ctime / inode); `PACK_CACHE` (per pack folder, bounded 64) returns the validated
  result while the sig is unchanged (the folder's realpath is checked every call); `PACK_CORPUS_CACHE` (bounded 16) keys the
  placeholder corpus by every valid pack's name / token / sig. A project without `.specs/tracks/` pays one existsCached.
- **Validation (`loadPack`) — any error ignores the pack as a whole:** name = folder, `RE_PACK_NAME`
  `^[a-z][a-z0-9]{1,19}$`, never `packReservedName()` (VALID_TRACKS, TRACK_ALIASES keys, `PACK_RESERVED_WORDS`, Windows device
  names, PROTO_KEYS); marker `RE_PACK_MARKER` `^[A-Z][A-Z0-9]{1,11}$` (bare or `[X]`), never `RE_PACK_MARKER_RESERVED` (built-in
  markers, US\d / P\d / SHARED, TODO / TBD / FIXME…, AC / SC / EC / NFR / T prefixes), unique (the first pack by name keeps it —
  `marker-duplicate`); title / section names / syn: `packTextOk()` (2–80, one line, no `[ ] < >` or backtick — they land in
  headings), section names never a PROTO_KEYS word; guidance `packGuidanceOk()` (one line, no `<!--`/`-->`, no heading or
  fence); keywords `RE_PACK_KEYWORD` (letters / digits, inner space - ' . ’, 2–60 — a regex-looking one is `signal-invalid`;
  a valid one reaches the classifier only through `keywordRe`, escaped); steering `RE_CUSTOM_STEERING` minus device / proto
  names. Bounds `PACK_LIMITS` (20 packs, 32 KB track.json and per fragment — size by lstat BEFORE the content, 20 sections /
  20 syn / 50 keywords per tier / 20 fragment items). Files: a regular file (never a link) in a folder chain checked once per
  pack (`.specs/tracks/` no link, the pack folder's realpath inside the real `.specs/`, a `<lang>/` Dirent no link — no
  per-file realpath: it adds nothing for a regular file and is the loader's biggest cost); `readPackItem()` reads after the
  size check; a pack folder that is a link (Dirent `isSymbolicLink` — a Windows junction is one) or resolves outside is refused.
- **Sections:** every name / synonym is keyed by `packSectionKey()` — lower-case, the RE_HEADING_LEAD lead stripped (what
  `headingMatches` strips; nothing left → `field-invalid`, a lead stripped → warn `section-name-lead`) — and is MARKER-BOUND
  (all `loose`: a core `## Architecture` never satisfies a pack's; a name equal to a core design heading,
  `coreDesignHeadingKeys()`, warns `section-core-name`). Two sections ONE heading can answer — a key equal to, a word-prefix
  of or an English inflection of another's (`synonymsOverlap()`, headingTextMatches' rule; `sectionOverlaps(table)` lists
  them) — are an ERROR, `section-overlap` (a filled "## [MOB] Offline Sync" would answer a deleted "Offline" section).
- **Fragments:** `packListItems()` (top-level item = at most one space before the bullet; lines indented ≥ 2 continue it),
  `packTableRows()` (six cells, header + separator skipped, else `fragment-row`; a `\|` is a pipe inside a cell — `tableCells`'
  rule); `{{acN}}` / `{{tN}}` beyond what the pack scaffolds in that language context → `fragment-ref` (its args name the
  context and the counting file). Warnings only: unknown keys / files / variables, an empty fragment (the default is used), a
  steering name a built-in track uses. Stable codes are in the guide and in `spec_tracks`' description.
- **Rendering (`msg.trackPacks`, EN / PT / ES / pt-BR):** `packDesignBlock` (`## [MARKER] <name>` + `todoLine` + guidance —
  `packSubstBasic()`; `trackDesignBlock(tr, lang, vars)`), `packRequirementsBlock` (`#### [MARKER] <title> — Acceptance
  Criteria (EARS)`, numbered after the highest US-1 AC; `insertPackRequirements()` puts it before the first REAL
  `#`/`##`/`###` heading after the last US-1 criterion — `commentLines()`: never inside an HTML comment or fence — else at the
  end), `packTaskBlock` (`## Story US-1 — [MARKER] <title>`, numbered by `nextTaskNumber()` after every number in use — the
  state's leftover evidence / tick numbers too, as `spec_append_tasks` and `trackTaskBlock` — so no new task inherits a removed
  task's run; `_Requirements:_` added when missing — the pack's AC IDs per `trackAcIds`, else `acPlaceholder`; the DEFAULT
  task also gets `_Makes green:_` from `packPlanRows()`; a fragment line whose `{{tN}}` / `{{tests}}` names no planned test is
  dropped), `packTestRowsBlock` (T-IDs after the plan's own; null when the plan already cites a pack AC or requirements.md
  defines none), `packChecklistBlock`, `packSteeringStub`. `packSubst()` resolves `{{ac1}}…` `{{acs}}` `{{t1}}…` `{{tests}}`
  `{{title}}` `{{marker}}` `{{name}}` `{{slug}}` with `RE_TEMPLATE_VAR` (linear).
- **Where the blocks go:** `scaffoldText()` — a built-in scaffold gets ONLY its pack tracks' blocks (`withTrackBlocks(…,
  {only})`); a project template gets every missing block (checklist: packs only). createFeature also writes each pack's
  steering file. applyTracks (add_track): design sections, steering, task block — never requirements. `scaffoldTestPlan`
  leaves the pack's ACs out of its "fresh template?" comparison and of its generic rows. classification.md lists pack signals
  (`signalTracks()`). importSpec re-inserts each pack's criteria, test rows and task block (`insertPackRequirements`,
  `withTrackBlocks(…, {only: packs})`, `withPackTasks`).
- **Gates & readers:** `activeSectionTracks()` (doctor `<name>-sections`, the design approval, design-save check, roadmap
  attention), `statusFeature` `packSections` + `missingPacks`, `checkPhaseIndex`, the brief's and the RTM's track lists
  (`packTracks()`), import's design blocks, `fitTemplateTasks`, append_tasks' inactive-heading refusal, templates check. A
  pack's task block is found by its MARKER in a tasks.md heading (`trackTaskHeadingIs()`). Placeholders: `[MARKER]` is stable
  (`isPackMarkerBracket()` in `scanBrackets` — the exact case-sensitive token: a lower-case `[role]` slot stays a slot beside a
  ROLE pack — never while the built-in corpus is built, `BUILTIN_CORPUS_BUILD`); the packs' texts in every language join the
  corpus (`packCorpusSets()` → `projectTemplateHas`), read from their SOURCES with `{{title}}` / `{{marker}}` filled and the
  feature's variables kept as a linear wildcard (`RE_PACK_WILD_VAR` split → `wildcardMatch`, ≥ 3 literal characters).
- **Missing packs:** createFeature / applyTracks record `.state.json → packMarkers {name: "[TOKEN]"}` (`packMarkersFor`). A
  saved non-built-in track is a pack name only when `savedPackName()` says so — a valid pack now, or in packMarkers, never a
  `packReservedName` (any other word — a typo, `security`, `gdpr` — makes the list unreadable → the files decide); such a
  missing one is kept by `savedTracks()` (applyTracks / removeTracks re-append `missingPackTracks()`). `detectTracks()` →
  `noteGhostPacks()` registers EVERY packMarkers entry that is no valid pack now, listed or not (a pack turned off, then deleted,
  must not come back to life), in the per-call `GHOST_MARKERS`; `inactiveMarkerLines` / `inactiveTaskLines` drop those sections
  like a removed track's, and `trackAcIds` keeps only the lines whose owner IS the asked track. Doctor warns
  `track-pack-missing` (absent vs invalid + its error codes); trace_check reads the active requirements and tasks, so a ghost
  section's criteria are not required and a task citing one is no phantom.
- **Packs of a now-reserved name or marker.** A pack named like a later built-in track or alias (`legacyPackName(st, n)`: in
  packMarkers, `packReservedName(n)` now) is the feature's MISSING pack — `savedTracks` drops it (a pack `dist` is never the
  built-in +dist), `noteGhostPacks` ghosts its marker unless that is reserved too, doctor's track-pack-missing says why
  (`trackPacks.missingReserved`, "from before 1.17 / 1.19 / 1.21" — `packReservedSince()` reads `TRACK_RESERVED_SINCE`),
  spec_upgrade flags `track-pack-reserved` (`reservedPacks`). So does a pack of ANY name whose recorded MARKER is now a
  built-in track's (`legacyPackMarkerTrack(st, n)`: 'webui' with `[UI]` — its headings would pass for the built-in track's;
  `trackPacks.missingReservedMarker`, `reservedMarkers` [{name, marker, track}], `upgrade.packMarkerReserved`). `add-track
  <f> ui` ADOPTS the built-in track (drops the record, appends its sections although a `[UI]` heading exists — `adopted:
  ["ui"]`, `adoptedPacks: ["webui"]`); `add-track <f> webui --remove` drops the pack.
- **`spec_tracks` / `dev-spec tracks`** (`trackPacks()`): list (built-in rows + every pack, valid or not), init
  (`initTrackPack` — six files from `msg.trackPacks.init*`, create-only, the `inside()` link refusal of templates init; marker =
  the name in capitals, `TRACK`-suffixed when reserved, numbered when taken), check (the loader's problems + EARS no-modal /
  vague on each fragment criterion; verdict; CLI exit 1 on an error), signals (Project signal overrides). `tracks` is a
  RESERVED slug; a `.specs/tracks/` holding a `.state.json` is an old feature (`reg.legacy`, every action refuses
  `legacyFeature`); the PostToolUse hook and the pre-commit check skip `.specs/tracks/`.
- **Known limits:** pack keywords share `KW_RE` / `KW_LITERAL` with the built-in ones (bounded: `KW_CACHE_MAX`); a slot or task
  line holding a variable is a wildcard (`[the {{name}} screens]` also recognises `[the checkout screens]`); editing
  `.specs/tracks/*` does not refresh ROADMAP.md; a hook is a fresh process — one read of the packs (20 packs × 4 language
  folders ≈ 60 ms); ghost markers are per call and project-wide (correct: the pack is gone for the whole project); section
  names are localized but `sectionState` reports the English name.

## Classifier gotchas
- **Classifier signals are matched as WORDS, never substrings** (`keywordRe`, not `indexOf`). A substring fires `claude`
  inside `.claude-plugin`, `rag` inside `sto·rag·e`, `sla` inside `tran·sla·te`, `auth` inside `auth·or` — and a phantom STRONG
  signal auto-enables a track, which then *hides* the negation computed for it. The regex allows inflections
  (`payment→payments`, `rate-limit→rate-limiting`), plural-only for ≤3-char acronyms (`rag`+`ing` ≠ `raging`), `STEMS` for
  deliberate prefixes (`idempoten`, `hallucinat`, `summariz`, `alucina`), `VERB_STEMS` (a stem + its listed endings only —
  `encript`, `cifr`, `criptograf`: never "cifra"; the self-match sweep probes them by infinitive), `-based/-powered/…`
  adjectives (`ADJ_SUFFIX`: `AI-powered`, "OpenAI-compatible"), while rejecting `-<letter>` compounds (`claude-plugin`) and
  dotted/slashed identifiers; `-<digit>` stays legal (`gpt-4`). **A glued version:** a built-in one-word keyword of 2–5
  letters (an acronym: oauth, gpt, tls, llm, saml) or a `VERSIONED_NAMES` product takes `VERSION_TAIL` — digits, dot-digits,
  one letter — before its inflection ("OAuth2", "GPT4o", "TLS1.3", "Gemini1.5"); a longer word never does ("Billing10x"), nor a
  pack's keyword. A keyword needing a new suffix class goes into the self-match sweep's expectations. Prose pairs like
  `login/signup` are split before matching; path-like tokens (`src/rag.ts`) are not. PT/ES plurals (`-ções`, `-ciones`, the
  first word of a phrase) come from `pluralize()`. One matched span counts once per track.
- **Negation never vetoes a track**, it annotates it: "the system shall not hallucinate" negates `hallucinat` on a feature that
  is unmistakably `+ai`, so a track that is ON with negated keywords gets a conflict note ("+ai is ON although 'llm' appeared
  negated") for the human who confirms Phase 0 — never silently drop a negation (what a negation excludes: The track model →
  Negation). Before widening `listLink()`, `GOVERN_ADOPT`,
  `GOVERN_AUX`, the subject lists (`ROLE_SUBJECTS` / `DESIGN_SUBJECTS`), `SUBJECT_VERBS`, `PLACE_PREPS` or `RE_DENY_VERB` — each
  turns tracks off or ON in every frame that uses them — prove it with a differential (the previous release / the last
  candidate / the change, over the logged classify inputs of both suites, every string literal of the test files and evals,
  the reviewers' corpora and a frame sweep of every built-in keyword, old and new keywords apart) and every negation case in
  04-tracks-builtin.js.
- **Project signal overrides are the team's, never the engine's defaults.** A tuning that holds for everyone goes into
  `SIGNALS`; `.specs/classifier.json` is one project's layer — never read it without a projectDir, never write it outside
  `writeSignalRecords()` (the roadmap lock, the never-rewrite-a-broken-file rule).
- **Classifier language guess** (`guessLang`): STRONG PT/ES markers (weight 2: `não`, `uma`, `-ção`, `ñ`…) and WEAK ones
  (weight 1: `de`, `por`, `com`…) must beat the English function-word count — never add ambiguous words (`do`, `da`, `usa`,
  `los`, `no`, `.com`): they flip English text to PT. The guess decides how `no` is read — a negator in EN/ES, *em+o* in PT
  ("aplicado no checkout"; also after a lowercase participle, never after a capitalised name like "Canada"). An explicit `lang`
  overrides the guess for negation too. Without one, every surface (classify, create — a new feature —, import) reads the text
  in its OWN language, `meta.lang` only the fallback when the text is inconclusive (`classify(…, {projectDir})` →
  `configuredLang()` → `guessLang(text, fallback)`, never the 'en' default), so create agrees with the classify the human
  confirms. Strong markers ONLY in a text with no English function word: a PT / ES infinitive opening a clause with its object
  (`INF_WORDS` → `PT_INF` / `ES_INF` / `PTES_INF`, none an English word: "Publicar eventos no Kafka." is PT) and one language's
  content words (`PT_WORDS` / `ES_WORDS`, `PTES_WORDS` for both: "Erro no pagamento" is PT, "Show the pagamento status"
  English). A verb both PT and ES have goes in `both` — it tells PT / ES from English, never PT from ES (a tie is PT, or ES in
  an ES project). "no" + a listed infinitive (`ES_NO_INF`, "no usar LLM") is a strong ES marker. `CLAUSE_START`'s spaces are
  `[^\S\n]*` — `\s*` there re-reads a run of blank lines from each line break (quadratic).

## The classifier's signal rules, track by track

The skill's Phase 0 reference (`skills/dev-spec-driven/references/classification-matrix.md`) keeps the decision procedure,
each track's "turn it on if" table and the `classification.md` format. How `spec_classify` reads a description — tiers,
negation, cues, each track's keywords and its answers on worked examples — is documented here for whoever tunes `SIGNALS` or
`engine/classify.js`; keep it in step with the engine (mcp/tests/04-tracks*.js pin the behaviour itself). Each track's full
keyword list, PT / ES included, is its `SIGNALS` entry; the lists below are the reading, with PT / ES samples.

### How `spec_classify` weighs a signal

The classifier is a local keyword heuristic (EN/PT/ES, whole words, negation-aware); its output is a draft the human
confirms in Phase 0.

- **Strong** signals turn a track on alone; **weak** ones need a second signal: score = 2 × strong + weak (+ generic), ON at 2 (one
  strong, or two weak — then a note says "on from weak signals only — double-check"); a lone weak signal is a **possible**
  note. **Generic** (app-level) words add to the score but never turn a track on alone ("Print queue: … retry failed prints"
  stays *possible*). **Corroborating-only** words (+sec `permission`, `at rest` / `in transit`; +dist `transaction`,
  `consistency`, `atomic`; +obs SLA / incident / health check and the technical targets; +data table / column / query) count
  only beside another signal of the track ("RBAC permissions"); alone they are no hint (file permission bits, a parcel in
  transit). Words of **one concept** count once: retry · backoff · jitter, consumer · producer · subscriber.
- A weak word inside a longer strong phrase is part of it: `model` in "threat model" is no +ai hint, `security` in "row-level
  security" no +sec one. A phrase may count for two tracks: "message queue" is strong +dist, weak +saas; `exactly-once` strong
  +tdd and +dist; `idempotent` / `webhook` strong +saas, weak +dist.
- Auth words (authentication, authorization, RBAC, MFA, SSO / single sign-on, OIDC, SAML) are **strong for +tdd and weak for
  +sec**, and so is a password (*senha, contraseña*): "login with a password" is `core +tdd` with a possible +sec note; "user
  authentication with email and password" turns +sec on. Role-based access control is strong +sec. A version glued to a short
  keyword is the keyword (OAuth2, GPT4o, TLS1.3, Claude3). Upper-case acronyms are case-sensitive where the lower-case word
  means something else: `STRIDE` (a lower-case "stride" is an array stride), `CDC`. A gap phrase (`publish … event`) matches up
  to three words between its parts.
- **Negation never vetoes a track**, it annotates it: "no personal data" keeps +privacy off and says so; a negated keyword on a
  track that is ON anyway comes back as a conflict note. A **hazard** is written negated by nature, so its negation is the
  requirement and it counts: a +dist lost update / oversell / race condition / duplicate delivery ("concurrent updates never
  oversell"), a +api breaking change ("without breaking changes", *sem alterações incompatíveis*), a +obs outage ("without
  downtime"), a +data duplicate row or stale data, +sec unauthorized access.
- **A negation reaches the whole list it opens**: "We will not add feature flags or canary releases", *"Não vamos usar
  feature flags nem lançamento canário"*, "without Kafka, RabbitMQ or SQS", "neither … nor". It stops at "and" ("without
  downtime and roll back on errors"), at a contrast word ("no feature flags, just a canary release"), at a comma no "or" closes
  ("Without feature flags, the canary release is done by hand") and at a comma after the closing "or" ("Without an LLM or
  embeddings, the checkout or a subscription page is the priority" keeps +tdd); a comma + an article joins only an item of the
  list's own track ("Without an LLM, a vector database or embeddings" is one list; "No LLM, the checkout or the subscription
  flow first" keeps +tdd).
- **What a negation negates:** it EXCLUDES a keyword only when it certainly governs it — anything else keeps the track (an
  extra track is a one-word removal in Phase 0; a missing one loses rigor). Certain: a nominal negator with only articles,
  quantifiers or a modifier before the keyword ("no payments", "without real-time Kafka", "Postgres, not MongoDB nor Kafka")
  or a list it opened; an adoption verb (use / add / need / include / integrate / deploy / enable / install / expose…,
  "necessary" — *usar, adicionar · añadir, hace falta*) whatever the modal ("must not use X or Y"); a plan or an intention
  (will / do / going to, want / plan / intend — *vamos, queremos*): "We don't use Kafka", "This feature doesn't need an LLM",
  "We no longer use Kafka", "No need for Kafka", *"Nunca usaremos Kafka"*. Kept: a noun ends the negated phrase ("Without
  payments the checkout is useless" keeps +tdd); an auxiliary or a modal + another verb is a requirement about its object
  ("The report does not show the LLM cost", "must not lose payments nor duplicate invoices", "We do not collect personal data"
  — +privacy stays for you to confirm); a verb form or a wished verb ("without losing payments"); a hazard ("We don't want
  duplicate payments"); a people relative clause ("The admin who doesn't have MFA must enable it"); a condition ("If we don't
  add rate limiting, the API will be abused"); a "without" inside a negated predicate ("We won't ship without a canary
  release"); any negated verb whose object is data to protect — secrets, keys, tokens, credentials, passwords, card numbers,
  personal data, PII, introspection ("The frontend must not embed OAuth client secrets", "The URL does not include the
  session token"); a preposition after another noun ("We didn't add an LLM to the checkout" keeps +tdd).
- **Whose adoption:** a negated adoption verb excludes only when its subject is the one designing — the first person ("We
  don't use Kafka", *"Não usamos Kafka"*), the system being built ("The service must not use Redis", "This feature does not
  require an LLM") or none ("Do not use Kafka", *"No se necesita un LLM"*). A role, a user group or a plan / tier / account
  states an access or entitlement rule and keeps the track: "Guests can't use the checkout" +tdd, "Free users may not use the
  LLM assistant" +ai, "The free plan has no webhooks" +saas, *"Las cuentas de prueba no incluyen el asistente LLM"*. Any other
  subject keeps it too — when in doubt, keep — except a singular component of what is being built with a plain negation ("The
  importer does not need Kafka", *"O agendador não usa Kafka"* exclude); with can't / may not, or as a plural ("Suppliers don't
  use the checkout"), it keeps.
- **What follows "no X" / "without X":** a negated SUBJECT with a verb is a requirement on X ("No personal data is sent to the
  LLM provider", "Ensure no PII is written to the logs", "No tenant can access another tenant's records"; PT / ES *nenhum /
  ningún* are no negations); so are data to protect kept out of a place ("No secrets in the repository", *"Sin datos personales
  en los registros"*) and a "without X" a denying predicate governs ("Reject requests without a valid access token", "Users
  without MFA must not access the admin panel" — an access rule: the auth word is strong +sec there). "no more X" is a
  replacement ("No more manual invoices: generate them automatically" keeps +tdd; "no more than 3 retries" is a limit); "without
  X" + an insufficiency predicate needs X ("Without an LLM summary the ticket view is incomplete" keeps +ai). Still excluded:
  the bare phrase ("No personal data."), a scope ("No personal data in this feature"), an adoption participle ("No LLM is
  needed", "No auth needed").
- **This project's own corrections:** after **two consistent corrections** in Phase 0 a word the team keeps rejecting stops
  turning its track on in this project, and a word the team keeps adding a track for becomes a signal there (Project signal
  overrides); `spec_classify` names every override that changed its reading. No `.specs/classifier.json`, no change.

### +saas — keywords, cues and worked examples

`tenant` is strong (*inquilino*, pt-BR *locatário*) — except beside rent, a landlord, a lease, an apartment (*renda, senhorio ·
alquiler, casero*): a tenant who rents a home is no signal.

### +ai — keywords, cues and worked examples

**Strong** (besides LLM / GPT / Claude / embeddings / RAG / machine learning…): `AI` / `IA` in capitals (lower case is weak;
"IA" beside navigation / a sitemap is information architecture, an "AI" file beside Illustrator is none), speech-to-text,
OCR, computer vision, object detection, facial recognition, sentiment analysis, a vision model, agentic, retrieval-augmented
generation, `Whisper`, `LLaMA` / `Llama 3` (capitalised and versioned — ES "llama" = calls), DeepSeek, the named products,
frameworks and vector stores (ChatGPT, Ollama, DALL-E, Midjourney, LlamaIndex, LangChain, Hugging Face, Bedrock, pgvector,
Qdrant, Weaviate, Milvus, FAISS, ChromaDB, a vector store), training or predicting with a model ("train … model", "predict …
churn", a predictive model; *treinar … modelo · entrenar … modelo*); "X-compatible" names X. **Case-sensitive** where the
lower-case word is everyday: `Claude`, `Gemini`, `Mistral`, `Copilot`, `RAG`, `Cohere`, `Stable Diffusion`, `Pinecone` — "a rag
rug", "the mistral wind" are no signal, nor Claude Monet, a Gemini zodiac page, a Copilot's seat. **Weak:** transcription /
transcribe, tool use (a workshop's "tool use log" is none), a classifier, predict, rerank; an e-mail / reset / API token is no
LLM token. Everyday senses of +tdd / +saas words are none: photo / film / course credits, "in charge of", a battery charge, a
therapy / training session, a cron EXPRESSION helper (a cron job keeps +saas).

### +sec — keywords, cues and worked examples

**Strong:** threat model, OWASP, XSS, CSRF, SQL / command injection, pentest, vulnerability, CVE, ASVS, secrets management,
encryption at rest / in transit, security audit / review / test, SAST / DAST, attack surface, privilege escalation, SSRF,
credential stuffing, zero trust, mTLS, content security policy, role-based access control, card numbers / cardholder data /
PCI DSS / `PAN`, impersonation, HMAC / signature verification / a webhook signature, bcrypt / argon2 / password hashing, key /
secret / credential rotation, a public share link ("anyone with the link"), unauthorized access (a hazard) (*modelo de
ameaças, teste de intrusão, acesso não autorizado · modelo de amenazas, número de tarjeta*) — and two readings: an auth word
after "without" in a denying sentence ("Reject requests without a valid access token") and a credential handled — a secret,
key, token, credential or password beside logs, a repository, plain text, hashing, a vault, rotation, a leak ("No API keys are
logged", "Hash passwords with bcrypt"). **Weak:** authentication, authorization, RBAC, access control, access / refresh token,
API key, credential, password, SSO / OIDC / SAML, encryption, TLS, CORS, audit log, input validation, security, hardening, least
privilege, MFA / 2FA, two-factor / multi-factor (*dois fatores, doble factor* — only next to an auth word: "depende de dois
fatores" is none), brute force, `STRIDE`, the encryption verbs (*encriptar, cifrar, criptografar*), OAuth, social login, a file
upload, a public / share link, verifying a signature, user roles, a valid / invalid / expired token, *segredos / secretos* —
"two-factor authentication" is two weak signals, so +sec turns on. **Corroborating only:** permission, at rest, in transit.
Never a bare "injection" (dependency injection) or "https".

### +privacy — keywords, cues and worked examples

**Strong:** GDPR, RGPD, LGPD, CCPA / CPRA, HIPAA, personal data, PII, DPIA, data protection, data subject, right to erasure,
data portability, data retention, anonymization / pseudonymization, data minimisation, data processing agreement, privacy by
design / policy / notice, special category data, data controller / processor, international transfer, standard contractual
clauses, medical / patient records, medical history, PHI / EHR, KYC, a passport number, an SSN / national insurance number, a
user's location (*dados pessoais, titular dos dados, histórico clínico · datos personales, ubicación del usuario*). **Weak:**
user / customer data, user profile, email address, phone number, date of birth / `DOB`, home / postal address, cookie, user
tracking, geolocation, location tracking, biometric, health data, passport, ID document, identity verification, fingerprint,
facial recognition, call recordings, `NIF` / `DNI` / `NIE` / `CPF`, opt-in / opt-out, unsubscribe, privacy, account deletion,
data export, DPA, **consent**, retention period / policy (*morada, cartão de cidadão · domicilio, huellas dactilares*) — alone a
hint (an OAuth consent screen, a trash folder's retention, "Track the parcel location", "Show the NIF on the invoice") until a
second privacy signal corroborates them.

### +dist — keywords, cues and worked examples

**Strong:** Kafka, RabbitMQ, ActiveMQ, AMQP, SQS, Kinesis, EventBridge, Debezium, Pub/Sub, `NATS`, Apache Pulsar, Azure Event
Hubs, Sidekiq, BullMQ, Resque, NServiceBus, MassTransit, `Temporal workflow` / `Celery task` / `CDC pipeline` (capitalised —
"temporal" is a PT / ES adjective, celery a vegetable), message broker / queue / bus, event-driven architecture, event
sourcing, domain / integration event, CQRS, transactional outbox, outbox / inbox pattern, idempotent consumer, dual write,
eventual / strong consistency, read-your-writes, distributed transaction / system / lock / cache, two-phase commit (`2PC`,
exact), microservice(s), change data capture, exactly-once, at-least-once delivery, saga pattern, compensating transaction,
optimistic / pessimistic locking, isolation level, write skew, lost update, network partition, split brain, read replica,
replication lag (*fila de mensagens, consistência eventual · cola de mensajes, bloqueo optimista*). **Weak** (a second system
or a delivery / concurrency concern): webhook, idempotency, at-least-once / at-most-once, duplicate delivery / message,
delivered twice, other / another / downstream services, cross-service, a service named by its role (the notification /
payment / order … service), exponential backoff, replication, cache invalidation, saga, `CDC` (upper case — also a health
agency), dead letter, DLQ, poison message, circuit breaker, concurrent updates / writes, "overwrite each other", a version
column, clock skew, message ordering, event bus / stream, event-driven, leader election, Redis, a search index, Elasticsearch,
gRPC (*outros serviços, recuo exponencial · otros servicios, retroceso exponencial*). **Generic** (only beside a strong or weak
one): queue, consumer, producer, subscriber, retry, jitter, deduplication, race condition, pub/sub, **publish … event /
message**, **send … message**, exactly once, event store, outbox, worker, background job, "keep … in sync", oversell,
compensate, concurrently (*fila, nova tentativa, publica … evento · cola, reintento*). **Corroborating only:** transaction,
consistency, atomic(ity). Never a bare "event" (DOM / calendar / analytics events), "lock" (an account lock), "stream" (video)
or "broker".

The canonical example — *"Create an endpoint that writes a user to Postgres and publishes a UserCreated event to Kafka for
other services"* — is `core +dist` in EN, PT and ES. Skip `+dist` when every write stays in one database and no other system
consumes the result (a CRUD screen over one table). Patterns: `distributed-data-patterns.md`.

Worked examples (what `spec_classify` answers):

| Description | Result | Signals |
|---|---|---|
| Create an endpoint that writes a user to Postgres and publishes a UserCreated event to Kafka for other services | `core +dist` | kafka, other services, publish … event |
| … the same without Kafka ("publishes a UserCreated event for other services") | `core +dist` (weak-only) | other services (the anchor), publish … event |
| Split billing into its own microservice | `core +tdd +dist` | microservice (billing → +tdd) |
| Implement checkout as a saga with compensating transactions across the order and payment services | `core +tdd +dist` | compensating transaction, saga |
| Use optimistic locking so concurrent updates to the cart never overwrite each other | `core +dist` | optimistic locking, concurrent updates |
| Queue the welcome email and retry with exponential backoff | `core +dist` (weak-only) | exponential backoff (+ retry: one concept), queue |
| Receive Stripe webhooks idempotently and retry failed deliveries | `core +saas +dist` | webhook, idempotent, retry |
| Use a message queue and a background worker to send emails | `core +saas +dist` | message queue (+dist strong, +saas weak), worker |
| Print queue: users send documents to the printer queue and can retry failed prints | `core`, *possible +dist* | queue, retry (generic only) |
| *Publicar eventos no Kafka.* | `core +dist` | kafka (PT: "no" is *em + o*), publica … evento |
| *Sincronizar o stock entre serviços com consistência eventual e um outbox transacional* | `core +dist` | outbox transacional, consistência eventual |
| *Reintentar los pagos fallidos con retroceso exponencial y una cola de mensajes* | `core +tdd +dist` | cola de mensajes, reintento, retroceso exponencial |
| Retry the image upload when the network drops | `core`, *possible +dist* | retry |
| Organizers can publish an event and sell tickets | `core`, *possible +dist* | publish … event |
| Create an endpoint that writes a user to Postgres and returns it | `core` | — |
| Plain CRUD endpoint for users, no Kafka and no events | `core` (+dist kept off, noted) | kafka (negated) |

### +api — keywords, cues and worked examples

**Strong:** RESTful, API-first, contract-first, OpenAPI, Swagger, GraphQL, gRPC, protobuf, a proto file, API versioning,
versioned API, API v1 / v2, a breaking API change, the API contract / spec / design, API consumers, third-party / external
developers, a developer portal, contract tests, consumer-driven contracts, problem+json, RFC 9457 / 7807, Idempotency-Key,
rate limit headers (`X-RateLimit-Limit` / `-Remaining` / `-Reset`, `RateLimit-*`), Retry-After, the Sunset / Deprecation header
(*contrato da API, portal do programador · versionado de la API, prueba de contrato*). **Ownership-ambiguous — weak, strong
when the API is ours:** a public / REST / HTTP / web / JSON / partner API, a REST endpoint, an API version, problem details —
strong beside an own cue ("our", expose, publish, offer, provide, design, document, deprecate, "Build a REST API") or when
the name opens its clause or follows a plain article ("REST API for the mobile app…", "add rate limiting to the public API");
"Stripe REST API integration" stays weak. **Weak:** a breaking change, backward compatibility, an SDK, a client library, ETag,
If-Match, status codes, JSON Schema, request / response schema, cursor pagination, deprecation, an API gateway, an internal /
admin API, the API docs, content negotiation, breaking compatibility as a verb ("must not break compatibility", *quebrar a
compatibilidade · romper la compatibilidad*). **Generic:** api, endpoint, route, request(s), pagination. A breaking change is a
**hazard**: "without breaking changes" counts. **Someone else's API is no contract of ours:** after a third-party owner
("Stripe's REST API", *"la API REST del banco"*, "the ECB's public API") or governed by a consumer verb ("call", "integrate
with", "sync from", "via") an API signal is a generic word, unless the clause says the API is ours ("Expose our catalog to
partners through a versioned REST API"). **Our API + a new version** is strong: "Our webhooks API needs a v2 …". An API
**key** is +sec's word: "an API key management page" is a UI — *possible +api* at most.

Worked examples (what `spec_classify` answers):

| Description | Result | Signals |
|---|---|---|
| Publish an OpenAPI spec for the orders REST API and generate the client SDKs from it | `core +api` | rest api, openapi, sdk |
| Version the public API: ship v2 and deprecate v1 with a Sunset header | `core +api` | public api, sunset header |
| Add cursor-based pagination to the list endpoints without breaking existing clients | `core +api` (weak-only) | cursor-based pagination, endpoint |
| Avoid breaking changes to the orders API for existing clients | `core +api` (weak-only) | breaking change (a hazard — not negated), api |
| *Devolver os erros em formato problem+json com códigos estáveis* | `core +api` | problem+json |
| *Definir el contrato gRPC del servicio de precios en protobuf* | `core +dist +api` | grpc, protobuf (+dist: gRPC, the pricing service) |
| API key management page where admins create and revoke keys | `core +ui`, *possible +sec / +api* | api (generic only; management page → +ui) |
| Integrate with the Salesforce REST API to sync contacts every hour | `core`, *possible +api* | rest api (someone else's API — generic) |
| Call the Stripe API to charge the customer's card | `core +tdd`, *possible +api* | api (generic only; charge → +tdd) |
| Bump the AWS SDK to v3 | `core`, *possible +api* | sdk |

### +ui — keywords, cues and worked examples

**Strong:** design system, design tokens, component library, UI kit, user interface, WCAG, a11y, screen reader, keyboard
navigation, focus order / trap, color contrast, alt text, `ARIA`, reduced motion, responsive design, mobile-first, dark mode,
Storybook, Figma, Core Web Vitals, `LCP`, visual regression, skeleton screen, empty state, right-to-left, a landing / settings /
admin / management / profile page, an admin panel, a confirm dialog, a confirmation modal, a modal dialog, a toast
notification, a snackbar (*leitor de ecrã, modo escuro, janela modal · lector de pantalla, página de ajustes*). **Weak:**
accessibility (alone it may be a venue's wheelchair access; with a page, a form or WCAG it is UI), frontend, `UI` / `UX`
(capitals, one concept — "translate the UI into Spanish" alone is no UI work), `React` / `Vue` / `Angular` / `Svelte` (one
concept), CSS / Tailwind, a modal, dropdown, tooltip, navbar, sidebar, toast, carousel, spinner, picker, popup / banner,
swipe, responsive, mobile-friendly, i18n / `RTL`, `CLS` / `INP`, a loading / error state, form validation, errors next to each
field, a wireframe / mockup; a widget a display verb shows is strong ("Show a modal …", *"Mostrar um popup"*). **Generic:**
screen, page, form (never "screening", "formed"), button, click, dialog, dashboard, menu, icon, widget, layout, theme.
**Backend-only work is no UI work:** in a clause that names a handler (`PATCH /…`), an endpoint, the backend, an API or a
data layer, or says the UI already exists, a page type and frontend / `UI` / `UX` count as generic ("the profile page backend
should return…") — not when the backend word is negated ("Frontend only, no backend changes: a new landing page"), when the
page consumes it ("The landing page loads its testimonials from the CMS API") or when the text says "frontend only". A
**public** API is never a page's backend: "Expose a public REST API for the mobile app's settings screen" is +api and +ui. A
**dashboard** is +ui's generic word only — a sales dashboard is a product screen; a monitoring / Grafana dashboard is +obs.

Worked examples (what `spec_classify` answers):

| Description | Result | Signals |
|---|---|---|
| Build the settings page with design-system components and WCAG 2.2 AA accessibility | `core +ui` | wcag, accessibility, settings page |
| Make the checkout form usable with a screen reader and keyboard navigation | `core +tdd +ui` | screen reader, keyboard navigation, form (checkout → +tdd) |
| Add a dark mode using the design tokens | `core +ui` | design tokens, dark mode |
| API key management page where admins create and revoke keys | `core +ui`, *possible +sec / +api* | management page |
| Rewrite the frontend in React | `core +ui` (weak-only) | frontend, React |
| *Adicionar modo escuro à aplicação* | `core +ui` | modo escuro |
| *Mostrar un estado vacío cuando no hay pedidos* | `core +ui` | estado vacío |
| Add a button to export orders as CSV | `core`, *possible +ui* | button (generic only) |
| Log in form | `core`, *possible +ui* | form (generic only — "log" is no +obs word) |
| Metrics dashboard for sales | `core`, *possible +ui* | dashboard (generic only) |

### +obs — keywords, cues and worked examples

**Strong:** observability, SLO / SLI, error budget, burn rate, OpenTelemetry / `OTel` (capitals), distributed tracing, runbook,
paging the on-call, PagerDuty, Opsgenie, Alertmanager, an alert rule, Prometheus, Grafana, Datadog, New Relic, Jaeger, Zipkin,
Sentry, structured logging, correlation / trace ID, `X-Request-ID`, golden signals, MTTR, incident response, feature flag,
kill switch, a canary release / deployment, blue-green, progressive / staged rollout, dark launch, a rollback plan, automatic
rollback, rolling back a deployment, liveness / readiness probe, a health check endpoint, synthetic monitoring, chaos
engineering, fault injection, zero downtime, a monitoring / Grafana / operational dashboard, log aggregation, error tracking
(*orçamento de erro, implantação canário · despliegue canario, plan de reversión*). **Weak:** monitoring / monitor, alert(s),
a postmortem (watch words — ONE concept: "monitor stock levels and send alerts to purchasing" is one hint, never +obs),
uptime, outage, downtime, rollback, rollout, a bare canary, telemetry, tracing, `APM`, error rate, 5xx, on-call, game day, a
request ID, latency metrics (*monitorização, alertar, avisar · monitoreo, guardia* — "Avisar al equipo cuando falle la tarea
programada" is +obs, "Avisar al encargado cuando baje el stock" a hint). **Generic:** metrics, logs, latency, p99, deploy.
**Context** (only beside another +obs signal): an SLA, an incident, a health check — a help desk's SLA or a clinical health
check alone is no operability — and the **technical targets** (one concept): a service, servers, production, a cluster /
Kubernetes, a cron / sync / import / backup job, a data / CI pipeline, an endpoint, the backend, the infrastructure, ops /
SRE, a status page, CPU / memory usage, queue depth, consumer lag — "customer service" / "service level" are none. So "Monitor
the ERP sync job and send alerts to ops" is +obs; "warehouse temperature monitoring … alerts go to the shift manager" is not.
Never a bare "log" ("log in"), "trace" or "dashboard". `observability` / `SLO` / `SLA` / `uptime` stay +saas signals too; the
`observability.md` steering file serves both.

Worked examples (what `spec_classify` answers):

| Description | Result | Signals |
|---|---|---|
| Define an SLO for checkout availability and alert on the error budget burn rate | `core +tdd +saas +obs` | slo, error budget, burn rate (checkout → +tdd, slo → +saas) |
| Instrument the payments service with OpenTelemetry distributed tracing | `core +tdd +obs` | opentelemetry, distributed tracing |
| Roll out the new pricing engine behind a feature flag with a canary release and automatic rollback | `core +tdd +obs` | feature flag, canary release, automatic rollback |
| Add monitoring and alerts for the nightly import job | `core +obs` (weak-only) | monitoring (+ alerts, one concept), import job (a technical target) |
| Monitor stock levels and send alerts to the purchasing team when inventory is low | `core`, *possible +obs* | monitor (+ alerts, one concept — no technical target) |
| Deploy the billing service without downtime and roll back on errors | `core +tdd +obs` (weak-only) | downtime (a hazard — not negated), roll back |
| *Despliegue canario del nuevo motor de precios con plan de reversión* | `core +obs` | despliegue canario, plan de reversión |
| Metrics dashboard for sales | `core`, *possible +ui / +obs* | dashboard, metrics (generic only) |
| Send price alerts to users when a product gets cheaper | `core`, *possible +obs* | alerts |
| Canary Islands shipping rates | `core`, *possible +obs* | canary (weak — never a release alone) |

### +data — keywords, cues and worked examples

**Strong:** ETL, an ELT pipeline / job / tool ("ELT teachers" teach English), a data / ingestion / batch pipeline, a data
warehouse / lake / lakehouse / mart, data quality, a data contract, data lineage, a data catalog, a data mesh, data / analytics
engineering, schema evolution / registry / drift, a backfill job, a slowly changing dimension, a star / snowflake schema, a
fact / dimension table, OLAP, dbt models / runs, an Airflow DAG, Apache Airflow / Spark / Iceberg / Hudi, PySpark, Dagster,
Databricks, BigQuery, Amazon Redshift, a Snowflake warehouse / table, Delta Lake, Parquet files, Fivetran, Airbyte, data
ingestion, data freshness, a freshness SLA, late-arriving data, an incremental load, a medallion architecture, data
observability, a quarantine table (*qualidade de dados, armazém de dados, carga incremental de dados · calidad de datos,
tabla de hechos*). **Weak** (anchors): a backfill, a warehouse, a lakehouse, a freshness check, `Snowflake` / `Redshift` /
`Airflow` (capitals — a snowflake icon, a galaxy's redshift, a vent's airflow are no signal), dbt, `SCD`, lineage, ingestion,
change data capture / a CDC pipeline (also +dist's), Parquet / Avro, a streaming pipeline, batch processing, a data platform,
data governance, a BI tool / dashboard / report, Power BI / Looker / Tableau / Metabase (one concept — `BI` alone is no signal:
*o número do BI* is the Portuguese ID card), duplicate rows, stale data, a uniqueness check (*linhagem, ingestão, carga
incremental · linaje, ingesta*). **Generic:** analytics, a dataset, a partition, a transformation, a batch / nightly job,
ingest, upsert, a materialized view, a data / analytics engineer (a role). **Context** (beside a strong or weak +data signal):
table, column, row, SQL, query, schema — "A BI dashboard over the orders table", "Load the orders table into the warehouse
every night" are +data; "migrate the users table" is not. A table, a column or a query never backs an anchor with an everyday
sense — a lakehouse, a lineage, ingestion, a freshness check, `SCD`, duplicate rows, stale data: "a horse's lineage in a
table", "React Query never shows stale data" name no pipeline. The BI phrases match at a sentence start or in title case
("Relatório de BI", "BI Dashboard"). **Hazards:** duplicate rows, stale data, schema drift.

**Cues** (the order: +data in The track model): a warehouse in a sentence about the building (stock, shelves, picking,
temperature…) is no signal; a backfill in a schema migration ("add a currency column; backfill existing rows") is app-level;
data moved into / out of `Snowflake` / `Redshift` is strong; a lakehouse, a freshness check or a lineage in a sentence about
data is strong ("Load the bookkeeping entries into the lakehouse tables"), and so are ingestion of files into a table and an
SCD with its type ("SCD type 2 on the customers table") — a lakehouse to rent, a horse's lineage, the ingestion of water,
parquet flooring are none. Shared phrases: an ETL job / data pipeline is also +obs's technical target, a CDC pipeline +dist's
strong phrase, data retention +privacy's.

Worked examples (what `spec_classify` answers):

| Description | Result | Signals |
|---|---|---|
| Build an ETL pipeline that loads the orders from Postgres into BigQuery every night | `core +data` | etl, bigquery |
| A nightly job that recomputes the loyalty points in the warehouse | `core +data` (weak-only) | warehouse, nightly job |
| Backfill the last 90 days of the events table partitions | `core +data` (weak-only) | backfill, partition |
| Stream changes from Postgres to the data warehouse with a CDC pipeline | `core +dist +data` | data warehouse, CDC pipeline |
| *Verificações de qualidade de dados na ingestão: as linhas com chaves nulas ficam em quarentena* | `core +data` | qualidade de dados |
| Migrate the orders table to add a currency column; backfill existing rows with EUR | `core +tdd`, *possible +data* | backfill (a migration's — app-level) |
| Analytics events for the signup funnel | `core`, *possible +data* | analytics (generic only) |
| Warehouse temperature monitoring: sensors report every minute | `core` | warehouse (the building — no signal) |
| Export orders as CSV · Import a CSV of contacts · Migrate the users table | `core` | — |
| Track the lineage of every dashboard metric back to its source tables | `core +data` | lineage (strong — about metrics), table |
| Guests can book a lakehouse or a cabin for the weekend · ELT teachers assign reading exercises | `core` | — (the everyday senses) |
| Show stock levels per warehouse in a table so pickers know which shelf to restock | `core`, *possible +ui* | picker — warehouse: the building, no signal |
| Prevent duplicate rows in the users table when the signup form is double-submitted | `core`, *possible +ui / +data* | form, duplicate rows (a table backs no everyday anchor) |
| A BI dashboard over the orders table · Load the orders table into the warehouse every night | `core +data` (weak-only; *possible +ui* for the dashboard) | BI dashboard / warehouse, table |
| *Relatório de BI com backfill mensal* | `core +data` (weak-only) | relatório de BI, backfill |

## History
How the rules above came to be, section by section — grep a release (`1.21`) or a finding id (`F2a`, `verify P1`, `r6`,
`R9`) here. "The differential" replays a large input set through two or more engine commits and counts the track decisions
that changed; "the logged inputs" are the classify inputs both test suites log.

### The track model
- **1.13** — the track list is persisted in `.state.json` `tracks`; features created before 1.13 fall back to their files,
  where a Mermaid node `X[AI]` or prose had switched +ai on — hence the real-heading rule.
- **1.14** — +sec and +privacy become built-in marker tracks; the GDPR names move from +saas to +privacy; `PRIVACY_SECTIONS`
  gets its `loose` synonyms (a core `## Processors and queues` had satisfied a deleted `[PRIVACY]` section).
- **1.15** — track packs (Project-defined tracks); every registry reader goes through the accessors; a saved name shaped like
  a pack's is kept (`track-pack-missing`).
- **1.16** — "message queue" becomes a +saas hint (kept as a shared phrase when +dist arrived).
- **1.17** — +dist, the seventh built-in marker track. **1.17 D review** — four tiers (the generic tier), `SIGNAL_CONCEPTS` /
  `SIGNAL_HAZARDS`, the case-sensitive product phrases, the reserved pack names and the packs that predate them (a 1.16 pack
  `dist` is never the built-in +dist). The +dist corpus: 45 texts, 96.8% / 100%.
- **1.18** — the reference of the 1.19 measurements: its tests (two of them read "translate the UI…" texts as core, so `UI` /
  `UX` became anchors rather than strong), its logged inputs, its placeholder corpus (628 texts, `templateSets()` ~70 ms).
- **1.19 T** — +api, +ui, +obs (the eighth to tenth tracks). T8: a 133-text EN / PT / ES precision / recall corpus, 100% / 100%
  per track; the 1,783 logged inputs gave the same 1.18 decisions (only +api / +ui switched on beside them); no logged 1.18
  input turned +obs on. The placeholder corpus: 47 track sets / 1,165 texts, `templateSets()` ~95 ms — T10 bounds it
  relatively; `T19` runs the same eight checks for each new track.
- **1.19 T review** — the cues (ownership for +api; the +ui sentence / near / text / clause rules; the +obs near rule, its
  context tier and technical targets); on-call, game day, postmortem demoted from strong to weak (a hospital's on-call
  schedule, a match's game day, a pathology postmortem); accessibility weak; a pack whose recorded MARKER is now a built-in's
  (`legacyPackMarkerTrack`). The reviewer's 205-text corpus: +api 70.4% / 95.0% → 100% / 100%, +ui 86.0% / 79.6% → 100% / 87.0%
  (left: sales dashboards — by design — and a downtime banner), +obs 68.6% / 82.8% → 100% / 100%; `1.19 T review` embeds 78 of
  its hardest texts (≥ 90% / ≥ 85% per track); 2,578 logged inputs through 1.18, the 1.19 package-T base and the fix gave the
  same 1.18 decisions.
- **1.19 verify 1** — the +ui backend test read the whole sentence and lost +ui: a negated backend word, one after the page with
  a consumer verb, a "frontend only" text no longer demote; the genericOnly note stopped offering "the frontend" as an anchor.
- **1.19 verify 2** — an ALL-CAPS organisation acronym is an owner (`RE_CUE_ACRONYM`); a participle after a determiner is an
  adjective; `API_BREAK_VERBS` (PT "não pode quebrar a compatibilidade da API pública" had missed +api).
- **1.19 verify 3** — alertar / avisar join the watch concept; health check endpoints are strong in PT / ES.
- **1.19 verification** — the verifier's 146-text corpus: +api 92.6% / 92.6% → 100% / 96.3%, +ui 100% / 71.0% → 100% / 74.2%
  (left: a confirm dialog, a toast, a login screen), +obs 90.6% / 93.5% → 91.2% / 100% (left: coordinated negations, "not add
  feature flags or canary releases"); 10 of its +ui findings joined `1.19 T review`; 2,644 logged inputs and a 12,390-text
  keyword sweep gave the seven older tracks' 1.18 decisions.
- **1.20** — cues become data: each track's `SIGNALS` entry holds its rules, `CUE_KINDS` the mechanisms (replacing six
  classifier constants — API_AMBIGUOUS, RE_API_ACRONYM, API_TECH_ACRONYMS, RE_UI_BACKEND…). `npm run build` renders the
  placeholder corpus into `engine/corpus.generated.json`.
- **1.21 F2 / F2a** — coordinated negation (`coordinatedNegation()`; `NEGATORS` gained nor / neither / nem / ni); the
  verification's remaining misses as data (+ui's everyday components strong, popup / banner, errors next to each field,
  mobile-friendly, the display-verb widget cue, a login screen kept off; the public-API exception to the backend-only clause,
  whose `notAfter` / `notBefore` became phrase lists; the `all` cue kind and +api's our-API + version rule). Measured (F2): the
  146 texts — +api 100% / 96.3% → 100% / 100%, +ui 100% / 74.2% → 100% / 100%, +obs 91.2% / 100% → 100% / 100%; the 205 — +ui
  recall 87.0% → 88.9% (a banner); the 1.17 +dist corpus unchanged; on 37,881 inputs the older tracks changed only where a list
  or a negative conjunction now reaches a keyword (the logged "sin datos personales ni autenticación": +tdd off). `1.21 F2a` in
  04-tracks-builtin.js embeds the cases + a 40-text precision / recall assertion (≥ 95% per track).
- **1.21 F2b** — project signal overrides (`.specs/classifier.json`), an action of `spec_tracks` rather than a 39th tool.
- **1.21 F4** — +data, the eleventh track. 72 texts (38 positives, 34 hard negatives — 04-tracks-data.js) 100% / 100%; on 36,281
  inputs (the logged inputs of 1.19 / the 1.19 fix / 1.20, the corpora rev19-t / verify19 / rev17-d / p19t, every string
  literal of the test files, an 18-frame sweep) no decision of the ten older tracks changed (a first cut's "redshift cluster"
  shadowed +obs's "cluster" — dropped); +data turned on for 2 logged inputs and 1 corpus text (CDC / Segment feeds into a
  warehouse). The corpus: 57 track sets, 1,387 texts (T10's bound then 1,400; the size variants took it to ~1,480, the bound to
  1,650).
- **1.21 F5** — sizes as data: section tiers, `TRACK_OVERLAPS`, `TRACK_TASK_OVERLAPS`, `CORE_SUPERSEDED_BY`, template tasks
  trimmed by rule.
- **1.21 review B1 – B6** — B1: an auxiliary / a modal + a verb is a requirement ("must not lose X nor …"); B2: a comma after
  the closing conjunction ends a list, a comma + an article joins only a same-track item; B3: `everydayAnchors`, the ELT phrases
  (a lone +data anchor + a table had turned +data on for a horse's lineage, SCD patients, medication ingestion); B4: the
  warehouse keep rule stopped counting tables / columns / queries ("Show stock levels per warehouse in a table" had kept the
  anchor); B5: `inOtherTrackContext`; B6: the example pack's PT / ES fragments. First cut, a three-way differential (1.20
  c2ade64, 1.21 427cd05, the fix) over 66,621 inputs (a 31-frame sweep): 15,239 decisions differ from 1.21, all in the B
  families (12,063 back to 1.20's decision, 3,176 a 1.21 change combined with the fix); +data on the 72 + 24 corpus 73.8% /
  100% → 100% / 100%; the +dist (45), T8 (133), T review (88) and F2a (40) corpora unchanged.
- **1.21 verify V1 – V5** — V1: exclusions negate the whole list again; V2: same-track article lists ("Without Kafka, the
  RabbitMQ broker or SQS"); V3: data-term anchors are backed by a table / a query again (the first cut — context backed by a
  STRONG signal only — lost "A BI dashboard over the orders table"), `mixedAcronyms()`, the data sense first (an everyday word
  anywhere in the sentence had won); V5: a deontic modal's object is kept. 81,075 inputs (39 frames): against the first cut
  a682f55 11,661 changed, all intended; against 427cd05 18,862.
- **1.21 verify R1 – R4** — R1: single-item exclusions and contractions ("We don't use X", "Nunca usaremos X"); R2: "must not
  install" / "Logs must not expose" keep a +sec / +privacy keyword; R3: a lineage of reports / fields strong; R4: ingestion of
  files and an SCD with its type strong. 100,713 inputs (50 frames): against 8b62972 10,976 changed, all intended, no logged
  input; 27,466 against 427cd05, 49,696 against 1.20. At 200 KB the slowest input ~0.4 s — the `RE_NEG_NEAR` precheck spares
  the farther look-back.
- **1.21 verify N1 – N3** — the principle: exclude only when the negation certainly governs the keyword. N1: a noun ends the
  phrase, an auxiliary + another verb, a people relative clause, a condition; N2: what is ingested named next to "ingestion"
  (water, a medication) → none; N3: protected heads for expose / embed. The verifier's 726 sentences: 36 changed against
  290e68c; 113,205 inputs (57 frames): 5,712 against 290e68c, 29,170 against 427cd05, 51,871 against 1.20; 50 / 100 / 200 KB
  ≤ 0.15 / 0.3 / 0.62 s.
- **1.21 verify P1 – P3** — P1: whose adoption (`subjectKeeps()`) — 27 role / plan sentences got their track back (some for the
  first time: 1.20 lost them too); 859 sentences, 30 changed against d10260f; 141,741 inputs (73 frames): 7,589 changed, none
  switching a track off; 58,839 against 1.20; ≤ 0.15 / 0.23 / 0.51 s. P2: a component's plain negation excludes
  (`componentAt()`), and the 3rd-person future is an adoption (*La versión 2 no añadirá…*); 950 sentences, 13 changed against
  0ed99a5; 156,001 inputs: 4,695. P3: a protected head under ANY verb and subject; 994 sentences, 11 changed against 9ea21e7,
  nothing lost a track; 164,909 inputs: 1,067; 200 KB ≤ 0.61 s.
- **1.22 review** — two-factor in PT / ES ("Adicionar autenticação de dois fatores" was `core +tdd`, its English twin +sec):
  the factor words joined sec.weak as separate words. e2bb4d1 vs the fix, 40,579 inputs (a 20-frame sweep): 1,863 changed, all
  +sec switched on by a new word.
- **1.22 Review 2** — the factor words count only as authentication ("depende de dois fatores", "a multi-factor risk model"
  were hints, and ON with one more weak word): the two cue rules. 7cf3843: 32,719 inputs, 1,943 +sec off — every one in a frame
  with a factor word; 0 on; the A2 self-match sweep probes each factor word beside an auth word.
- **1.22 Review 3** — the natural phrasings ("Iniciar sesión con doble factor", "Require multifactor at login"): the auth verbs
  and the at / ao / al connectors. f67e2ff: 53,462 inputs, 66 changed (62 a new hint, 4 on); known cost "entrar".
- **1.22 Review 4** — the catch-all takes every inflection ("a multi-factored discount" was ON), the PT / ES adjective slot,
  conjugated auth verbs; checked with the reviewer's cases, no differential. A track kept off with weak words reads
  `classify.offWeak`.
- **1.23 Review 5 (review 5, L29)** — recall as data: +sec password / SSO / OIDC / SAML weak, +tdd strong single sign-on / OIDC
  / SAML, +sec role-based access control strong, +ai machine learning / deep learning / neural network, +api REST endpoint;
  glued versions and PT / ES content words (Classifier gotchas). 7ed88be, 13,717 inputs: 189 decisions changed, all on (+sec
  21, +tdd 83, +ai 88, +api 6), 143 language guesses; two test texts re-worded ("Cifrar las contraseñas", "Excluir contas").
- **1.24 r6 (Review 6)** — negation (F5): the three readings after a nominal negation (`nominalFollowRequires()`,
  `negativePredicate()`); recall: +ai AI / IA, speech, OCR, vision, Whisper, LLaMA; +privacy medical / KYC / passport / SSN /
  location; +sec card data, HMAC, password hashing, rotation, share links, unauthorized access, the access-rule and credential
  cues; +saas `tenant` strong with its rent cue ("Os inquilinos pagam a renda ao senhorio" had been +saas). E3: removing +tdd /
  +ai under the approval guard; F9: trace_check reads the active ACs. 24fb470, 76,011 inputs (29 frames): 16,700 changed —
  11,861 on the old keywords' frames, all on; 4,099 on / 530 off on the new keywords' (a new keyword opening a negated list);
  117 existing literals, all on. The recall corpus (141 one-liners): +ai 11% → 100%, +privacy 0% → 100%, +sec 3% → 100%, +saas
  43% → 100%; the negation set (56 texts, 17 exclusions kept off); the reviewer's 45 (t7): +ai 3 → 20 / 21, +privacy 0 → 10 /
  12, +sec 0 → 10 / 12; a 71-text hold-out: +ai recall 25% → 91.7%, +privacy 6.3% → 81.3%, +sec 0% → 100%, +saas 40% → 100%,
  precision 100%.
- **1.25.1** — `AI_SECTIONS`' fallback words became loose (an unmarked "## Fallbacks" — a payment processor's — answered the
  deleted [AI] section); `headingLeadMarkers` (a marker must lead the heading). The 1.25.1 review found this note still naming
  the constants 1.20 had replaced; 17-docs-review7.js now fails on any dead identifier.

### Project-defined tracks
- **1.14** — a project template gets every missing track block; a built-in scaffold without packs stays byte-identical to 1.14.
- **1.15** — track packs in `.specs/tracks/<name>/`; `tracks` became a reserved slug (a `.specs/tracks/` holding a
  `.state.json` is a pre-1.15 feature).
- **1.17 / 1.19 / 1.21** — each new built-in track reserved its name and aliases: a pre-1.17 `dist` pack, a pre-1.19 `api` /
  `rest`… pack, a pre-1.21 `etl` pack is a missing pack (`TRACK_RESERVED_SINCE`); 1.19 T review added the packs whose MARKER
  became a built-in's ('contracts' with `[API]`, 'ops' with `[OBS]`).
- **1.21 F4 review R1 – R10** — R1: a pack turned off, then deleted, came back to life → `noteGhostPacks()` registers every
  packMarkers entry; R2: the wildcard needs ≥ 3 literal characters; R3: `commentLines()` for the criteria's insertion point;
  R4: `packSectionKey()` strips the heading lead; R5: ghost sections joined another track's criteria → `trackAcIds` keeps the
  asked track's lines; R6: `savedPackName` never a reserved name (in 1.14 the files decided); R7: every pack synonym
  marker-bound; R8: importSpec re-inserts the pack blocks; R9: 20 packs × 4 languages cost ~100 ms per call → the cross-call
  caches; R10: `fragment-ref` names the context and the file.
- **1.21 review B6** — the example pack's `pt/` / `es/` lacked test-plan.md and steering.md (PT / ES features got English rows
  and steering).
- **1.24 r6** — F7: `section-overlap` is an error ("## [MOB] Offline Sync" filled "Offline" too, so deleting the Offline section
  passed doctor); F9: trace_check reads the active requirements and tasks for a ghost section too.
- **1.25.1** — `packTableRows` reads `\|` as a pipe ("encode \| decode" split the row into seven cells and refused the pack);
  `packTaskBlock` numbers after every number in use (a removed task's run was inherited by the track's first new task).

### Classifier gotchas
- **1.20** — this section moved here from conventions.md's Conventions & gotchas when the notes split by topic.
- **1.21** — every surface reads a text in its own language, `meta.lang` only the fallback (forcing it read "no checkout" in
  a PT summary as an English negation in an EN project). **1.21 F2** — a negation reaches the coordinated list it opens.
- **1.23 review 5 (L29)** — glued versions: "OAuth2", "GPT4", "GPT4o", "TLS1.3", "Claude3", "Gemini1.5" were no signal at all;
  one language's content words: "Erro no pagamento", "Cupom de desconto no checkout", "Alertas no PagerDuty" read English in an
  English project and their "no" (em + o) switched +tdd / +obs off.
- **1.24 r6 F5** — what follows a nominal negation; its harness: 29 frames × every built-in keyword, old and new apart.
- **1.25.1** — the everyday product names written capitalised (lower-case claude / gemini / mistral / copilot / rag had been
  +ai), the +tdd / +saas everyday cues, 'tool use' weak, `-compatible` in `ADJ_SUFFIX`, training / predicting gap keywords;
  "no more X" (`NO_MORE`) and the insufficiency predicate (`insufficientAfter()`). b7978f8 vs the fix: 16,125 literals, 76
  decisions changed, each a targeted phrasing; a 14-frame sweep (30,716 texts): 369 — +ai off only for the lower-case words,
  on only for the new keywords.

### The classifier's signal rules, track by track
- **1.21** — the list negation, +api's our-API + version rule and the public-API exception joined the reading.
- **1.24** — the strong / weak additions of review 6 and "What follows 'no X' / 'without X'".
- **1.25.1** — the named AI products and frameworks, "no more X", the insufficiency predicate.
- **1.26** — the section moved here from the skill's `references/classification-matrix.md` (the text the skill shipped up to
  1.25); the skill keeps the decision procedure, the "turn it on if" tables and the classification.md format. **1.27** — the
  keyword lists keep PT / ES samples only (the full lists are the `SIGNALS` entries).
