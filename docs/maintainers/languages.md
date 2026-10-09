# Languages (EN / PT-PT / PT-BR / ES)

Maintainer notes, one topic of the map in [CLAUDE.md](../../CLAUDE.md) — the index and the hard constraints.
Where localized text lives, the English-stable tokens, the synonyms that keep PT / ES specs readable. The rules come first;
how they came to be — the releases and review findings — is in History at the end.

## Languages (EN / PT-PT / PT-BR / ES) — the system both READS and WRITES them
- **Where the text lives.** Every localized string (artifacts, steering stubs, messages, CLI and hook output) is in
  `mcp/lib/i18n/en.js`, `pt.js` or `es.js`, assembled by the `mcp/lib/i18n.js` facade; EN is the reference. The structure all
  languages share — sections, order, track / size conditions, IDs, markers, numbering — is written ONCE in `i18n.js`: `LAYOUTS`
  (every multi-section scaffold, the track design and task blocks — `TRACK_TASK_PLAN`) and `approvalAction`, bound by
  `loadLocale` to a language's **`text` block** (strings; a function only where a value sits inside a sentence or the grammar
  differs); `renderBrief` / `renderRetro` read the `brief` block / `msg.metrics.retroText`. `build` keeps the one-template
  builders (bugReport, change, evalPlan…), `msg` the messages. A structural change goes into the layout, a wording change into
  each `text`.
- **One key tree.** `mcp/tests/03-languages.js` holds the three files to the same keys, value kinds, arities and list lengths
  (the layouts read `text`'s lists by position), except the identity maps EN leaves empty (`msg.sectionNames`,
  `msg.secPrivacy.sectionNames`, `msg.cliOutput.words`) and the stop gate's pattern lists.
- **pt-BR is DERIVED** (`canonicalLang()` folds `pt_BR` / `pt-br` / `ptbr` to `pt-BR`; `pt` / `pt-PT` stay European):
  `toPtBr()` (its stages: the header of `i18n/pt-br.js`) rewrites each whole output of pt's builders and messages, never
  `text`, lazily per table (`defineDerivedLocale`) — pt-BR inherits every key, ID, marker and synonym. A word whose twin
  changes gender (`ecrã` → `tela`) needs its articles in `PTBR_PHRASES`, or the word rule writes "no tela". **After editing a
  PT string, read its twin** (`node -e "console.log(require('./mcp/lib/i18n.js').toPtBr('…'))"`): a clause-start 3rd person
  read as an order → `RE_PTBR_NOT_IMPERATIVE`, a missed word → `PTBR_WORDS` / `PTBR_PHRASES`, anything else →
  `PTBR_OVERRIDES`. `mcp/test.js` (pD1) lints every pt-BR string (no European-only word, stable tokens byte-identical,
  idempotent).
- **Reading pt-BR.** PT readers match it (`baseLang()`). The classifier answers `pt` for both and adds **`langHint: "pt-BR"`**
  when Brazilian markers outweigh European ones (`ptVariantHint()`; never with an explicit `pt-BR`); the agent then passes
  `lang: "pt-BR"` (SKILL.md → Language). Its project templates live in `.specs/templates/pt-BR/`.
- **Changing a template:** EN / PT / ES together (pt-BR where it overrides); the tests round-trip a PT and an ES scaffold
  through doctor.
- **Language resolution.** The project's is `.specs/roadmap.json` `meta.lang` (seeded by `spec_init {lang}`,
  `projectLang()`); a feature may override it in its `.state.json` `lang` (`featureLang()`). `spec_create {lang}` takes the
  explicit one, else the project's, else `en`; feature operations, the CLI and the hooks read `featureLang()`.
- **English-STABLE tokens** — matched literally, never translated: AC / SC / test IDs (`US-1.AC-1`, `SC-001`, `T-01`, `EC-1`,
  `NFR-1`), `D-n`, the markers `[SaaS]`/`[AI]`/`[SEC]`/`[PRIVACY]`/`[DIST]`/`[API]`/`[UI]`/`[OBS]`/`[DATA]` (case-sensitive)
  and a pack's own, `[US1]`/`[US2]`/`[shared]`/`[P]`, `> **TODO**`, `[NEEDS CLARIFICATION]`, every `_Marker:_`
  (`_Requirements:_` … `_Supersedes:_`, the decision log's `_Kind:_` / `_Date:_` / `_Affects:_`, `_Outcome:_` with `go` /
  `no-go` / `pivot`), `**Checkpoint:**`, the Kind values `example` / `property`, the steering front matter
  (`inclusion: always|fileMatch|manual`, `fileMatchPattern`), `{{name}}`…`{{date}}`, every stable code (check ids, `step`,
  reasons, statuses), the ` ```mermaid ` / ` ```typescript ` fences and the eval harness's `## System` / `## User Template`.
