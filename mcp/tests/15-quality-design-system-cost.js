"use strict";
// The costs of 1.38's raw values against the scale and of the units table, as ratios measured at the same moment (each a
// file of its own: the fixtures of 15-quality-design-system-scale.js / -units.js stay quick for a mutation pass).

const fs = require("fs");
const path = require("path");

exports.run = async ({ all, remeasure, S, tmp, require, __dirname }) => {
  const js = (v) => JSON.stringify(v);
  const T = require(path.join(__dirname, "lib", "engine", "index.js")).loadLazyTier();
  const write = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  const registry = (tokens, more) => "# Design System\n\n| Token | Value | Use |\n|---|---|---|\n" + tokens.map(([n, v]) => "| " + n + " | " + v + " | x |").join("\n") + "\n" + (more || "");
  const table = (head, rows) => "| " + head.join(" | ") + " |\n|" + head.map(() => "---").join("|") + "|\n" + rows.map((r) => "| " + r.join(" | ") + " |").join("\n") + "\n";
  const REG = (more) => "# Design System\n\n| Token | Value | Use |\n|---|---|---|\n| --space-4 | 16px | gaps |\n\n" + more;
  let k = 0;
  const project = (reg, files) => {
    const p = path.join(tmp, "proj-cost-" + ++k);
    S.initProject(p, ["ui"], "en");
    if (reg != null) write(p, ".specs/steering/design-system.md", reg);
    for (const [rel, text] of Object.entries(files || {})) write(p, rel, text);
    return p;
  };
  // a project with one +ui feature whose tasks name src/checkout/
  const feature = (reg, files) => {
    const p = project(reg, files);
    const f = S.createFeature(p, { name: "Checkout", tracks: ["ui"], summary: "x" });
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Build the checkout\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/checkout/_\n  - _Verify: npm test_\n");
    return { p, slug: f.slug };
  };
  const report = (x) => S.designSystemReport(x.p, { name: x.slug });

  { // cost, as ratios measured at the same moment: (K3) kinds on over a 20,000-line sheet with no value ≤ 1.5× kinds off; (K4) the
    // hostile lines — a font-family of 1,000 families, a transition of 500 times, `ease-[` never closed — ≤ 3× plain lines of the
    // same length, kinds on; (K1) 100 files × 200 distinct colours against 2,000 tokens ≤ 1.5× the same report with none
    const time = (f) => { const ts = []; for (let i = 0; i < 5; i++) { const t0 = process.hrtime.bigint(); f(); ts.push(Number(process.hrtime.bigint() - t0) / 1e6); } ts.sort((a, b) => a - b); return ts[2]; };
    const KINDS = { font: true, motion: true };
    const walk = (text, rel) => [...T.viewLines(text, rel)];
    const empty = walk(Array.from({ length: 20000 }, (_, i) => ".c" + i + " { display: block; position: relative; }").join("\n"), "x.css");
    const plainLine = ".x { color: red; margin: 0; padding: 0 } ".repeat(48);
    const hostile = { fonts: ".a { font-family: " + "a,".repeat(990) + " }", times: ".a { transition: " + "1s,".repeat(495) + " }", ease: "<div className=\"" + "ease-[".repeat(330) + "\" />" };
    const sheet = (l) => walk(Array(400).fill(l).join("\n"), "x.css"), markup = (l) => walk(Array(400).fill(l).join("\n"), "X.tsx");
    const plain = sheet(plainLine), plainMarkup = markup("<div className=\"" + "p-2 m-4 ".repeat(250) + "\" />");
    const H = { fonts: sheet(hostile.fonts), times: sheet(hostile.times), ease: markup(hostile.ease) };
    T.rawValuesIn(empty, KINDS); T.rawValuesIn(empty);
    const n = 100, many = (c) => Array.from({ length: 200 }, (_, i) => ".c" + i + " { color: #" + (0x100000 + c * 200 + i).toString(16) + "; }").join("\n");
    const files = {};
    for (let f = 0; f < n; f++) files["src/checkout/v" + f + ".css"] = many(f);
    // (the same registry and token file, read alike, of colours or of sizes: the difference is the judging alone)
    const tokens = (value) => [registry(Array.from({ length: 1000 }, (_, i) => ["--r" + i, value(i, 0x800000)])),
      { "src/styles/tokens.css": ":root {\n" + Array.from({ length: 1000 }, (_, i) => "  --t" + i + ": " + value(i, 0xa00000) + ";").join("\n") + "\n}\n" }];
    const [cReg, cFile] = tokens((i, b) => "#" + (b + i * 7).toString(16)), [sReg, sFile] = tokens((i) => i + 1 + "px");
    const withTokens = feature(cReg, Object.assign(cFile, files)), none = feature(sReg, Object.assign(sFile, files));
    report(withTokens); report(none);
    const s = remeasure(() => {
      const on = time(() => T.rawValuesIn(empty, KINDS)), off = time(() => T.rawValuesIn(empty));
      const base = time(() => T.rawValuesIn(plain, KINDS)), baseM = time(() => T.rawValuesIn(plainMarkup, KINDS));
      const h = { fonts: time(() => T.rawValuesIn(H.fonts, KINDS)) / base, times: time(() => T.rawValuesIn(H.times, KINDS)) / base, ease: time(() => T.rawValuesIn(H.ease, KINDS)) / baseM };
      const t1 = time(() => report(withTokens)), t0 = time(() => report(none));
      const r2 = (x) => Math.round(x * 100) / 100;
      return { kinds: r2(on / off), hostile: Object.fromEntries(Object.entries(h).map(([k, v]) => [k, r2(v)])), tokens: r2(t1 / t0) };
    }, (x) => x.kinds <= 1.5 && Object.values(x.hostile).every((v) => v <= 3) && x.tokens <= 1.5);
    const tok = report(withTokens);
    all("1.38 cost: kinds on ≤ 1.5× off over a 20,000-line sheet with no value; each hostile line ≤ 3× plain; 100 files × 200 distinct colours judged against 2,000 tokens ≤ 1.5× the same report with none (got " + js(s) + ")", {
      kinds: () => s.kinds <= 1.5,
      hostile: () => Object.values(s.hostile).every((v) => v <= 3),
      tokens: () => s.tokens <= 1.5 && tok.counts.color === 20000,
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
