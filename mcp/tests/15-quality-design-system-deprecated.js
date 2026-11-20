"use strict";
// The design-system registry — 1.37: a component row marked `_Deprecated: use X_` (its reader, the replacement it names, the brief).
// Every fixture below was written from a mutation of the rule it names (the mutation list came first): each must fail without it.

const fs = require("fs");
const path = require("path");

exports.run = async ({ all, S, tmp, remeasure, require, __dirname }) => {
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