- **TRANSLATED, but matched by synonyms**, so PT / ES specs pass doctor and clarify: EARS keywords (QUANDO / CUANDO, O SISTEMA
  DEVE / EL SISTEMA DEBE… — `earsValidate`), section headings (`TRACK_SECTIONS`, the `RE_*` matchers), `DECISION_LABELS`,
  spike.md's headings, the Kind column header, the converge heading (`Phase: Convergence` / `Fase: Convergência` /
  `Fase: Convergencia`). **A new or renamed translated heading needs its synonym**, or doctor reports the section missing.
- **Terminology** mirrors `ROADMAP_I18N`: PT keeps the "Feature / Tasks / Tracks" anglicisms, ES translates them (Función /
  Tareas). Eval sample JSON is data, as-is; its prose is localized.
- **The README, one file per language.** `README.md` (the reference), `README.pt.md` (European, no Brazilianisms) and
  `README.es.md` (neutral) hold the same sections and tables in the same order; a change goes to all three in one commit. The
  docs tests read each (mcp/tests/17-docs*.js, 04-tracks-data, 10-guards-hooks-r7); the PR / CI prose guard reads
  `README.pt.md` as Portuguese. Release news goes into CHANGELOG.md.
- **Adding a language:** a regional variant derives from its base, as pt-BR from pt (only the overrides). A new language is a
  file `mcp/lib/i18n/<lang>.js` with every block `en.js` has (`text`, `build`, `steering`, `evalsReadme`, `msg`, `quality`,
  `designWeigh`, `brief`) — `en.js` translated, every key, list length and arity kept (the parity test names what differs) —
  wired into `i18n.js`'s `LOCALE_FILES` (loaded on first use) and added to `BASE_LANGS` (`i18n/common.js`): `LANGS`, the strict
  `canonicalLang()` every surface validates with and the MCP `lang` enum (`LANG_ENUM`, `mcp/server.js`) derive from it — no enum
  to edit by hand. Then the classifier `SIGNALS` (`engine/tracks.js`; the language guess, `engine/classify.js`), `ROADMAP_I18N`
  (`engine/roadmap-md.js`), every `TRACK_SECTIONS` synonym table, the stop gate's `stopGate.claims` / `triggers` (a word of each
  claim) / `negators` / `admissions`, the `RE_*` matchers, and a test that a localized scaffold round-trips.

## Localization gotchas
- **Multilingual headings:** the `TRACK_SECTIONS` tables (`SAAS_SECTIONS` … `DATA_SECTIONS`) are `{name, syn:[…], loose?:[…]}`;
  `extractSection` matches any synonym (a `loose` one only in the track's context — see The track model). `clarify` uses
  `RE_CONSTITUTION_CHECK`, `RE_SUCCESS_CRITERIA`, `RE_INDEPENDENT_TEST`, `RE_OUT_OF_SCOPE`, `RE_NFR`, `RE_EDGE_CASES`,
  `RE_GLOBAL_CONSTRAINTS`; doctor's `constitution-check` reads `CONSTITUTION_SYN` through `sectionFilled`, the gate's reader;
  `addTrack` uses `RE_TESTABILITY`. Localized BODY content lives in the i18n files, never the engine.
- **Returned text is localized, structured fields are not.** Engine errors (`errs()`), EARS issue `msg`, classifier `notes` /
  `reasoning`, doctor details, add_track's `added`, the ROADMAP Phase column (`phaseNames`; the JSON `phase` stays English), CLI,
  hook and pre-commit output go through `i18n.msg(lang)`. Callers branch on stable fields — EARS `code` / `severity`,
  `unverifiedReason`, check `id`, next_action `step` — never on a `msg`.
- **The one exception: the CLI's help text** (`helpText()` / `helpFor()`, from each command entry's `help`) is English in every
  language, like the names and flags it lists; only `help <command>`'s frame lines (`cliOutput.cmdHelp`) are localized. Never
  document the help as localized.
