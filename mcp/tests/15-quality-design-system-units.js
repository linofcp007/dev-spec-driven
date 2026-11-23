"use strict";
// The registry's units table (1.38 — the team's convention, a report): found by its header — the first cell Property /
// Propriedade / Propiedad, a column headed Units / Unidades / Unidad holding at least one CSS unit (a props table is none) —, its
// rows {props, units} (CSS_UNITS: lengths, %, fr; `prefix-*`; never a custom property), the rows it cannot read (`unread`) and
// past its 50 (`past`); the feature report's `units` (each declaration whose first top-level length is off its row — the exact
// row, else the longest prefix; never inside calc() / clamp() / var(), never 0, a custom property, a Sass variable; Tailwind's
// arbitrary sizes by the property they set); the project report's `unitsTable`. Never finish (15-…-scale) or doctor.
// 1.39 (item 4 as cut, 1.38.0 review 1's T2 / T3): a negative length is judged (a minus at the value's start or after a blank /
// a comma), Tailwind's sizes in ANY unit (RE_TW_UNIT, the table's own — RE_TW_SIZE stays the raw values'); a units column by a
// WORD of its header when none starts with it; the task brief quotes the table's rows (its own 400-character bound).

const fs = require("fs");
const path = require("path");

exports.run = async ({ all, S, tmp, require, __dirname }) => {
  const js = (v) => JSON.stringify(v);
  const E = require(path.join(__dirname, "lib", "engine", "index.js"));
  const write = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  const lines = (...l) => l.join("\n") + "\n";
  const table = (head, rows) => "| " + head.join(" | ") + " |\n|" + head.map(() => "---").join("|") + "|\n" + rows.map((r) => "| " + r.join(" | ") + " |").join("\n") + "\n";
  const REG = (more) => "# Design System\n\n| Token | Value | Use |\n|---|---|---|\n| --space-4 | 16px | gaps |\n\n" + more;
  let k = 0;
  const project = (reg, files) => {
    const p = path.join(tmp, "proj-units-" + ++k);
    S.initProject(p, ["ui"], "en");
    if (reg != null) write(p, ".specs/steering/design-system.md", reg);
    for (const [rel, text] of Object.entries(files || {})) write(p, rel, text);
    return p;
  };
  const units = (reg) => E.designSystemRegistry(path.join(project(reg), ".specs")).units;
  const feature = (reg, files) => {
    const p = project(reg, files);
    const f = S.createFeature(p, { name: "Checkout", tracks: ["ui"], summary: "x" });
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Build the checkout\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/checkout/_\n  - _Verify: npm test_\n");
    return S.designSystemReport(p, { name: f.slug });
  };

  { // the reader: by its header, wherever it stands (under any heading), in EN / PT / ES; a props table, a table whose units
    // column is not headed, a table of no CSS unit are none; a word that is no CSS unit is dropped, a row left with none unread
    const got = {
      en: units(REG("## Anything\n\n" + table(["Property", "Units"], [["`font-size`, line-height", "rem, em, rems"], ["margin-*", "rem"], ["spacing", "small"], ["--gap", "px"], ["[property]", "[units]"]]))),
      pt: units(REG(table(["Propriedade", "Unidades"], [["font-size", "rem"]]))), es: units(REG(table(["Propiedad", "Unidad"], [["border-width", "px"]]))),
      props: units(REG(table(["Property", "Type", "Default"], [["variant", "string", "primary"], ["size", "px", "md"]]))),
      third: units(REG(table(["Property", "Notes", "Units"], [["gap", "px is fine", "rem"]]))),
      noUnit: units(REG(table(["Property", "Units"], [["spacing", "small"]]))), none: units(REG("")),
      two: units(REG(table(["Property", "Units"], [["gap", "rem"]]) + "\n## More\n\n" + table(["Property", "Units"], [["border-width", "px"]]))),
      past: (() => { const u = units(REG(table(["Property", "Units"], Array.from({ length: 60 }, (_, i) => ["p" + String.fromCharCode(97 + (i % 26)) + i.toString(36).replace(/\d/g, "x"), "px"])))); return u && [u.rows.length, u.unread.length, u.past]; })(),
    };
    all("1.38 units table: read by its header — `| Property | Units |` under any heading (rem, em kept, `rems` dropped; `margin-*` a prefix; `spacing | small` and a `--gap` row unread, a `[property]` slot row none), PT `| Propriedade | Unidades |`, ES `| Propiedad | Unidad |`, a units column in third place; a props table (`| Property | Type | Default |`, even with `px` in a cell), a table of no CSS unit and no table → null; 60 rows → 50 read, 10 past (got " + js(got) + ")", {
      en: () => js(got.en) === js({ rows: [{ props: ["font-size", "line-height"], units: ["rem", "em"] }, { props: ["margin-*"], units: ["rem"] }], unread: ["spacing", "--gap"], past: 0 }),
      pt: () => js(got.pt.rows) === js([{ props: ["font-size"], units: ["rem"] }]) && js(got.es.rows) === js([{ props: ["border-width"], units: ["px"] }]),
      third: () => js(got.third.rows) === js([{ props: ["gap"], units: ["rem"] }]),
      two: () => js(got.two.rows) === js([{ props: ["gap"], units: ["rem"] }, { props: ["border-width"], units: ["px"] }]),
      none: () => got.props === null && got.noUnit === null && got.none === null,
      past: () => js(got.past) === js([50, 0, 10]),
    });
  }

  { // the feature report: each declaration whose first top-level length the row does not allow — the exact row first, else the
    // LONGEST `prefix-*` (`margin-*` covers margin and margin-top); never inside calc() / clamp() / var(), never 0, a custom
    // property, a Sass variable, a unitless value, a hex colour's digits; one finding a declaration; Tailwind's text-[14px] by its
    // property; a unit in capitals
    // (the longer prefix written BEFORE the shorter one: the longest wins, never the last; MARGIN-LEFT in capitals; an unclosed
    // calc( holds the rest; a stray `)` closes nothing)
    const T = table(["Property", "Units"], [["margin-*", "rem"], ["border-top-*", "rem"], ["border-*", "px"], ["border-radius", "rem"], ["width, max-width", "%"], ["font-size", "rem, em"],
      ["padding", "rem"], ["line-height", "rem"], ["color", "px"], ["gap", "rem"]]);
    const r = feature(REG(T), {
      "src/checkout/c.css": lines(".a {", "  margin: 4px;", "  margin-top: 8px;", "  margin-left: 1rem;", "  border-width: 2px;", "  border-top-width: 2px;", "  border-radius: 4px;",
        "  width: calc(100% - 16px);", "  max-width: clamp(1rem, 50%, 2rem);", "  width: 10px;", "  font-size: 14PX;", "  margin: 0;", "  margin-bottom: 0px;", "  padding: 12px 13px;",
        "  line-height: 1.5;", "  color: #123abc;", "  --gap: 12px;", "  gap: var(--gap) 12px;", "  MARGIN-LEFT: 3px;", "  max-width: calc(100% - 16px", "}", "$gap: 12px;", ".b { width: 1%) calc(1px) 3px; }"),
      "src/checkout/C.tsx": lines("export const C = () => <div className=\"md:text-[14px] text-[1rem] mt-[3px] p-[1rem]\" style={{ padding: 13 }} />;"),
    });
    const got = r.units && { list: r.units.findings.map((x) => x.file.slice(13) + ":" + x.line + " " + x.value + " (" + x.unit + "; " + x.allowed.join(", ") + ")"), total: r.units.total, by: r.units.byProperty };
    all("1.38 units: margin / margin-top (`margin-*`), border-top-width (the longer `border-top-*`, written first), border-radius (exact over `border-*`), width: 10px, font-size: 14PX (px), padding 12px 13px (once), gap's top-level 12px, MARGIN-LEFT: 3px, `width: 1%) calc(1px) 3px` (a stray `)`), Tailwind's md:text-[14px] and mt-[3px]; never border-width (px allowed), calc() / clamp() / an unclosed calc(, margin: 0 / 0px, a unitless line-height, a hex colour #123abc, a custom property, a Sass variable (got " + js(got) + ")", {
      list: () => js(got.list) === js(["C.tsx:1 md:text-[14px] (px; rem, em)", "C.tsx:1 mt-[3px] (px; rem)", "c.css:2 margin: 4px (px; rem)", "c.css:3 margin-top: 8px (px; rem)",
        "c.css:6 border-top-width: 2px (px; rem)", "c.css:7 border-radius: 4px (px; rem)", "c.css:10 width: 10px (px; %)", "c.css:11 font-size: 14PX (px; rem, em)", "c.css:14 padding: 12px 13px (px; rem)",
        "c.css:18 gap: var(--gap) 12px (px; rem)", "c.css:19 margin-left: 3px (px; rem)", "c.css:23 width: 1%) calc(1px) 3px (px; %)"]),
      total: () => got.total === 12 && js(got.by) === js({ "font-size": 2, "margin-top": 2, margin: 1, "border-top-width": 1, "border-radius": 1, width: 2, padding: 1, gap: 1, "margin-left": 1 }),
    });
  }

  { // Tailwind's arbitrary sizes, each by the property it sets (twProperty): p / m and their sides, gap and its axes, space-x /
    // space-y, text, leading, tracking, rounded and a corner
    const T = table(["Property", "Units"], [["padding-*, margin-*, gap, column-gap, row-gap, font-size, line-height, letter-spacing, border-radius", "rem"]]);
    const r = feature(REG(T), { "src/checkout/C.tsx": lines("export const C = () => <div className=\"p-[1px] pt-[1px] pr-[1px] pb-[1px] pl-[1px] px-[1px] py-[1px] ps-[1px] pe-[1px] m-[1px] mx-[1px] gap-[1px] gap-x-[1px] gap-y-[1px] space-x-[1px] space-y-[1px] text-[1px] leading-[1px] tracking-[1px] rounded-[1px] rounded-tl-[1px]\" />;") });
    const got = r.units.findings.map((x) => x.value + "=" + x.property);
    all("1.38 units: each Tailwind arbitrary size by the property it sets — padding / margin and their sides (x / y the inline / block axes, s / e their start / end), gap and column-gap / row-gap, space-x / space-y the inline / block start margin, text the font size, leading the line height, tracking the letter spacing, rounded and a corner the border radius (got " + js(got) + ")", {
      exact: () => js(got) === js(["p-[1px]=padding", "pt-[1px]=padding-top", "pr-[1px]=padding-right", "pb-[1px]=padding-bottom", "pl-[1px]=padding-left", "px-[1px]=padding-inline",
        "py-[1px]=padding-block", "ps-[1px]=padding-inline-start", "pe-[1px]=padding-inline-end", "m-[1px]=margin", "mx-[1px]=margin-inline", "gap-[1px]=gap", "gap-x-[1px]=column-gap",
        "gap-y-[1px]=row-gap", "space-x-[1px]=margin-inline-start", "space-y-[1px]=margin-block-start", "text-[1px]=font-size", "leading-[1px]=line-height", "tracking-[1px]=letter-spacing",
        "rounded-[1px]=border-radius", "rounded-tl-[1px]=border-radius"]),
    });
  }

  { // the bounds and the shapes: no table → `units: null`; 250 findings in a file → all counted (total 250), 50 listed; the
    // project report's `unitsTable` (rows, unread, past) — never part of inSync
    const none = feature(REG(""), { "src/checkout/c.css": ".a { margin: 4px; }\n" });
    const many = feature(REG(table(["Property", "Units"], [["margin", "rem"], ["spacing", "small"]])), { "src/checkout/c.css": Array.from({ length: 250 }, (_, i) => ".a" + i + " { margin: " + (i + 1) + "px; }").join("\n") + "\n" });
    const p = project("# Design System\n\n_Token sources: src/styles/tokens.css_\n\n| Token | Value | Use |\n|---|---|---|\n| --a | 1px | x |\n\n" + table(["Property", "Units"], [["margin", "rem"], ["spacing", "small"]]),
      { "src/styles/tokens.css": ":root { --a: 1px; }\n" });
    const pr = S.designSystemReport(p), bare = S.designSystemReport(project(REG(""), {}));
    const got = { none: none.units, many: many.units && [many.units.findings.length, many.units.total, many.units.byProperty], project: [pr.unitsTable, pr.inSync], bare: bare.unitsTable };
    all("1.38 units: no table → null; 250 findings in one file → 50 listed, total 250 (every one counted); the project report says the table's rows / unread / past and stays in sync; without a table, unitsTable null (got " + js(got) + ")", {
      none: () => none.units === null,
      many: () => js(got.many) === js([50, 250, { margin: 250 }]),
      project: () => js(pr.unitsTable) === js({ rows: 1, unread: ["spacing"], past: 0 }) && pr.inSync === true,
      bare: () => bare.unitsTable === null,
    });
  }

  // --- 1.39: T2 — a negative length, Tailwind's sizes in any unit ----------------------------------------------------------------
  { // offUnit (design-values.js RE_UNIT_LITERAL): a minus at the value's start or after a blank / a comma signs a length; a word's,
    // a custom property's, a hex colour's digits never (`a-12px`, `$gap-8px`, `--12px`, `#12px`, `translate-12px`)
    const T = E.loadLazyTier();
    const at = (v) => T.offUnit(v, ["rem"]);
    const got = Object.fromEntries(["0 -8px", "-12px", "0 0,-8px 0", "0\t-8px", "-.5em", "-1px !important", "0 8px", "a-12px", "$gap-8px", "--12px", "#12px", "translate-12px", "calc(-8px + 1rem)", "-0px"]
      .map((v) => [v, at(v)]));
    all("1.39 units, T2: offUnit judges a negative length — `0 -8px`, `-12px`, after a comma (`0 0,-8px 0`) or a tab, `-.5em`, Bootstrap's `-1px !important` —, never a word's, a Sass variable's, a custom property's or a hex colour's digits (`a-12px`, `$gap-8px`, `--12px`, `#12px`, `translate-12px`), inside calc(), a negative zero (got " + js(got) + ")", {
      blank: () => got["0 -8px"] === "px" && got["0\t-8px"] === "px" && got["0 8px"] === "px",
      start: () => got["-12px"] === "px" && got["-.5em"] === "em" && got["-1px !important"] === "px",
      comma: () => got["0 0,-8px 0"] === "px",
      words: () => ["a-12px", "$gap-8px", "--12px", "#12px", "translate-12px", "calc(-8px + 1rem)", "-0px"].every((v) => got[v] === null),
    });
  }

  { // the feature report on real shapes: a stylesheet's negative lengths (YuriiHayakawa's `margin: 0 -16px`, Bootstrap's
    // `_visually-hidden.scss:12`, its examples' `-.5em`, a minified comma); Tailwind's (sinhong's `-ml-[3px]`, `md:-mx-[8px]`, a
    // bracketed minus, podman's `py-[3pt]`, runwithbee's `text-[11vw]`, magicui's `leading-[100%]`, `rounded-[50%]`, a 5-letter
    // unit) — never scroll-margin's `scroll-mt-[…]`, a unitless or a colour value, an allowed unit; the raw values unchanged
    // (RE_TW_SIZE: px / rem / em, no minus — 1.38's list)
    const T = table(["Property", "Units"], [["margin-*, padding-*", "rem"], ["font-size", "rem, em"], ["line-height", "rem"], ["border-radius", "rem"], ["background-position", "rem"]]);
    const r = feature(REG(T), {
      "src/checkout/c.css": lines(".a {", "  margin: 0 -16px;", "  margin: -1px !important;", "  margin-top: -.5em;", "  background-position: 0 0,-8px 0;", "  margin: $gap-8px;",
        "  margin: calc(-8px + 1rem);", "  margin: 0 8px;", "}"),
      "src/checkout/C.tsx": lines("export const C = () => <div className=\"-ml-[3px] md:-mx-[8px] mt-[-12px] py-[3pt] text-[11vw] leading-[100%] rounded-[50%] py-[2vmin] scroll-mt-[12px] leading-[1.5] text-[#fff] text-[1rem] p-[13px]\" />;",
        "export const D = () => <div className=\"pt-[2svmin] text-[3inches]\" />;"),
    });
    const got = { units: r.units && r.units.findings.map((x) => x.file.slice(13) + ":" + x.line + " " + x.value + "=" + x.property + " (" + x.unit + ")"), total: r.units && r.units.total,
      raw: r.raw.filter((x) => x.kind === "size").map((x) => x.file.slice(13) + ":" + x.line + " " + x.value) };
    // (1.38.0's raw sizes of these two files, the oracle's run: no negative length, no unit outside px / rem / em)
    const RAW138 = ["C.tsx:1 text-[1rem]", "C.tsx:1 p-[13px]", "c.css:8 margin: 0 8px"];
    all("1.39 units, T2: the feature report lists a stylesheet's negative lengths (`margin: 0 -16px`, `-1px !important`, `-.5em`, `0 0,-8px 0`) and Tailwind's sizes in any unit, negative ones too (`-ml-[3px]`, `md:-mx-[8px]`, `mt-[-12px]`, `py-[3pt]`, `text-[11vw]`, `leading-[100%]`, `rounded-[50%]`, `py-[2vmin]`, CSS's longest unit `pt-[2svmin]`), each by the property it sets; never `$gap-8px`, calc(), `scroll-mt-[12px]`, `leading-[1.5]`, `text-[#fff]`, `text-[1rem]`, a word of 6 letters (`text-[3inches]`); the raw sizes stay RE_TW_SIZE's (got " + js(got) + ")", {
      css: () => js(got.units.filter((x) => x.startsWith("c.css"))) === js(["c.css:2 margin: 0 -16px=margin (px)", "c.css:3 margin: -1px !important=margin (px)", "c.css:4 margin-top: -.5em=margin-top (em)",
        "c.css:5 background-position: 0 0,-8px 0=background-position (px)", "c.css:8 margin: 0 8px=margin (px)"]),
      tailwind: () => js(got.units.filter((x) => x.startsWith("C.tsx"))) === js(["C.tsx:1 -ml-[3px]=margin-left (px)", "C.tsx:1 md:-mx-[8px]=margin-inline (px)", "C.tsx:1 mt-[-12px]=margin-top (px)",
        "C.tsx:1 py-[3pt]=padding-block (pt)", "C.tsx:1 text-[11vw]=font-size (vw)", "C.tsx:1 leading-[100%]=line-height (%)", "C.tsx:1 rounded-[50%]=border-radius (%)", "C.tsx:1 py-[2vmin]=padding-block (vmin)",
        "C.tsx:1 p-[13px]=padding (px)", "C.tsx:2 pt-[2svmin]=padding-top (svmin)"]),
      total: () => got.total === 15,
      raw: () => js(got.raw) === js(RAW138),
    });
  }

  // --- 1.39: T3 — a units column by a WORD of its header ---------------------------------------------------------------------------
  { // the 1.38 header (one that STARTS with Units / Unidades / Unidad) first, wherever it stands — every 1.38 table reads the same
    // —, else the first header holding the word (RE_DS_UNITS_WORD): `Allowed units`, `Las unidades`, a singular; never inside
    // another word of any script (`Comunidade`, `Unitless`, PT `Valor unitário`); still ≥ 1 CSS unit (`Default unit` with `16`)
    const got = {
      allowed: units(REG(table(["Property", "Allowed units"], [["margin-*", "rem"]]))),
      singular: units(REG(table(["Property", "Allowed unit"], [["gap", "px"]]))),
      es: units(REG(table(["Propiedad", "Las unidades"], [["gap", "rem"]]))),
      order: units(REG(table(["Property", "Notes on units", "Units"], [["gap", "px is fine", "rem"]]))),
      first: units(REG(table(["Property", "Units", "Allowed units"], [["gap", "rem", "px"]]))),
      defaultUnit: units(REG(table(["Property", "Default unit"], [["font-size", "16"]]))),
      community: units(REG(table(["Propriedade", "Comunidade"], [["gap", "px"]]))),
      unitless: units(REG(table(["Property", "Unitless"], [["gap", "px"]]))),
      unitario: units(REG(table(["Propriedade", "Valor unitário"], [["gap", "px"]]))),
      v138: [table(["Property", "Units"], [["gap", "rem"]]), table(["Propriedade", "Unidades"], [["gap", "rem"]]), table(["Propiedad", "Unidad"], [["gap", "rem"]]), table(["Property", "Notes", "Units"], [["gap", "px", "rem"]])]
        .map((t) => units(REG(t)) && units(REG(t)).rows),
    };
    all("1.39 units, T3: a header that STARTS with Units still wins (1.38's four shapes read the same; `| Property | Notes on units | Units |` → column 3, never the notes' px); else one holding the word — `Allowed units`, `Allowed unit`, ES `Las unidades`; never `Comunidade`, `Unitless`, `Valor unitário`; a `Default unit` column of numbers is none (got " + js(got) + ")", {
      word: () => js(got.allowed && got.allowed.rows) === js([{ props: ["margin-*"], units: ["rem"] }]) && js(got.singular && got.singular.rows) === js([{ props: ["gap"], units: ["px"] }])
        && js(got.es && got.es.rows) === js([{ props: ["gap"], units: ["rem"] }]),
      tier1: () => js(got.order.rows) === js([{ props: ["gap"], units: ["rem"] }]) && js(got.first.rows) === js([{ props: ["gap"], units: ["rem"] }]),
      v138: () => got.v138.every((r) => js(r) === js([{ props: ["gap"], units: ["rem"] }])),
      none: () => got.defaultUnit === null && got.community === null && got.unitless === null && got.unitario === null,
    });
  }

  // --- 1.39: the task brief quotes the table (quality.js DS_BRIEF_UNITS, its own bound) ------------------------------------------
  {
    const QY = fs.readFileSync(path.join(__dirname, "lib", "engine", "quality.js"), "utf8");
    const bound = Number((QY.match(/const DS_BRIEF_UNITS = (\d+);/) || [])[1]);
    const USAGE = (names) => "# Design: Checkout\n\n## Overview\nOne page.\n\n## [UI] Design System Usage\nBuilt from the system.\n\n| Kind | Component | Why / notes |\n|---|---|---|\n" +
      names.map(([n, why]) => "| Reuse | " + n + " | " + why + " |").join("\n") + "\n";
    // a brief of task 1 (a view file: uiTask) and task 2 (a store: none) → { part (the Design system part's text), b1, b2 }
    const brief = (tag, reg, design, lang, opts) => {
      const p = path.join(tmp, "proj-units-brief-" + tag);
      S.initProject(p, ["ui"], lang || "en");
      if (reg != null) write(p, ".specs/steering/design-system.md", reg);
      const f = S.createFeature(p, { name: "Checkout", tracks: ["ui"], summary: "x", ...(lang ? { lang } : {}) });
      if (design != null) fs.writeFileSync(path.join(f.dir, "design.md"), design);
      fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Build the checkout page\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/checkout/Checkout.tsx_\n  - _Verify: npm test_\n" +
        "- [ ] 2. [US1] Store the order\n  - _Requirements: US-1.AC-2_\n  - _Implements: src/orders/store.ts_\n  - _Verify: npm test_\n");
      const b1 = S.taskBrief(p, f.slug, 1, opts), b2 = S.taskBrief(p, f.slug, 2);
      const at = b1.brief ? b1.brief.indexOf("## Design system") : -1;
      return { part: at < 0 ? "" : b1.brief.slice(at, b1.brief.indexOf("\n## ", at + 3)), b1, b2 };
    };
    const UNITS3 = "## Units\n" + table(["Property", "Units"], [["font-size, line-height", "rem"], ["margin-*, padding-*, gap", "rem, %"], ["border-width, outline-width", "px"]]);
    const LINE3 = "Units — the registry's table, the team's convention: font-size, line-height: rem · margin-*, padding-*, gap: rem, % · border-width, outline-width: px.";
    const ROWS3 = [{ props: ["font-size", "line-height"], units: ["rem"] }, { props: ["margin-*", "padding-*", "gap"], units: ["rem", "%"] }, { props: ["border-width", "outline-width"], units: ["px"] }];
    // a property of letters (RE_DS_UNIT_PROP: letters and hyphens), `border-aa-width` … — 15 characters; a row's text, `px` and
    // its `: ` and ` · `, 22: 18 rows within 400 (396), never 19 (418) — a formula without the separators quotes 20 or 21.
    // `long(23)`: one cell of 23 (389 characters, under the cell's 400), a row of 396 — past what 400 leaves after one short row
    // (378); `long(24)` is cut at the cell's 400 and its row (407) passes the bound alone
    const prop = (i) => "border-" + "abcdefghijklmnopqrstuvwxyz"[i % 26] + "abcdefghijklmnopqrstuvwxyz"[Math.floor(i / 26)] + "-width";
    const many = (n) => table(["Property", "Units"], Array.from({ length: n }, (_, i) => [prop(i), "px"]));
    const long = (n) => Array.from({ length: n }, (_, i) => prop(i)).join(", ");
    // 12 components filling the components' 1,500 characters to within 10 (each entry: name + path + why + 20)
    const C12 = Array.from({ length: 12 }, (_, i) => ["C" + String(i).padStart(2, "0"), "x".repeat(i === 11 ? 89 : 87)]);
    const REG12 = "# Design System\n\n| Component | Path |\n|---|---|\n" + C12.map(([n]) => "| " + n + " | src/ui/" + n + ".tsx |").join("\n") + "\n\n";
    const got = {
      three: brief("three", REG(UNITS3), USAGE([["Button", "the pay action"]])),
      only: brief("only", "# Design System\n\n" + UNITS3, null),
      none: brief("none", REG(""), USAGE([["Button", "x"]])),
      written: brief("written", REG(UNITS3), null, null, { write: true }),
      full: brief("full", REG12, USAGE(C12)), fullUnits: brief("full-units", REG12 + UNITS3, USAGE(C12)),
      sixty: brief("sixty", REG(many(60)), null),
      // (20 rows of 20 — `margin-aa-top: px` and its separators —: exactly the bound, every row quoted)
      exact: brief("exact", REG(table(["Property", "Units"], Array.from({ length: 20 }, (_, i) => [prop(i).replace("border-", "margin-").replace("-width", "-top"), "px"]))), null),
      skip: brief("skip", REG(table(["Property", "Units"], [[prop(0), "px"], [long(23), "px"], [prop(1), "px"]])), null),
      tooLong: brief("too-long", REG(table(["Property", "Units"], [[long(24), "px"]])), null),
      // (1.39.0 review 1, BU-4 — W1–W3: a long FIRST row, two short ones after it — the line says the first is too long, then
      // how many rows the registry holds; EN / PT / ES)
      firstLong: Object.fromEntries(["en", "pt", "es"].map((l) => [l, brief("first-long-" + l, REG(table(["Property", "Units"], [[long(24), "px"], ["font-size", "rem"], ["gap", "rem, %"]])), null, l === "en" ? null : l)])),
      pt: brief("pt", REG(UNITS3), null, "pt"),
    };
    const sixtyList = Array.from({ length: 18 }, (_, i) => prop(i) + ": px").join(" · ");
    const comps = (b) => b.b1.designSystem && [b.b1.designSystem.components.map((c) => c.name), /more component/.test(b.part)];
    all("1.39 brief: a UI task's Design system part quotes the units table after its tokens line — `" + LINE3 + "` — and the result's `designSystem.units` {rows, more}; a registry holding ONLY a units table opens the part (a blank line before); no table → no line, no `units` key; a non-UI task, write: true → none; its own " + bound + "-character bound — 60 rows: the first 18 (their text within it), `+42 more` (the 32 past it and the table's 10 past its 50), 20 rows of exactly 400 all, a long row ends the quote, a first row too long is said as the first, with the rows the registry holds (1.39.0 review 1, BU-4 — EN / PT / ES) —, the components' 1,500 untouched; PT (got " +
      js({ three: got.three.part, only: got.only.part, sixty: got.sixty.b1.designSystem && got.sixty.b1.designSystem.units, skip: got.skip.b1.designSystem && got.skip.b1.designSystem.units, tooLong: got.tooLong.part, pt: got.pt.part,
        firstLong: Object.fromEntries(Object.entries(got.firstLong).map(([l, b]) => [l, (b.part.match(/^Unid.*$|^Units — .*$/m) || [""])[0]])),
        full: [comps(got.full), comps(got.fullUnits)] }) + ")", {
      line: () => got.three.part.includes("\n\nTokens: 1 in the registry.\n" + LINE3 + "\n") && bound === 400,
      json: () => js(got.three.b1.designSystem.units) === js({ rows: ROWS3, more: 0 }),
      only: () => got.only.part.includes("before creating anything.\n\n" + LINE3) && !got.only.part.includes("Tokens:") && js(got.only.b1.designSystem.units) === js({ rows: ROWS3, more: 0 }),
      noTable: () => !got.none.part.includes("Units —") && got.none.part.includes("## Design system") && !("units" in got.none.b1.designSystem),
      nonUi: () => got.three.b2.designSystem === undefined && !got.three.b2.brief.includes("Units —"),
      written: () => got.written.b1.designSystem === undefined,
      bound: () => js(got.sixty.b1.designSystem.units.rows.map((r) => r.props[0])) === js(Array.from({ length: 18 }, (_, i) => prop(i))) && got.sixty.b1.designSystem.units.more === 42
        && got.sixty.part.includes(": " + sixtyList + ". (+42 more rows in the registry)") && sixtyList.length <= bound
        && got.exact.b1.designSystem.units.rows.length === 20 && got.exact.b1.designSystem.units.more === 0,
      prefix: () => js(got.skip.b1.designSystem.units) === js({ rows: [{ props: [prop(0)], units: ["px"] }], more: 2 }),
      tooLong: () => got.tooLong.part.includes("Units — the registry's table, the team's convention: the first row is too long to quote here — 1 row in the registry: read it there.") && js(got.tooLong.b1.designSystem.units) === js({ rows: [], more: 1 }),
      firstLong: () => got.firstLong.en.part.includes("Units — the registry's table, the team's convention: the first row is too long to quote here — 3 rows in the registry: read them there.") &&
        got.firstLong.pt.part.includes("Unidades — a tabela do registo, a convenção da equipa: a primeira linha é longa demais para citar aqui — 3 linhas no registo: lê-as lá.") &&
        got.firstLong.es.part.includes("Unidades — la tabla del registro, la convención del equipo: la primera fila es demasiado larga para citarla aquí — 3 filas en el registro: léelas allí.") &&
        ["en", "pt", "es"].every((l) => js(got.firstLong[l].b1.designSystem.units) === js({ rows: [], more: 3 })) &&
        require(path.join(__dirname, "lib", "i18n.js")).brief("pt-BR").designSystemUnits("", 3).endsWith("— 3 linhas no registro: leia-as lá."), // (pt-BR derived: a clause start after the colon)
      budget: () => js(comps(got.full)) === js([C12.map(([n]) => n), false]) && js(comps(got.fullUnits)) === js(comps(got.full)),
      pt: () => got.pt.part.includes("Unidades — a tabela do registo, a convenção da equipa: font-size, line-height: rem · margin-*, padding-*, gap: rem, % · border-width, outline-width: px."),
    });
  }
};
