"use strict";
// The design-system registry — 1.37: a component row marked `_Deprecated: use X_` (its reader, the replacement it names, the brief)
// and doctor's ui-deprecated (a Reuse / Extend row naming one: a warn, never a fail, never on a finished feature; spec_upgrade).
// Every fixture below was written from a mutation of the rule it names (the mutation list came first): each must fail without it.

const fs = require("fs");
const path = require("path");

exports.run = async ({ all, rpc, payload, S, tmp, approveBefore, remeasure, fsCalls, require, __dirname }) => {
  const js = (v) => JSON.stringify(v);
  const E = require(path.join(__dirname, "lib", "engine", "index.js"));
  const write = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  const REG = ".specs/steering/design-system.md";
  const HEAD = "| Component | Path | Variants | Notes |\n|---|---|---|---|\n";
  const project = (tag, lang) => { const p = path.join(tmp, "proj-dsdep-" + tag); S.initProject(p, ["ui"], lang || "en"); return p; };
  const registryOf = (tag, rows) => { const p = project(tag); write(p, REG, "# Design System\n\n" + HEAD + rows.join("\n") + "\n"); return E.designSystemRegistry(path.join(p, ".specs")); };
  const comp = (reg, name) => reg.components.find((c) => c.name === name) || {};
  const depOf = (reg) => (reg && reg.deprecated) || new Map(); // (a label never throws: the parent has no map)

  // --- the marker, where it stands and how it is written -------------------------------------------------------------------------
  {
    const reg = registryOf("reader", [
      "| Table | src/components/Table.tsx | dense | old grid _Deprecated: use DataGrid_ |",
      // (1.37.0 review 2: the successor's own note on the deprecation is no marker — read as one, it voided every `use DataGrid`)
      "| DataGrid | src/components/DataGrid.tsx |  | replaces the _deprecated Table_ (see below) |",
      "| Grid | src/components/Grid.tsx | _Deprecated_ |  |",
      "| Pager | src/components/Pager.tsx _Deprecated: use DataGrid_ |  |  |",
      "| Inner | src/Inner.tsx |  | _Deprecated: use Data_Grid now_ |",
      "| Open | src/Open.tsx |  | _Deprecated: use DataGrid |",
      "| Lower | src/Lower.tsx |  | _deprecated: use DataGrid_ |",
      "| Snake | src/Snake.tsx |  | snake_deprecated_flag |",
      "| Flag | src/Flag.tsx |  | uses _deprecated_flag here |",
      "| Paren | src/Paren.tsx |  | (_Deprecated_) |",
      "| Star | src/Star.tsx |  | **_Deprecated_** |",
      "| Dot | src/Dot.tsx |  | _Deprecated: use DataGrid_. |",
      "| Own | src/Own.tsx |  | _Deprecated: Own is old, use DataGrid_ |",
      "| Spaced | src/Spaced.tsx |  | _Deprecated: use Data Grid_ |",
      "| Label | src/Label.tsx |  | _Deprecated:_ use DataGrid |",
      "| Nowhere | src/Nowhere.tsx |  | _Deprecated: use Nothing Here_ |",
      "| Origin | src/Origin.tsx |  | _Deprecated: use DataGrid_ _From: checkout_ |",
      // (each of these answers ONE rule alone: the start — `:` would read it —, a letter after the label, a second occurrence
      // after a first that is none, and each mark that closes it)
      "| Word | src/Word.tsx |  | config_deprecated: true |",
      "| Ness | src/Ness.tsx |  | the _deprecatedness of x |",
      "| Second | src/Second.tsx |  | was snake_deprecated_flag _Deprecated: use DataGrid_ |",
      "| Comma | src/Comma.tsx |  | _Deprecated: use DataGrid_, since 2026 |",
      "| Semi | src/Semi.tsx |  | _Deprecated: use DataGrid_; see ADR-7 |",
      "| Colon | src/Colon.tsx |  | _Deprecated_: use DataGrid |",
      "| Empty | src/Empty.tsx |  | _Deprecated: _ |",
      // 1.37.0 review 1 (RB-3): a punctuation mark after the word — the natural spellings, with or without a blank; the label
      // alone italic before a period too; a digit continues the word. (RB-6) an `İ` before the marker (two code units lower-cased)
      "| Dash | src/Dash.tsx |  | _Deprecated — use DataGrid_ |",
      "| Tight | src/Tight.tsx |  | _Deprecated—use DataGrid_ |",
      "| Hyphen | src/Hyphen.tsx |  | _Deprecated - use DataGrid_ |",
      "| Period | src/Period.tsx |  | _Deprecated. Use DataGrid instead._ |",
      "| Commas | src/Commas.tsx |  | _Deprecated, use DataGrid_ |",
      "| Dated | src/Dated.tsx |  | _Deprecated (v3): use DataGrid_ |",
      "| LabelPeriod | src/LabelPeriod.tsx |  | _Deprecated._ Use DataGrid instead. |",
      "| Digit | src/Digit.tsx |  | _deprecated2 notes_ |",
      "| Turkish | src/Turkish.tsx |  | İptal akışı _Deprecated: use DataGrid_ |",
      // 1.37.0 review 2 (R2-1): a WORD after the word — past any blanks — makes a note (an italic phrase about something else, as
      // 457d3da read it), and `-` / `/` / `.` before a letter or digit join it into a longer name (a flag, a folder, a file)
      "| Favour | src/Favour.tsx |  | _Deprecated in favour of DataGrid_ |",
      "| Since | src/Since.tsx |  | _Deprecated since 2.0: use DataGrid_ |",
      "| Props | src/Props.tsx |  | _deprecated props removed in v3: size, kind_ |",
      "| Wide | src/Wide.tsx |  | _deprecated  props removed_ |",
      "| Prop | src/Prop.tsx |  | `dense` prop (_deprecated in v2_) |",
      "| Kebab | src/Kebab.tsx |  | reads _deprecated-flag_ from config |",
      "| Folder | _deprecated/Folder.tsx |  | the list |",
      "| DotFile | _deprecated.tsx |  | the list |",
    ]);
    const dep = reg.deprecated;
    all("1.37 registry: `_Deprecated: use X_` in a component row (any cell after the name, any case; bare, closed, the label alone italic or never closed; at a cell's start or after a blank, `(` or `*` — never inside a word; a punctuation mark after the word, never a word — 1.37.0 review 2: `_deprecated props removed_`, `_Deprecated in favour of X_` are notes, `_deprecated-flag_` / `_deprecated/Folder.tsx` longer names) marks it deprecated: `deprecated` maps its key to the replacement — the first OTHER listed component its text names, a word or two adjacent ones, as written there; \"\" when it names none —, the marker is cut out of its cell (a path stays a path) and shown first in the notes, whole; `_From:_` beside it is still read (got " +
      js({ dep: [...depOf(reg)], comps: reg.components.map((c) => [c.name, c.path, c.variants, c.notes]), origin: reg.origins.get("origin") }) + ")", {
      notes: () => dep.get("table") === "DataGrid" && comp(reg, "Table").notes === "_Deprecated: use DataGrid_ · old grid" && comp(reg, "Table").variants === "dense",
      variantsCell: () => dep.get("grid") === "" && comp(reg, "Grid").variants === "" && comp(reg, "Grid").notes === "_Deprecated_",
      bare: () => dep.has("grid") && dep.get("grid") === "",
      pathCell: () => dep.get("pager") === "DataGrid" && comp(reg, "Pager").path === "src/components/Pager.tsx" && comp(reg, "Pager").notes === "_Deprecated: use DataGrid_",
      inner: () => dep.get("inner") === "Data_Grid" && comp(reg, "Inner").notes === "_Deprecated: use Data_Grid now_",
      unclosed: () => dep.get("open") === "DataGrid" && comp(reg, "Open").notes === "_Deprecated: use DataGrid_",
      lower: () => dep.get("lower") === "DataGrid",
      snake: () => !dep.has("snake") && comp(reg, "Snake").notes === "snake_deprecated_flag",
      flag: () => !dep.has("flag"),
      paren: () => dep.has("paren"),
      star: () => dep.has("star"),
      dot: () => dep.get("dot") === "DataGrid" && comp(reg, "Dot").notes === "_Deprecated: use DataGrid_",
      own: () => dep.get("own") === "DataGrid",
      pair: () => dep.get("spaced") === "Data Grid",
      labelItalic: () => dep.get("label") === "DataGrid" && comp(reg, "Label").notes === "_Deprecated: use DataGrid_",
      unlisted: () => dep.has("nowhere") && dep.get("nowhere") === "",
      from: () => reg.origins.get("origin") === "checkout" && comp(reg, "Origin").from === "checkout" && comp(reg, "Origin").notes === "_Deprecated: use DataGrid_",
      word: () => !dep.has("word"),
      ness: () => !dep.has("ness"),
      second: () => dep.get("second") === "DataGrid" && comp(reg, "Second").notes === "_Deprecated: use DataGrid_ · was snake_deprecated_flag",
      comma: () => dep.get("comma") === "DataGrid" && comp(reg, "Comma").notes === "_Deprecated: use DataGrid_ · , since 2026",
      semi: () => dep.get("semi") === "DataGrid" && comp(reg, "Semi").notes === "_Deprecated: use DataGrid_ · ; see ADR-7",
      colon: () => dep.get("colon") === "" && comp(reg, "Colon").notes === "_Deprecated_ · : use DataGrid",
      empty: () => dep.get("empty") === "" && comp(reg, "Empty").notes === "_Deprecated_",
      dash: () => dep.get("dash") === "DataGrid" && comp(reg, "Dash").notes === "_Deprecated — use DataGrid_",
      tight: () => dep.get("tight") === "DataGrid" && comp(reg, "Tight").notes === "_Deprecated—use DataGrid_",
      hyphen: () => dep.get("hyphen") === "DataGrid" && comp(reg, "Hyphen").notes === "_Deprecated - use DataGrid_",
      period: () => dep.get("period") === "DataGrid" && comp(reg, "Period").notes === "_Deprecated. Use DataGrid instead._",
      comma2: () => dep.get("commas") === "DataGrid" && comp(reg, "Commas").notes === "_Deprecated, use DataGrid_",
      dated: () => dep.get("dated") === "DataGrid" && comp(reg, "Dated").notes === "_Deprecated (v3): use DataGrid_",
      labelPeriod: () => dep.get("labelperiod") === "DataGrid" && comp(reg, "LabelPeriod").notes === "_Deprecated. Use DataGrid instead._",
      digit: () => !dep.has("digit") && comp(reg, "Digit").notes === "deprecated2 notes",
      turkish: () => dep.get("turkish") === "DataGrid" && comp(reg, "Turkish").notes === "_Deprecated: use DataGrid_ · İptal akışı",
      // (review 2: notes as 457d3da read them, the path a path)
      successor: () => !dep.has("datagrid") && comp(reg, "DataGrid").notes === "replaces the _deprecated Table_ (see below)",
      favour: () => !dep.has("favour") && comp(reg, "Favour").notes === "Deprecated in favour of DataGrid",
      since: () => !dep.has("since") && comp(reg, "Since").notes === "Deprecated since 2.0: use DataGrid",
      props: () => !dep.has("props") && comp(reg, "Props").notes === "deprecated props removed in v3: size, kind",
      wide: () => !dep.has("wide") && comp(reg, "Wide").notes === "deprecated  props removed",
      prop: () => !dep.has("prop") && comp(reg, "Prop").notes === "dense` prop (_deprecated in v2_)",
      kebab: () => !dep.has("kebab") && comp(reg, "Kebab").notes === "reads _deprecated-flag_ from config",
      folder: () => !dep.has("folder") && /^_?deprecated\/Folder\.tsx$/.test(comp(reg, "Folder").path) && comp(reg, "Folder").notes === "the list",
      dotFile: () => !dep.has("dotfile") && /^_?deprecated\.tsx$/.test(comp(reg, "DotFile").path),
      count: () => dep.size === 27,
    });
  }
  {
    // 1.37.0 review 1 (RB-5): the replacement is never a word pair across punctuation, never a fragment of a hyphenated / slashed /
    // dotted name (a whole one still names it), never deprecated itself — the next one named is
    const NFD = "Dia" + String.fromCharCode(0x301) + "logo", NFC = NFD.normalize("NFC");
    const reg = registryOf("replacement", [
      "| Card | src/Card.tsx |  |  |", "| CardHeader | src/CardHeader.tsx |  |  |", "| Data | src/Data.tsx |  |  |",
      "| DataGrid | src/DataGrid.tsx |  |  |", "| Dialog | src/Dialog.tsx |  |  |",
      "| Panel | src/Panel.tsx |  | _Deprecated: use Card. Header and footer are slots now_ |",
      "| Slash | src/Slash.tsx |  | _Deprecated: see @acme/data_ |",
      "| Hyphen | src/Hyphen.tsx |  | _Deprecated: see x-data_ |",
      "| Dotted | src/Dotted.tsx |  | _Deprecated: see lib.data_ |",
      "| Kebab | src/Kebab.tsx |  | _Deprecated: use data-grid_ |",
      "| Popup | src/Popup.tsx |  | _Deprecated: use Dialog_ |",
      "| Modal | src/Modal.tsx |  | _Deprecated: use Popup_ |",
      "| Sheet | src/Sheet.tsx |  | _Deprecated: use Popup or Dialog_ |",
      // (1.37.0 review 2: a marker writing the accent as a combining mark names the NFC row — as 457d3da's folded key did)
      "| " + NFC + " | src/Dialogo.tsx |  |  |",
      "| Accent | src/Accent.tsx |  | _Deprecated: use " + NFD + "_ |",
    ]);
    const dep = depOf(reg);
    all("1.37.0 review 1: a deprecated row's replacement — a pair only across blanks (`Card. Header` is Card), a hyphenated / slashed / dotted name whole or not at all (`@acme/data`, `x-data`, `lib.data` name no Data; `data-grid` is DataGrid), never a component deprecated itself (`use Popup or Dialog` is Dialog); review 2: read in NFC (got " + js([...dep]) + ")", {
      sentence: () => dep.get("panel") === "Card",
      slash: () => dep.get("slash") === "",
      hyphen: () => dep.get("hyphen") === "",
      dotted: () => dep.get("dotted") === "",
      kebab: () => dep.get("kebab") === "data-grid",
      chain: () => dep.get("modal") === "" && dep.get("popup") === "Dialog",
      chainNext: () => dep.get("sheet") === "Dialog",
      nfc: () => dep.get("accent") === NFC,
    });
  }
  {
    // 1.37.0 review 1 (RB-7): deprecated is a property of the NAME — a later row of a name read in full marks it when no row did yet
    // (its text from that row, its marker first in the entry's notes, bounded); the first marked row wins
    const p = project("twice");
    write(p, REG, "# Design System\n\n## Components\n\n" + HEAD + "| Table | src/Table.tsx | dense | the old list |\n| DataGrid | src/DataGrid.tsx |  |  |\n| Dialog | src/Dialog.tsx |  |  |\n" +
      "| Plain | src/Plain.tsx |  |  |\n| Long | src/Long.tsx |  | " + "n".repeat(190) + " |\n| Both | src/Both.tsx |  | _Deprecated: use DataGrid_ |\n\n## Deprecated\n\n" + HEAD +
      "| Table | src/Table.tsx |  | _Deprecated: use DataGrid_ |\n| Plain | src/Plain.tsx |  | _Deprecated_ |\n| Long | src/Long.tsx |  | _Deprecated: use DataGrid_ |\n| Both | src/Both.tsx |  | _Deprecated: use Dialog_ |\n");
    const reg = E.designSystemRegistry(path.join(p, ".specs"));
    const dep = depOf(reg);
    all("1.37.0 review 1: a name listed twice is deprecated by its later row's marker — the replacement read from that row, the marker shown first in the entry's notes (bounded, no empty part); a name already marked keeps its first marker (got " +
      js({ dep: [...dep], notes: reg.components.map((c) => [c.name, c.notes]) }) + ")", {
      twice: () => dep.get("table") === "DataGrid" && dep.get("plain") === "",
      twiceNotes: () => comp(reg, "Table").notes === "_Deprecated: use DataGrid_ · the old list" && comp(reg, "Plain").notes === "_Deprecated_",
      twiceBound: () => comp(reg, "Long").notes === ("_Deprecated: use DataGrid_ · " + "n".repeat(190)).slice(0, 200),
      twiceFirstWins: () => dep.get("both") === "DataGrid" && comp(reg, "Both").notes === "_Deprecated: use DataGrid_",
    });
  }
  {
    // past the 500 rows read in full: a row there is NOT marked (1.37.0 review 1 — doctor and the brief read the same rows), nor by a
    // later row of its name; a later row of a name read in full is; a replacement listed past them is still found (a listed name)
    const rows = Array.from({ length: 520 }, (_, i) => "| C" + i + " | src/c" + i + ".tsx |  | " + (i === 0 ? "_Deprecated: use C510_" : i === 519 ? "_Deprecated_" : "") + " |");
    const big = registryOf("past-cap", rows.concat(["| C1 | src/c1.tsx |  | _Deprecated: use C2_ |", "| C510 | src/c510.tsx |  | _Deprecated_ |"]));
    // `Data` AND `DataGrid` listed: `use Data Grid` names DataGrid (two words before one)
    const both = registryOf("pair-first", ["| Data | src/Data.tsx |  |  |", "| DataGrid | src/DataGrid.tsx |  |  |", "| Table | src/Table.tsx |  | _Deprecated: use Data Grid_ |"]);
    // the text the notes show is bounded (120 characters from the label's word, as written — `: ` counts —, the blank its cut ends
    // on dropped) — a replacement is looked for in all of it, among its first 20 words
    const longText = "use the grid " + "x".repeat(104) + " DataGrid then " + "y".repeat(160);
    const words = (n) => Array.from({ length: n }, (_, i) => "w" + i).join(" ");
    const shown = registryOf("shown", ["| DataGrid | src/DataGrid.tsx |  |  |", "| Long | src/Long.tsx |  | _Deprecated: " + longText + "_ |",
      "| Busy | src/Busy.tsx | _Deprecated: use DataGrid_ | " + "n".repeat(190) + " |",
      "| Far | src/Far.tsx |  | _Deprecated: " + words(20) + " DataGrid_ |", "| Near | src/Near.tsx |  | _Deprecated: " + words(19) + " DataGrid_ |"]);
    const none = registryOf("none", ["| Button | src/Button.tsx |  | every action |"]);
    all("1.37 registry: a deprecated row past the 500 read in full is not marked (1.37.0 review 1), by none of its rows, while a later row of a name read in full marks it, and a replacement listed past them is still found; two adjacent words are asked before one; the notes show the marker's first 120 characters, closed, BEFORE the other notes (their 200-character bound never cuts it), while its replacement is looked for among the first 20 words of all of it; a registry with no marker has an empty map (got " +
      js({ big: [depOf(big).get("c0"), depOf(big).get("c1"), depOf(big).get("c510"), depOf(big).get("c519"), big.components.length], both: [...depOf(both)], shown: [...depOf(shown)], notes: shown.components.map((c) => c.notes), none: none.deprecated && none.deprecated.size }) + ")", {
      pastCap: () => big.components.length === 500 && !big.deprecated.has("c519") && big.deprecated.size === 2,
      twicePastCap: () => big.deprecated.get("c1") === "C2" && !big.deprecated.has("c510"),
      pastCapReplacement: () => big.deprecated.get("c0") === "C510",
      pairFirst: () => both.deprecated.get("table") === "Data Grid",
      shown: () => comp(shown, "Long").notes === "_Deprecated: " + longText.slice(0, 117) + "_",
      shownSearch: () => shown.deprecated.get("long") === "DataGrid",
      first: () => comp(shown, "Busy").notes === ("_Deprecated: use DataGrid_ · " + "n".repeat(190)).slice(0, 200) && comp(shown, "Busy").variants === "",
      wordBound: () => shown.deprecated.get("far") === "" && shown.deprecated.get("near") === "DataGrid",
      none: () => none.deprecated instanceof Map && none.deprecated.size === 0,
    });
  }
  {
    // the brief quotes the registry row with its marker whole (dsCell drops a closing `_`: the notes carry it as one text)
    const p = project("brief");
    write(p, REG, "# Design System\n\n" + HEAD + "| Table | src/components/Table.tsx | dense | old grid _Deprecated: use DataGrid_ |\n| DataGrid | src/components/DataGrid.tsx |  |  |\n");
    const f = S.createFeature(p, { name: "Orders", tracks: ["ui"], summary: "x" });
    fs.writeFileSync(path.join(f.dir, "design.md"), "# Design: Orders\n\n## [UI] Design System Usage\nThe page uses the system.\n\n| Kind | Component | Why / notes |\n|---|---|---|\n| Reuse | Table | the orders list |\n");
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Build the orders page\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/orders/Orders.tsx_\n  - _Verify: npm test_\n");
    const b = S.taskBrief(p, f.slug, 1);
    const part = b.brief.slice(b.brief.indexOf("## Design system"), b.brief.indexOf("## Verification"));
    all("1.37 brief: a task building a view that reuses a deprecated component reads the registry row with its `_Deprecated: use X_` marker whole, first among its notes (got " + js(part) + ")", {
      brief: () => part.includes("- **Table** (reuse) — `src/components/Table.tsx` · variants: dense · _Deprecated: use DataGrid_ · old grid · the orders list"),
    });
  }

  // --- doctor's ui-deprecated ----------------------------------------------------------------------------------------------------
  const i18n = require(path.join(__dirname, "lib", "i18n.js"));
  const REQ = "# Feature: Orders\n\n## Summary\nList the orders.\n\n## User Stories\n### US-1 (P1): See my orders\nAs a buyer I want to see my orders.\n**Independent Test:** open the list.\n\n" +
    "#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN the buyer opens the orders page THE SYSTEM SHALL list the orders.\n" +
    "2. **US-1.AC-2** — IF the list fails to load THEN THE SYSTEM SHALL show an error message with a Retry action.\n\n## Success Criteria\n- **SC-001** — 95% of lists load in under 2 s.\n\n" +
    "## Edge Cases & Error Handling\n- **EC-1** — WHEN there is no order THE SYSTEM SHALL show the empty state.\n\n## Non-Functional Requirements\n- **NFR-1** — p95 < 2 s.\n\n## Out of Scope\n- Refunds.\n";
  const TABLE = { en: "| Kind | Component | Why / notes |\n|---|---|---|\n", pt: "| Tipo | Componente | Porquê / notas |\n|---|---|---|\n", es: "| Tipo | Componente | Por qué / notas |\n|---|---|---|\n" };
  const UI_NAMES = { en: ["Design System Usage", "UI States", "Accessibility", "Responsiveness & i18n", "UI Performance Budget"],
    pt: ["Uso do Design System", "Estados da Interface", "Acessibilidade", "Design Responsivo e i18n", "Orçamento de Desempenho da Interface"],
    es: ["Uso del Design System", "Estados de la Interfaz", "Accesibilidad", "Diseño Adaptable e i18n", "Presupuesto de Rendimiento de la Interfaz"] };
  // a complete design whose Design System Usage holds `rows` (the 1.35 tests' own shape)
  const design = (rows, lang) => {
    const n = UI_NAMES[lang || "en"];
    return "# Design: Orders\n\n## Overview\nOne page.\n\n## Architecture\n```mermaid\ngraph TD\n  P[Page] --> A[API]\n```\n\n" +
      "## Reuse & Integration\n| Kind | What | Where (path) | Why / notes |\n|---|---|---|---|\n| Reuse | the orders store | `src/orders/store.ts` | it holds the orders |\n\n" +
      "## Alternatives & Trade-offs\n| Decision | Option | Pros | Cons | Cost if wrong | Chosen |\n|---|---|---|---|---|---|\n| Layout | One page | Simple | Long | A redesign | ✓ |\n| Layout | Tabs | Short | More clicks | Drop-off | ✗ |\n\n" +
      "## Data Models\nOrder {id, total}.\n\n## Error Handling\nSee the IF…THEN criteria.\n\n## Testing Strategy\nComponent tests.\n\n## Risks\n- A slow API — medium — a timeout and a Retry.\n\n" +
      "## Constitution Check\n- [x] Small components — complies.\n\n## Complexity Tracking\nNone.\n\n" +
      "## [UI] " + n[0] + "\nThe page is built from the system.\n\n" + TABLE[lang || "en"] + rows.join("\n") + "\n\n" +
      "## [UI] " + n[1] + "\nLoading: a skeleton. Error: a message with Retry. Reference: design/orders.png.\n\n## [UI] " + n[2] + "\nWCAG 2.2 AA; axe in the component tests.\n\n" +
      "## [UI] " + n[3] + "\nBreakpoints 360 / 768 / 1280.\n\n## [UI] " + n[4] + "\nLCP under 2.5 s.\n";
  };
  const DREG = "# Design System\n\n" + HEAD + "| Table | src/components/Table.tsx | dense | old grid _Deprecated: use DataGrid_ |\n| DataGrid | src/components/DataGrid.tsx |  |  |\n" +
    "| Grid | src/components/Grid.tsx |  | _Deprecated_ |\n| DatePicker | src/components/DatePicker.tsx |  | _Deprecated: use DataGrid_ |\n| Button | src/components/Button.tsx |  |  |\n";
  const PLAIN = "# Design System\n\n" + HEAD + "| Table | src/components/Table.tsx | dense |  |\n| DataGrid | src/components/DataGrid.tsx |  |  |\n| Button | src/components/Button.tsx |  |  |\n";
  const mk = (tag, o = {}) => {
    const p = project("doc-" + tag, o.lang);
    if (o.registry != null) write(p, REG, o.registry);
    const f = S.createFeature(p, { name: "Orders", tracks: o.tracks || ["ui"], summary: "x", ...(o.size ? { size: o.size } : {}), ...(o.lang ? { lang: o.lang } : {}) });
    fs.writeFileSync(path.join(f.dir, "requirements.md"), REQ);
    approveBefore(p, f.slug, "design");
    if (o.rows) fs.writeFileSync(path.join(f.dir, "design.md"), design(o.rows, o.lang));
    return { p, slug: f.slug, dir: f.dir };
  };
  const checkOf = (g, id) => (S.specDoctor(g.p, g.slug).checks || []).find((c) => c.id === (id || "ui-deprecated")) || null;
  const Q = (lang) => i18n.msg(lang || "en").quality;
  {
    const st = {};
    const one = (tag, rows) => { const g = mk(tag, { registry: DREG, rows }); st[tag] = checkOf(g); return g; };
    one("reuse", ["| Reuse | Table | the orders list |", "| Reuse | Button | the actions |"]);
    one("extend", ["| Extend | Table | a compact variant |"]);
    const news = one("news", ["| New | Table | ours |"]);
    one("silenced", ["| Reuse | Table | DataGrid lacks grouping, which this list needs |"]);
    one("silencedPair", ["| Reuse | Table | the Data Grid lacks grouping |"]);
    // (the notes are read whole: the replacement named past their twentieth word still silences — the marker's bound is not theirs)
    one("silencedLong", ["| Reuse | Table | we keep the old table on this one page for now because the export button and its print layout are not ready elsewhere and DataGrid lacks both |"]);
    one("noReplacement", ["| Reuse | Grid | DataGrid lacks x |"]);
    one("key", ["| Reuse | Date Picker | the range |"]);
    one("dedup", ["| Reuse | Table | the list |", "| Extend | Table | dense rows |"]);
    one("dedupAfterSilence", ["| Reuse | Table | DataGrid lacks grouping |", "| Extend | Table | dense rows |"]);
    one("clean", ["| Reuse | DataGrid | the list |", "| Reuse | Button | the actions |"]);
    const newsDs = checkOf(news, "ui-design-system");
    const E1 = () => Q().dsDeprecated(1, Q().dsDeprecatedItem("Table", "DataGrid")); // (lazy: the parent has no such key)
    all("1.37 doctor ui-deprecated: a Reuse or an Extend row naming a component the registry marks `_Deprecated:_` WARNS, naming its replacement (a component marked with no replacement: its name alone) — once per component, by its key (`Date Picker` is DatePicker); the row's notes naming the replacement (a word or two adjacent ones) silence it, and a silenced row hides no later one; a New row is not asked (ui-design-system says it is listed); rows on no deprecated component pass (got " +
      js({ st, newsDs }) + ")", {
      reuse: () => st.reuse.status === "warn" && st.reuse.detail === E1(),
      extend: () => st.extend.status === "warn" && st.extend.detail === E1(),
      news: () => st.news.status === "pass" && st.news.detail === Q().dsDeprecatedNone && newsDs.status === "warn" && /already lists Table/.test(newsDs.detail),
      silenced: () => st.silenced.status === "pass",
      silencedPair: () => st.silencedPair.status === "pass",
      silencedLong: () => st.silencedLong.status === "pass",
      noReplacement: () => st.noReplacement.status === "warn" && st.noReplacement.detail === Q().dsDeprecated(1, "'Grid'"),
      key: () => st.key.status === "warn" && st.key.detail === Q().dsDeprecated(1, Q().dsDeprecatedItem("Date Picker", "DataGrid")),
      dedup: () => st.dedup.detail === E1(),
      dedupAfterSilence: () => st.dedupAfterSilence.status === "warn" && st.dedupAfterSilence.detail === E1(),
      clean: () => st.clean.status === "pass" && st.clean.detail === Q().dsDeprecatedNone,
      shape: () => js(Object.keys(st.reuse)) === js(["id", "status", "detail"]),
    });
  }
  {
    // 1.37.0 review 1 (RB-1): the notes name the replacement only AS A COMPONENT — in the letter case the registry writes its name
    // (its row's; the marker's for a name past the rows read in full), in prose, a code span or a tag; a common word does not
    const MREG = "# Design System\n\n" + HEAD + "| Modal | src/components/Modal.tsx |  | _Deprecated: use Dialog_ |\n| Dialog | src/components/Dialog.tsx |  |  |\n" +
      "| Table | src/components/Table.tsx |  | _Deprecated: use DataGrid_ |\n| DataGrid | src/components/DataGrid.tsx |  |  |\n| Sheet | src/components/Sheet.tsx |  | _Deprecated: use datagrid_ |\n";
    const st = {};
    const one = (tag, rows, registry) => { st[tag] = checkOf(mk("as-" + tag, { registry: registry || MREG, rows })); };
    one("prose", ["| Reuse | Modal | the delete-confirmation dialog |"]);
    one("prosePair", ["| Reuse | Table | the users' data grid |"]);
    one("word", ["| Reuse | Modal | Dialog lacks a sheet variant |"]);
    one("code", ["| Reuse | Modal | uses `Dialog` for the rest |"]);
    one("tag", ["| Reuse | Modal | <Dialog /> lacks a sheet |"]);
    one("registryCase", ["| Reuse | Sheet | DataGrid lacks grouping |"]);
    one("markerCase", ["| Reuse | Sheet | the datagrid lacks grouping |"]);
    // a replacement listed past the 500 rows read in full: named as the marker writes it
    const big = "# Design System\n\n" + HEAD + "| Table | src/components/Table.tsx |  | _Deprecated: use Z9_ |\n" +
      Array.from({ length: 499 }, (_, i) => "| C" + i + " | src/c" + i + ".tsx |  |  |").join("\n") + "\n| Z9 | src/z9.tsx |  |  |\n";
    one("pastCapName", ["| Reuse | Table | Z9 lacks the export |"], big);
    one("pastCapWarn", ["| Reuse | Table | the export |"], big);
    // 1.37.0 review 2 (R2-3): the letters compared in one Unicode form (NFC) — an accent written as a combining mark, in the notes or
    // in the registry's name, is the precomposed one; accents are still kept (an unaccented word warns)
    const NFD = "Dia" + String.fromCharCode(0x301) + "logo", NFC = NFD.normalize("NFC");
    const AREG = (name) => "# Design System\n\n" + HEAD + "| " + name + " | src/components/Dialogo.tsx |  |  |\n| Modal | src/components/Modal.tsx |  | _Deprecated: use " + name + "_ |\n";
    one("nfdNotes", ["| Reuse | Modal | kept: the " + NFD + " lacks a sheet |"], AREG(NFC));
    one("nfdName", ["| Reuse | Modal | kept: the " + NFC + " lacks a sheet |"], AREG(NFD));
    one("unaccented", ["| Reuse | Modal | kept: the Dialogo lacks a sheet |"], AREG(NFC));
    const W = (name, use) => Q().dsDeprecated(1, Q().dsDeprecatedItem(name, use));
    all("1.37.0 review 1: ui-deprecated is silenced only when the row's notes name the replacement as a component — in the registry's letter case (its row's name; the marker's spelling for a name past the rows read in full), a word, a code span or a tag; the same word in prose (`dialog`, `data grid`, `datagrid`) warns; review 2: the warn prints the replacement in that spelling — the one that silences it — and the letters compare in NFC (got " + js(st) + ")", {
      prose: () => st.prose.status === "warn" && st.prose.detail === W("Modal", "Dialog"),
      prosePair: () => st.prosePair.status === "warn" && st.prosePair.detail === W("Table", "DataGrid"),
      word: () => st.word.status === "pass",
      code: () => st.code.status === "pass",
      tag: () => st.tag.status === "pass",
      registryCase: () => st.registryCase.status === "pass",
      markerCase: () => st.markerCase.status === "warn" && st.markerCase.detail === W("Sheet", "DataGrid"),
      pastCapName: () => st.pastCapName.status === "pass",
      pastCapWarn: () => st.pastCapWarn.status === "warn" && st.pastCapWarn.detail === W("Table", "Z9"),
      nfdNotes: () => st.nfdNotes.status === "pass",
      nfdName: () => st.nfdName.status === "pass",
      unaccented: () => st.unaccented.status === "warn" && st.unaccented.detail === W("Modal", NFC),
    });
  }
  {
    // more than six: the first six named, the rest counted
    const seven = "# Design System\n\n" + HEAD + Array.from({ length: 7 }, (_, i) => "| Old" + i + " | src/Old" + i + ".tsx |  | _Deprecated_ |").join("\n") + "\n";
    const many = checkOf(mk("many", { registry: seven, rows: Array.from({ length: 7 }, (_, i) => "| Reuse | Old" + i + " | a part |") }));
    // who is never asked: a registry with no marker, no registry at all, a feature without +ui
    const noMarker = mk("no-marker", { registry: PLAIN, rows: ["| Reuse | Table | the list |"] });
    const noReg = mk("no-registry", { rows: ["| Reuse | Table | the list |"] });
    const noRegDoc = S.specDoctor(noReg.p, noReg.slug);
    const core = mk("core", { registry: DREG, tracks: ["core"] });
    fs.writeFileSync(path.join(core.dir, "design.md"), design(["| Reuse | Table | the list |"]));
    // PT / ES / pt-BR: the feature's language
    const loc = {};
    for (const [l, kind] of [["pt", "Reutilizar"], ["es", "Reutilizar"], ["pt-BR", "Reutilizar"]]) {
      const base = l === "pt-BR" ? "pt" : l;
      const g = mk("lang-" + l, { registry: DREG, lang: l });
      fs.writeFileSync(path.join(g.dir, "design.md"), design(["| " + kind + " | Table | a lista |"], base));
      loc[l] = checkOf(g);
    }
    all("1.37 doctor ui-deprecated: past six components the rest is counted; never run for a registry with no `_Deprecated:_` row, a project with no registry (doctor still answers) or a feature without +ui; the detail is in the feature's language (got " +
      js({ many, noMarker: checkOf(noMarker), noReg: [noRegDoc.ok, (noRegDoc.checks || []).map((c) => c.id).filter((id) => /^ui-/.test(id))], core: checkOf(core), loc }) + ")", {
      bound: () => many.status === "warn" && many.detail === Q().dsDeprecated(7, Array.from({ length: 6 }, (_, i) => "'Old" + i + "'").concat(Q().xacMore(1)).join("; ")),
      noMarker: () => checkOf(noMarker) === null,
      noRegistry: () => noRegDoc.ok === true && !(noRegDoc.checks || []).some((c) => c.id === "ui-deprecated") && (noRegDoc.checks || []).some((c) => c.id === "ui-design-system"),
      core: () => checkOf(core) === null,
      langs: () => ["pt", "es", "pt-BR"].every((l) => loc[l] && loc[l].status === "warn" && loc[l].detail === Q(l).dsDeprecated(1, Q(l).dsDeprecatedItem("Table", "DataGrid"))) &&
        loc.pt.detail !== loc["pt-BR"].detail && loc.es.detail !== Q().dsDeprecated(1, Q().dsDeprecatedItem("Table", "DataGrid")),
    });
  }
  {
    // never a fail and never an approval check: a size l design reusing a deprecated component is approved, doctor warns — over MCP too
    const g = mk("size-l", { registry: DREG, size: "l", rows: ["| Reuse | Table | the orders list |", "| Reuse | Button | the actions |"] });
    const before = checkOf(g);
    const ap = S.approvePhase(g.p, g.slug, "design", "t");
    const after = checkOf(g);
    const viaMcp = ((payload(await rpc("tools/call", { name: "spec_doctor", arguments: { projectDir: g.p, name: g.slug } })).checks) || []).find((c) => c.id === "ui-deprecated");
    // spec_upgrade lists it among the feature's warnings (attention `warnings` — the default: it is no design-writing warn)
    const upF = (S.specUpgrade(g.p).features || []).find((x) => x.name === g.slug) || {};
    all("1.37 doctor ui-deprecated: a WARN at size l too — the design approval goes through (no gate, no failing id), doctor still warns (MCP spec_doctor: {id, status, detail}); spec_upgrade lists it among the feature's warnings (attention `warnings`) (got " +
      js({ before, ap: [ap.ok, ap.failing], after, viaMcp, up: [upF.doctor, upF.attention] }) + ")", {
      neverGated: () => before.status === "warn" && ap.ok === true && !(ap.failing || []).length && after.status === "warn",
      mcp: () => js(viaMcp) === js(after),
      upgrade: () => upF.doctor.warnings.includes("ui-deprecated") && upF.attention.includes("warnings"),
    });
  }
  {
    // a finished feature is never asked: a READY written finish, then the team deprecates a component its design reused
    const p = project("doc-finished");
    write(p, REG, PLAIN);
    const f = S.createFeature(p, { name: "Price Tag", tracks: ["ui"], summary: "Show a price", size: "s" });
    fs.writeFileSync(path.join(f.dir, "requirements.md"), REQ.replace("# Feature: Orders", "# Feature: Price Tag"));
    fs.writeFileSync(path.join(f.dir, "design.md"), "# Design: Price Tag\n\n## Overview\nA price with its currency.\n\n## Architecture\n```mermaid\ngraph TD\n  P[PriceTag] --> F[format]\n```\n\n" +
      "## Decisions, reuse & risks\nReuses the money formatter (`src/lib/money.ts`); one component rather than a helper, so the markup is shared; no material risk: it only renders.\n\n" +
      "## Error Handling\nSee the IF…THEN criteria.\n\n## Constitution Check\n- [x] Small components — complies.\n\n## Complexity Tracking\nNone.\n\n" +
      "## [UI] Design System Usage\nBuilt from the system.\n\n" + TABLE.en + "| Reuse | Table | the price list |\n\n" +
      "## [UI] UI States\nLoading: a skeleton. Error: a message with Retry. Reference: design/price.png.\n\n## [UI] Accessibility\nWCAG 2.2 AA; axe in the component tests.\n");
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Build the price tag\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n  - _Implements: src/components/PriceTag.tsx_\n  - _Verify: npm test_\n");
    write(p, "src/components/PriceTag.tsx", "export const PriceTag = () => null;\n");
    const approvals = ["requirements", "design", "tasks"].map((ph) => { const a = S.approvePhase(p, f.slug, ph, "t"); return a.ok ? true : (a.failing || a.error); });
    S.completeTask(p, f.slug, 1, { command: "npm test", exitCode: 0, summary: "42/42 passing" });
    write(p, REG, DREG);
    const open = checkOf({ p, slug: f.slug });
    const fin = S.finishFeature(p, f.slug, { write: true });
    const done = checkOf({ p, slug: f.slug });
    all("1.37 doctor ui-deprecated: never on a finished feature — the same design warns before its written finish and is not asked after it (got " +
      js({ approvals, open, fin: [fin.readyToFinish, fin.blockers], done }) + ")", {
      before: () => approvals.every((a) => a === true) && open && open.status === "warn",
      finished: () => fin.readyToFinish === true && done === null,
    });
  }

  // --- linear on hostile cells ----------------------------------------------------------------------------------------------------
  {
    // 1,000 rows whose marker never closes on a `_` that ends it (`_a` after `_a`, every one a candidate) against 1,000 with a plain
    // marker of the same length, read at the same moment
    const rows = (note) => Array.from({ length: 1000 }, (_, i) => "| C" + i + " | src/c" + i + ".tsx |  | " + note + " |");
    const hostile = project("hostile"), calm = project("calm");
    write(hostile, REG, "# DS\n\n" + HEAD + rows("_Deprecated: " + "_a".repeat(190)).join("\n") + "\n");
    write(calm, REG, "# DS\n\n" + HEAD + rows("_Deprecated: use DataGrid " + "word ".repeat(73) + "_").join("\n") + "\n");
    const read = (p) => E.designSystemRegistry(path.join(p, ".specs"));
    const linear = (s) => s.ms < 3 * s.calm + 300;
    const t = remeasure(() => { const t0 = Date.now(); const h = read(hostile); const t1 = Date.now(); const c = read(calm); return { ms: t1 - t0, calm: Date.now() - t1, h: depOf(h).size, c: depOf(c).size }; }, linear);
    all("1.37 registry: the marker is read in linear time — 1,000 cells of `_Deprecated: ` and 190 `_a` (each `_` a closing candidate; the 500 read in full are marked) within 3× + 0.3 s of 1,000 plain markers of the same length read at the same moment (got " + js(t) + ")", {
      linear: () => linear(t),
      read: () => t.h === 500 && t.c === 500,
    });
  }

  // --- 1.39: the files that still import a deprecated component — the project report's `deprecatedUses` --------------------------
  // (each fixture answers a mutant of the list written before the code: a row named by its file is its MODULE — any import of
  // the file —, a component a file exports beside its own counts by its NAME; settle's follow, a second instance of it)
  const L = (lines) => lines.join("\n") + "\n";
  const depProject = (tag, rows, files, lang) => {
    const p = project("uses-" + tag, lang);
    write(p, REG, "# Design System\n\n" + HEAD + rows.join("\n") + "\n");
    for (const [rel, text] of Object.entries(files)) write(p, rel, text);
    return p;
  };
  const usesOf = (r) => r.deprecatedUses || { rows: [], unlocated: [], limits: [] };
  const rowOf = (r, name) => usesOf(r).rows.find((x) => x.name === name) || { files: [], paths: [] };
  const uses = (r, name) => [rowOf(r, name).filesTotal, rowOf(r, name).files];
  const KIT = "src/components/ui/";
  const compFile = (name, more) => L(["export function " + name + "() { return <div />; }"].concat(more || []));
  const kitFiles = {
    "package.json": js({ name: "kit", dependencies: { react: "^19" } }),
    "tsconfig.json": js({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"] } } }),
    [KIT + "table.tsx"]: compFile("Table", ["export function TableRow() { return <tr />; }", "export const tableVariants = 1;"]),
    [KIT + "data-grid.tsx"]: compFile("DataGrid"),
    [KIT + "card.tsx"]: compFile("Card", ["export function CardHeader() { return <div />; }", "export function CardFooter() { return <div />; }"]),
    [KIT + "sonner.tsx"]: L(["export function Toaster() { return <div />; }", "export const toast = (m) => m;"]),
    [KIT + "index.ts"]: L(["export * from \"./sonner\";", "export * from \"./menu\";"]),
    [KIT + "toast.tsx"]: compFile("Toast"), [KIT + "chart.tsx"]: L(["export function ChartContainer() { return <div />; }"]),
    [KIT + "avatar.tsx"]: compFile("Avatar"), [KIT + "panel.tsx"]: L(["export default function Panel() { return <div />; }"]),
    [KIT + "field.tsx"]: compFile("Field", ["export type FieldProps = { name: string };"]), [KIT + "chip.tsx"]: compFile("Chip"), [KIT + "drawer.tsx"]: compFile("Drawer"),
    [KIT + "menu.tsx"]: compFile("Menu"), [KIT + "button.tsx"]: compFile("Button"),
    // (a folder's index file is a module named by its folder: `@/components/ui/select` is select/index.tsx)
    [KIT + "select/index.tsx"]: compFile("Select", ["export const selectVariants = 1;"]),
    "src/app/users/select.tsx": L(["import { selectVariants } from \"@/components/ui/select\";", "export const v = selectVariants;"]),
    // (a file importing its own deprecated part: never its own importer)
    [KIT + "tree.tsx"]: L(["import { TreeNode } from \"./tree\";", "export function Tree() { return <TreeNode />; }", "export function TreeNode() { return <li />; }"]),
    "src/components/callout.tsx": compFile("Callout"),
    // (a component file — read for what it exports — is an importer too, whatever settle asks)
    "src/components/badge.tsx": compFile("Badge"),
    "src/components/badge-list.tsx": L(["import { Badge } from \"@/components/badge\";", "export function BadgeList() { return <Badge />; }"]),
    // (a non-component export of a namesake file: the module check alone sees it, whichever namesake the walk met first)
    "src/app/users/variants.tsx": L(["import { tableVariants } from \"@/components/ui/table\";", "export const v = tableVariants;"]),
    "src/app/users/named.tsx": L(["import { Table, TableRow } from \"@/components/ui/table\";", "export const P = () => <Table><TableRow /></Table>;"]),
    "src/app/users/both.tsx": L(["import { Table } from \"@/components/ui/table\";", "import * as K from \"@/components/ui/table\";", "export const P = () => <Table><K.TableRow /></Table>;"]),
    "src/app/users/renamed.tsx": L(["import { Avatar as A } from \"../../components/ui/avatar\";", "export const P = () => <A />;"]),
    "src/app/users/renamed-folder.tsx": L(["import { Avatar as Av } from \"@/components/ui\";", "export const P = () => <Av />;"]),
    "src/app/users/default.tsx": L(["import Box from \"@/components/ui/panel\";", "export const P = () => <Box />;"]),
    // (the module written with its .js extension, NodeNext's way: the base the prefilter asks is the path's, its extension dropped)
    "src/app/users/default-js.tsx": L(["import Pane from \"@/components/ui/panel.js\";", "export const P = () => <Pane />;"]),
    "src/app/users/types.tsx": L(["import type { FieldProps } from \"@/components/ui/field\";", "export const p = (x: FieldProps) => x.name;"]),
    "src/app/users/require.js": L(["const { Chip } = require(\"../../components/ui/chip\");", "module.exports = () => Chip;"]),
    "src/app/users/dynamic.tsx": L(["import { lazy } from \"react\";", "const D = lazy(() => import(\"@/components/ui/drawer\"));", "export const P = () => <D />;"]),
    "src/app/users/namespace.tsx": L(["import * as UI from \"@/components/ui\";", "export const P = () => <UI.Menu />;"]),
    "src/app/users/ns-part.tsx": L(["import * as UI2 from \"@/components/ui\";", "export const P = () => <UI2.Menu.Item />;"]),
    "src/app/users/ns-button.tsx": L(["import * as UI from \"@/components/ui\";", "export const P = () => <UI.Button />;"]),
    "src/app/users/header.tsx": L(["import { CardHeader } from \"@/components/ui/card\";", "export const P = () => <CardHeader />;"]),
    "src/app/users/footer.tsx": L(["import { CardFooter } from \"@/components/ui/card\";", "export const P = () => <CardFooter />;"]),
    "src/app/users/card-only.tsx": L(["import { Card } from \"@/components/ui/card\";", "export const P = () => <Card />;"]),
    "src/app/users/toast-fn.tsx": L(["import { toast } from \"@/components/ui/sonner\";", "export const P = () => toast(1);"]),
    "src/app/users/folder.tsx": L(["import { Toaster } from \"@/components/ui\";", "export const P = () => <Toaster />;"]),
    "src/app/users/chart.tsx": L(["import { ChartContainer } from \"@/components/ui/chart\";", "export const P = () => <ChartContainer />;"]),
    "src/app/users/table.test.tsx": L(["import { Table } from \"@/components/ui/table\";", "test(\"t\", () => <Table />);"]),
    "src/app/users/table.stories.tsx": L(["import { Table } from \"@/components/ui/table\";", "export default { component: Table };"]),
    "src/__mocks__/table.tsx": L(["import { Table } from \"@/components/ui/table\";", "export const X = () => <Table />;"]),
    "src/app/local.tsx": L(["function Table() { return null; }", "export const P = () => <Table />;"]),
    // a namesake: another folder's table.tsx (exporting BillingTable) is a Table file too — its importers count (CRIT_1 s2)
    "src/billing/components/table.tsx": L(["export function BillingTable() { return <table />; }"]),
    "src/billing/page.tsx": L(["import { BillingTable } from \"./components/table\";", "export const P = () => <BillingTable />;"]),
    "docs/guide.mdx": L(["# Guide", "", "<Callout>hi</Callout>"]),
    "docs/parts.mdx": L(["The CardHeader is retired: use the part.", "", "<Card.Header />"]), // (a part's tag is no unbound CardHeader: a tag with a dot is never one)
    "docs/zz.mdx": L(["<Callout />"]), // (read before guide.mdx — the shorter path —, never named before it: the first by path)
    "docs/bound.mdx": L(["import { Callout } from \"../src/components/callout\";", "", "<Callout>hi</Callout>"]),
  };
  const KIT_ROWS = (mark) => ["| Table | src/components/ui/table.tsx |  | " + mark("use data-grid") + " |", "| DataGrid | src/components/ui/data-grid.tsx |  |  |",
    "| Card | src/components/ui/card.tsx |  |  |", "| CardHeader | src/components/ui/card.tsx |  | " + mark("use Card") + " |", "| Sonner | src/components/ui/sonner.tsx |  | " + mark() + " |",
    "| Toast | src/components/ui/toast.tsx |  | " + mark("use Sonner") + " |", "| Modal |  |  | " + mark() + " |", "| Chart | src/components/ui/chart.tsx |  | " + mark() + " |",
    "| Callout | src/components/callout.tsx |  | " + mark() + " |", "| Avatar | src/components/ui/avatar.tsx |  | " + mark() + " |", "| Panel | src/components/ui/panel.tsx |  | " + mark() + " |",
    "| Field | src/components/ui/field.tsx |  | " + mark() + " |", "| Chip | src/components/ui/chip.tsx |  | " + mark() + " |", "| Drawer | src/components/ui/drawer.tsx |  | " + mark() + " |",
    "| Menu | src/components/ui/menu.tsx |  | " + mark() + " |", "| Badge | src/components/badge.tsx |  | " + mark() + " |", "| Button | src/components/ui/button.tsx |  |  |",
    "| Tree | src/components/ui/tree.tsx |  |  |", "| TreeNode | src/components/ui/tree.tsx |  | " + mark() + " |",
    "| Select | src/components/ui/select/index.tsx |  | " + mark() + " |", "| CardFooter | src/components/ui/card.tsx |  | " + mark() + " |"];
  const MARK = (use) => "_Deprecated" + (use ? ": " + use : "") + "_", NONE = () => "";
  // the report with the markers against the same report with none — every key but `deprecatedUses` byte-identical (settle's
  // verdicts are a scan's with no row: the watch is its own instance)
  const differential = (p, rows) => {
    write(p, REG, "# Design System\n\n" + HEAD + rows(NONE).join("\n") + "\n");
    const off = S.designSystemReport(p);
    write(p, REG, "# Design System\n\n" + HEAD + rows(MARK).join("\n") + "\n");
    const on = S.designSystemReport(p);
    const strip = (r) => { const o = Object.assign({}, r); delete o.deprecatedUses; delete o.registry; return js(o); };
    return { on, same: strip(off) === strip(on), off: "deprecatedUses" in off };
  };
  {
    const kit = depProject("kit", KIT_ROWS(MARK), kitFiles);
    const r = S.designSystemReport(kit), d = usesOf(r);
    const diff = differential(kit, KIT_ROWS);
    // the replacement is doctor's: a design reusing Table warns `'Table' (use DataGrid)` (ONE expression, dsReplacement)
    const g = mk("uses-doctor", { registry: "# Design System\n\n" + HEAD + KIT_ROWS(MARK).join("\n") + "\n", rows: ["| Reuse | Table | the list |"] });
    const doc = checkOf(g);
    all("1.39 deprecatedUses (a React kit, settle asking nothing): for each `_Deprecated:_` row the code holds a component file for — the rows still imported first, each group in the registry's order —, the files that still import it — its replacement as doctor names it; a row named by its file is its MODULE: a named, renamed, default (its local name is no watched name: the module's base), type-only or `require` import of the file, a non-component export of it (`toast`), a namespace member, the components it exports through a folder's barrel (`{ Toaster }`), every namesake's importers (`billing/components/table.tsx`); a component a file exports beside its own counts by its NAME (`CardHeader`, never `{ Card }`); one count a file; a component file read for its exports is an importer too; never a dynamic import(), a test, a story, a mock, a folder import of another member, a file's own local `<Table />`; an .mdx tag no import binds counted apart; a located row with no importer listed with 0, an unlocated one named; never the report's limits or inSync; the same report with no marker holds every other key the same (got " +
      js({ rows: d.rows, unlocated: d.unlocated, read: d.read, limits: d.limits, same: diff.same, doc }) + ")", {
      order: () => js(d.rows.map((x) => x.name)) === js(["Table", "CardHeader", "Sonner", "Chart", "Callout", "Avatar", "Panel", "Field", "Chip", "Menu", "Badge", "Select", "CardFooter", "Toast", "Drawer", "TreeNode"]) && d.rowsTotal === 16,
      indexFolder: () => js(uses(r, "Select")) === js([1, ["src/app/users/select.tsx"]]),
      ownFile: () => js(uses(r, "TreeNode")) === js([0, []]) && js(rowOf(r, "TreeNode").paths) === js(["src/components/ui/tree.tsx"]),
      use: () => rowOf(r, "Table").use === "DataGrid" && rowOf(r, "CardHeader").use === "Card" && rowOf(r, "Toast").use === "" && doc && doc.detail === Q().dsDeprecated(1, Q().dsDeprecatedItem("Table", "DataGrid")),
      namesakes: () => js(rowOf(r, "Table").paths) === js(["src/billing/components/table.tsx", "src/components/ui/table.tsx"]) && rowOf(r, "Table").pathsTotal === 2,
      module: () => js(uses(r, "Table")) === js([4, ["src/app/users/both.tsx", "src/app/users/named.tsx", "src/app/users/variants.tsx"]]),
      renamed: () => js(uses(r, "Avatar")) === js([2, ["src/app/users/renamed-folder.tsx", "src/app/users/renamed.tsx"]]),
      defaultBase: () => js(uses(r, "Panel")) === js([2, ["src/app/users/default-js.tsx", "src/app/users/default.tsx"]]),
      typeOnly: () => js(uses(r, "Field")) === js([1, ["src/app/users/types.tsx"]]),
      require: () => js(uses(r, "Chip")) === js([1, ["src/app/users/require.js"]]),
      dynamic: () => js(uses(r, "Drawer")) === js([0, []]),
      namespace: () => js(uses(r, "Menu")) === js([2, ["src/app/users/namespace.tsx", "src/app/users/ns-part.tsx"]]),
      name: () => js(uses(r, "CardHeader")) === js([1, ["src/app/users/header.tsx"]]) && rowOf(r, "CardHeader").unbound === 0 && js(uses(r, "CardFooter")) === js([1, ["src/app/users/footer.tsx"]]),
      moduleExport: () => js(uses(r, "Sonner")) === js([2, ["src/app/users/folder.tsx", "src/app/users/toast-fn.tsx"]]),
      kitParts: () => js(uses(r, "Chart")) === js([1, ["src/app/users/chart.tsx"]]) && rowOf(r, "Chart").pathsTotal === 1,
      result: () => js(uses(r, "Badge")) === js([1, ["src/components/badge-list.tsx"]]),
      unbound: () => js(uses(r, "Callout")) === js([1, ["docs/bound.mdx"]]) && rowOf(r, "Callout").unbound === 2 && rowOf(r, "Callout").unboundAt === "docs/guide.mdx" && rowOf(r, "Table").unbound === 0 && !("unboundAt" in rowOf(r, "Table")),
      none: () => js(uses(r, "Toast")) === js([0, []]) && rowOf(r, "Toast").pathsTotal === 1,
      unlocated: () => js(d.unlocated) === js(["Modal"]) && d.unlocatedTotal === 1,
      // (in scope: the 19 component files, the 22 pages and the 4 .mdx — never the test, the story, the mock)
      read: () => d.read === 45 && js(d.limits) === js([]) && d.note === Q().dsDepUsesNote,
      report: () => js(r.limits) === js([]) && r.truncated === false,
      differential: () => diff.same === true && diff.off === false,
    });
  }
  {
    // five importers: the first three by path, all counted; past DS_LIST (50) located rows: 50 listed, every one counted; a row
    // with no marker is no row; the key only while a row is marked, never in a feature's report; never in inSync
    const many = {};
    for (let i = 0; i < 5; i++) many["src/app/p" + (4 - i) + "/page.tsx"] = L(["import { Table } from \"../../components/Table\";", "export const P = () => <Table />;"]);
    for (const d of ["B", "C", "D"]) many["src/components/" + d + "/Table.tsx"] = compFile("Table");
    const five = depProject("five", ["| Table | src/components/Table.tsx |  | _Deprecated_ |"], Object.assign({ "src/components/Table.tsx": compFile("Table") }, many));
    const r5 = S.designSystemReport(five);
    const big = {};
    for (let i = 0; i < 51; i++) big["src/components/C" + String(i).padStart(2, "0") + ".tsx"] = compFile("C" + String(i).padStart(2, "0"));
    // (review 1 of 1.39: the rows still imported first, the registry's order within each group — C50, past the cut in the
    // registry's order, imported twice; C10 once: [C10, C50, C00 …])
    big["src/app/a.tsx"] = L(["import { C50 } from \"../components/C50\";", "import { C10 } from \"../components/C10\";", "export const P = () => <><C50 /><C10 /></>;"]);
    big["src/app/b.tsx"] = L(["import { C50 } from \"../components/C50\";", "export const P = () => <C50 />;"]);
    const fifty = depProject("fifty", Array.from({ length: 51 }, (_, i) => "| C" + String(i).padStart(2, "0") + " | src/components/C" + String(i).padStart(2, "0") + ".tsx |  | _Deprecated_ |"), big);
    const r51 = usesOf(S.designSystemReport(fifty));
    const u51 = usesOf(S.designSystemReport(depProject("unlocated", Array.from({ length: 51 }, (_, i) => "| U" + String(i).padStart(2, "0") + " |  |  | _Deprecated_ |"), {})));
    // (no row located — the marked component is a library's: nothing to look for, nothing read for it)
    const idle = usesOf(S.designSystemReport(depProject("idle", ["| Modal |  |  | _Deprecated_ |"], { "src/components/Table.tsx": compFile("Table"),
      "src/app/page.tsx": L(["import { Table } from \"../components/Table\";", "export const P = () => <Table />;"]) })));
    const sync = depProject("sync", ["| Table | src/components/Table.tsx |  | _Deprecated_ |"], { "package.json": js({ name: "s" }), "src/components/Table.tsx": compFile("Table"),
      "src/app/page.tsx": L(["import { Table } from \"../components/Table\";", "export const P = () => <Table />;"]) });
    const rs = S.designSystemReport(sync);
    const plain = depProject("plain", ["| Table | src/components/Table.tsx |  |  |"], { "src/components/Table.tsx": compFile("Table") });
    const f = S.createFeature(sync, { name: "Orders", tracks: ["ui"], summary: "x" });
    const feat = S.designSystemReport(sync, { name: f.slug });
    all("1.39 deprecatedUses: a row lists its first 3 importers by path and counts them all; the rows still imported come first (the registry's order within each group), the rows past the first 50 are counted (`rowsTotal`); the key is there only while the registry marks a row (none with no marker, none in a feature's report); a used deprecated row never touches the report's `inSync` or `limits` (got " +
      js({ five: rowOf(r5, "Table"), fifty: [r51.rows.length, r51.rowsTotal], sync: [rs.inSync, rs.limits, rowOf(rs, "Table").filesTotal], plain: "deprecatedUses" in S.designSystemReport(plain), feat: "deprecatedUses" in feat }) + ")", {
      first3: () => js(uses(r5, "Table")) === js([5, ["src/app/p0/page.tsx", "src/app/p1/page.tsx", "src/app/p2/page.tsx"]]),
      paths3: () => js(rowOf(r5, "Table").paths) === js(["src/components/B/Table.tsx", "src/components/C/Table.tsx", "src/components/D/Table.tsx"]) && rowOf(r5, "Table").pathsTotal === 4,
      unlocated50: () => u51.unlocated.length === 50 && u51.unlocatedTotal === 51 && u51.unlocated[49] === "U49",
      idle: () => js([idle.rows, idle.unlocated, idle.read]) === js([[], ["Modal"], 0]),
      fifty: () => r51.rows.length === 50 && r51.rowsTotal === 51 && js(r51.rows.slice(0, 3).map((x) => [x.name, x.filesTotal])) === js([["C10", 1], ["C50", 2], ["C00", 0]]) && r51.rows[49].name === "C48" && !r51.rows.some((x) => x.name === "C49"),
      inSync: () => rs.inSync === true && js(rs.limits) === js([]) && rowOf(rs, "Table").filesTotal === 1,
      absent: () => !("deprecatedUses" in S.designSystemReport(plain)) && !("deprecatedUses" in feat),
    });
  }
  {
    // Vue, Svelte, Astro, a workspace package's barrels, an Angular row — settle asking a weak name (it reads `.ts` files then)
    const vue = {
      "package.json": js({ name: "app", private: true, workspaces: ["packages/*"], dependencies: { vue: "^3", react: "^19" } }),
      "jsconfig.json": js({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"], "$lib/*": ["./src/lib/*"] } } }),
      "src/components/Table.vue": L(["<template><table /></template>"]),
      "src/components/Pagination/index.vue": L(["<template><nav /></template>"]),
      "src/components/DataTable.vue": L(["<template><table /></template>"]),
      "src/components/Tree.vue": L(["<script>", "import Tree from './Tree.vue'", "export default { name: 'Tree', components: { Tree } }", "</script>", "<template><Tree /></template>"]),
      "src/components/Badge.svelte": L(["<span />"]),
      "src/components/Hero.astro": L(["---", "---", "<header />"]),
      "src/app/components/grid/grid.component.ts": L(["export class GridComponent {}"]),
      // (a weak name asked: settle reads the `.ts` files too — the watch's scope stays the same)
      "src/components/kit.tsx": L(["export const MotionBox = motion(Box);", "export const Shown = observer(() => <div />);"]),
      "src/main.ts": L(["import T from './components/Table.vue'", "app.component('Table', T)"]),
      // Vue CLI / webpack: an SFC imported with no extension, a folder's index.vue by its folder
      "src/views/list.vue": L(["<script>", "import Table from '@/components/Table'", "import Pagination from '@/components/Pagination'", "export default { components: { Table, Pagination } }", "</script>",
        "<template><Table /><pagination /></template>"]),
      "src/views/motion.vue": L(["<script setup>", "import { MotionBox } from '@/components/kit'", "</script>", "<template><MotionBox /></template>"]),
      "src/views/with-ext.vue": L(["<script setup>", "import Table from '@/components/Table.vue'", "</script>", "<template><Table /></template>"]),
      // (a platform infix, as an import names the module: `@/components/Chart.client` is Chart.client.vue)
      "src/components/Chart.client.vue": L(["<template><canvas /></template>"]),
      "src/views/chart.vue": L(["<script setup>", "import Chart from '@/components/Chart.client'", "</script>", "<template><Chart /></template>"]),
      "src/views/kebab.vue": L(["<template><data-table /></template>"]),
      "src/views/bound.vue": L(["<script setup>", "import DataTable from '../components/DataTable.vue'", "</script>", "<template><data-table /></template>"]),
      "src/views/s.svelte": L(["<script>", "  import Badge from '../components/Badge.svelte';", "</script>", "<Badge />"]),
      "src/views/u.svelte": L(["<Badge />"]),
      "src/pages/index.astro": L(["---", "import Hero from '../components/Hero.astro';", "---", "<Hero />"]),
      // vben: a workspace package, a component folder's barrel naming the SFC's default, a second barrel renaming that name
      "packages/ui/package.json": js({ name: "@acme/ui" }),
      "packages/ui/src/index.ts": L(["export * from './components/button';", "export * from './components/kit';"]),
      "packages/ui/src/components/button/index.ts": L(["export { default as VbenButton } from './button.vue';"]),
      "packages/ui/src/components/button/button.vue": L(["<template><button /></template>"]),
      "packages/ui/src/components/kit/index.ts": L(["export { VbenButton as VBtn } from '../button';"]),
      "src/views/vben.vue": L(["<script setup>", "import { VbenButton } from '@acme/ui'", "</script>", "<template><VbenButton /></template>"]),
      "src/views/vbtn.vue": L(["<script setup>", "import { VBtn } from '@acme/ui'", "</script>", "<template><VBtn /></template>"]),
      // shadcn-svelte: a namespace over a folder whose index is no component folder's barrel (a .js one) — its base is asked
      "src/lib/components/ui/sheet/sheet.svelte": L(["<div />"]),
      "src/lib/components/ui/sheet/index.js": L(["import Root from './sheet.svelte';", "export { Root };"]),
      "src/routes/+page.svelte": L(["<script>", "  import * as Sheet from '$lib/components/ui/sheet/index.js';", "</script>", "<Sheet.Root />"]),
    };
    const VUE_ROWS = (mark) => ["| Table | src/components/Table.vue |  | " + mark() + " |", "| Pagination | src/components/Pagination/index.vue |  | " + mark() + " |",
      "| Button | packages/ui/src/components/button/button.vue |  | " + mark() + " |", "| DataTable | src/components/DataTable.vue |  | " + mark() + " |",
      "| Tree | src/components/Tree.vue |  | " + mark() + " |", "| Grid | src/app/components/grid/grid.component.ts |  | " + mark() + " |",
      "| Badge | src/components/Badge.svelte |  | " + mark() + " |", "| Hero | src/components/Hero.astro |  | " + mark() + " |",
      "| Sheet | src/lib/components/ui/sheet/sheet.svelte |  | " + mark() + " |", "| Chart | src/components/Chart.client.vue |  | " + mark() + " |",
      "| MotionBox | src/components/kit.tsx |  | " + mark() + " |"];
    const p = depProject("sfc", VUE_ROWS(MARK), vue);
    const r = S.designSystemReport(p), d = usesOf(r);
    const diff = differential(p, VUE_ROWS);
    all("1.39 deprecatedUses (SFCs): an SFC imported with its extension or without (Vue CLI's `@/components/Table`), a folder's `index.vue` by its folder, a .svelte / .astro default import; a workspace package's barrel naming an SFC's default (`{ VbenButton }`) and a second barrel renaming it (`{ VBtn }`); a namespace over a folder whose index is a .js file — by the namespace's base; a .vue kebab tag no import binds counted apart, never a bound one, never a .svelte tag; a recursive SFC's own import never counted; an Angular `*.component.ts` is no row's file (its importers are `.ts` files): unlocated; the `.ts` files settle reads for a weak name stay out of the watch (`app.component('Table', T)`); every other key the same with no marker (got " +
      js({ rows: d.rows.map((x) => [x.name, x.filesTotal, x.files, x.unbound, x.unboundAt]), unlocated: d.unlocated, same: diff.same }) + ")", {
      extensionless: () => js(uses(r, "Table")) === js([2, ["src/views/list.vue", "src/views/with-ext.vue"]]) && js(uses(r, "Chart")) === js([1, ["src/views/chart.vue"]]),
      indexVue: () => js(uses(r, "Pagination")) === js([1, ["src/views/list.vue"]]),
      barrels: () => js(uses(r, "Button")) === js([2, ["src/views/vben.vue", "src/views/vbtn.vue"]]),
      kebab: () => js(uses(r, "DataTable")) === js([1, ["src/views/bound.vue"]]) && rowOf(r, "DataTable").unbound === 1 && rowOf(r, "DataTable").unboundAt === "src/views/kebab.vue",
      ownFile: () => js(uses(r, "Tree")) === js([0, []]),
      svelte: () => js(uses(r, "Badge")) === js([1, ["src/views/s.svelte"]]) && rowOf(r, "Badge").unbound === 0,
      astro: () => js(uses(r, "Hero")) === js([1, ["src/pages/index.astro"]]),
      namespaceBase: () => js(uses(r, "Sheet")) === js([2, ["src/lib/components/ui/sheet/index.js", "src/routes/+page.svelte"]]),
      angular: () => js(d.unlocated) === js(["Grid"]) && !d.rows.some((x) => x.name === "Grid"),
      candidate: () => js(uses(r, "MotionBox")) === js([1, ["src/views/motion.vue"]]),
      differential: () => diff.same === true,
    });
  }
  {
    // the barrel names, DS_ALIAS_PASSES (8) deep: a rename of a rename, each barrel read before the one it renames (one level a
    // pass) — the 8th rename's name is watched, the 9th's is not (a cost bound: its importer is not counted)
    const files = { "package.json": js({ name: "deep" }), "tsconfig.json": js({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"] } } }), [KIT + "button.tsx"]: compFile("Button") };
    for (let k = 1; k <= 9; k++) files["src/components/r" + k + "/index.ts"] = L([k === 9 ? "export { Button as N9 } from \"../ui/button\";" : "export { N" + (k + 1) + " as N" + k + " } from \"../r" + (k + 1) + "\";"]);
    files["src/app/n2.tsx"] = L(["import { N2 } from \"@/components/r2\";", "export const P = () => <N2 />;"]);
    files["src/app/n1.tsx"] = L(["import { N1 } from \"@/components/r1\";", "export const P = () => <N1 />;"]);
    const r = S.designSystemReport(depProject("passes", ["| Button | src/components/ui/button.tsx |  | _Deprecated_ |"], files));
    all("1.39 deprecatedUses: a component folder's barrel renaming a watched name makes its name watched — DS_ALIAS_PASSES (8) renames deep, the 9th not (got " + js(rowOf(r, "Button")) + ")", {
      passes: () => js(uses(r, "Button")) === js([1, ["src/app/n2.tsx"]]),
    });
  }
  {
    // the language: the note in the project's language (pt-BR derived), the codes English
    const loc = {};
    for (const l of ["pt", "es", "pt-BR"]) loc[l] = usesOf(S.designSystemReport(depProject("lang-" + l, ["| Table | src/components/Table.tsx |  | _Deprecated_ |"], { "src/components/Table.tsx": compFile("Table") }, l))).note;
    all("1.39 deprecatedUses: its `note` — what the search does not see, and that no import found is not unused — in the project's language (got " + js(loc) + ")", {
      langs: () => ["pt", "es", "pt-BR"].every((l) => loc[l] === Q(l).dsDepUsesNote) && loc.pt !== loc["pt-BR"] && loc.es !== Q().dsDepUsesNote && /import\(\)/.test(Q().dsDepUsesNote),
      // (review 1 of 1.39: what is not seen names a tag an auto-import names by its folder — Nuxt's <BaseCard>; and `unlocated`
      // says only what is true: no component file the scan reads — a component folder's index among them — gives the name)
      autoImport: () => ["en", "pt", "es"].every((l) => Q(l).dsDepUsesNote.includes("<BaseCard>") && Q(l).dsDepUsesNote.includes("components/base/Card.vue")),
      unlocated: () => ["en", "pt", "es"].every((l) => i18n.msg(l).cliOutput.dsDepUsesUnlocated("X").includes("index") && !/Angular|Blade/.test(i18n.msg(l).cliOutput.dsDepUsesUnlocated("X"))),
    });
  }
  {
    // review 1 of 1.39 — a row named through a component folder's barrel (vben: `export { default as VbenButton } from
    // './button.vue'`, the seed's row) is located, its importers counted; a barrel's default export (outline's List/index.ts over
    // a styled List.ts) binds its default importers, as a file whose DEFAULT export is the row's name does (List/Item.tsx's
    // `export default ListItem`, ToolbarSeparator.tsx's Separator) — never a default import of a file whose default is another
    // (card.tsx's Card beside the deprecated CardHeader); a barrel is among `paths` only when no component file is; TypeScript's
    // `import type { … }` names no default (a folder's types are not its component) while `import type * as` the row's own file
    // is an import of it, and `import type X from` its folder stays unbound (1.40: of the file, counted); an SFC's extensionless
    // twin is no module a script of that key holds (Sheet.vue beside sheet.ts)
    const files = {
      "package.json": js({ name: "r1", private: true, workspaces: ["packages/*"], dependencies: { react: "^19", vue: "^3" } }),
      "tsconfig.json": js({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"] } } }),
      "packages/ui/package.json": js({ name: "@acme/ui" }),
      "packages/ui/src/index.ts": L(["export * from './components';"]),
      "packages/ui/src/components/index.ts": L(["export * from './button';"]),
      "packages/ui/src/components/button/button.vue": L(["<template><button /></template>"]),
      "packages/ui/src/components/button/icon-button.vue": L(["<template><button /></template>"]),
      "packages/ui/src/components/button/index.ts": L(["export { default as VbenButton } from './button.vue';", "export { default as VbenIconButton } from './icon-button.vue';"]),
      "apps/web/src/views/v1.vue": L(["<script setup lang=\"ts\">", "import { VbenButton } from '@acme/ui';", "</script>", "<template><VbenButton /></template>"]),
      "apps/web/src/views/v2.vue": L(["<script setup lang=\"ts\">", "import { VbenButton } from '@acme/ui';", "</script>", "<template><VbenButton /></template>"]),
      "src/components/List/List.ts": L(["import styled from \"styled-components\";", "const List = styled.ol``;", "export default List;"]),
      "src/components/List/index.ts": L(["import List from \"./List\";", "export default List;"]),
      "src/components/List/Item.tsx": L(["function ListItem() { return <li />; }", "", "export default ListItem;"]),
      "src/components/ToolbarSeparator.tsx": L(["const Separator = () => <hr />;", "export default Separator;"]),
      "src/components/ui/card.tsx": L(["export function CardHeader() { return <div />; }", "export default function Card() { return <div />; }"]),
      "src/components/ui/toggle/toggle.tsx": compFile("Toggle"),
      "src/components/ui/toggle/index.ts": L(["export * from \"./toggle\";", "export * from \"./variants\";"]),
      "src/components/ui/toggle/variants.ts": L(["export type ToggleVariants = { size: string };"]),
      "src/components/ui/field.tsx": compFile("Field", ["export type FieldProps = { name: string };"]),
      "src/components/ui/badge/Badge.vue": L(["<script setup lang=\"ts\">", "import { badgeVariants } from '.'", "</script>", "<template><span :class=\"badgeVariants()\" /></template>"]),
      "src/components/ui/badge/index.ts": L(["export { default as Badge } from './Badge.vue'", "export const badgeVariants = (x) => x", "export type BadgeVariants = { size?: string }"]),
      // (a barrel's part under a located row's name — select's `Option`, its own select-option.vue — is no namesake of the kit's Option)
      "src/components/ui/option.tsx": compFile("Option"),
      "src/components/ui/select/select-option.vue": L(["<template><li /></template>"]),
      "src/components/ui/select/index.ts": L(["import Option from './select-option.vue';", "export { Option, Option as SelectOption };"]),
      "src/app/select.tsx": L(["import * as Select from \"@/components/ui/select\";", "export const S = () => <Select.Option />;"]),
      "src/app/option.tsx": L(["import { Option } from \"@/components/ui/option\";", "export const I = () => <Option />;"]),
      "src/components/ui/sheet/Sheet.vue": L(["<template><div /></template>"]),
      "src/components/ui/sheet/sheet.ts": L(["export const sheetVariants = 1;"]),
      "src/components/ui/sheet/SheetContent.vue": L(["<script setup lang=\"ts\">", "import { sheetVariants } from './sheet'", "</script>", "<template><div :class=\"sheetVariants\" /></template>"]),
      "src/app/list-a.tsx": L(["import List from \"@/components/List\";", "export const A = () => <List />;"]),
      "src/app/list-b.tsx": L(["import List from \"../components/List\";", "export const B = () => <List />;"]),
      "src/app/views.tsx": L(["import ListItem from \"@/components/List/Item\";", "export const V = () => <ListItem />;"]),
      "src/app/toolbar.tsx": L(["import ToolbarSeparator from \"../components/ToolbarSeparator\";", "export const T = () => <ToolbarSeparator />;"]),
      "src/app/card-default.tsx": L(["import Card from \"@/components/ui/card\";", "export const C = () => <Card />;"]),
      "src/app/card-header.tsx": L(["import { CardHeader } from \"@/components/ui/card\";", "export const C = () => <CardHeader />;"]),
      "src/app/type-folder.tsx": L(["import type { ToggleVariants } from \"@/components/ui/toggle\";", "export const B = (p: { v: ToggleVariants }) => <div>{p.v.size}</div>;"]),
      "src/app/type-default.tsx": L(["import type ToggleDefault from \"@/components/ui/toggle\";", "export const B = (p: { v: ToggleDefault }) => <div />;"]),
      "src/app/toggle.tsx": L(["import { Toggle } from \"@/components/ui/toggle\";", "export const R = () => <Toggle />;"]),
      "src/app/type-ns.tsx": L(["import type * as FT from \"@/components/ui/field\";", "export const f = (x: FT.FieldProps) => <div>{x.name}</div>;"]),
      "src/components/ui/pagination/PaginationFirst.vue": L(["<script setup lang=\"ts\">", "import type { BadgeVariants } from '@/components/ui/badge'", "import { badgeVariants } from '@/components/ui/badge'",
        "defineProps<{ size?: BadgeVariants['size'] }>()", "</script>", "<template><a :class=\"badgeVariants()\" /></template>"]),
    };
    const rows = (mark) => ["| VbenButton | `packages/ui/src/components/button/index.ts` |  | " + mark("use VbenIconButton") + " |", "| VbenIconButton | `packages/ui/src/components/button/index.ts` |  |  |",
      "| List | src/components/List/index.ts |  | " + mark() + " |", "| ListItem | src/components/List/Item.tsx |  | " + mark() + " |", "| Separator | src/components/ToolbarSeparator.tsx |  | " + mark() + " |",
      "| CardHeader | src/components/ui/card.tsx |  | " + mark() + " |", "| Toggle | src/components/ui/toggle/toggle.tsx |  | " + mark() + " |", "| Field | src/components/ui/field.tsx |  | " + mark() + " |",
      "| Badge | src/components/ui/badge/Badge.vue |  | " + mark() + " |", "| Sheet | src/components/ui/sheet/Sheet.vue |  | " + mark() + " |", "| Option | src/components/ui/option.tsx |  | " + mark() + " |"];
    const p = depProject("review1", rows(MARK), files);
    const r = S.designSystemReport(p), d = usesOf(r);
    const diff = differential(p, rows);
    all("1.39 deprecatedUses (review 1): a row named through a component folder's barrel is located and its importers counted; a barrel's default export and a file's default export under the row's name bind their default importers, never a default import of another default; a barrel is a row's path only when no component file is; `import type { … }` from a folder names no default, `import type * as` the row's file is its import, `import type X from` its folder binds nothing; an SFC's extensionless twin is no module a script of that key holds; every other key the same with no marker (got " +
      js({ rows: d.rows.map((x) => [x.name, x.filesTotal, x.files, x.paths, x.pathsTotal]), unlocated: d.unlocated, same: diff.same }) + ")", {
      barrel: () => js(uses(r, "VbenButton")) === js([2, ["apps/web/src/views/v1.vue", "apps/web/src/views/v2.vue"]]) && js(rowOf(r, "VbenButton").paths) === js(["packages/ui/src/components/button/index.ts"]) && rowOf(r, "VbenButton").use === "VbenIconButton",
      barrelDefault: () => js(uses(r, "List")) === js([2, ["src/app/list-a.tsx", "src/app/list-b.tsx"]]) && js(rowOf(r, "List").paths) === js(["src/components/List/index.ts"]),
      defaultName: () => js(uses(r, "ListItem")) === js([1, ["src/app/views.tsx"]]) && js(uses(r, "Separator")) === js([1, ["src/app/toolbar.tsx"]]),
      otherDefault: () => js(uses(r, "CardHeader")) === js([1, ["src/app/card-header.tsx"]]),
      typeOnly: () => js(uses(r, "Toggle")) === js([1, ["src/app/toggle.tsx"]]) && js(uses(r, "Field")) === js([1, ["src/app/type-ns.tsx"]]),
      vueType: () => js(uses(r, "Badge")) === js([0, []]) && js(rowOf(r, "Badge").paths) === js(["src/components/ui/badge/Badge.vue"]) && rowOf(r, "Badge").pathsTotal === 1,
      twin: () => js(uses(r, "Sheet")) === js([0, []]),
      barrelPart: () => js(uses(r, "Option")) === js([1, ["src/app/option.tsx"]]) && rowOf(r, "Option").pathsTotal === 1,
      located: () => js(d.unlocated) === js([]) && d.rowsTotal === 10,
      differential: () => diff.same === true,
    });
  }
  {
    // review 2 of 1.39 — a kit's parts: when the component folders' indexes give a row's name to more than one FILE (shadcn-
    // svelte's `Content`: card's, dialog's and the picker's own content.svelte), only the index the row's path names locates it
    // (its key, or its folder's: `./…/picker`); a name an index declares is that index's file (`const Trigger = …Trigger`);
    // given to ONE file (vben's VbenButton → button.vue, through two indexes; a third passes on a package's, vben's common-ui
    // `export { VbenButton } from '@vben-core/shadcn-ui'`: no file placed), every index, as before; a path that names none of
    // them leaves the row unlocated, and the line says why. And `import type{ X }` — no blank, or two — binds no default
    const C = "src/lib/components/ui/", part = (c, p) => C + c + "/" + c + "-" + p + ".svelte";
    const files = {
      "package.json": js({ name: "r2", private: true, workspaces: ["packages/*"], dependencies: { svelte: "^5", vue: "^3", react: "^19" } }),
      "tsconfig.json": js({ compilerOptions: { baseUrl: ".", paths: { "$lib/*": ["./src/lib/*"], "@/*": ["./src/*"] } } }),
      "packages/ui/package.json": js({ name: "@acme/ui" }),
      "packages/ui/src/index.ts": L(["export * from './components';"]),
      "packages/ui/src/components/index.ts": L(["export * from './button';"]),
      "packages/ui/src/components/button/button.vue": L(["<template><button /></template>"]),
      "packages/ui/src/components/button/index.ts": L(["export { default as VbenButton } from './button.vue';"]),
      "packages/ui/src/components/legacy/index.ts": L(["export { default as VbenButton } from '../button/button.vue';"]),
      "packages/effects/package.json": js({ name: "@acme/effects" }),
      "packages/effects/src/components/index.ts": L(["export {", "  VbenButton,", "  VbenTooltip,", "} from '@acme/ui';"]),
      // (a name only packages' re-exports give — no file placed: every index, as before)
      "packages/extras/src/components/index.ts": L(["export { VbenTooltip } from '@acme/ui';"]),
      "packages/extras/src/views/tip.vue": L(["<script setup lang=\"ts\">", "import { VbenTooltip } from '../components';", "</script>", "<template><VbenTooltip /></template>"]),
      "packages/ui/src/views/legacy.vue": L(["<script setup lang=\"ts\">", "import { VbenButton } from '../components/legacy';", "</script>", "<template><VbenButton /></template>"]),
      "apps/web/src/v1.vue": L(["<script setup lang=\"ts\">", "import { VbenButton } from '@acme/ui';", "</script>", "<template><VbenButton /></template>"]),
      "src/components/ui/toggle/toggle.tsx": compFile("Toggle"),
      "src/components/ui/toggle/index.ts": L(["export * from \"./toggle\";", "export * from \"./variants\";"]),
      "src/components/ui/toggle/variants.ts": L(["export type ToggleVariants = { size: string };"]),
      "src/app/toggle.tsx": L(["import { Toggle } from \"@/components/ui/toggle\";", "export const R = () => <Toggle />;"]),
      "src/app/type-tight.tsx": L(["import type{ ToggleVariants } from \"@/components/ui/toggle\";", "export const B = (p: { v: ToggleVariants }) => <div />;"]),
      "src/app/type-wide.tsx": L(["import type  { ToggleVariants } from \"@/components/ui/toggle\";", "export const B = (p: { v: ToggleVariants }) => <div />;"]),
      "src/app/type-file.tsx": L(["import type ToggleT from \"@/components/ui/toggle/toggle\";", "export const B = (p: { v: ToggleT }) => <div />;"]),
    };
    for (const c of ["card", "dialog", "picker"]) {
      const U = c[0].toUpperCase() + c.slice(1), grouped = c !== "card", own = c === "picker";
      for (const p of ["content", "footer"].concat(grouped ? ["group"] : [], own ? ["trigger"] : [])) files[part(c, p)] = L(["<div><slot /></div>"]);
      files[C + c + "/" + c + ".svelte"] = L(["<div><slot /></div>"]);
      files[C + c + "/index.ts"] = L(["import { Dialog as Primitive } from \"bits-ui\";", "import Root from \"./" + c + ".svelte\";", "import Content from \"./" + c + "-content.svelte\";", "import Footer from \"./" + c + "-footer.svelte\";"]
        .concat(grouped ? ["import Group from \"./" + c + "-group.svelte\";"] : [], own ? ["import Trigger from \"./" + c + "-trigger.svelte\";"] : ["const Trigger = Primitive.Trigger;"],
          ["export { Root, Content, Footer, Trigger" + (grouped ? ", Group" : "") + ", Root as " + U + ", Content as " + U + "Content };"]));
    }
    for (let i = 0; i < 4; i++) files["src/routes/r" + i + "/+page.svelte"] = L(["<script lang=\"ts\">", "  import * as Card from \"$lib/components/ui/card/index.js\";", "  import * as Dialog from \"$lib/components/ui/dialog/index.js\";", "</script>",
      "<Card.Root><Card.Trigger /><Card.Content>x</Card.Content><Card.Footer /></Card.Root>", "<Dialog.Root><Dialog.Trigger /><Dialog.Group><Dialog.Content>y</Dialog.Content></Dialog.Group></Dialog.Root>"]);
    files["src/routes/picker/+page.svelte"] = L(["<script lang=\"ts\">", "  import * as Picker from \"$lib/components/ui/picker/index.js\";", "</script>",
      "<Picker.Root><Picker.Trigger /><Picker.Group><Picker.Content>z</Picker.Content></Picker.Group><Picker.Footer /></Picker.Root>"]);
    const rows = (mark) => ["| VbenButton | `packages/ui/src/components/button/index.ts` |  | " + mark() + " |", "| Content | " + C + "picker/index.ts |  | " + mark("use Popover.Content") + " |",
      "| Group | ./" + C + "picker |  | " + mark() + " |", "| Trigger | " + C + "picker/index.ts |  | " + mark() + " |", "| Footer | " + C + "sheet/index.ts |  | " + mark() + " |",
      "| Toggle | src/components/ui/toggle/toggle.tsx |  | " + mark() + " |", "| VbenTooltip | packages/effects/src/components/index.ts |  | " + mark() + " |"];
    const p = depProject("review2", rows(MARK), files);
    const r = S.designSystemReport(p), d = usesOf(r);
    const diff = differential(p, rows);
    const PICKER = "src/routes/picker/+page.svelte", AT = [C + "picker/index.ts"];
    const clause = { en: "the index the row's path names", pt: "o index que o caminho da linha nomeia", es: "el index que nombra la ruta de la fila" };
    all("1.39 deprecatedUses (review 2): when the component folders' indexes give a row's name to more than one file — a kit's parts, a name an index declares its own —, only the index the row's path names (its key or its folder's) locates it; given to one file, every index; another package's re-export places no file; a path naming none of them leaves the row unlocated, the line saying why (EN / PT / ES); `import type{ X }` and `import type  { X }` bind no default, `import type X from` the row's file counts (1.40); every other key the same with no marker (got " +
      js({ rows: d.rows.map((x) => [x.name, x.filesTotal, x.files, x.paths, x.pathsTotal]), unlocated: d.unlocated, same: diff.same }) + ")", {
      parts: () => js(uses(r, "Content")) === js([1, [PICKER]]) && js(rowOf(r, "Content").paths) === js(AT) && rowOf(r, "Content").pathsTotal === 1,
      twoFiles: () => js(uses(r, "Group")) === js([1, [PICKER]]) && js(rowOf(r, "Group").paths) === js(AT),
      declared: () => js(uses(r, "Trigger")) === js([1, [PICKER]]) && js(rowOf(r, "Trigger").paths) === js(AT),
      oneFile: () => js(uses(r, "VbenButton")) === js([2, ["apps/web/src/v1.vue", "packages/ui/src/views/legacy.vue"]]),
      noFile: () => js(uses(r, "VbenTooltip")) === js([1, ["packages/extras/src/views/tip.vue"]]),
      unlocated: () => js(d.unlocated) === js(["Footer"]) && d.unlocatedTotal === 1 && ["en", "pt", "es"].every((l) => i18n.msg(l).cliOutput.dsDepUsesUnlocated("X").includes(clause[l])),
      // (1.40, R3-DEP-4: `import type ToggleT from` the row's own file is an import of it — counted; through its folder, below, never)
      typeTight: () => js(uses(r, "Toggle")) === js([2, ["src/app/toggle.tsx", "src/app/type-file.tsx"]]),
      differential: () => diff.same === true,
    });
  }
  {
    // 1.40 (R3-DEP-3) — the row's path cell is read as stalePath reads it (ONE reader, pathWords): the whole cell, then each
    // word, a link unwrapped — the index the row's path names may stand beside another path, backticked, or as a link; a cell
    // naming two indexes locates the row by both; a folder with a blank is named by the whole cell alone. Still 1.39's: one
    // path, the picker's index alone (its parts' importers aside)
    const kitsIn = (dir) => {
      const out = {};
      for (const c of ["card", "dialog", "picker"]) {
        out[dir + c + "/" + c + ".svelte"] = L(["<div><slot /></div>"]);
        out[dir + c + "/" + c + "-content.svelte"] = L(["<div><slot /></div>"]);
        out[dir + c + "/index.ts"] = L(["import Root from \"./" + c + ".svelte\";", "import Content from \"./" + c + "-content.svelte\";", "export { Root, Content };"]);
      }
      return out;
    };
    const page = (dir, c) => L(["<script lang=\"ts\">", "  import * as " + c + " from '../../lib/components/" + dir + c.toLowerCase() + "';", "</script>", "<" + c + ".Content />"]);
    const kitFilesOf = (dir) => Object.assign({ "package.json": js({ name: "cells" }), "src/routes/r0/+page.svelte": page(dir, "Card"), "src/routes/r1/+page.svelte": page(dir, "Dialog"),
      "src/routes/picker/+page.svelte": page(dir, "Picker") }, kitsIn("src/lib/components/" + dir));
    const K = "src/lib/components/ui/", PICKER = "src/routes/picker/+page.svelte";
    const cell = (tag, text, dir) => S.designSystemReport(depProject("cell-" + tag, ["| Content | " + text + " |  | _Deprecated_ |"], kitFilesOf(dir || "ui/")));
    const one = cell("one", K + "picker/index.ts"), two = cell("two", "`" + K + "picker/index.ts`, `" + K + "picker/picker-content.svelte`");
    const link = cell("link", "[picker](" + K + "picker/index.ts)"), both = cell("both", K + "picker/index.ts " + K + "card/index.ts");
    const blank = cell("blank", "src/lib/components/ui kit/picker/index.ts", "ui kit/");
    const at = (r) => [rowOf(r, "Content").filesTotal, rowOf(r, "Content").files, rowOf(r, "Content").paths, usesOf(r).unlocated];
    const ONE = [1, [PICKER], [K + "picker/index.ts"], []];
    all("1.40 deprecatedUses (R3-DEP-3): the row's path cell read as stalePath reads it — the whole cell, then each word, a link unwrapped: the index the row's path names beside another path, backticked, or as a link; two indexes named, both locate it; a folder with a blank, the whole cell; one path as 1.39 read it (got " +
      js({ one: at(one), two: at(two), link: at(link), both: at(both), blank: at(blank) }) + ")", {
      one: () => js(at(one)) === js(ONE),
      two: () => js(at(two)) === js(ONE),
      link: () => js(at(link)) === js(ONE),
      both: () => js(at(both)) === js([2, [PICKER, "src/routes/r0/+page.svelte"], [K + "card/index.ts", K + "picker/index.ts"], []]),
      blank: () => js(at(blank)) === js([1, [PICKER], ["src/lib/components/ui kit/picker/index.ts"], []]),
    });
  }
  {
    // 1.40 (R2-DEP-2 b) — the file a component folder's barrel that LOCATES a row renames, imported DIRECTLY under the name it
    // has there, is a use of that row (vben's icon-button.vue: `import VbenButton from './button.vue'`; cal.com's `{
    // AppleConnect }` for `export { AppleConnect as AppleCalendar }`) — of every row whose barrel renames it; an SFC's twin
    // too (never when a script holds that key: `./button` is button.ts); never another export of that file (`{ cardVariants
    // }`, `{ IconCard }`), never a namesake row's import by name from the package (vben's form-field.vue), never the parts of a
    // kit whose barrel does not locate the row (card-item.svelte), never a component FILE's re-export (only a barrel's), never
    // a barrel passing on a package's (no file placed). Still 1.39's: every importer it counted, the same paths and unlocated
    const vue = (imp, tag) => L(["<script setup lang=\"ts\">", imp, "</script>", "<template><" + tag + " /></template>"]);
    const sv = (imp, tag) => L(["<script lang=\"ts\">", imp, "</script>", "<" + tag + " />"]);
    const B = "src/components/button/", CD = "src/components/card/", T2 = "src/components/two/";
    const renamedFiles = {
      "package.json": js({ name: "renamed" }), "tsconfig.json": js({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"] } } }),
      // (the renamed file itself recursive — never its own importer —, and a type-only default import of it: the module check
      // alone counts a type, never the file a barrel renames — R3-DEP-4)
      [B + "button.vue"]: vue("import VbenButton from './button.vue';", "VbenButton"), [B + "type-default.vue"]: vue("import type VbenButtonT from './button.vue';", "div"),
      [B + "button.ts"]: L(["export type VbenButtonProps = { a?: string };", "export default {};"]),
      [B + "icon-button.vue"]: vue("import VbenButton from './button.vue';", "VbenButton"), [B + "group.vue"]: vue("import Btn from './button.vue';", "Btn"),
      [B + "typed.vue"]: vue("import type { VbenButtonProps } from './button';", "div"), [B + "script.vue"]: vue("import Btn from './button';", "Btn"),
      [B + "index.ts"]: L(["export { default as VbenButton } from './button.vue';", "export { default as VbenIconButton } from './icon-button.vue';"]),
      "src/views/v.vue": vue("import { VbenButton } from '../components/button';", "VbenButton"),
      "src/views/alias.vue": vue("import T from '@/components/button/button.vue';", "T"),
      [CD + "card.tsx"]: L(["export function Card() { return <div />; }", "export function IconCard() { return <div />; }", "export const cardVariants = {};"]),
      [CD + "index.ts"]: L(["export { Card as KitCard } from './card';"]),
      "src/pages/card.tsx": L(["import { Card } from '../components/card/card';", "export default () => <Card />;"]),
      "src/pages/variants.tsx": L(["import { cardVariants } from '../components/card/card';", "export default () => <div />;"]),
      "src/pages/icon.tsx": L(["import { IconCard } from '../components/card/card';", "export default () => <IconCard />;"]),
      "src/pages/kit.tsx": L(["import { KitCard } from '../components/card';", "export default () => <KitCard />;"]),
      // (two barrels renaming one file — the row each locates counts the direct import; a third renames it again)
      [T2 + "a/button.vue"]: L(["<template><button /></template>"]), [T2 + "a/index.ts"]: L(["export { default as AButton } from './button.vue';"]),
      [T2 + "b/index.ts"]: L(["export { default as BButton } from '../a/button.vue';"]), [T2 + "c/index.ts"]: L(["export { default as BButton } from '../a/button.vue';"]),
      [T2 + "a/icon.vue"]: vue("import Btn from './button.vue';", "Btn"), "src/views/two.vue": vue("import X from '../components/two/a/button';", "X"),
      // (a component FILE passing on another's component under a row's name: no barrel — its file's importers are not the row's)
      "src/components/ui/panel.tsx": L(["export function Panel() { return <div />; }", "export { PanelTitle as Title } from './panel-title';"]),
      "src/components/ui/panel-title.tsx": L(["export function PanelTitle() { return <h3 />; }"]),
      "src/pages/title.tsx": L(["import { PanelTitle } from '../components/ui/panel-title';", "export default () => <PanelTitle />;"]),
      "src/pages/panel.tsx": L(["import { Title } from '../components/ui/panel';", "export default () => <Title />;"]),
    };
    const K = "src/lib/components/ui/";
    for (const c of ["card", "dialog", "picker"]) {
      renamedFiles[K + c + "/" + c + ".svelte"] = L(["<div><slot /></div>"]);
      renamedFiles[K + c + "/" + c + "-content.svelte"] = L(["<div><slot /></div>"]);
      renamedFiles[K + c + "/index.ts"] = L(["import Root from \"./" + c + ".svelte\";", "import Content from \"./" + c + "-content.svelte\";", "export { Root, Content };"]);
    }
    renamedFiles[K + "picker/picker-item.svelte"] = sv("import Content from './picker-content.svelte';", "Content");
    renamedFiles[K + "card/card-item.svelte"] = sv("import Content from './card-content.svelte';", "Content");
    renamedFiles["src/routes/picker/+page.svelte"] = sv("import * as Picker from '../../lib/components/ui/picker';", "Picker.Content");
    const rows = (mark) => ["| VbenButton | " + B + "index.ts |  | " + mark() + " |", "| KitCard | " + CD + "index.ts |  | " + mark() + " |", "| AButton | " + T2 + "a/index.ts |  | " + mark() + " |",
      "| BButton | " + T2 + "b/index.ts |  | " + mark() + " |", "| Title | src/components/ui/panel.tsx |  | " + mark() + " |", "| Content | " + K + "picker/index.ts |  | " + mark() + " |"];
    const p = depProject("renamed", rows(MARK), renamedFiles);
    const r = S.designSystemReport(p), d = usesOf(r), diff = differential(p, rows);
    // vben's shape: a namesake module row (Button.vue) imported BY NAME from the package is not the file VbenButton's barrel
    // renames; a barrel passing on the package's VbenButton places no file
    const ws = depProject("renamed-ws", ["| VbenButton | packages/ui/src/components/button/index.ts |  | _Deprecated_ |", "| Button | packages/ui/src/ui/button/Button.vue |  | _Deprecated_ |"], {
      "package.json": js({ name: "root", private: true, workspaces: ["packages/*", "apps/*"] }), "packages/ui/package.json": js({ name: "@acme/ui", main: "src/index.ts" }),
      "packages/ui/src/components/button/button.vue": L(["<template><button /></template>"]), "packages/ui/src/components/button/index.ts": L(["export { default as VbenButton } from './button.vue';"]),
      "packages/ui/src/ui/button/Button.vue": L(["<template><button /></template>"]), "packages/ui/src/ui/button/index.ts": L(["export { default as Button } from './Button.vue';"]),
      "packages/ui/src/index.ts": L(["export * from './components/button';", "export * from './ui/button';"]), "apps/web/package.json": js({ name: "web", dependencies: { "@acme/ui": "*" } }),
      "apps/web/src/form.vue": vue("import { Button } from '@acme/ui';", "Button"), "apps/web/src/v.vue": vue("import { VbenButton } from '@acme/ui';", "VbenButton"),
      "packages/effects/src/components/index.ts": L(["export { VbenButton } from '@acme/ui';"]) });
    const rw = S.designSystemReport(ws);
    all("1.40 deprecatedUses (R2-DEP-2 b): a direct import of the file a row's barrel renames, under the name it has there, counts — of every row whose barrel renames it, an SFC's twin too but never a script's key, never another export of the file, never a namesake row's import by name from the package, never a kit's part the row's barrel does not give, never a component file's re-export; paths and unlocated 1.39's; every other key the same with no marker (got " +
      js({ rows: d.rows.map((x) => [x.name, x.filesTotal, x.files, x.pathsTotal]), unlocated: d.unlocated, ws: usesOf(rw).rows.map((x) => [x.name, x.filesTotal, x.files]), same: diff.same }) + ")", {
      sfc: () => js(uses(r, "VbenButton")) === js([4, [B + "group.vue", B + "icon-button.vue", "src/views/alias.vue"]]) && rowOf(r, "VbenButton").pathsTotal === 1,
      named: () => js(uses(r, "KitCard")) === js([2, ["src/pages/card.tsx", "src/pages/kit.tsx"]]),
      twoBarrels: () => js(uses(r, "AButton")) === js([2, [T2 + "a/icon.vue", "src/views/two.vue"]]) && js(uses(r, "BButton")) === js([2, [T2 + "a/icon.vue", "src/views/two.vue"]]) && rowOf(r, "BButton").pathsTotal === 2,
      fileReexport: () => js(uses(r, "Title")) === js([1, ["src/pages/panel.tsx"]]),
      parts: () => js(uses(r, "Content")) === js([2, [K + "picker/picker-item.svelte", "src/routes/picker/+page.svelte"]]),
      namesake: () => js(uses(rw, "VbenButton")) === js([1, ["apps/web/src/v.vue"]]) && js(uses(rw, "Button")) === js([2, ["apps/web/src/form.vue", "apps/web/src/v.vue"]]) && rowOf(rw, "VbenButton").pathsTotal === 2,
      located: () => js(d.unlocated) === js([]) && d.rowsTotal === 6 && js(d.limits) === js([]),
      differential: () => diff.same === true,
    });
  }
  {
    // 1.40.0 review 1 (DEP-1) — an export an index ALSO gives under a LIVE row's name is that row's component: its direct
    // importers are never the deprecated alias's (`default as Button, default as OldButton` — the usual deprecation of a
    // rename —, a compat index's `default as BButton` of a/index.ts's AButton file, a React index's `export { Tab }` beside
    // `Tab as OldTab`: any named re-export); the alias's own importers count, 1.39's. Still (b)'s: a name no row has makes
    // nothing live (VbenBtn), another export of that file (`{ Card }` beside a live IconCard), and a live row naming the file
    // by its PATH alone (vben's seed `ButtonGroup | …/button-group.vue`, the index giving it VbenButtonGroup only); a live
    // name passed on from a package places no file
    const vue = (imp, tag) => L(["<script setup lang=\"ts\">", imp, "</script>", "<template><" + tag + " /></template>"]);
    const C = "src/components/";
    const files = {
      "package.json": js({ name: "live-alias" }), "tsconfig.json": js({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"] } } }),
      [C + "button/Button.vue"]: L(["<template><button><slot /></button></template>"]),
      [C + "button/index.ts"]: L(["export { default as Button, default as OldButton } from './Button.vue';"]),
      "src/views/new-direct.vue": vue("import Button from '@/components/button/Button.vue';", "Button"), "src/views/rel-direct.vue": vue("import B from '../components/button/Button.vue';", "B"),
      "src/views/new-named.vue": vue("import { Button } from '@/components/button';", "Button"), "src/views/old-named.vue": vue("import { OldButton } from '@/components/button';", "OldButton"),
      [C + "a/button.vue"]: L(["<template><button /></template>"]), [C + "a/index.ts"]: L(["export { default as AButton } from './button.vue';"]),
      [C + "b/index.ts"]: L(["export { default as BButton } from '../a/button.vue';"]),
      "src/views/a-direct.vue": vue("import AButton from '@/components/a/button.vue';", "AButton"), "src/views/a-named.vue": vue("import { AButton } from '@/components/a';", "AButton"),
      "src/views/b-named.vue": vue("import { BButton } from '@/components/b';", "BButton"),
      [C + "norow/btn.vue"]: L(["<template><button /></template>"]), [C + "norow/index.ts"]: L(["export { default as Btn, default as VbenBtn } from './btn.vue';"]),
      "src/views/btn-direct.vue": vue("import Btn from '../components/norow/btn.vue';", "Btn"),
      [C + "card/card.tsx"]: L(["export function Card() { return <div />; }", "export function IconCard() { return <div />; }"]),
      [C + "card/index.ts"]: L(["export { Card as KitCard, IconCard } from './card';"]),
      "src/pages/card.tsx": L(["import { Card } from '../components/card/card';", "export default () => <Card />;"]),
      "src/pages/icon.tsx": L(["import { IconCard } from '../components/card/card';", "export default () => <IconCard />;"]),
      [C + "tabs/Tab.tsx"]: L(["export function Tab() { return <div />; }"]), [C + "tabs/index.ts"]: L(["export { Tab } from './Tab';", "export { Tab as OldTab } from './Tab';"]),
      "src/pages/tab.tsx": L(["import { Tab } from '../components/tabs/Tab';", "export default () => <Tab />;"]),
      "src/pages/old-tab.tsx": L(["import { OldTab } from '../components/tabs';", "export default () => <OldTab />;"]),
      [C + "group/button-group.vue"]: L(["<template><div><slot /></div></template>"]), [C + "group/index.ts"]: L(["export { default as VbenButtonGroup } from './button-group.vue';"]),
      "src/views/group-direct.vue": vue("import ButtonGroup from '../components/group/button-group.vue';", "ButtonGroup"),
      // (an SFC an index re-exports with no extension — Vue CLI's resolution: the file found by its twin, `fileOf`)
      [C + "sel/sel.vue"]: L(["<template><select /></template>"]), [C + "sel/index.ts"]: L(["export { default as VbenSel } from './sel';"]),
      "src/views/sel-direct.vue": vue("import Sel from '../components/sel/sel.vue';", "Sel"),
      [C + "pkg/index.ts"]: L(["export { Primitive } from 'some-primitives';"]),
    };
    const rows = (mark) => ["| Button | " + C + "button/Button.vue |  |  |", "| OldButton | " + C + "button/index.ts |  | " + mark("use Button") + " |",
      "| AButton | " + C + "a/index.ts |  |  |", "| BButton | " + C + "b/index.ts |  | " + mark("use AButton") + " |", "| VbenBtn | " + C + "norow/index.ts |  | " + mark() + " |",
      "| IconCard | " + C + "card/index.ts |  |  |", "| KitCard | " + C + "card/index.ts |  | " + mark() + " |",
      "| Tab | " + C + "tabs/Tab.tsx |  |  |", "| OldTab | " + C + "tabs/index.ts |  | " + mark("use Tab") + " |",
      "| ButtonGroup | " + C + "group/button-group.vue |  |  |", "| VbenButtonGroup | " + C + "group/index.ts |  | " + mark() + " |", "| Primitive | " + C + "pkg/index.ts |  |  |",
      "| VbenSel | " + C + "sel/index.ts |  | " + mark() + " |"];
    const p = depProject("live-alias", rows(MARK), files);
    const r = S.designSystemReport(p), d = usesOf(r), diff = differential(p, rows);
    all("1.40.0 review 1 deprecatedUses (DEP-1): an export an index also gives a LIVE row's name is that row's component — OldButton, BButton and OldTab count their own importers alone (1.39.0's); a name no row has, another export of the file, a live row naming the file by its path keep (b)'s direct imports; every other key the same with no marker (got " +
      js({ rows: d.rows.map((x) => [x.name, x.filesTotal, x.files, x.pathsTotal]), unlocated: d.unlocated, same: diff.same }) + ")", {
      alias: () => js(uses(r, "OldButton")) === js([1, ["src/views/old-named.vue"]]),
      compat: () => js(uses(r, "BButton")) === js([1, ["src/views/b-named.vue"]]),
      passThrough: () => js(uses(r, "OldTab")) === js([1, ["src/pages/old-tab.tsx"]]),
      noRow: () => js(uses(r, "VbenBtn")) === js([1, ["src/views/btn-direct.vue"]]),
      otherExport: () => js(uses(r, "KitCard")) === js([1, ["src/pages/card.tsx"]]),
      byPath: () => js(uses(r, "VbenButtonGroup")) === js([1, ["src/views/group-direct.vue"]]),
      noExtension: () => js(uses(r, "VbenSel")) === js([1, ["src/views/sel-direct.vue"]]),
      located: () => js(d.unlocated) === js([]) && d.rowsTotal === 7 && js(d.limits) === js([]),
      differential: () => diff.same === true,
    });
  }
  {
    // …its cost, counted (CRIT_2's hostile shape, scaled; no clock): three component folders' barrels each rename the same 20
    // files under the 20 marked rows' names (one file a name: every barrel locates its row — `renamed` holds each row once),
    // 30 pages import two of the files directly, 10 import another file: the watch parses exactly the pages that name a renamed
    // file — the fixture computes them —, and each row counts the pages that import its file
    const vue = (imp, tag) => L(["<script setup lang=\"ts\">", imp, "</script>", "<template><" + tag + " /></template>"]);
    const files = { "package.json": js({ name: "hostile-b" }), "src/components/files/other.vue": L(["<template><i /></template>"]) };
    for (let i = 0; i < 20; i++) files["src/components/files/p" + i + ".vue"] = L(["<template><b /></template>"]);
    for (let b = 0; b < 3; b++) {
      files["src/components/k" + b + "/index.ts"] = L(Array.from({ length: 20 }, (_, i) => "export { default as N" + i + " } from \"../files/p" + i + ".vue\";"));
      files["src/components/k" + b + "/k" + b + ".vue"] = L(["<template><div /></template>"]);
    }
    const imported = (j) => (j < 30 ? [(j * 7) % 20, (j * 7 + 3) % 20] : []);
    for (let j = 0; j < 40; j++) {
      const ids = imported(j), at = "src/views/v" + String(j).padStart(2, "0") + ".vue";
      files[at] = ids.length ? vue(ids.map((i) => "import P" + i + " from \"../components/files/p" + i + ".vue\";").join("\n"), ids.map((i) => "P" + i).join(" /><")) : vue("import O from \"../components/files/other.vue\";", "O");
    }
    const want = new Map(); // a row → the pages that import its file (what the fixture expects)
    let naming = 0;
    for (let j = 0; j < 40; j++) { const ids = imported(j); if (ids.length) naming++; for (const i of ids) want.set("N" + i, (want.get("N" + i) || 0) + 1); }
    const h = usesOf(S.designSystemReport(depProject("hostile-b", Array.from({ length: 20 }, (_, i) => "| N" + i + " | src/components/k0/index.ts |  | _Deprecated_ |"), files)));
    all("1.40 deprecatedUses (R2-DEP-2 b), its cost counted: three barrels renaming the same 20 files, 30 of 40 pages importing two directly — the watch parses exactly the 30 pages that name a renamed file, and each row counts the pages that import its file (got " +
      js({ parsed: h.parsed, naming, rows: h.rows.map((x) => [x.name, x.filesTotal]) }) + ")", {
      parsed: () => naming === 30 && h.parsed === naming,
      counts: () => h.rowsTotal === 20 && h.rows.every((x) => x.filesTotal === want.get(x.name) && x.pathsTotal === 3) && [...want.values()].reduce((a, n) => a + n, 0) === 60,
    });
  }
  {
    // 1.40 (R2-DEP-2 d) — three groups: the rows still imported, then those only rendered with no import (`unbound`: Bootstrap's
    // BsTable in 39 .mdx files, Nuxt's auto-imports — 1.39 listed them with the unused, past DS_LIST cut first), then the rest;
    // the registry's order within each
    const vue = (imp, tag) => L(["<script setup lang=\"ts\">", imp, "</script>", "<template><" + tag + " /></template>"]);
    const files = { "package.json": js({ name: "order" }), "pages/p.vue": vue("import Eee from '../components/Eee.vue';", "Eee"), "pages/q.vue": L(["<template><Ccc /><Ddd /></template>"]) };
    for (const n of ["Aaa", "Bbb", "Ccc", "Ddd", "Eee"]) files["components/" + n + ".vue"] = L(["<template><div /></template>"]);
    const r = usesOf(S.designSystemReport(depProject("order", ["Aaa", "Bbb", "Ccc", "Ddd", "Eee"].map((n) => "| " + n + " | components/" + n + ".vue |  | _Deprecated_ |"), files)));
    all("1.40 deprecatedUses (R2-DEP-2 d): the rows still imported first, then those only rendered with no import, then the rest — the registry's order within each group (got " +
      js(r.rows.map((x) => [x.name, x.filesTotal, x.unbound])) + ")", {
      order: () => js(r.rows.map((x) => x.name)) === js(["Eee", "Ccc", "Ddd", "Aaa", "Bbb"]) && r.rows[1].unbound === 1 && r.rows[3].unbound === 0 && r.rowsTotal === 5,
    });
  }
  {
    // 1.40 (R3-DEP-4) — `import type X from` the row's FILE is an import of it (shadcn-svelte's `import type Calendar from
    // "./calendar.svelte"` for `ComponentProps<typeof Calendar>`): counted by the module check alone — never through its folder
    // (toggle/index.ts, a barrel), never followed; `type from from` is a type named `from`; filtered as a default import is
    // (by its module's base), so through an alias whose last segment is not the file's base it counts where the value import
    // does — nowhere. Kept apart from the imports settle reads: a weak default called under a type-only default import stays a
    // component, under a value one it is dropped. Still 1.39's: `import type { P }` from the file counts
    const T = "src/components/ui/toggle/";
    const files = {
      "package.json": js({ name: "typed" }), "tsconfig.json": js({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"], "#toggle": ["./" + T + "toggle.tsx"] } } }),
      [T + "toggle.tsx"]: L(["export function Toggle() { return <button />; }", "export type ToggleProps = { on: boolean };", "export default Toggle;"]),
      [T + "index.ts"]: L(["export { Toggle } from './toggle';", "export type { ToggleProps } from './toggle';"]),
      "src/components/DataTable.vue": L(["<template><table /></template>"]), "src/components/Calendar.svelte": L(["<div />"]),
      "src/app/file.tsx": L(["import type ToggleT from '@/components/ui/toggle/toggle';", "export const A = (p: { t: ToggleT }) => <div />;"]),
      "src/app/folder.tsx": L(["import type ToggleT from '@/components/ui/toggle';", "export const F = (p: { t: ToggleT }) => <div />;"]),
      "src/app/named.tsx": L(["import type { ToggleProps } from '@/components/ui/toggle/toggle';", "export const N = (p: ToggleProps) => <div />;"]),
      "src/app/e.vue": L(["<script setup lang=\"ts\">", "import type DataTable from '@/components/DataTable.vue';", "const r = ref<InstanceType<typeof DataTable>>();", "</script>", "<template><div /></template>"]),
      "src/app/from.svelte": L(["<script lang=\"ts\">", "import type from from '../components/Calendar.svelte';", "</script>", "<div />"]),
      "src/app/alias-value.tsx": L(["import ToggleV from '#toggle';", "export const V = () => <div>{String(ToggleV)}</div>; // a Toggle"]),
      "src/app/alias-type.tsx": L(["import type ToggleW from '#toggle';", "export const W = (p: { t: ToggleW }) => <div />; // a Toggle"]),
    };
    const rows = ["| Toggle | " + T + "toggle.tsx |  | _Deprecated_ |", "| DataTable | src/components/DataTable.vue |  | _Deprecated_ |", "| Calendar | src/components/Calendar.svelte |  | _Deprecated_ |"];
    const r = S.designSystemReport(depProject("typed", rows, files));
    // (settle's side: a weak default — a PascalCase function that renders nothing — CALLED under a type-only default import
    // stays a component; under a value one it is dropped, a helper)
    const settleOf = (tag, clause) => S.designSystemReport(depProject("typed-settle-" + tag, ["| Table | src/components/Table.tsx |  | _Deprecated_ |"], {
      "package.json": js({ name: "ts" }), "src/components/Table.tsx": compFile("Table"), "src/components/Price.tsx": L(["export default function FormatPrice(v) { return String(v); }"]),
      "src/app/page.tsx": L(["import " + clause + " from '../components/Price';", "export const P = () => <div>{FormatPrice(1)}</div>;"]) })).missing.some((m) => m.name === "FormatPrice");
    const typeOnly = settleOf("type", "type FormatPrice"), value = settleOf("value", "FormatPrice");
    all("1.40 deprecatedUses (R3-DEP-4): `import type X from` the row's file counts (a .tsx, a .vue, a .svelte; `type from from`), never through its folder's barrel, never through an alias the value import is not counted through; settle never reads it (a weak default called under it stays a component) (got " +
      js({ rows: usesOf(r).rows.map((x) => [x.name, x.filesTotal, x.files]), typeOnly, value }) + ")", {
      file: () => js(uses(r, "Toggle")) === js([2, ["src/app/file.tsx", "src/app/named.tsx"]]),
      sfc: () => js(uses(r, "DataTable")) === js([1, ["src/app/e.vue"]]) && js(uses(r, "Calendar")) === js([1, ["src/app/from.svelte"]]),
      settle: () => typeOnly === true && value === false,
    });
  }

  // --- 1.40: the pages the watch parses itself — a count, not a clock ------------------------------------------------------------
  {
    // `parsed` (item 1 c — in-process only: not enumerable, never in the JSON): the texts the watch parses ITSELF — those
    // that name a watched name or a row file's base and that settle did not parse. Twelve pages, the even ones Table's, the odd
    // ones Button's; 0–3 also render Moving (a candidate settle asks: settle parses them, and its parse is not the watch's);
    // one page imports table.tsx as Grid (its base, not its name). table.tsx has NO default export: with one, settle asks the
    // name Table (a default's) and parses every Table page itself — parsed falls to 1 and the Grid page's count is gone
    // (CRIT_1 must-fix 8). The watch reads nothing itself: every fs call under the pages' folder the same with no marker
    const APP = "src/app/", page = (i) => APP + "p" + String(i).padStart(2, "0") + ".tsx";
    const files = { "package.json": js({ name: "parsed" }), "src/components/table.tsx": compFile("Table"),
      "src/components/kit.tsx": L(["export const Moving = motion(Box);", "export function Button() { return <button />; }"]),
      [APP + "grid.tsx"]: L(["import Grid from \"../components/table\";", "export const G = () => <Grid />;"]) };
    const pageOf = (i, wide) => i % 2 === 0
      ? L(["import { Table } from \"../components/table\";"].concat(i < 4 ? ["import { Moving } from \"../components/kit\";"] : [], ["export const P = () => <Table>" + (i < 4 ? "<Moving />" : "") + "</Table>;"]))
      : L(["import { Button" + (i < 4 ? ", Moving" : "") + " } from \"../components/kit\";", "export const P = () => <Button>" + (i < 4 ? "<Moving />" : "") + "</Button>;"].concat(wide ? ["// not a Table"] : []));
    for (let i = 0; i < 12; i++) files[page(i)] = pageOf(i, false);
    const rows = (mark) => ["| Table | src/components/table.tsx |  | " + mark() + " |", "| Button | src/components/kit.tsx |  |  |"];
    const p = depProject("parsed", rows(MARK), files);
    const under = path.join(p, "src", "app") + path.sep;
    const callsOf = (mark) => { write(p, REG, "# Design System\n\n" + HEAD + rows(mark).join("\n") + "\n"); let r = null; const calls = fsCalls(under, () => { r = S.designSystemReport(p); }); return { r, calls }; };
    const off = callsOf(NONE), on = callsOf(MARK);
    const d = usesOf(on.r);
    for (let i = 1; i < 12; i += 2) write(p, page(i), pageOf(i, true));
    const wideR = S.designSystemReport(p), wide = usesOf(wideR), TABLE = [7, [APP + "grid.tsx", page(0), page(2)]];
    all("1.40 deprecatedUses.parsed: the pages the watch parses itself — those naming a watched name or a row file's base that settle did not parse (4 Table pages and the Grid page: 5; every Button page naming Table: 9) —, in-process only (never in the report's JSON: its keys 1.39's), and the watch reads nothing itself: every fs call under the pages' folder the same with no marker (got " +
      js({ parsed: d.parsed, wide: wide.parsed, table: uses(on.r, "Table"), keys: Object.keys(d), on: on.calls, off: off.calls }) + ")", {
      parsed: () => d.parsed === 5 && js(uses(on.r, "Table")) === js(TABLE),
      wide: () => wide.parsed === 9 && js(uses(wideR, "Table")) === js(TABLE),
      hidden: () => !("parsed" in JSON.parse(js(d))) && js(Object.keys(d)) === js(["rows", "rowsTotal", "unlocated", "unlocatedTotal", "read", "limits", "note"]),
      reads: () => js(on.calls) === js(off.calls) && (on.calls.openSync || 0) >= 13,
    });
  }

  // --- 1.39: the bounds — each said in `deprecatedUses.limits` when it cut, never in the report's ---------------------------------
  {
    const TROW = ["| Table | src/components/Table.tsx |  | _Deprecated_ |"];
    const TFILE = { "package.json": js({ name: "b" }), "src/components/Table.tsx": compFile("Table") };
    const limitsOf = (p) => { const r = S.designSystemReport(p); return { codes: usesOf(r).limits, top: r.limits.map((l) => l.code), table: uses(r, "Table") }; };
    // the follow's own bounds (a second instance of settle's: DS_PASS_FILES 2,000 files, DS_PASS_CHARS 8 MB, DS_PASS_STEPS
    // 100,000): a chain of 2,001 `export *` barrels to Table, then of 2,000 (in the count-bound tree below); 33 barrels of 256K
    // characters; a barrel of 11 stars whose 10 first pass on 10,000 names each, the 11th the one to Table
    const fat = depProject("follow-chars", TROW, Object.assign({ "src/app/page.tsx": L(["import { Table } from \"../fat/f00\";", "export const P = () => <Table />;"]) }, TFILE));
    for (let i = 0; i <= 32; i++) write(fat, "src/fat/f" + String(i).padStart(2, "0") + ".ts", (i === 32 ? "export * from \"../components/Table\";\n" : "export * from \"./f" + String(i + 1).padStart(2, "0") + "\";\n") + "// " + "x".repeat(256 * 1024) + "\n");
    const chars = limitsOf(fat);
    const hub = depProject("follow-steps", TROW, Object.assign({ "src/app/page.tsx": L(["import { Table } from \"../hub\";", "export const P = () => <Table />;"]),
      "src/hub.ts": L(Array.from({ length: 11 }, (_, k) => "export * from \"./n/n" + String(k + 1).padStart(2, "0") + "\";")) }, TFILE));
    const names = (k) => L(Array.from({ length: 100 }, (_, j) => "export { " + Array.from({ length: 100 }, (_, i) => "a" + k + "_" + (j * 100 + i)).join(", ") + " } from \"./x\";"));
    for (let k = 1; k <= 10; k++) write(hub, "src/n/n" + String(k).padStart(2, "0") + ".ts", names(k));
    write(hub, "src/n/n11.ts", "export * from \"../components/Table\";\n");
    const steps = limitsOf(hub);
    // (n10 cut to 9,900 names and a last list of n: at 9,954 the last operation is refused in `reach`, at 9,952 it fits)
    const tail = (n) => names(10).split("\n").slice(0, 99).join("\n") + "\nexport { " + Array.from({ length: n }, (_, i) => "a10_" + (9900 + i)).join(", ") + " } from \"./x\";\n";
    write(hub, "src/n/n10.ts", tail(54));
    const reachCut = limitsOf(hub);
    write(hub, "src/n/n10.ts", tail(52));
    const reachFits = limitsOf(hub);
    const FOLLOW = { code: "deprecated-follow", read: 2000, chars: 8 * 1024 * 1024, count: 100000 };
    // the count-bound tree, ONE project (review 1 of 1.39: three trees of 2,001 / 5,001 / 1,001 files read five times cost the
    // file ~2.4× its 1.38.0 time), each limit read from the same report: the chain of 2,001 barrels (the follow's DS_PASS_FILES);
    // settle's read (DS_USAGE_FILES 5,000 files: a weak name asked, so the chain's and 3,010 more `.ts` files go before the markup
    // files — a .vue importing Table past the bound is said); the exports loop's bound (1,000 component files read for what they
    // export: 1,003 here — said, as the report says it). Then the same tree at each bound: the chain of 2,000 (followed, Table's
    // importer counted), only `.ts` files past DS_USAGE_FILES (nothing said: no file the watch reads was left), 1,000 component files
    const tree = depProject("count-bounds", TROW, Object.assign({ "src/app/page.tsx": L(["import { Table } from \"../chain/b0000\";", "export const P = () => <Table />;"]),
      "src/components/kit.tsx": L(["export const Shown = observer(() => <div />);"]), "jsconfig.json": js({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"] } } }),
      "src/views/list.vue": L(["<script setup>", "import Table from '@/components/Table'", "</script>", "<template><Table /></template>"]) }, TFILE));
    // (a folder made once, its files written in it: a mkdir a file cost the block a third of its writes)
    const many = (folder, n, name, text) => { fs.mkdirSync(path.join(tree, folder), { recursive: true }); for (let i = 0; i < n; i++) fs.writeFileSync(path.join(tree, folder, name(i)), text(i)); };
    const p4 = (i) => String(i).padStart(4, "0");
    many("src/chain", 2001, (i) => "b" + p4(i) + ".ts", (i) => (i === 2000 ? "export * from \"../components/Table\";\n" : "export * from \"./b" + p4(i + 1) + "\";\n"));
    many("src/lib", 3010, (i) => "u" + p4(i) + ".ts", () => "export const x = 1;\n");
    many("src/components", 1001, (i) => "c" + p4(i) + ".tsx", (i) => compFile("C" + i));
    const over = limitsOf(tree);
    write(tree, "src/chain/b0000.ts", "export * from \"./b0002\";\n");
    for (const f of ["src/views/list.vue", "src/components/c0998.tsx", "src/components/c0999.tsx", "src/components/c1000.tsx"]) fs.rmSync(path.join(tree, f));
    const at = limitsOf(tree);
    all("1.39 deprecatedUses: its own bounds are said in its `limits` — the follow's (`deprecated-follow`: a chain of 2,001 barrels, 33 of 256K characters, 100,000 steps; a chain of 2,000 is followed, Table's importer counted), settle's read (`usage-files`: the files read, when a file the watch reads was left past DS_USAGE_FILES — 5,014 `.ts` and `.tsx` files before a .vue — never when only `.ts` files were), the exports loop's (`component-files`, as the report says it; 1,000 component files cut nothing) — each from one report of one tree, and none reaches the report's own `limits` but the exports loop's (got " +
      js({ over, at, chars, steps, reachCut, reachFits }) + ")", {
      // (one report: the exports loop's cut repeated first, settle's read, the follow's — and the report's own limits the exports
      // loop's alone)
      over: () => js(over.codes) === js([{ code: "component-files", read: 1000 }, { code: "usage-files", read: 5000 }, FOLLOW]) && js(over.top) === js(["component-files"]) && over.table[0] === 0,
      atBounds: () => js(at.codes) === js([]) && js(at.top) === js([]) && js(at.table) === js([1, ["src/app/page.tsx"]]),
      followChars: () => js(chars.codes) === js([FOLLOW]) && chars.table[0] === 0,
      followSteps: () => js(steps.codes) === js([FOLLOW]) && steps.table[0] === 0,
      followReach: () => js(reachCut.codes) === js([FOLLOW]) && reachCut.table[0] === 0 && js(reachFits.codes) === js([]) && reachFits.table[0] === 1,
    });
  }
  {
    // the watch's places are its own (projectPlaces — the lazy manifest walk and the config budget, DS_TS_CONFIGS 100): 100 apps
    // whose pages import the deprecated Button through their own tsconfig.json's `paths` — read by the watch alone (no page names
    // what settle asks) — then the app whose page renders MotionBox, a candidate settle asks through ITS config: settle's
    // verdict is the scan's with no marker (shared places spent the 100 config reads and lost MotionBox)
    const files = { "package.json": js({ name: "ws" }), "packages/ui/components/kit.tsx": L(["export const MotionBox = motion(Box);", "export function Button() { return <button />; }"]) };
    const cfg = js({ compilerOptions: { paths: { "@ui/*": ["../../packages/ui/*"] } } });
    for (let i = 0; i < 100; i++) {
      const app = "apps/a" + String(i).padStart(3, "0") + "/";
      files[app + "tsconfig.json"] = cfg;
      files[app + "page.tsx"] = L(["import { Button } from \"@ui/components/kit\";", "export const P = () => <Button />;"]);
    }
    files["apps/zzzzzzzz/tsconfig.json"] = cfg;
    files["apps/zzzzzzzz/page.tsx"] = L(["import { MotionBox } from \"@ui/components/kit\";", "export const P = () => <MotionBox />;"]);
    const rows = (mark) => ["| Button | packages/ui/components/kit.tsx |  | " + mark() + " |"];
    const p = depProject("own-places", rows(MARK), files);
    const diff = differential(p, rows);
    const motion = diff.on.missing.filter((m) => m.name === "MotionBox").map((m) => m.path);
    all("1.39 deprecatedUses: the watch's places are its own — 100 configs it reads for its importers spend none of settle's DS_TS_CONFIGS: settle still settles MotionBox through the 101st app's config, every key the scan's with no marker (got " +
      js({ same: diff.same, motion, button: uses(diff.on, "Button") }) + ")", {
      own: () => diff.same === true && js(motion) === js(["packages/ui/components/kit.tsx"]) && uses(diff.on, "Button")[0] === 100,
    });
  }
  {
    // …and its follow's budget is its own (DS_PASS_STEPS 100,000): the first page's Table goes through a hub of 60,000 names the
    // watch alone follows (no page names what settle asks there), the second page's Moving — the candidate settle asks — through
    // another of 60,000: settle still settles it (a budget shared with the watch's ran out before it), every key the same
    const hubFiles = (dir, to) => {
      const out = { ["src/" + dir + "/index.ts"]: L(Array.from({ length: 7 }, (_, k) => "export * from \"./h" + (k + 1) + "\";")) };
      for (let k = 1; k <= 6; k++) out["src/" + dir + "/h" + k + ".ts"] = L(Array.from({ length: 100 }, (_, j) => "export { " + Array.from({ length: 100 }, (_, i) => dir + k + "_" + (j * 100 + i)).join(", ") + " } from \"./x\";"));
      out["src/" + dir + "/h7.ts"] = "export * from \"" + to + "\";\n";
      return out;
    };
    const files = Object.assign({ "package.json": js({ name: "budget" }), "src/components/Table.tsx": compFile("Table"), "src/components/ui/kit.tsx": L(["export const Moving = motion(Box);"]),
      "src/app/a.tsx": L(["import { Table } from \"../hubA\";", "export const P = () => <Table />;"]), "src/app/b.tsx": L(["import { Moving } from \"../hubB\";", "export const P = () => <Moving />;"]) },
    hubFiles("hubA", "../components/Table"), hubFiles("hubB", "../components/ui/kit"));
    const rows = (mark) => ["| Table | src/components/Table.tsx |  | " + mark() + " |"];
    const diff = differential(depProject("own-budget", rows(MARK), files), rows);
    const moving = diff.on.missing.filter((m) => m.name === "Moving").map((m) => m.path);
    all("1.39 deprecatedUses: the watch's follow has a budget of its own — 60,000 steps it spends for its importer leave settle's 100,000 whole: settle still settles Moving through another 60,000, every key the scan's with no marker (got " +
      js({ same: diff.same, moving, table: uses(diff.on, "Table") }) + ")", {
      own: () => diff.same === true && js(moving) === js(["src/components/ui/kit.tsx"]) && uses(diff.on, "Table")[0] === 1,
    });
  }
};
