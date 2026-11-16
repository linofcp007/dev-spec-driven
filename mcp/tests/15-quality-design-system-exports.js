"use strict";
// The design-system registry — 1.35.4: a workspace package's `exports` map, read as Node's resolver reads it. A subpath is
// also where the map says — its own key (as written), else the pattern with the longest part before its `*`, then the
// longest key; every condition's target up to `default`, a list's first target Node takes; `null` excludes (never a
// shorter pattern instead), an index target is its folder, a default import by its target's own name — and the guess stays
// beside it. Its bounds (500 keys, 8 deep, 16 targets, 4 MB of kept manifests; review 1: a path of 1,024 characters, the
// match's in it too — a many-star target in a capped heap), a key's targets reached once (timed), each folder its own
// manifest's map, the file Node's own require.resolve picks, and (review 1) a list that ends at an object whose `default` resolves
// — review 2: whose branches all resolve up to its `default` (Node's import.meta.resolve too) —; a default import's lookup, timed.

const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");
const { spawn } = require("child_process");
const { pathToFileURL, fileURLToPath } = require("url");

exports.run = async ({ all, S, tmp, remeasure, require, __dirname }) => {
  const js = (v) => JSON.stringify(v);
  const E = require(path.join(__dirname, "lib", "engine", "index.js"));
  const write = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  const BS = String.fromCharCode(92);
  const project = (tag, files) => {
    const p = path.join(tmp, "proj-dsexp-" + tag);
    for (const [rel, text] of Object.entries(files || {})) write(p, rel, text);
    S.initProject(p, ["ui"], "en");
    return p;
  };
  const registry = (p) => E.designSystemRegistry(path.join(p, ".specs"));
  // every name the scan finds — the report lists its first 50 rows, the seed all of them
  const seeded = (p) => { S.scaffoldSteeringFile(p, "design-system.md"); return registry(p).components.map((c) => c.name).sort(); };
  const glow = (names) => names.map((n) => "export const " + n + " = motion(Base);").join("\n") + "\n";
  const page = (name, spec, i) => "import { " + name + " } from \"" + spec + "\";\nexport const P" + i + " = () => <" + name + " />;\n";
  const WORKSPACE = js({ private: true, workspaces: ["packages/*", "apps/*"], dependencies: { react: "1" } });

  // --- the map's shapes: one kit package, one page an import (each its own module) -----------------------------------------------
  const nest = (n, leaf) => { let v = leaf; for (let i = 0; i < n; i++) v = { a: v }; return v; };
  const wide = (n, leaf) => { const o = {}; for (let i = 1; i < n; i++) o["c" + i] = "./dist/" + i + ".js"; o["c" + n] = leaf; return o; };
  const KIT_MAP = {
    ".": "./src/index.ts",
    "./*": "./src/components/*/index.ts",
    "./anatomy": "./src/components/parts/anatomy.tsx",
    "./layouts/NestProviders": "./src/components/root/NestProviders.tsx",
    "./looks/*": "./src/components/view-kit/*/index.tsx",
    "./*/panel-view": "./src/components/wrong/*/panel.tsx",
    "./looks/*/metadata": "./src/components/view-meta/*/meta.tsx",
    "./private/*": null,
    "./components/*": null,
    "./styled/*": { dev: "./src/components/tinted/*/kit.tsx", import: { types: "./dist/types/styled/*.d.ts", default: "./dist/esm/styled/*.js" } },
    "./after": { default: "./src/components/late/first.tsx", import: "./src/components/late/second.tsx" },
    // (Node passes a target it refuses — no `./`, a `..` / `.` / `node_modules` segment, `%`-encoded, after a `\` — and a
    // `null`, and takes the first it accepts; a segment that only LOOKS like one it refuses is accepted)
    "./list": ["src/components/many/nodot.tsx", "./src/../up.tsx", "./src/./dot.tsx", "./src/%2E%2e/hex.tsx", "./Node_Modules/nm.tsx", "./src" + BS + ".." + BS + "bs.tsx", null,
      "./src/components/many/ok.tsx", "./src/components/many/second.tsx"],
    "./edge": ["./src/components/node_modules-x/x-node_modules/edge.tsx", "./src/components/many/later.tsx"],
    "./fallback/*": "./src/components/back/kit.tsx",
    "./kits/*": "./src/components/*/*-kit.tsx",
    "./gradient/*/internal/*": "./src/components/grad/kit.tsx",
    "./bs": "./src" + BS + "components" + BS + "slash" + BS + "kit.tsx",
    "./dbl": "./src//components/dbl/kit.tsx",
    "./deep": nest(9, "./src/components/nest/deep.tsx"),
    "./shallow": nest(8, "./src/components/nest/shallow.tsx"),
    "./wide": wide(17, "./src/components/broad/kit.tsx"),
    "./wide16": wide(16, "./src/components/broad16/kit.tsx"),
  };
  // the files the names live in — never named like them —, by package
  const KIT_FILES = [
    ["src/components/dialog/root-part.tsx", "DialogRoot"], ["src/components/forms/input/input.tsx", "FormInput"], ["src/components/parts/anatomy.tsx", "AnatomyGlow"],
    ["src/components/root/NestProviders.tsx", "NestA", "NestB"], ["src/components/view-kit/list/view.tsx", "ViewGlow"], ["src/components/view-kit/panel-view/right.tsx", "PanelRight"],
    ["src/components/wrong/looks/panel.tsx", "PanelWrong"], ["src/components/wrong/panel.tsx", "PanelOverlap"], ["src/components/view-meta/list/meta.tsx", "MetaGlow"],
    ["src/components/view-kit/list/metadata/wrong.tsx", "MetaWrong"], ["src/components/private/vault/vault.tsx", "VaultDecoy"], ["src/components/vault2.tsx", "VaultGuess"],
    ["src/components/tinted/button/kit.tsx", "TintGlow"], ["src/components/late/first.tsx", "LateFirst"], ["src/components/late/second.tsx", "LateSecond"],
    ["src/components/many/ok.tsx", "ListOk"], ["src/components/many/second.tsx", "ListSecond"], ["src/components/node_modules-x/x-node_modules/edge.tsx", "EdgeGlow"],
    ["src/components/many/later.tsx", "EdgeSecond"], ["src/components/back/kit.tsx", "BackOk", "BackGlow"], ["src/components/grad/kit.tsx", "GradGlow"],
    ["src/components/chip/chip-kit.tsx", "ChipGlow"], ["src/components/slash/kit.tsx", "SlashGlow"], ["src/components/dbl/kit.tsx", "DblGlow"],
    ["src/components/nest/deep.tsx", "DeepGlow"], ["src/components/nest/shallow.tsx", "ShallowGlow"], ["src/components/broad/kit.tsx", "BroadGlow"],
    ["src/components/broad16/kit.tsx", "Broad16Glow"], ["src/components/elsewhere/whole.tsx", "WholeGlow"],
  ];
  const KIT_EXTRA = [ // (a barrel's re-export; a default export)
    ["src/components/dialog/index.ts", "export { DialogRoot } from \"./root-part\";\n"],
    ["src/components/view-meta/card/meta.tsx", "const MetaDefault = motion(Base);\nexport default MetaDefault;\n"],
  ];
  const keysMap = (n) => { const o = {}; for (let i = 0; i < n; i++) o["./k" + i] = "./dist/k" + i + ".js"; o["./*"] = "./src/components/glow/*.tsx"; return o; };
  const OTHERS = { // package folder → [manifest, [[file, ...names]]]
    many: [{ name: "@acme/many", exports: keysMap(500) }, [["src/components/glow/a.tsx", "ManyGlow"]]], // (501 keys: no map)
    fits: [{ name: "@acme/fits", exports: keysMap(499) }, [["src/components/glow/a.tsx", "FitsGlow"]]], // (500: read)
    mixed: [{ name: "@acme/mixed", exports: { import: "./src/index.js", "./*": "./src/components/mix/*.tsx" } }, [["src/components/mix/a.tsx", "MixGlow"]]],
    bare: [{ name: "@acme/bare" }, [["src/components/plain.tsx", "BareGlow"]]],
  };
  const PAGES = [ // [name, spec]
    ["DialogRoot", "@acme/kit/dialog"], ["FormInput", "@acme/kit/forms/input"], ["AnatomyGlow", "@acme/kit/anatomy"],
    ["NestA", "@acme/kit/layouts/NestProviders"], ["NestB", "@acme/kit/layouts/nestproviders"], ["ViewGlow", "@acme/kit/looks/list"],
    ["PanelRight", "@acme/kit/looks/panel-view"], ["PanelWrong", "@acme/kit/looks/panel-view"], ["PanelOverlap", "@acme/kit/panel-view"],
    ["MetaGlow", "@acme/kit/looks/list/metadata"], ["MetaWrong", "@acme/kit/looks/list/metadata"], ["VaultDecoy", "@acme/kit/private/vault"],
    ["VaultGuess", "@acme/kit/components/vault2"], ["TintGlow", "@acme/kit/styled/button"], ["LateFirst", "@acme/kit/after"], ["LateSecond", "@acme/kit/after"],
    ["ListOk", "@acme/kit/list"], ["ListSecond", "@acme/kit/list"], ["EdgeGlow", "@acme/kit/edge"], ["EdgeSecond", "@acme/kit/edge"],
    ["BackOk", "@acme/kit/fallback/ok"], ["BackGlow", "@acme/kit/fallback/../x"], ["GradGlow", "@acme/kit/gradient/a/internal/*"], ["ChipGlow", "@acme/kit/kits/chip"],
    ["SlashGlow", "@acme/kit/bs"], ["DblGlow", "@acme/kit/dbl"], ["DeepGlow", "@acme/kit/deep"], ["ShallowGlow", "@acme/kit/shallow"],
    ["BroadGlow", "@acme/kit/wide"], ["Broad16Glow", "@acme/kit/wide16"], ["BareGlow", "@acme/kit/abyss"], ["WholeGlow", "@acme/kit"],
    ["ManyGlow", "@acme/many/a"], ["FitsGlow", "@acme/fits/a"], ["MixGlow", "@acme/mixed/a"], ["BareGlow", "@acme/bare/components/plain"],
  ];
  const DEFAULT_PAGE = ["MetaDefault", "@acme/kit/looks/card/metadata"]; // (a default import through a target named its own way)
  const fileOf = new Map(); // name → [package folder, its file]
  for (const [file, ...names] of KIT_FILES) for (const n of names) fileOf.set(n, ["kit", file]);
  fileOf.set("MetaDefault", ["kit", "src/components/view-meta/card/meta.tsx"]);
  for (const [dir, [, files]] of Object.entries(OTHERS)) for (const [file, ...names] of files) for (const n of names) fileOf.set(n, [dir, file]);
  const ASKED = new Set(PAGES.map(([n]) => n).concat(DEFAULT_PAGE[0]));
  let got = [], threw = null, limits = null;
  {
    const p = project("shapes", { "package.json": WORKSPACE });
    // (and a list 100,000 deep, written as text — JSON.stringify overflows on it; JSON.parse does not)
    const kitText = js({ name: "@acme/kit", exports: KIT_MAP });
    write(p, "packages/kit/package.json", kitText.slice(0, -2) + ",\"./abyss\":" + "[".repeat(100000) + "\"./x.tsx\"" + "]".repeat(100000) + "}}");
    for (const [file, ...names] of KIT_FILES) write(p, "packages/kit/" + file, glow(names));
    for (const [file, text] of KIT_EXTRA) write(p, "packages/kit/" + file, text);
    for (const [dir, [manifest, files]] of Object.entries(OTHERS)) {
      write(p, "packages/" + dir + "/package.json", js(manifest));
      for (const [file, ...names] of files) write(p, "packages/" + dir + "/" + file, glow(names));
    }
    write(p, "packages/nullish/package.json", "null\n"); // (a manifest of no object: read by the miss's walk below)
    PAGES.forEach(([name, spec], i) => write(p, "apps/web/p" + i + ".tsx", page(name, spec, i)));
    write(p, "apps/web/pd.tsx", "import MetaDefault from \"" + DEFAULT_PAGE[1] + "\";\nexport const PD = () => <MetaDefault />;\n");
    write(p, "apps/web/miss.tsx", "import Link from \"next/link\";\nimport { WholeGlow } from \"@acme/kit\";\nexport const M = () => <Link><WholeGlow /></Link>;\n");
    try { got = seeded(p).filter((n) => ASKED.has(n)); limits = S.designSystemReport(p).limits; } catch (e) { threw = e.constructor.name + ": " + String(e.message).slice(0, 120); }
  }
  const WANT = ["AnatomyGlow", "BackOk", "BareGlow", "Broad16Glow", "ChipGlow", "DblGlow", "DialogRoot", "EdgeGlow", "FitsGlow", "FormInput", "LateFirst", "ListOk", "MetaDefault",
    "MetaGlow", "NestA", "PanelRight", "ShallowGlow", "SlashGlow", "TintGlow", "VaultGuess", "ViewGlow", "WholeGlow"];
  const has = (list) => list.every((n) => got.includes(n)), none = (list) => list.every((n) => !got.includes(n));
  all("1.35.4: a workspace package's subpath is also where its `exports` map says, read as Node reads it — its own key as written (`./anatomy`, `./layouts/NestProviders`; `layouts/nestproviders` matches no key), else the pattern with the longest part before its `*` (`./looks/*` over `./*/panel-view`), then the longest key (`./looks/*/metadata` over `./looks/*`), never one longer than the subpath (`./*/panel-view` for `panel-view`); the `*` any text, `/` included (`forms/input`), every `*` of a target (`*/*-kit`), a key of two `*`s none; an index target is its folder (`dialog`, `forms/input`); every condition's target (Chakra's `dev`) up to `default`; a list's first target Node takes, past the ones it refuses (no `./`, `..`, `.`, `%2E%2e`, `Node_Modules`, `\\..\\`) and a `null` — a segment that only looks like one (`node_modules-x`) taken; a `\\` and a `//` in a target resolved; `null` excludes — never a shorter pattern instead (`private/vault`), the guess kept beside it (`components/vault2`); a match with a `..` none; a default import by its target's own name (`meta.tsx` for `…/metadata`); its bounds — 9 deep none, 8 read; 17 targets the first 16; 501 keys no map, 500 read; a mix of subpaths and conditions none, each without a word — and a list 100,000 deep, a `null` manifest crash nothing (got " + js({ got, threw, limits }) + ")", {
    scanned: () => threw === null,
    silent: () => js(limits) === "[]",
    keyChoice: () => has(["AnatomyGlow", "NestA", "PanelRight", "MetaGlow", "ViewGlow"]) && none(["NestB", "PanelWrong", "PanelOverlap", "MetaWrong"]),
    star: () => has(["FormInput", "ChipGlow", "BackOk", "DialogRoot"]) && none(["GradGlow", "BackGlow"]),
    nulls: () => has(["VaultGuess"]) && none(["VaultDecoy"]),
    conditions: () => has(["TintGlow", "LateFirst"]) && none(["LateSecond"]),
    lists: () => has(["ListOk", "EdgeGlow"]) && none(["ListSecond", "EdgeSecond"]),
    separators: () => has(["SlashGlow", "DblGlow"]),
    defaultImport: () => has(["MetaDefault"]),
    bounds: () => has(["ShallowGlow", "Broad16Glow", "FitsGlow"]) && none(["DeepGlow", "BroadGlow", "ManyGlow", "MixGlow"]),
    package: () => has(["WholeGlow", "BareGlow"]),
    exactly: () => js(got) === js(WANT),
  });

  // --- Node's own resolver: the file require.resolve picks is the file the scan reaches, and none other -------------------------------
  {
    // The same packages as node_modules/@acme/<x> (the kit's manifest without its abyss — not every Node's reader takes a
    // list that deep), each folder given an index stub where it has none (Node checks that its target exists; the scan
    // takes an index target for its folder). Left out, knowingly: a condition's target (Node takes its own — require,
    // node, default —, the scan any: TintGlow, ShallowGlow, DeepGlow, BroadGlow, Broad16Glow), the guess (VaultGuess,
    // BareGlow), the package itself (WholeGlow: its folder) and the 500-key bound (ManyGlow).
    const base = path.join(tmp, "dsexp-node");
    const LEFT_OUT = new Set(["TintGlow", "ShallowGlow", "DeepGlow", "BroadGlow", "Broad16Glow", "VaultGuess", "BareGlow", "WholeGlow", "ManyGlow"]);
    const nm = (dir) => path.join(base, "node_modules", "@acme", dir);
    write(nm("kit"), "package.json", js({ name: "@acme/kit", exports: KIT_MAP }));
    for (const [file, ...names] of KIT_FILES) write(nm("kit"), file, glow(names));
    for (const [file, text] of KIT_EXTRA) write(nm("kit"), file, text);
    for (const dir of ["fits", "mixed"]) { write(nm(dir), "package.json", js(OTHERS[dir][0])); for (const [file, ...names] of OTHERS[dir][1]) write(nm(dir), file, glow(names)); }
    const stub = (d) => { for (const f of ["index.ts", "index.tsx"]) if (!fs.existsSync(path.join(d, f))) fs.writeFileSync(path.join(d, f), "export {};\n"); for (const e of fs.readdirSync(d, { withFileTypes: true })) if (e.isDirectory()) stub(path.join(d, e.name)); };
    stub(path.join(nm("kit"), "src", "components"));
    write(base, "probe.js", "\n");
    const req = createRequire(path.join(base, "probe.js"));
    const node = {}, conds = {};
    const quiet = process.noDeprecation;
    process.noDeprecation = true; // (Node warns of a `//` target: DEP0166)
    try {
      for (const [name, spec] of PAGES.concat([DEFAULT_PAGE])) {
        if (LEFT_OUT.has(name)) continue;
        const [dir, file] = fileOf.get(name);
        let picked = null;
        // (both real: Node may answer with the temp folder's short name, `ADMINI~1`)
        try { picked = path.relative(fs.realpathSync.native(nm(dir)), fs.realpathSync.native(req.resolve(spec))).split(path.sep).join("/"); } catch (e) { picked = e.code || e.constructor.name; }
        const resolved = fs.existsSync(path.join(nm(dir), picked));
        // (Node's file holds the name: that file, or an index whose folder holds it)
        const holds = resolved && (picked === file || (/^index\.[cm]?[jt]sx?$/.test(path.posix.basename(picked)) && file.startsWith(path.posix.dirname(picked) + "/")));
        node[name] = [spec, picked, holds, got.includes(name)];
        conds[name] = () => holds === got.includes(name);
      }
    } finally {
      process.noDeprecation = quiet;
    }
    conds.ran = () => threw === null && Object.keys(node).length === 27;
    all("1.35.4: Node's own resolver agrees — for each import of the map's shapes, the name is listed exactly when the file require.resolve picks holds it (that file, or an index whose folder holds it): a key's choice, a list's first target, `null`, a `..` in the subpath, a two-`*` key, a `\\` and a `//`, a map of 500 keys, one mixing subpaths and conditions — each name's [spec, Node's file or error, Node's file holds it, listed] (got " + js(node) + ")", conds);
  }

  // --- the kept maps' budget: 4 MB of manifests, a manifest with no map spending none -----------------------------------------------
  {
    const p = project("budget", { "package.json": js({ private: true, workspaces: ["packages/*"], dependencies: { react: "1" } }) });
    // b0: 502 keys — no map, it spends none —; b1…b17: exactly 4 MiB between them (16 of 246,724 characters and one of
    // 246,720); b18: past them. Asked in that order (one page renders them so).
    const SIZES = [240000].concat(Array(16).fill(246724), [246720, 240000]);
    const sizes = [];
    SIZES.forEach((size, i) => {
      const man = { name: "@acme/b" + i, exports: { "./*": "./src/components/kit/*.tsx", "./pad": "./dist/" } };
      if (i === 0) for (let k = 0; k < 500; k++) man.exports["./k" + k] = "./dist/k" + k + ".js";
      man.exports["./pad"] = "./dist/" + "y".repeat(size - js(man).length);
      const text = js(man);
      sizes.push(text.length);
      write(p, "packages/b" + i + "/package.json", text);
      write(p, "packages/b" + i + "/src/components/kit/glow.tsx", glow(["B" + i + "Glow"]));
    });
    write(p, "apps/web/page.tsx", SIZES.map((_, i) => "import { B" + i + "Glow } from \"@acme/b" + i + "/glow\";").join("\n") + "\nexport const P = () => <>" + SIZES.map((_, i) => "<B" + i + "Glow />").join("") + "</>;\n");
    let listed = [], err = null, said = null;
    try { listed = seeded(p).filter((n) => /^B\d+Glow$/.test(n)); said = S.designSystemReport(p).limits; } catch (e) { err = String(e.message).slice(0, 120); }
    const want = SIZES.map((_, i) => "B" + i + "Glow").slice(1, 18);
    all("1.35.4: a workspace package's map is kept while the manifests whose maps are kept total 4 MB or less — 17 of them make exactly 4 MiB and are all read; the 18th, past them, gets the guess alone, without a word; a manifest that holds no map (502 keys) spends none of it (got " + js({ listed, err, said, sizes: [sizes[0], sizes[1], sizes[17], sizes[18]] }) + ")", {
      silent: () => js(said) === "[]",
      sizes: () => sizes.every((n, i) => n === SIZES[i]) && sizes.slice(1, 18).reduce((a, b) => a + b, 0) === 4 * 1024 * 1024,
      kept: () => want.every((n) => listed.includes(n)),
      noMap: () => !listed.includes("B0Glow"),
      past: () => !listed.includes("B18Glow"),
    });
  }

  // --- each folder its own manifest's map (shadcn's templates: two `packages/ui` named `@workspace/ui`); the root package's own ------
  {
    const p = project("folders", { "package.json": js({ name: "kit-root", private: true, dependencies: { react: "1" }, exports: { "./*": "./src/components/*/index.tsx" } }) });
    for (const [t, own, other] of [["a", "a-kit", "b-kit"], ["b", "b-kit", "a-kit"]]) {
      const T = t.toUpperCase(), ui = "templates/" + t + "/packages/ui/";
      write(p, ui + "package.json", js({ name: "@workspace/ui", exports: { "./*": "./src/components/" + own + "/*.tsx" } }));
      write(p, ui + "src/components/" + own + "/tile.tsx", glow([T + "Glow"]));
      // (the other template's map, read for this folder, would reach this one)
      write(p, ui + "src/components/" + other + "/tile.tsx", glow([T + "Cross"]));
      write(p, "templates/" + t + "/apps/web/app/page.tsx", "import { " + T + "Glow, " + T + "Cross } from \"@workspace/ui/tile\";\nexport default function P() { return <><" + T + "Glow /><" + T + "Cross /></>; }\n");
    }
    write(p, "src/components/button/glow.tsx", glow(["RootKitGlow"]));
    write(p, "src/app/page.tsx", page("RootKitGlow", "kit-root/button", 0));
    let listed = [], err = null;
    try { listed = seeded(p).filter((n) => /^(?:[AB](?:Glow|Cross)|RootKitGlow)$/.test(n)); } catch (e) { err = String(e.message).slice(0, 120); }
    all("1.35.4: each folder of a package's name reads its own manifest's map — two templates' `packages/ui`, both `@workspace/ui`, each reach their own kit and never through the other's map —, and the root package's own map gives its subpaths (Node's self-reference: `kit-root/button`) (got " + js({ listed, err }) + ")", {
      own: () => listed.includes("AGlow") && listed.includes("BGlow"),
      other: () => !listed.includes("ACross") && !listed.includes("BCross"),
      root: () => listed.includes("RootKitGlow"),
    });
  }

  // --- what it costs: a key's targets are reached once, whatever the lookups --------------------------------------------------------
  {
    // hard: one key of 4,000 conditions (each a target Node would take: every one is reached, the first 16 kept); soft: the
    // same key cut to the 16 it keeps, the manifest padded to the same size — 100 pages, each in a folder of its own and
    // asking 11 subpaths (1,100 lookups; without the memo, 12,000 conditions measured ×50 — 24 s against 0.4 —, the soft
    // side the same with or without it)
    const memo = (tag, conditions) => {
      const p = project("memo-" + tag, { "package.json": js({ private: true, workspaces: ["packages/*"], dependencies: { react: "1" } }) });
      const star = { source: "./src/components/glow/*.tsx" };
      for (let i = 0; i < conditions; i++) star["c" + i.toString(36)] = "./d/*.js";
      return [p, star];
    };
    const [hard, hardMap] = memo("hard", 4000), [soft, softMap] = memo("soft", 15);
    const hardText = js({ name: "@acme/huge", description: "", exports: { "./*": hardMap } });
    const softMan = { name: "@acme/huge", description: "", exports: { "./*": softMap } };
    softMan.description = "x".repeat(hardText.length - js(softMan).length);
    const softText = js(softMan);
    for (const [p, text] of [[hard, hardText], [soft, softText]]) {
      write(p, "packages/huge/package.json", text);
      write(p, "packages/huge/src/components/glow/g.tsx", glow(["HugeGlow"]));
      for (let i = 0; i < 100; i++) {
        const lines = Array.from({ length: 10 }, (_, k) => "import { HugeGlow as H" + k + " } from \"@acme/huge/x" + k + "\";");
        lines.push("import { HugeGlow } from \"@acme/huge/g\";", "export const P = () => <><HugeGlow />" + Array.from({ length: 10 }, (_, k) => "<H" + k + " />").join("") + "</>;");
        write(p, "apps/a" + i + "/page.tsx", lines.join("\n") + "\n");
      }
    }
    const row = (p) => S.designSystemReport(p).missing.some((m) => m.name === "HugeGlow");
    const rows = [row(hard), row(soft)]; // (and each read once before it is timed)
    const mms = remeasure(() => { const t0 = Date.now(); S.designSystemReport(hard); const t1 = Date.now(); S.designSystemReport(soft); return [t1 - t0, Date.now() - t1]; }, (s) => s[0] < 2.5 * s[1] + 150);
    all("1.35.4: a key's targets are reached once, whatever the lookups — 1,100 lookups of a key of 4,000 conditions cost no more than of the same key cut to the 16 it keeps (the manifest the same size), and the map gives the row in both (got " + js({ ms: mms, rows, chars: [hardText.length, softText.length] }) + ")", {
      rows: () => rows[0] && rows[1],
      size: () => hardText.length === softText.length && hardText.length < 256 * 1024,
      memo: () => mms[0] < 2.5 * mms[1] + 150,
    });
  }

  // --- review 1 of 1.35.4 (EXP-1): a path the map writes past 1,024 characters names no file — a target, or what the match makes it --
  {
    // Each long target is padded with a run of `/` — the scan folds a `//` as Node does (DEP0166) — so the file it would
    // name IS there: past the bound it is not taken all the same, and the bound alone decides (`at` 1,000 characters kept,
    // `past` 1,100 not; a pattern's 980 + the match — `near` 984 taken, FAR 1,040 not —; two `*`s 980 + twice the match —
    // `ab` 984 taken, TWO 1,040 not: counted once it would be 1,010). A list still ends at a target past it (Node takes it).
    const pad = (head, tail, len) => head + "/".repeat(len - head.length - tail.length) + tail;
    const KIT = "src/components/kit/";
    const FAR = "far-" + "a".repeat(56), TWO = "two-" + "b".repeat(26);
    const LONG_MAP = {
      "./at": "./" + pad(KIT, "at.tsx", 998),
      "./past": "./" + pad(KIT, "past.tsx", 1098),
      "./head": ["./" + pad(KIT, "head.tsx", 1098), "./" + KIT + "next.tsx"],
      "./p/*": "./" + pad(KIT, "*.tsx", 980),
      "./q/*": "./" + pad("src/components/", "*/*.tsx", 980),
    };
    const lengths = [LONG_MAP["./at"], LONG_MAP["./past"], LONG_MAP["./head"][0], LONG_MAP["./p/*"], LONG_MAP["./q/*"]].map((t) => t.length);
    const p = project("paths", { "package.json": WORKSPACE, "packages/long/package.json": js({ name: "@acme/long", exports: LONG_MAP }) });
    const FILES = [["at", "AtGlow"], ["past", "PastGlow"], ["head", "HeadGlow"], ["next", "NextGlow"], ["near", "NearGlow"], [FAR, "FarGlow"]];
    for (const [f, n] of FILES) write(p, "packages/long/" + KIT + f + ".tsx", glow([n]));
    write(p, "packages/long/src/components/ab/ab.tsx", glow(["TwoNearGlow"]));
    write(p, "packages/long/src/components/" + TWO + "/" + TWO + ".tsx", glow(["TwoFarGlow"]));
    const LONG_PAGES = [["AtGlow", "at"], ["PastGlow", "past"], ["HeadGlow", "head"], ["NextGlow", "head"], ["NearGlow", "p/near"], ["FarGlow", "p/" + FAR],
      ["TwoNearGlow", "q/ab"], ["TwoFarGlow", "q/" + TWO]];
    LONG_PAGES.forEach(([name, sub], i) => write(p, "apps/web/l" + i + ".tsx", page(name, "@acme/long/" + sub, i)));
    const asked = new Set(LONG_PAGES.map(([n]) => n));
    let listed = [], err = null, said = null;
    try { listed = seeded(p).filter((n) => asked.has(n)); said = S.designSystemReport(p).limits; } catch (e) { err = e.constructor.name + ": " + String(e.message).slice(0, 120); }
    const yes = (n) => listed.includes(n), no = (n) => !listed.includes(n);
    all("1.35.4 review 1: a target the map writes past 1,024 characters (DS_PATH_CHARS) is not kept — 1,100 of them, though its `//`s fold to a file that is there — and a pattern's target the match would make longer is not taken, its every `*` counted (980 + 2 × 30); a target of 1,000 characters and the matches that stay under the bound still give their files; a list still ends at a target past the bound, as Node takes it — each without a word (got " + js({ listed, err, said, lengths }) + ")", {
      scanned: () => err === null,
      lengths: () => js(lengths) === js([1000, 1100, 1100, 982, 982]),
      silent: () => js(said) === "[]",
      kept: () => yes("AtGlow") && yes("NearGlow") && yes("TwoNearGlow"),
      pastKept: () => no("PastGlow"),
      pastInList: () => no("HeadGlow") && no("NextGlow"),
      pastTaken: () => no("FarGlow"),
      everyStar: () => no("TwoFarGlow"),
      exactly: () => js(listed) === js(["AtGlow", "NearGlow", "TwoNearGlow"]),
    });
  }

  // --- review 1 of 1.35.4 (EXP-1): the reviewer's many-star manifest — a `./*` target of 200,000 `*`s, 10 imports of 1,900-character
  // subpaths (every `*` × the match: 380 MB a lookup — it ran the scan out of a 4 GB heap) — scanned by the CLI in a heap of 256 MB --
  {
    const CLI = path.join(__dirname, "..", "cli", "dev-spec.js");
    // a node process → { code, signal, killed, stdout, stderr, ms } — killed after killMs (a hang FAILS, never waits forever)
    const runNode = (args, { env, cwd, killMs }) => new Promise((resolve) => {
      const t0 = Date.now();
      const ch = spawn(process.execPath, args, { env, cwd, stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "", stderr = "", killed = false;
      ch.stdout.on("data", (d) => { stdout += d; });
      ch.stderr.on("data", (d) => { stderr += d; });
      const timer = setTimeout(() => { killed = true; ch.kill(); }, killMs);
      ch.on("close", (code, signal) => { clearTimeout(timer); resolve({ code, signal, killed, stdout, stderr, ms: Date.now() - t0 }); });
    });
    const p = project("stars", { "package.json": WORKSPACE });
    const manifest = js({ name: "@acme/ui", exports: { "./*": "./" + "*".repeat(200000) } });
    write(p, "packages/ui/package.json", manifest);
    write(p, "packages/ui/src/components/glow/glow.tsx", glow(["FooGlow"]));
    // (and a package whose `./*` target is of a normal length: it still gives its file)
    write(p, "packages/calm/package.json", js({ name: "@acme/calm", exports: { "./*": "./src/components/glow/*.tsx" } }));
    write(p, "packages/calm/src/components/glow/calm.tsx", glow(["CalmGlow"]));
    const lines = Array.from({ length: 10 }, (_, i) => "import { FooGlow as F" + i + " } from \"@acme/ui/" + String.fromCharCode(97 + i) + i + "x".repeat(1900) + "\";");
    lines.push("import { CalmGlow } from \"@acme/calm/calm\";", "export const P = () => <><CalmGlow />" + Array.from({ length: 10 }, (_, i) => "<F" + i + " />").join("") + "</>;");
    write(p, "apps/web/page.tsx", lines.join("\n") + "\n");
    const r = await runNode(["--max-old-space-size=256", CLI, "design-system", "--json"], { env: Object.assign({}, process.env, { SPEC_PROJECT_DIR: p }), cwd: p, killMs: 120000 });
    let j = null;
    try { j = JSON.parse(r.stdout); } catch { /* no JSON: the check says so */ }
    const rows = j && Array.isArray(j.missing) ? j.missing.map((m) => m.name).sort() : null;
    all("1.35.4 review 1: the reviewer's many-star manifest — a `./*` target of 200,000 `*`s (" + manifest.length + " characters) and 10 imports of 1,900-character subpaths — is scanned by `dev-spec design-system --json` in a heap of 256 MB: it exits 0 (it ran a 4 GB heap out of memory, exit 134), the many-star target naming no file and the normal-length one giving its row (got " + js({ code: r.code, signal: r.signal, killed: r.killed, ms: r.ms, rows, err: r.stderr.slice(0, 200) }) + ")", {
      exits: () => r.code === 0 && !r.killed,
      json: () => j !== null && j.ok === true,
      normal: () => rows.includes("CalmGlow"),
      noFile: () => !rows.includes("FooGlow"),
    });
  }

  // --- review 1 of 1.35.4 (EXP-3): in a list, an object whose `default` resolves ends it — `default` always matches -------------------
  {
    // [{default: a}, b]: Node never reaches b, under any conditions; [{import: a}, b]: b where `import` is not one (require);
    // a `default` that resolves through another object ends it too, one that may match nothing (`{import}`), a `null` and a
    // target Node refuses do not; an object of `import` and `default` ends it with both its targets. And Node's own
    // require.resolve picks, for each, a file the scan lists — never one it cuts.
    const K = "./src/components/kit/", F = (f) => K + f + ".tsx";
    const LISTS = {
      "./ends": [{ default: F("ends-first") }, F("ends-after")],
      "./goes": [{ import: F("goes-first") }, F("goes-after")],
      "./deep": [{ default: { default: F("deep-first") } }, F("deep-after")],
      "./may": [{ default: { import: F("may-first") } }, F("may-after")],
      "./nulls": [{ default: null }, F("null-after")],
      "./refused": [{ default: "./../up.tsx" }, F("ref-after")],
      "./both": [{ import: F("both-import"), default: F("both-default") }, F("both-after")],
      // (a list that ends at a target ends the one around it: a list in a list, a list under `default`)
      "./inlist": [[F("in-first"), F("in-second")], F("in-after")],
      "./deflist": [{ default: [F("dl-first")] }, F("dl-after")],
      // (review 2: it ends the list only when every branch up to its `default` resolves — a condition before it that gives
      // `null`, `[]` or a target Node refuses sends Node on to the next entry under that condition; one whose target
      // resolves, `require` as `import` in `./both`, ends it)
      "./inull": [{ import: null, default: F("inull-first") }, F("inull-after")],
      "./rnull": [{ require: null, default: F("rnull-first") }, F("rnull-after")],
      "./rempty": [{ require: [], default: F("rempty-first") }, F("rempty-after")],
      "./rrefused": [{ require: "./node_modules/x.tsx", default: F("rref-first") }, F("rref-after")],
      "./ract": [{ require: F("ract-require"), default: F("ract-default") }, F("ract-after")],
    };
    // (a file's name is never the name it holds: a component folder's file gives a row of its own name — `ends-first.tsx`, EndsFirst)
    const pascal = (f) => f.replace(/(?:^|-)([a-z])/g, (_, c) => c.toUpperCase()) + "Glow";
    const filesIn = (v) => typeof v === "string" ? (v.startsWith(K) ? [v.slice(K.length, -4)] : []) : v && typeof v === "object" ? Object.values(v).flatMap(filesIn) : [];
    const manifest = js({ name: "@acme/lists", exports: LISTS });
    const p = project("lists", { "package.json": WORKSPACE, "packages/lists/package.json": manifest });
    const base = path.join(tmp, "dsexp-lists-node"), nm = path.join(base, "node_modules", "@acme", "lists");
    write(nm, "package.json", manifest);
    write(base, "probe.js", "\n");
    const req = createRequire(path.join(base, "probe.js"));
    const asked = new Set(), node = {};
    Object.entries(LISTS).forEach(([key, value], i) => {
      const files = filesIn(value), spec = "@acme/lists/" + key.slice(2);
      for (const f of files) { write(p, "packages/lists/" + K.slice(2) + f + ".tsx", glow([pascal(f)])); write(nm, K.slice(2) + f + ".tsx", glow([pascal(f)])); asked.add(pascal(f)); }
      write(p, "apps/web/list" + i + ".tsx", "import { " + files.map(pascal).join(", ") + " } from \"" + spec + "\";\nexport const L" + i + " = () => <>" + files.map((f) => "<" + pascal(f) + " />").join("") + "</>;\n");
      try { node[key] = pascal(path.basename(fs.realpathSync.native(req.resolve(spec)), ".tsx")); } catch (e) { node[key] = e.code || e.constructor.name; }
    });
    // (and Node's import.meta.resolve — the `import` conditions —, through a module of the probe's folder: none, or not a
    // synchronous one, before Node 18.19 / 20.6 — the check is skipped there)
    write(base, "probe.mjs", "export const resolve = typeof import.meta.resolve === \"function\" && typeof import.meta.resolve(\"./probe.mjs\") === \"string\" ? (s) => import.meta.resolve(s) : null;\n");
    const esmResolve = (await import(pathToFileURL(path.join(base, "probe.mjs")).href)).resolve, esm = {};
    if (esmResolve) for (const key of Object.keys(LISTS)) { try { esm[key] = pascal(path.basename(fileURLToPath(esmResolve("@acme/lists/" + key.slice(2))), ".tsx")); } catch (e) { esm[key] = e.code || e.constructor.name; } }
    let listed = [], err = null;
    try { listed = seeded(p).filter((n) => asked.has(n)); } catch (e) { err = e.constructor.name + ": " + String(e.message).slice(0, 120); }
    // (review 1's lists, review 2's: each check of its own)
    const R2 = ["./inull", "./rnull", "./rempty", "./rrefused", "./ract"], R1 = Object.keys(LISTS).filter((k) => !R2.includes(k));
    const namesOf = (keys) => new Set(keys.flatMap((k) => filesIn(LISTS[k]).map(pascal)));
    const of = (o, keys) => Object.fromEntries(keys.map((k) => [k, o[k]]));
    const listed1 = listed.filter((n) => namesOf(R1).has(n)), listed2 = listed.filter((n) => namesOf(R2).has(n)), node1 = of(node, R1), node2 = of(node, R2);
    const CUT = ["EndsAfterGlow", "DeepAfterGlow", "BothAfterGlow", "InSecondGlow", "InAfterGlow", "DlAfterGlow", "RactAfterGlow"];
    all("1.35.4 review 1: in a target list, an object whose `default` resolves ends it as Node's resolver does (`default` always matches) — [{default: a}, b] never b, a `default` resolving through another object either — while an object that may match nothing (`{import}`, `{default: {import}}`), a `default: null` and a `default` Node refuses pass on to the next entry, and `{import, default}` gives both before it ends; Node's require.resolve picks a listed file for each list, never a cut one (got " + js({ listed: listed1, err, node: node1 }) + ")", {
      scanned: () => err === null,
      ends: () => listed.includes("EndsFirstGlow") && !listed.includes("EndsAfterGlow"),
      deep: () => listed.includes("DeepFirstGlow") && !listed.includes("DeepAfterGlow"),
      both: () => listed.includes("BothImportGlow") && listed.includes("BothDefaultGlow") && !listed.includes("BothAfterGlow"),
      goesOn: () => ["GoesFirstGlow", "GoesAfterGlow", "MayFirstGlow", "MayAfterGlow", "NullAfterGlow", "RefAfterGlow"].every((n) => listed.includes(n)),
      nested: () => listed.includes("InFirstGlow") && listed.includes("DlFirstGlow") && !["InSecondGlow", "InAfterGlow", "DlAfterGlow"].some((n) => listed.includes(n)),
      node: () => js(node1) === js({ "./ends": "EndsFirstGlow", "./goes": "GoesAfterGlow", "./deep": "DeepFirstGlow", "./may": "MayAfterGlow", "./nulls": "NullAfterGlow", "./refused": "RefAfterGlow", "./both": "BothDefaultGlow", "./inlist": "InFirstGlow", "./deflist": "DlFirstGlow" }),
      nodeListed: () => Object.values(node1).every((n) => listed.includes(n) && !CUT.includes(n)),
      exactly: () => js(listed1) === js(["BothDefaultGlow", "BothImportGlow", "DeepFirstGlow", "DlFirstGlow", "EndsFirstGlow", "GoesAfterGlow", "GoesFirstGlow", "InFirstGlow", "MayAfterGlow", "MayFirstGlow", "NullAfterGlow", "RefAfterGlow"]),
    });
    // review 2: an object ends the list only when every branch up to its `default` resolves — [{import: null, default: a}, b]
    // reaches b (Node's import.meta.resolve takes it), as `require: null`, `require: []` and a `require` target Node refuses
    // do (its require.resolve takes b); [{require: x, default: a}, b] — and `./both`'s `import` — does not
    all("1.35.4 review 2: in a target list, an object ends it only when every branch up to its `default` resolves — [{import: null, default: a}, b], [{require: null, default: a}, b], [{require: [], default: a}, b] and [{require: \"./node_modules/x\", default: a}, b] reach b as well as a, as Node's resolver goes on to the next entry under that condition, while [{require: x, default: a}, b] (and `./both`'s {import: x, default: a}) does not reach b; Node's require.resolve and import.meta.resolve each pick a listed file for every list, never a cut one (got " + js({ listed: listed2, node: node2, esm: esmResolve ? esm : "no import.meta.resolve here: that check skipped" }) + ")", {
      scanned: () => err === null,
      goesOn: () => ["InullFirstGlow", "InullAfterGlow", "RnullFirstGlow", "RnullAfterGlow", "RemptyFirstGlow", "RemptyAfterGlow", "RrefFirstGlow", "RrefAfterGlow"].every((n) => listed.includes(n)),
      ends: () => listed.includes("RactRequireGlow") && listed.includes("RactDefaultGlow") && !listed.includes("RactAfterGlow") && !listed.includes("BothAfterGlow"),
      node: () => js(node2) === js({ "./inull": "InullFirstGlow", "./rnull": "RnullAfterGlow", "./rempty": "RemptyAfterGlow", "./rrefused": "RrefAfterGlow", "./ract": "RactRequireGlow" }),
      esm: () => !esmResolve || js(esm) === js({ "./ends": "EndsFirstGlow", "./goes": "GoesFirstGlow", "./deep": "DeepFirstGlow", "./may": "MayFirstGlow", "./nulls": "NullAfterGlow", "./refused": "RefAfterGlow", "./both": "BothImportGlow",
        "./inlist": "InFirstGlow", "./deflist": "DlFirstGlow", "./inull": "InullAfterGlow", "./rnull": "RnullFirstGlow", "./rempty": "RemptyFirstGlow", "./rrefused": "RrefFirstGlow", "./ract": "RactDefaultGlow" }),
      nodeListed: () => Object.values(node2).concat(Object.values(esm)).every((n) => listed.includes(n) && !CUT.includes(n)),
      exactly: () => js(listed2) === js(["InullAfterGlow", "InullFirstGlow", "RactDefaultGlow", "RactRequireGlow", "RemptyAfterGlow", "RemptyFirstGlow", "RnullAfterGlow", "RnullFirstGlow", "RrefAfterGlow", "RrefFirstGlow"]),
    });
  }

  // --- review 2 of 1.35.4 (RES-1): a default import walks each base's files once a place, whatever the place's keys -----------------
  {
    // hard: 200 workspace packages all named `@workspace/ui` (shadcn's templates' shape: every folder named like it is a place
    // of the import — 400 keys a place, all of base `button`), each a button.tsx with a default export, and 200 page folders
    // importing it by DEFAULT; soft: the same tree importing it by name (lookup's named branch: none of the default's walk) —
    // once a key, each place walked the 200 files 400 times: ×6 to ×8 at this size (three copies of this file at once
    // too), ×26 on 400 packages and 1,000 pages; grouped, ×1.1 to ×1.5
    const ui = (tag, byDefault) => {
      const p = project("default-" + tag, { "package.json": js({ private: true, workspaces: ["pkgs/*/ui", "apps/*"], dependencies: { react: "1" } }), "apps/web/package.json": js({ name: "web", private: true }) });
      for (let i = 0; i < 200; i++) {
        write(p, "pkgs/p" + i + "/ui/package.json", js({ name: "@workspace/ui", private: true }));
        write(p, "pkgs/p" + i + "/ui/src/components/button.tsx", "export const Button = motion(Base);\nexport default Button;\n");
      }
      const imp = byDefault ? "import Button from \"@workspace/ui/components/button\";" : "import { Button } from \"@workspace/ui/components/button\";";
      for (let f = 0; f < 200; f++) write(p, "apps/web/p/f" + f + "/page.tsx", imp + "\nexport const P = () => <Button />;\n");
      return p;
    };
    const hard = ui("hard", true), soft = ui("soft", false);
    const button = (r) => r.missing.some((m) => m.name === "Button");
    const dms = remeasure(() => {
      const t0 = Date.now(), h = S.designSystemReport(hard), t1 = Date.now(), s = S.designSystemReport(soft);
      return [t1 - t0, Date.now() - t1, button(h), button(s)];
    }, (s) => s[0] < 2.5 * s[1] + 150);
    all("1.35.4 review 2: a default import's lookup walks each base's files once a place, its keys grouped by base — 200 page folders importing by default a button that 200 workspace packages all named `@workspace/ui` hold (400 keys a place, one base) cost within ×2.5 the same tree imported by name, and both settle Button (got " + js({ sample: dms, tries: dms.tries }) + ")", {
      rows: () => dms[2] && dms[3],
      bounded: () => dms[0] < 2.5 * dms[1] + 150,
    });
  }
};
