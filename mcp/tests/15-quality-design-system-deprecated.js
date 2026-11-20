"use strict";
// The design-system registry — 1.37: a component row marked `_Deprecated: use X_` (its reader, the replacement it names, the brief)
// and doctor's ui-deprecated (a Reuse / Extend row naming one: a warn, never a fail, never on a finished feature; spec_upgrade).
// Every fixture below was written from a mutation of the rule it names (the mutation list came first): each must fail without it.

const fs = require("fs");
const path = require("path");

exports.run = async ({ all, rpc, payload, S, tmp, approveBefore, remeasure, require, __dirname }) => {
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
      "| DataGrid | src/components/DataGrid.tsx |  |  |",
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
    ]);
    const dep = reg.deprecated;
    all("1.37 registry: `_Deprecated: use X_` in a component row (any cell after the name, any case; bare, closed, the label alone italic or never closed; at a cell's start or after a blank, `(` or `*` — never inside a word) marks it deprecated: `deprecated` maps its key to the replacement — the first OTHER listed component its text names, a word or two adjacent ones, as written there; \"\" when it names none —, the marker is cut out of its cell (a path stays a path) and shown first in the notes, whole; `_From:_` beside it is still read (got " +
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
      count: () => dep.size === 19 && !dep.has("datagrid"),
    });
  }
  {
    // past the 500 rows read in full: a row there is still marked, and a replacement listed there is still found
    const rows = Array.from({ length: 520 }, (_, i) => "| C" + i + " | src/c" + i + ".tsx |  | " + (i === 0 ? "_Deprecated: use C510_" : i === 519 ? "_Deprecated_" : "") + " |");
    const big = registryOf("past-cap", rows);
    // `Data` AND `DataGrid` listed: `use Data Grid` names DataGrid (two words before one)
    const both = registryOf("pair-first", ["| Data | src/Data.tsx |  |  |", "| DataGrid | src/DataGrid.tsx |  |  |", "| Table | src/Table.tsx |  | _Deprecated: use Data Grid_ |"]);
    // the text the notes show is bounded (120 characters, the blank its cut ends on dropped) — a replacement is looked for in all
    // of it, among its first 20 words
    const longText = "use the grid " + "x".repeat(106) + " DataGrid then " + "y".repeat(160);
    const words = (n) => Array.from({ length: n }, (_, i) => "w" + i).join(" ");
    const shown = registryOf("shown", ["| DataGrid | src/DataGrid.tsx |  |  |", "| Long | src/Long.tsx |  | _Deprecated: " + longText + "_ |",
      "| Busy | src/Busy.tsx | _Deprecated: use DataGrid_ | " + "n".repeat(190) + " |",
      "| Far | src/Far.tsx |  | _Deprecated: " + words(20) + " DataGrid_ |", "| Near | src/Near.tsx |  | _Deprecated: " + words(19) + " DataGrid_ |"]);
    const none = registryOf("none", ["| Button | src/Button.tsx |  | every action |"]);
    all("1.37 registry: a deprecated row past the 500 read in full is still marked, and a replacement listed past them still found; two adjacent words are asked before one; the notes show the marker's first 120 characters, closed, BEFORE the other notes (their 200-character bound never cuts it), while its replacement is looked for among the first 20 words of all of it; a registry with no marker has an empty map (got " +
      js({ big: [depOf(big).get("c0"), depOf(big).get("c519"), big.components.length], both: [...depOf(both)], shown: [...depOf(shown)], notes: shown.components.map((c) => c.notes), none: none.deprecated && none.deprecated.size }) + ")", {
      pastCap: () => big.components.length === 500 && big.deprecated.has("c519") && big.deprecated.get("c519") === "",
      pastCapReplacement: () => big.deprecated.get("c0") === "C510",
      pairFirst: () => both.deprecated.get("table") === "Data Grid",
      shown: () => comp(shown, "Long").notes === "_Deprecated: " + longText.slice(0, 120).trim() + "_",
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
    all("1.37 registry: the marker is read in linear time — 1,000 cells of `_Deprecated: ` and 190 `_a` (each `_` a closing candidate) within 3× + 0.3 s of 1,000 plain markers of the same length read at the same moment (got " + js(t) + ")", {
      linear: () => linear(t),
      read: () => t.h === 1000 && t.c === 1000,
    });
  }
};
