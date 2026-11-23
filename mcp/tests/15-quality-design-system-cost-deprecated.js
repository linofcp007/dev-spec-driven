"use strict";
// The cost of 1.39's deprecated uses' watch (G1–G3), as ratios measured at the same moment — the half of 15-quality-design-system-cost.js
// split off by topic in 1.40 (that file was the suite's slowest chain: ~134 s alone on a loaded Windows); its trees and pair() come from there.

const path = require("path");
const { trees, pair } = require("./15-quality-design-system-cost.js");

exports.run = async ({ all, remeasure, fsCalls, S, tmp }) => {
  const js = (v) => JSON.stringify(v);
  const { project } = trees({ S, tmp }, "proj-costdep-");

  { // 1.39 deprecated uses (G1–G3), as ratios measured at the same moment — never an absolute slack (CRIT_1 must-fix 7): the watch
    // reads and parses what settle would, no more. The yardstick: the same tree where settle itself reads and parses every page
    // (a candidate each page names — a comment `// Moving`), with no row marked. Each a pair — a median of 5, the calls interleaved —
    // under its own remeasure (1.40: the six were one sample of medians of 3, and both node 22 first tries missed on one of them).
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
    // (1.40: `asks` is COUNTED, no clock — rebased on `same`, it still missed both tries on node:24-alpine under load (1.63,
    // 1.64; ~1.2 typical) while the property is two counts: the watch parses the Table pages settle did not (300 − the 25 of
    // settle's 50: 275 — `deprecatedUses.parsed`, which also sees the hidden case above: 550 for the wide stand-in), and reads
    // nothing itself — every fs call under the pages the same as the identical tree with no marker. `nothing` keeps its clock
    // (0.67–0.79× everywhere) and counts its 300)
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
    const G1 = { asksOn: app("asks", true), asksOff: app("asks", false), nothingOn: app("nothing", true), all: app("all", false) };
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
    const within = (a, b, bound) => remeasure(() => pair(a, b), (x) => x.ratio <= bound);
    const pages = (p) => path.join(p, "src", "app") + path.sep;
    const callsOf = (p) => fsCalls(pages(p), () => S.designSystemReport(p));
    const asksCalls = { on: callsOf(G1.asksOn), off: callsOf(G1.asksOff) };
    const parsedOf = (p) => (S.designSystemReport(p).deprecatedUses || {}).parsed;
    const counted = { asks: parsedOf(G1.asksOn), nothing: parsedOf(G1.nothingOn), table: 300, settled: 25 };
    const s = { nothing: within(rep(G1.nothingOn), rep(G1.all), 1.5), rows500: within(rep(G2.on), rep(G2.all), 1.5),
      web: within(rep(G3.watch), rep(G3.settle), 1.5), feature: within(F.on, F.off, 1.25), prefilter: within(rep(G2q.q500), rep(G2q.q1), 1.25) };
    const tries = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.tries]));
    const got = { asks: (S.designSystemReport(G1.asksOn).deprecatedUses || { rows: [{}] }).rows[0].filesTotal, nothing: (S.designSystemReport(G1.nothingOn).deprecatedUses || { rows: [{}] }).rows[0].filesTotal,
      rows500: ((d) => [d.rowsTotal, d.rows.every((r) => r.filesTotal === 2)])(S.designSystemReport(G2.on).deprecatedUses || { rows: [] }) };
    all("1.39 cost: the deprecated uses' watch reads and parses no more than settle would — a real-shaped app (600 pages, 40 SFCs, 20 MDX) with a row while settle asks a candidate: the watch parses only the pages naming the row that settle did not (counted, 1.40) and reads nothing itself (every fs call under the pages the same with no marker); with no candidate it parses the row's pages alone, ≤ 1.5× settle parsing every page; 500 located rows over 2,000 pages (half naming none) ≤ 1.5× settle parsing them all; the hostile `export *` web ≤ 1.5× settle's own follow through it; a feature's report with a row marked ≤ 1.25× with none (it builds no watch); 500 rows marked over pages that name none ≤ 1.25× one (got " +
      js({ s, tries, got, counted, asksCalls }) + ")", {
      asks: () => counted.asks === counted.table - counted.settled && got.asks === counted.table,
      asksReads: () => Object.keys(asksCalls.on).length > 0 && js(asksCalls.on) === js(asksCalls.off),
      nothing: () => s.nothing.ratio <= 1.5 && got.nothing === counted.table && counted.nothing === counted.table,
      rows500: () => s.rows500.ratio <= 1.5 && js(got.rows500) === js([500, true]),
      web: () => s.web.ratio <= 1.5,
      feature: () => s.feature.ratio <= 1.25 && !("deprecatedUses" in F.on()),
      prefilter: () => s.prefilter.ratio <= 1.25,
    });
  }
};