- **Runnable CLI lines.** A plugin install puts no `dev-spec` on PATH, so a message that tells someone to RUN the CLI writes
  `${DEV_SPEC} <command> …` — `DEV_SPEC` (`i18n/common.js`) = `node "<clone>/cli/dev-spec.js"`, quoted by `cliQuote()` for bash
  AND PowerShell (`approvalCommand()` shares `cliPrefix()`); pt-BR's stage 0 protects it whole. The bare name stays where it
  NAMES the command (`observed.on`, the approval guard's `on.ask` / `on.deny`, the merge driver's stderr), in product-name uses
  and in text written into a COMMITTED file (every `autogen` marker, retro.md, UPGRADE.md, decisions.md, a pack's `initJson`,
  the tracker CSV) — the ALLOWED list of `mcp/tests/03-languages.js`, whose sweep calls every message of every language with
  several argument shapes and fails on any other bare `dev-spec <command>` (the commands: the CLI's `COMMAND_INDEX`). The
  writers of committed files pass their text through `portableCli()` (→ `dev-spec`, HTML-escaped too): no machine path is
  committed. The MCP tool descriptions and `initialize` instructions interpolate `spec.DEV_SPEC`; a command file writes
  `node "${CLAUDE_PLUGIN_ROOT}/cli/dev-spec.js" …` where it hands the user a `--run` line.

## History
How the rules above came to be, section by section — grep a release (`1.21.1`) or a finding id (`M8`, `r6 B3`) here.

### Languages (EN / PT-PT / PT-BR / ES)
- **1.13** — the EN templates changed on purpose (every template AC planned and tasked, track ACs under `[SaaS]`/`[AI]`
  headings, the test plan's Kind column): the templates follow the gates.
- **1.14 (D1)** — pt-BR arrives as a locale derived from pt by `toPtBr`, so a PT edit reaches pt-BR with nothing else to change.
- **1.18** — each language's blocks leave `i18n.js` for `i18n/en.js`, `pt.js` and `es.js` under the module rule; `i18n.js`
  becomes the facade that assembles them.
- **1.24 review 6** — words whose Brazilian twin changes gender (`ecrã` → `tela`, `faturação` → `faturamento`) came out as "no
  tela": their articles, contractions and possessives went into `PTBR_PHRASES`.
- **1.24 r6 H-I4** — a summary in Brazilian wording got European artifacts (the guess answers `pt` for both variants):
  `spec_classify` adds `langHint: "pt-BR"` — a hint for the agent, never a reading change. The markers and their weights are
  `PTBR_STRONG` / `PTBR_WEAK` / `PTPT_STRONG` in engine/classify.js (a hint at ≥ 2 points and above the European count).
- **1.24 r6 H10** — Adding a language named identifiers the code doesn't have and enums to edit by hand; it names the table and
  the derived enum the code has, and mcp/tests/17-docs-review6.js holds it to them.
- **1.25.1** — the stop gate's `triggers` (a word of each claim: a message without one runs none of the language's claim
  patterns) join what a new language fills.
- **1.26** — the README becomes one file per language: `README.md`, `README.pt.md`, `README.es.md`.
- **1.27** — the shared layouts: `LAYOUTS` and `approvalAction` in `i18n.js` take the structure out of the three language files,
  which keep only their `text` — a structural change was made three times before. `mcp/tests/03-languages.js` gains the
  one-key-tree parity check.

### Localization gotchas
- **1.19** — the eval run showed agents relaying `dev-spec done <f> <n> --run` to users who had no `dev-spec` on PATH (only
  `npm link` puts it there).
- **1.21 F3** — every message that says to run the CLI prints the runnable `DEV_SPEC` line; a committed file keeps the bare name
  through `portableCli()`; pt-BR's stage 0 protects the line whole (a folder named with a word the rules map would be rewritten).
- **1.21 review A2** — the bare-command sweep's hand-written command list missed `signals` and `merge-state`; it read the CLI's
  own `case "<name>":` labels from then on (the `COMMAND_INDEX` of cli/commands.js since 1.27), and a list-mapping builder, once
  skipped, is called with several argument shapes.
- **1.24 review 6** — doctor's `constitution-check` moved to `CONSTITUTION_SYN` through `sectionFilled`, the approval gate's
  reader.
