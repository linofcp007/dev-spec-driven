"use strict";
// The costs of 1.38's raw values against the scale and of the units table, as ratios measured at the same moment (each a
// file of its own: the fixtures of 15-quality-design-system-scale.js / -units.js stay quick for a mutation pass; 1.39's
// deprecated uses — G1–G3 — are 15-quality-design-system-cost-deprecated.js, split off by topic in 1.40).

const fs = require("fs");
const path = require("path");

// What both cost files use (15-quality-design-system-cost-deprecated.js takes it from here, never a copy): the trees' writer —
// each folder made once, none ever removed (a mkdir a file cost the trees' writes a third, review 1 of 1.39) — and a project
// under tmp named by the caller's own prefix (two files run in one chain never share a folder)
exports.trees = ({ S, tmp }, prefix) => {
  const made = new Set();
  const write = (dir, rel, text) => { const d = path.dirname(path.join(dir, rel)); if (!made.has(d)) { fs.mkdirSync(d, { recursive: true }); made.add(d); } fs.writeFileSync(path.join(dir, rel), text); };
  let k = 0;
  const project = (reg, files) => {
    const p = path.join(tmp, prefix + ++k);
    S.initProject(p, ["ui"], "en");
    if (reg != null) write(p, ".specs/steering/design-system.md", reg);
    for (const [rel, text] of Object.entries(files || {})) write(p, rel, text);
    return p;
  };
  return { write, project };
};
// pair(a, b) → { ratio: a / b, a, b }: each side's median of 5 calls, the calls INTERLEAVED (a, b, a, b, …) so a load spike hits
// both sides alike — and one ratio a remeasure (1.40: five calls of one side, then five of the other, crossed 1.5 where the
// interleaved calls did not, and a bundle of ratios missed whenever any one of them met a spike)
exports.pair = (a, b, n = 5) => {
  const ta = [], tb = [];
  const once = (f, into) => { const t0 = process.hrtime.bigint(); f(); into.push(Number(process.hrtime.bigint() - t0) / 1e6); };
  for (let i = 0; i < n; i++) { once(a, ta); once(b, tb); }
  const med = (x) => x.sort((p, q) => p - q)[n >> 1];
  return { ratio: Math.round(med(ta) / med(tb) * 100) / 100, a: Math.round(med(ta) * 10) / 10, b: Math.round(med(tb) * 10) / 10 };
};

exports.run = async ({ all, remeasure, S, tmp, require, __dirname }) => {
  const js = (v) => JSON.stringify(v);
  const T = require(path.join(__dirname, "lib", "engine", "index.js")).loadLazyTier();
  const pair = exports.pair, { project } = exports.trees({ S, tmp }, "proj-cost-");
  const registry = (tokens, more) => "# Design System\n\n| Token | Value | Use |\n|---|---|---|\n" + tokens.map(([n, v]) => "| " + n + " | " + v + " | x |").join("\n") + "\n" + (more || "");
  const table = (head, rows) => "| " + head.join(" | ") + " |\n|" + head.map(() => "---").join("|") + "|\n" + rows.map((r) => "| " + r.join(" | ") + " |").join("\n") + "\n";
  const REG = (more) => "# Design System\n\n| Token | Value | Use |\n|---|---|---|\n| --space-4 | 16px | gaps |\n\n" + more;
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
    // same length, kinds on; (K1) 100 files × 200 distinct colours against 2,000 tokens ≤ 1.5× the same report with none. Each a
    // pair of its own, under its own remeasure (1.40: the five ratios were one sample of blocked medians — K1 crossed 1.5 in 3 of
    // 64 blocked samples, in none of 64 interleaved)
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
    const within = (a, b, bound) => remeasure(() => pair(a, b), (x) => x.ratio <= bound);
    const s = { kinds: within(() => T.rawValuesIn(empty, KINDS), () => T.rawValuesIn(empty), 1.5),
      hostile: { fonts: within(() => T.rawValuesIn(H.fonts, KINDS), () => T.rawValuesIn(plain, KINDS), 3), times: within(() => T.rawValuesIn(H.times, KINDS), () => T.rawValuesIn(plain, KINDS), 3),
        ease: within(() => T.rawValuesIn(H.ease, KINDS), () => T.rawValuesIn(plainMarkup, KINDS), 3) },
      tokens: within(() => report(withTokens), () => report(none), 1.5) };
    const tok = report(withTokens);
    const tries = { kinds: s.kinds.tries, fonts: s.hostile.fonts.tries, times: s.hostile.times.tries, ease: s.hostile.ease.tries, tokens: s.tokens.tries };
    all("1.38 cost: kinds on ≤ 1.5× off over a 20,000-line sheet with no value; each hostile line ≤ 3× plain; 100 files × 200 distinct colours judged against 2,000 tokens ≤ 1.5× the same report with none (got " + js({ s, tries }) + ")", {
      kinds: () => s.kinds.ratio <= 1.5,
      hostile: () => Object.values(s.hostile).every((v) => v.ratio <= 3),
      tokens: () => s.tokens.ratio <= 1.5 && tok.counts.color === 20000,
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
