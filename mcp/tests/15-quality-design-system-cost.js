"use strict";
// The costs of 1.38's raw values against the scale and of the units table, as ratios measured at the same moment (each a
// file of its own: the fixtures of 15-quality-design-system-scale.js / -units.js stay quick for a mutation pass).

const fs = require("fs");
const path = require("path");

exports.run = async ({ all, remeasure, S, tmp, require, __dirname }) => {
  const js = (v) => JSON.stringify(v);
  const T = require(path.join(__dirname, "lib", "engine", "index.js")).loadLazyTier();
  // (each folder made once — no folder is ever removed here: a mkdir a file cost the trees' writes a third, review 1 of 1.39)
  const made = new Set();
  const write = (dir, rel, text) => { const d = path.dirname(path.join(dir, rel)); if (!made.has(d)) { fs.mkdirSync(d, { recursive: true }); made.add(d); } fs.writeFileSync(path.join(dir, rel), text); };
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

  { // 1.39 deprecated uses (G1–G3), as ratios measured at the same moment — never an absolute slack (CRIT_1 must-fix 7): the watch
    // reads and parses what settle would, no more. The yardstick: the same tree where settle itself reads and parses every page
    // (a candidate each page names — a comment `// Moving`), with no row marked. Each a median of 3, the pairs interleaved.
    const once = (f) => { const t0 = process.hrtime.bigint(); f(); return Number(process.hrtime.bigint() - t0) / 1e6; };
    const ratio = (a, b) => { const ta = [], tb = []; for (let i = 0; i < 3; i++) { ta.push(once(a)); tb.push(once(b)); } const m = (x) => x.sort((p, q) => p - q)[1]; return m(ta) / m(tb); };
    const r2 = (x) => Math.round(x * 100) / 100;
    const L = (lines) => lines.join("\n") + "\n";
    const HEAD = "# Design System\n\n| Component | Path | Variants | Notes |\n|---|---|---|---|\n";
    const kitOf = (moving) => L(["export function Table() { return <table />; }", "export function Button() { return <button />; }"].concat(moving ? ["export const Moving = motion(Box);"] : []));
    // G1: a real-shaped app — 600 TSX pages (300 render Table, 300 Button), 40 Vue SFCs, 20 MDX; `asks`: settle asks a candidate 50
    // pages render; `same`: the same, and every Table page also names the candidate (settle parses the pages the watch would);
    // `nothing`: it asks none (the watch reads alone); `all`: every page names the candidate (settle parses them all).
    // (`asks` against `same`, never against the report with none: there settle parses its 50 pages alone, and the watch's 300
    // are a parse the CHANGELOG states — 1.02× on Windows, where the reads weigh, and 1.69–1.83× on all four Linux images, where
    // they are cheap and the parse is the report: a read-speed ratio, +19–24 ms. Against `same`: 1.01× Windows, 1.06–1.07× Linux.
    // What the bound hides: a watch that parses pages naming no marked row — every Button page naming Table, 600 parsed for
    // 300: 1.05× Windows, 1.30× Linux; it catches a second read of the tree, never that. 1.39 Docker)
    const app = (shape, marked) => {
      const files = { "package.json": js({ name: "g1" }), "tsconfig.json": js({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"] } } }),
        "src/components/ui/kit.tsx": kitOf(shape !== "nothing"), "src/components/ui/table.tsx": L(["export function Table() { return <table />; }"]) };
      for (let i = 0; i < 600; i++) {
        const t = i % 2 === 0, m = shape === "all" || ((shape === "asks" || shape === "same") && i < 50);
        files["src/app/p" + i + "/page.tsx"] = L([t ? "import { Table } from \"@/components/ui/table\";" : "import { Button } from \"@/components/ui/kit\";"].concat(m ? ["import { Moving } from \"@/components/ui/kit\";", "// Moving"] : shape === "same" && t ? ["// Moving"] : [],
          ["export const P = () => <section>" + (t ? "<Table />" : "<Button />") + (m && shape !== "all" ? "<Moving />" : "") + "</section>;"], Array.from({ length: 40 }, (_, k) => "const v" + k + " = \"" + "x".repeat(60) + "\";")));
      }
      for (let i = 0; i < 40; i++) files["src/views/v" + i + ".vue"] = L(["<script setup>", "import Button from '@/components/ui/button.vue'", "</script>", "<template><Button />" + (shape === "all" ? "<!-- Moving -->" : "") + "</template>"]);
      for (let i = 0; i < 20; i++) files["docs/d" + i + ".mdx"] = L(["# Doc " + i, "", "Some text." + (shape === "all" ? " Moving" : ""), "", "<Callout>x</Callout>"]);
      files[".specs/steering/design-system.md"] = HEAD + "| Table | src/components/ui/table.tsx |  | " + (marked ? "_Deprecated_" : "") + " |\n| Button | src/components/ui/kit.tsx |  |  |\n";
      return project(null, files);
    };
    const G1 = { asksOn: app("asks", true), same: app("same", false), nothingOn: app("nothing", true), all: app("all", false) };
    // G2: 500 LOCATED rows (500 component files, every one marked), 1,000 pages each importing one and 1,000 pages of 16 KB that
    // name none — the module check indexed by key; and the prefilter two linear passes, whatever the rows: on 50 pages of 64 KB
    // that name none, 500 rows marked ≤ 1.25× one (`includes` × the names scanned a text whole once a name: 1.42–1.47× on 50
    // pages, 2.2–2.6× on 200 — a linearity ratio, so 50 hold it at a quarter of the bytes written: review 1 of 1.39)
    const quiet = (rowsMarked) => {
      const files = { "package.json": js({ name: "g2q" }) }, rows = [];
      for (let c = 0; c < 500; c++) {
        const n = "C" + String(c).padStart(3, "0");
        files["src/components/ui/" + n.toLowerCase() + ".tsx"] = L(["export function " + n + "() { return <div />; }"]);
        rows.push("| " + n + " | src/components/ui/" + n.toLowerCase() + ".tsx |  | " + (c < rowsMarked ? "_Deprecated_" : "") + " |");
      }
      for (let i = 0; i < 50; i++) files["src/app/q" + i + ".tsx"] = L(["export const Q = () => <section />;"].concat(Array.from({ length: 800 }, (_, k) => "const w" + k + " = \"" + "z".repeat(70) + "\";")));
      files[".specs/steering/design-system.md"] = HEAD + rows.join("\n") + "\n";
      return project(null, files);
    };
    const G2q = { q500: quiet(500), q1: quiet(1) };
    const many = (marked) => {
      const files = { "package.json": js({ name: "g2" }), "tsconfig.json": js({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"] } } }) };
      const rows = [];
      for (let c = 0; c < 500; c++) {
        const n = "C" + String(c).padStart(3, "0");
        files["src/components/ui/" + n.toLowerCase() + ".tsx"] = L(["export function " + n + "() { return <div />; }"].concat(c === 0 && !marked ? ["export const Moving = motion(Box);"] : []));
        rows.push("| " + n + " | src/components/ui/" + n.toLowerCase() + ".tsx |  | " + (marked ? "_Deprecated_" : "") + " |");
      }
      for (let i = 0; i < 1000; i++) {
        const n = "C" + String(i % 500).padStart(3, "0");
        files["src/app/p" + i + ".tsx"] = L(["import { " + n + " } from \"@/components/ui/" + n.toLowerCase() + "\";"].concat(marked ? [] : ["// Moving"], ["export const P = () => <" + n + " />;"], Array.from({ length: 20 }, (_, k) => "const v" + k + " = \"" + "y".repeat(60) + "\";")));
        files["src/app/q" + i + ".tsx"] = L((marked ? [] : ["// Moving"]).concat(["export const Q = () => <section />;"], Array.from({ length: 200 }, (_, k) => "const w" + k + " = \"" + "z".repeat(70) + "\";")));
      }
      files[".specs/steering/design-system.md"] = HEAD + rows.join("\n") + "\n";
      return project(null, files);
    };
    const G2 = { on: many(true), all: many(false) };
    // G3: the hostile `export *` web — 1,000 component folders' barrels passing on a hub that passes on all of them — the watch
    // following its deprecated Moving through it against settle following its candidate Moving through it (each its own budget)
    const web = (watch) => {
      const files = { "package.json": js({ name: "g3" }), "src/components/ui/kit.tsx": L([watch ? "export function Moving() { return <div />; }" : "export const Moving = motion(Box);"]) };
      for (let i = 0; i < 1000; i++) {
        files["src/components/k" + i + "/index.ts"] = "export * from \"../hub\";\n";
        files["src/app/p" + i + ".tsx"] = L(["import { Moving } from \"../components/k" + i + "\";", "export const P = () => <Moving />;"]);
      }
      files["src/components/hub/index.ts"] = Array.from({ length: 1000 }, (_, i) => "export * from \"../k" + i + "\";").join("\n") + "\nexport * from \"../ui/kit\";\n";
      files[".specs/steering/design-system.md"] = HEAD + "| Moving | src/components/ui/kit.tsx |  | " + (watch ? "_Deprecated_" : "") + " |\n";
      return project(null, files);
    };
    const G3 = { watch: web(true), settle: web(false) };
    const rep = (p) => () => S.designSystemReport(p);
    // (a feature's report builds no watch — scanCode(root, false) reads no component's name: its cost is the same with a row
    // marked as with none; built, it read every page for nothing, ×3.6–4 on shadcn-ui and Starlight)
    const featOf = (p) => { const f = S.createFeature(p, { name: "Orders", tracks: ["ui"], summary: "x" }); return () => S.designSystemReport(p, { name: f.slug }); };
    const F = { on: featOf(G1.nothingOn), off: featOf(app("nothing", false)) };
    for (const g of [G1, G2, G2q, G3]) for (const p of Object.values(g)) S.designSystemReport(p);
    F.on(); F.off();
    const s = remeasure(() => ({
      asks: r2(ratio(rep(G1.asksOn), rep(G1.same))), nothing: r2(ratio(rep(G1.nothingOn), rep(G1.all))),
      rows500: r2(ratio(rep(G2.on), rep(G2.all))), web: r2(ratio(rep(G3.watch), rep(G3.settle))), feature: r2(ratio(F.on, F.off)), prefilter: r2(ratio(rep(G2q.q500), rep(G2q.q1))),
    }), (x) => x.asks <= 1.5 && x.nothing <= 1.5 && x.rows500 <= 1.5 && x.web <= 1.5 && x.feature <= 1.25 && x.prefilter <= 1.25);
    const got = { asks: (S.designSystemReport(G1.asksOn).deprecatedUses || { rows: [{}] }).rows[0].filesTotal, nothing: (S.designSystemReport(G1.nothingOn).deprecatedUses || { rows: [{}] }).rows[0].filesTotal,
      rows500: ((d) => [d.rowsTotal, d.rows.every((r) => r.filesTotal === 2)])(S.designSystemReport(G2.on).deprecatedUses || { rows: [] }) };
    all("1.39 cost: the deprecated uses' watch reads and parses no more than settle would — a real-shaped app (600 pages, 40 SFCs, 20 MDX) with a row while settle asks a candidate ≤ 1.5× the same report with none where settle parses the pages the watch reads, and ≤ 1.5× settle parsing every page when it asks none; 500 located rows over 2,000 pages (half naming none) ≤ 1.5× settle parsing them all; the hostile `export *` web ≤ 1.5× settle's own follow through it; a feature's report with a row marked ≤ 1.25× with none (it builds no watch); 500 rows marked over pages that name none ≤ 1.25× one (got " +
      js({ s, got }) + ")", {
      asks: () => s.asks <= 1.5 && got.asks === 300,
      nothing: () => s.nothing <= 1.5 && got.nothing === 300,
      rows500: () => s.rows500 <= 1.5 && js(got.rows500) === js([500, true]),
      web: () => s.web <= 1.5,
      feature: () => s.feature <= 1.25 && !("deprecatedUses" in F.on()),
      prefilter: () => s.prefilter <= 1.25,
    });
  }
};
