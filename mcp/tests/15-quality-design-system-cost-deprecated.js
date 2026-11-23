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
    // pages render; `nothing`: it asks none (the watch reads alone); `all`: every page names the candidate (settle parses them all).
    // (1.40: `asks` is COUNTED, no clock — timed in 1.39 against a yardstick of the same pages parsed, it still missed both tries
    // on node:24-alpine under load (1.63, 1.64; ~1.2 typical) while the property is two counts: the watch parses the Table pages
    // settle did not (300 − the 25 of settle's 50: 275 — `deprecatedUses.parsed`, which also sees what that clock could not: a
    // watch parsing pages that name no marked row, 610), and reads nothing itself — every fs call under `src/`, `docs/` and
    // `.specs/` the SAME as the identical tree with no marker (review 2, DT2-1: a bound of 2 a kind under the root left a read
    // once a row inside it on Windows, where the follow's config reads count one open, not two), and under the project root at
    // most 2 more a kind (the follow's own package.json / tsconfig reads, one or two by platform — a re-read once a page is
    // hundreds). `nothing` keeps its clock (0.67–1.29× measured, loaded) and counts its 300. A feature's report is counted too:
    // with a row marked as with none it makes no call under the pages — it builds no watch)
    const app = (shape, marked) => {
      const files = { "package.json": js({ name: "g1" }), "tsconfig.json": js({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"] } } }),
        "src/components/ui/kit.tsx": kitOf(shape !== "nothing"), "src/components/ui/table.tsx": L(["export function Table() { return <table />; }"]) };
      for (let i = 0; i < 600; i++) {
        const t = i % 2 === 0, m = shape === "all" || (shape === "asks" && i < 50);
        files["src/app/p" + i + "/page.tsx"] = L([t ? "import { Table } from \"@/components/ui/table\";" : "import { Button } from \"@/components/ui/kit\";"].concat(m ? ["import { Moving } from \"@/components/ui/kit\";", "// Moving"] : [],
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
    const nothingOff = app("nothing", false);
    const F = { on: featOf(G1.nothingOn), off: featOf(nothingOff) };
    for (const g of [G1, G2, G2q, G3]) for (const p of Object.values(g)) S.designSystemReport(p);
    F.on(); F.off();
    const within = (a, b, bound) => remeasure(() => pair(a, b), (x) => x.ratio <= bound);
    const under = (p, dir) => path.join(p, dir) + path.sep;
    const asksCalls = { on: fsCalls(G1.asksOn + path.sep, rep(G1.asksOn)), off: fsCalls(G1.asksOff + path.sep, rep(G1.asksOff)) };
    // (under the root, the marked tree's only own reads are the follow's config files, one or two by platform — never one a page)
    const added = Object.keys(asksCalls.on).map((k) => asksCalls.on[k] - (asksCalls.off[k] || 0));
    // (under the folders that hold the pages, the views, the MDX and the registry: no call more, of any kind)
    const DIRS = ["src", "docs", ".specs"];
    const dirCalls = Object.fromEntries(DIRS.map((d) => [d, { on: fsCalls(under(G1.asksOn, d), rep(G1.asksOn)), off: fsCalls(under(G1.asksOff, d), rep(G1.asksOff)) }]));
    const featCalls = { on: fsCalls(under(G1.nothingOn, "src"), F.on), off: fsCalls(under(nothingOff, "src"), F.off),
      project: fsCalls(under(G1.nothingOn, "src"), rep(G1.nothingOn)) };
    const parsedOf = (p) => (S.designSystemReport(p).deprecatedUses || {}).parsed;
    const counted = { asks: parsedOf(G1.asksOn), nothing: parsedOf(G1.nothingOn), table: 300, settled: 25 };
    const s = { nothing: within(rep(G1.nothingOn), rep(G1.all), 1.5), rows500: within(rep(G2.on), rep(G2.all), 1.5),
      web: within(rep(G3.watch), rep(G3.settle), 1.5), prefilter: within(rep(G2q.q500), rep(G2q.q1), 1.25) };
    const tries = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.tries]));
    const got = { asks: (S.designSystemReport(G1.asksOn).deprecatedUses || { rows: [{}] }).rows[0].filesTotal, nothing: (S.designSystemReport(G1.nothingOn).deprecatedUses || { rows: [{}] }).rows[0].filesTotal,
      rows500: ((d) => [d.rowsTotal, d.rows.every((r) => r.filesTotal === 2)])(S.designSystemReport(G2.on).deprecatedUses || { rows: [] }) };
    all("1.39 cost: the deprecated uses' watch reads and parses no more than settle would — a real-shaped app (600 pages, 40 SFCs, 20 MDX) with a row while settle asks a candidate: the watch parses only the pages naming the row that settle did not (counted, 1.40) and reads nothing itself (every fs call under src/, docs/ and .specs/ the same with no marker, under the project root at most 2 more a kind — the follow's config reads, never a page's); with no candidate it parses the row's pages alone, ≤ 1.5× settle parsing every page; 500 located rows over 2,000 pages (half naming none) ≤ 1.5× settle parsing them all; the hostile `export *` web ≤ 1.5× settle's own follow through it; a feature's report with a row marked makes no fs call under src/ — as with none: it builds no watch (counted, 1.40); 500 rows marked over pages that name none ≤ 1.25× one (got " +
      js({ s, tries, got, counted, asksCalls, dirCalls, featCalls }) + ")", {
      asks: () => counted.asks === counted.table - counted.settled && got.asks === counted.table,
      asksReads: () => (asksCalls.off.openSync || 0) >= 660 && Object.keys(asksCalls.off).every((k) => k in asksCalls.on) && added.every((n) => n >= 0 && n <= 2),
      asksDirs: () => DIRS.every((d) => Object.keys(dirCalls[d].off).length > 0 && js(dirCalls[d].on) === js(dirCalls[d].off)),
      nothing: () => s.nothing.ratio <= 1.5 && got.nothing === counted.table && counted.nothing === counted.table,
      rows500: () => s.rows500.ratio <= 1.5 && js(got.rows500) === js([500, true]),
      web: () => s.web.ratio <= 1.5,
      feature: () => (featCalls.project.openSync || 0) >= 600 && js(featCalls.on) === js(featCalls.off) && !(featCalls.on.openSync > 0) && !("deprecatedUses" in F.on()),
      prefilter: () => s.prefilter.ratio <= 1.25,
    });
  }

  { // 1.40 (the merged tree's mutation replay: S3, a cost guard only timed) — DS_PATH_WORDS: a registry row's path cell is read
    // for its first 20 words at most; a cell of 33 absent files makes the same fs calls under the project as its first 20
    // (without the bound: 38 lstats against 28)
    const mk = (n) => project(null, { "src/a.tsx": "export function A() { return <div />; }\n",
      ".specs/steering/design-system.md": "# Design System\n\n| Component | Path | Variants | Notes |\n|---|---|---|---|\n| C0 | " +
        Array.from({ length: n }, (_, j) => "z/" + j + ".t").join(" ") + " |  |  |\n" });
    const w20 = mk(20), w33 = mk(33);
    const c = { w20: fsCalls(w20 + path.sep, () => S.designSystemReport(w20)), w33: fsCalls(w33 + path.sep, () => S.designSystemReport(w33)) };
    all("1.40: a registry row's path cell is read for its first 20 words at most (DS_PATH_WORDS) — a cell of 33 absent files makes the same fs calls as its first 20, counted (got " + js(c) + ")", {
      bounded: () => (c.w20.lstatSync || 0) > 0 && js(c.w33) === js(c.w20),
    });
  }
};
