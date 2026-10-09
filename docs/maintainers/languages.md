# Languages (EN / PT-PT / PT-BR / ES)

Maintainer notes, one topic of the map in [CLAUDE.md](../../CLAUDE.md) — the index and the hard constraints.
Where localized text lives, the English-stable tokens, the synonyms that keep PT / ES specs readable.

## Languages (EN / PT-PT / PT-BR / ES) — the system both READS and WRITES them
**All localized content lives in `mcp/lib/i18n.js`** (artifact builders, steering stubs, tool
messages, CLI and hook output — one set per language; since 1.18 each language's blocks are in `mcp/lib/i18n/en.js`,
`pt.js`, `es.js`, assembled by `i18n.js` — see the module rule). The engine keeps the logic and delegates: each
template function is a one-line call into `i18n.<builder>(args, lang)`. EN is the canonical reference;
PT and ES mirror its structure (same sections, IDs, markers and slots). **pt-BR (1.14) is a DERIVED locale**
(`lang: "pt-BR"`; `pt_BR` / `pt-br` / `ptbr` fold to it via `canonicalLang()`, `pt` / `pt-PT` stay European): every
pt-BR string is `toPtBr(<the pt string>)` — protected tokens (code spans, `_Marker:_`s, paths, the caller's arguments),
then `PTBR_OVERRIDES`, the progressive (`está a correr` → `está rodando`), `PTBR_PHRASES`, the second person (`tens` →
`você tem`), clause-start imperatives (`corre` → `execute`) and `PTBR_WORDS` (vocabulary + spelling; a word whose
Brazilian twin changes gender — `ecrã` → `tela`, `faturação` → `faturamento` — also has its articles, contractions and
possessives in `PTBR_PHRASES`, or the word rule alone writes "no tela"; 1.24 review 6) — built lazily per
table group (`defineDerivedLocale`), so it inherits every key, ID, marker and synonym of the PT set and a PT edit
reaches pt-BR with nothing else to change. **When you add or edit a PT string, read its twin once**
(`node -e "console.log(require('./mcp/lib/i18n.js').toPtBr('…'))"`): a clause-start 3rd person read as an order goes
into `RE_PTBR_NOT_IMPERATIVE`, a missed word into `PTBR_WORDS` / `PTBR_PHRASES`, anything else into `PTBR_OVERRIDES`;
`mcp/test.js` (pD1) lints every pt-BR string (no European-only vocabulary, English-stable tokens byte-identical,
idempotent). Readers that match PT headings/keywords match pt-BR too (`baseLang()`); the classifier's language guess
counts Brazilian markers but still answers `pt` (a stable field — pt and pt-BR classify alike). **1.24 r6 H-I4:** when the
Brazilian markers outweigh the European ones, `spec_classify` (= `classify --json`) adds **`langHint: "pt-BR"`** (absent
otherwise — never with an explicit `pt-BR`; `ptVariantHint()` in engine/classify.js: STRONG = você, usuário, arquivo, cadastro /
cadastrar, celular, aplicativo, planilha, deletar, gerenciar, an ê / ô before m / n + a vowel — eletrônico, gênero; WEAK = tela,
equipe, registro, contato, salvar, baixar, "o / do / no time"; European = utilizador, ficheiro, ecrã, telemóvel, equipa,
palavra-passe, registo, contacto, facto, secção, descarregar, gerir, utente, "está a <infinitive>", é / ó before m / n — a hint
at ≥ 2 points and more than the European count). The agent then passes `lang: "pt-BR"` to spec_init / spec_create (SKILL.md →
Language; commands/classify.md). Project templates for it live in `.specs/templates/pt-BR/`.
The EN templates are **not** frozen: 1.13 changed them on purpose (every template AC planned + tasked, track ACs under
`[SaaS]`/`[AI]` headings, the test plan's Kind column…). When you change a template, change EN / PT / ES together
(and pt-BR where it overrides that text) and keep the tests that round-trip a PT and an ES scaffold through doctor green.
- **Language resolution (single source of truth + per-feature override).** The PROJECT language lives
  in `.specs/roadmap.json` `meta.lang`, seeded by `spec_init {lang}` (read via `projectLang()`). Each
  FEATURE may override it; the resolved feature language is persisted in `.specs/<feature>/.state.json`
  `lang` (read via `featureLang()`). `spec_create {lang}` resolves `explicit > project default > en`,
  writes the state file, and generates every artifact in that language; every feature operation, the
  CLI and the hooks read `featureLang()` so messages match the spec.
- **English-STABLE tokens (the tooling matches them literally — never translate, in any language):**
  AC/SC/test IDs (`US-1.AC-1`, `SC-001`, `T-01`, `EC-1`, `NFR-1`), decision IDs `D-n`, section markers
  `[SaaS]`/`[AI]`/`[SEC]`/`[PRIVACY]` (case-sensitive), story/parallel tags `[US1]`/`[US2]`/`[shared]`/`[P]`, the
  unfilled sentinel `> **TODO**`, `[NEEDS CLARIFICATION]`, annotation tags `_Requirements:_`/`_Makes green:_`/
  `_Affects evals:_`/`_Emits metrics:_`/`_Implements:_`/`_Verify:_`/`_Expect:_`/`_Size:_`/`_Supersedes:_`, the
  decision-log markers `_Kind:_`/`_Date:_`/`_Affects:_` and the spike's `_Outcome:_` (values `go`/`no-go`/`pivot`),
  `**Checkpoint:**`, the test plan's Kind values `example`/`property`, the steering front-matter keys and values
  (`inclusion: always|fileMatch|manual`, `fileMatchPattern`), template variables `{{name}}`…`{{date}}`, evidence reason
  codes and every other stable code (check ids, `step`, forecast reasons, suite statuses), the
  ` ```mermaid `/` ```typescript ` fences, and the eval-harness headings `## System` / `## User Template`.
- **TRANSLATED, but matched by synonyms** so generated PT/ES specs still pass `doctor`/`clarify`: EARS
  keywords (QUANDO/CUANDO, O SISTEMA DEVE/EL SISTEMA DEBE, SE…ENTÃO/SI…ENTONCES — recognized by
  `earsValidate`), and section headings (matched by the `TRACK_SECTIONS` synonym tables, the
  `RE_*` matchers, and `RE_TESTABILITY` for the +tdd block). The decision log's Context / Decision / Discovery /
  Consequences labels (`DECISION_LABELS`) and spike.md's headings are read in any EN/PT/ES spelling. The Kind column
  header (Kind/Tipo) and the converge heading (`Phase: Convergence` / `Fase: Convergência` / `Fase: Convergencia`)
  are localized too.
  **When you add/rename a translated heading, add the matching synonym** or `doctor` will think the
  section is missing.
- **Terminology** mirrors the existing `ROADMAP_I18N` per language (PT keeps the "Feature/Tasks/Tracks"
  anglicisms; ES translates to Función/Tareas). Eval sample JSON (`golden.json`/`adversarial.json`) is
  data and stays as-is; its surrounding prose (README, prompt stub) is localized.
- **Adding a language:** a regional variant of an existing one derives from it, as pt-BR does from pt-PT (only the
  overrides). A new language adds a file `mcp/lib/i18n/<lang>.js` holding every table's block (`build`, `steering`,
  `evalsReadme`, `msg`, `quality`, `designWeigh`, `brief` — as `en.js` does), wires it into `i18n.js`'s `LOCALE_FILES`
  (each table's getter for it loads that file on first use), adds it to `BASE_LANGS` (`i18n/common.js` — `LANGS`, the
  strict `canonicalLang()` reading every surface validates with, and the MCP schemas' `lang` enum, `LANG_ENUM` in
  `mcp/server.js`, all derive from it: no enum to edit by hand), extends the classifier `SIGNALS` (`engine/tracks.js`;
  language guess in `engine/classify.js`), `ROADMAP_I18N` (`engine/roadmap-md.js`), the `TRACK_SECTIONS` synonyms (all
  four tables, `engine/tracks.js`), the stop gate's `stopGate.claims` / `negators` / `admissions` and the `RE_*`
  matchers, then adds a test asserting a localized scaffold round-trips.

## Localization gotchas (from Conventions & gotchas)
- **Multilingual headings:** the `TRACK_SECTIONS` tables (`SAAS_SECTIONS` / `AI_SECTIONS` / `SEC_SECTIONS` /
  `PRIVACY_SECTIONS`) are `{name, syn:[…], loose?:[…]}` with EN/PT/ES synonyms; `extractSection` matches any synonym
  (a `loose` one only in the track's context — see The track model). `clarify` uses `RE_CONSTITUTION_CHECK` (doctor's `constitution-check` reads `CONSTITUTION_SYN` through `sectionFilled`, the gate's reader, since 1.24 review 6),
  `RE_SUCCESS_CRITERIA`, `RE_INDEPENDENT_TEST`, `RE_OUT_OF_SCOPE`, `RE_NFR`, `RE_EDGE_CASES`,
  `RE_GLOBAL_CONSTRAINTS`; `addTrack` uses `RE_TESTABILITY` for the +tdd block heading. Add a synonym when
  adding a language. Localized BODY content is in `mcp/lib/i18n.js` (its `i18n/<lang>.js` files), not the engine.
- **Returned text is localized, structured fields are not.** Engine errors (`errs()`), EARS issue
  `msg`, classifier `notes`/`reasoning`, doctor section names and details (the ears `earsDetail`), add_track's
  `added` annotations (`design.md (+secções)`), the ROADMAP.md/.html Phase column (`phaseNames`; the JSON
  `phase` stays English), CLI output (usage prefix, section labels, EARS severities included), hook and
  pre-commit lines all go through `i18n.msg(lang)`. Callers branch on stable fields — EARS `code` / `severity`,
  evidence `unverifiedReason` (and `spec_impact`'s task `evidence`), doctor check `id`, next_action `step` —
  never regex a `msg`.
- **Runnable CLI lines (1.21 F3).** A plugin install puts no `dev-spec` on PATH (only `npm link` does), and the 1.19 eval
  run showed agents relaying `dev-spec done <f> <n> --run` to users who couldn't run it. So every message that tells
  someone to RUN the CLI writes `${DEV_SPEC} <command> …` (a quoted string: `" + DEV_SPEC + "`) — `DEV_SPEC` =
  `node "<clone>/cli/dev-spec.js"` from `i18n/common.js` (resolved from its own place; forward slashes; `cliQuote()`:
  double quotes, single quotes when the path holds `"` `$` `` ` `` `!` or a curly double quote, a `<placeholder>` when it
  holds a single quote too — pasteable into bash AND PowerShell; `approvalCommand()` uses the same `cliPrefix()`). EN /
  PT / ES carry the same keys; pt-BR's stage 0 holds `DEV_SPEC` whole (a folder named with a word the rules map would
  be rewritten otherwise). The bare name stays where it NAMES the command (`observed.on`, the approval guard's
  `on.ask` / `on.deny`, `gitLog.noGit`'s first half), in product-name uses (`dev-spec upgrade — …` headings, "dev-spec
  guard:") and in text written into a COMMITTED file (every `autogen` marker, retro.md's `followUpsNote`, UPGRADE.md's
  `intro`, decisions.md's `header`, a pack's `initJson`, the tracker CSV's `featureLine`); the writers of ROADMAP.md /
  .html, SPECS.md, UPGRADE.md, retro.md and `.specs/exports/*` also pass their text through `portableCli()` (the
  runnable line → `dev-spec`, HTML-escaped too), so no machine path is ever committed. `mcp/tests/03-languages.js`
  sweeps every message of every language: a bare `dev-spec <command>` outside that list fails — the command list is read
  from the CLI's own `case "<name>":` labels (1.21 review A2: a hand-written list missed `signals` and `merge-state`) and
  each builder is called with several argument shapes (a list-mapping one is swept, not skipped); the driver's own stderr
  lines (`dev-spec merge-state: <file>: …`, `mergeState.conflictHead` / `parseError`) are product-name uses. The MCP tool
  descriptions and `initialize` instructions interpolate `spec.DEV_SPEC` the same way; the command files write
  `node "${CLAUDE_PLUGIN_ROOT}/cli/dev-spec.js" …` where they hand the user a `--run` line.
