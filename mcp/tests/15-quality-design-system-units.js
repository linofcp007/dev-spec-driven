"use strict";
// The registry's units table (1.38 — the team's convention, a report): found by its header — the first cell Property /
// Propriedade / Propiedad, a column headed Units / Unidades / Unidad holding at least one CSS unit (a props table is none) —, its
// rows {props, units} (CSS_UNITS: lengths, %, fr; `prefix-*`; never a custom property), the rows it cannot read (`unread`) and
// past its 50 (`past`); the feature report's `units` (each declaration whose first top-level length is off its row — the exact
// row, else the longest prefix; never inside calc() / clamp() / var(), never 0, a custom property, a Sass variable; Tailwind's
// arbitrary sizes by the property they set); the project report's `unitsTable`. Never finish (15-…-scale), doctor or the brief.

const fs = require("fs");
const path = require("path");

exports.run = async ({ all, remeasure, S, tmp, require, __dirname }) => {
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
      en: units(REG("## Anything\n\n" + table(["Property", "Units"], [["`font-size`, line-height", "rem, em, rems"], ["margin-*", "rem"], ["spacing", "small"], ["--gap", "px"]]))),
      pt: units(REG(table(["Propriedade", "Unidades"], [["font-size", "rem"]]))), es: units(REG(table(["Propiedad", "Unidad"], [["border-width", "px"]]))),
      props: units(REG(table(["Property", "Type", "Default"], [["variant", "string", "primary"], ["size", "px", "md"]]))),
      third: units(REG(table(["Property", "Notes", "Units"], [["gap", "px is fine", "rem"]]))),
      noUnit: units(REG(table(["Property", "Units"], [["spacing", "small"]]))), none: units(REG("")),
      two: units(REG(table(["Property", "Units"], [["gap", "rem"]]) + "\n## More\n\n" + table(["Property", "Units"], [["border-width", "px"]]))),
      past: (() => { const u = units(REG(table(["Property", "Units"], Array.from({ length: 60 }, (_, i) => ["p" + String.fromCharCode(97 + (i % 26)) + i.toString(36).replace(/\d/g, "x"), "px"])))); return u && [u.rows.length, u.unread.length, u.past]; })(),
    };
    all("1.38 units table: read by its header — `| Property | Units |` under any heading (rem, em kept, `rems` dropped; `margin-*` a prefix; `spacing | small` and a `--gap` row unread), PT `| Propriedade | Unidades |`, ES `| Propiedad | Unidad |`, a units column in third place; a props table (`| Property | Type | Default |`, even with `px` in a cell), a table of no CSS unit and no table → null; 60 rows → 50 read, 10 past (got " + js(got) + ")", {
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

  { // the bounds and the shapes: no table → `units: null`; 250 findings in a file → 200 kept a file, all counted (total 250), 50
    // listed; the project report's `unitsTable` (rows, unread, past) — never part of inSync
    const none = feature(REG(""), { "src/checkout/c.css": ".a { margin: 4px; }\n" });
    const many = feature(REG(table(["Property", "Units"], [["margin", "rem"], ["spacing", "small"]])), { "src/checkout/c.css": Array.from({ length: 250 }, (_, i) => ".a" + i + " { margin: " + (i + 1) + "px; }").join("\n") + "\n" });
    const p = project("# Design System\n\n_Token sources: src/styles/tokens.css_\n\n| Token | Value | Use |\n|---|---|---|\n| --a | 1px | x |\n\n" + table(["Property", "Units"], [["margin", "rem"], ["spacing", "small"]]),
      { "src/styles/tokens.css": ":root { --a: 1px; }\n" });
    const pr = S.designSystemReport(p), bare = S.designSystemReport(project(REG(""), {}));
    const got = { none: none.units, many: many.units && [many.units.findings.length, many.units.total, many.units.byProperty], project: [pr.unitsTable, pr.inSync], bare: bare.unitsTable };
    all("1.38 units: no table → null; 250 findings in one file → 50 listed, total 250 (200 kept, the rest counted); the project report says the table's rows / unread / past and stays in sync; without a table, unitsTable null (got " + js(got) + ")", {
      none: () => none.units === null,
      many: () => js(got.many) === js([50, 250, { margin: 250 }]),
      project: () => js(pr.unitsTable) === js({ rows: 1, unread: ["spacing"], past: 0 }) && pr.inSync === true,
      bare: () => bare.unitsTable === null,
    });
  }

  { // cost (K2), as ratios measured at the same moment: a units table costs at most 1.5× no table on 60 component stylesheets
    // as written (a row for a third of the declarations, a finding now and then — on the real corpora, shadcn v4, Bootstrap,
    // Breeze, Tailwind, it measured 0.9–1.0×); and at most 3× on the worst case — EVERY declaration of 60 files × 300 lines has a
    // row and is a finding (the raw values stop at 200 a file, the units reader counts them all)
    const TABLE = REG(table(["Property", "Units"], [["margin-*", "rem"], ["padding", "rem"], ["font-size", "rem"], ["width", "%"]]));
    const sheet = (j) => [".c" + j + " {", "  display: flex;", "  align-items: center;", "  margin: 0 auto;", "  padding: 1rem;", "  color: #333;", "  border: 1px solid #ccc;",
      "  font-weight: 600;", "  line-height: 1.5;", "  font-size: " + (j % 10 ? "1rem" : "14px") + ";", "}"].join("\n");
    const worst = (j) => ".c" + j + " { margin: " + (j + 1) + "px; padding: 1rem 2px; font-size: 14px; width: calc(100% - 4px); }";
    const mk = (reg, line) => {
      const files = {};
      for (let i = 0; i < 60; i++) files["src/checkout/v" + i + ".css"] = Array.from({ length: 300 }, (_, j) => line(j)).join("\n");
      const p = project(reg, files), f = S.createFeature(p, { name: "Checkout", tracks: ["ui"], summary: "x" });
      fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] B\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/checkout/_\n  - _Verify: npm test_\n");
      return () => S.designSystemReport(p, { name: f.slug });
    };
    const R = { real: mk(TABLE, sheet), realNo: mk(REG(""), sheet), worst: mk(TABLE, worst), worstNo: mk(REG(""), worst) };
    Object.values(R).forEach((f) => f());
    const time = (f) => { const ts = []; for (let i = 0; i < 5; i++) { const t0 = process.hrtime.bigint(); f(); ts.push(Number(process.hrtime.bigint() - t0) / 1e6); } ts.sort((a, b) => a - b); return ts[2]; };
    const r2 = (x) => Math.round(x * 100) / 100;
    const s = remeasure(() => ({ real: r2(time(R.real) / time(R.realNo)), worst: r2(time(R.worst) / time(R.worstNo)) }), (x) => x.real <= 1.5 && x.worst <= 3);
    const counts = [R.real().units.total, R.worst().units.total];
    all("1.38 units: the units table's reader costs at most 1.5× the same report without a table on component stylesheets as written, and 3× when every declaration is a finding (got " + js(s) + ", findings " + js(counts) + ")", {
      real: () => s.real <= 1.5 && counts[0] === 60 * 30,
      worst: () => s.worst <= 3 && counts[1] === 60 * 300 * 3,
    });
  }
};
