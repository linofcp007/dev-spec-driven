"use strict";
// The design-system registry — 1.35.4: a name imported through a barrel is followed to the file that declares it.
// Through what a module's own file passes on (`export { A as B } from`, `export *`, `export * as NS`, a name it imports
// exported again), any script the module is (a file barrel, `x/index`, a workspace package's `src/index`); a file's own link
// hides its stars, a star never passes a default, cycles end; the follow's bounds (files and characters read, one bound of
// steps) end it without a word; a namespace a barrel passes on widens the search, nothing else does; an `export {` that
// never closes is given up in linear time.

const fs = require("fs");
const path = require("path");

exports.run = async ({ all, S, tmp, remeasure, require, __dirname }) => {
  const js = (v) => JSON.stringify(v);
  const E = require(path.join(__dirname, "lib", "engine", "index.js"));
  const write = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  const L = (lines) => lines.join("\n") + "\n";
  const REACT = js({ dependencies: { react: "1.0.0" } });
  const project = (tag, files) => {
    const p = path.join(tmp, "proj-dsr-" + tag);
    write(p, "package.json", REACT);
    for (const [rel, text] of Object.entries(files || {})) write(p, rel, text);
    S.initProject(p, ["ui"], "en");
    return p;
  };
  // every row the scan finds, name → path (the seed lists all of them; the report its first 50)
  const rowsOf = (p) => { S.scaffoldSteeringFile(p, "design-system.md"); return Object.fromEntries(E.designSystemRegistry(path.join(p, ".specs")).components.map((c) => [c.name, c.path])); };
  const KIT = "src/components/ui/kit.tsx";
  const kit = L(["import { Box } from \"./box-lib\";", "export const MotionBox = motion(Box);", "export const Glide = motion(Box);", "export const Late = motion(Box);"]);
  const SPIN = "src/components/ui/spinners.tsx";
  const spin = L(["const Spin = makeSpin(config);", "export default Spin;"]);
  const page = (imports, jsx) => L(imports.concat(["export default function P() { return " + jsx + "; }"]));
  const has = (rows, name) => Object.prototype.hasOwnProperty.call(rows, name);

  // --- what a module's own file passes on, followed to the file that declares the name ----------------------------------------
  {
    const got = {
      // a file barrel's named re-export (beside another package's: skipped)
      named: rowsOf(project("named", { [KIT]: kit, "src/ui.ts": L(["export { Root as Drawer } from \"vaul\";", "export { MotionBox } from \"./components/ui/kit\";"]),
        "src/app/page.tsx": page(["import { MotionBox, Drawer } from \"@/ui\";"], "<MotionBox><Drawer /></MotionBox>") })),
      // a star (beside another package's star), a namespace import of the barrel, a namespace link, `export * as default`
      star: rowsOf(project("star", { [KIT]: kit, "src/ui.ts": L(["export * from \"framer-motion\";", "export * from \"./components/ui/kit\";"]),
        "src/app/page.tsx": page(["import { MotionBox } from \"@/ui\";"], "<MotionBox />") })),
      nsImport: rowsOf(project("ns-import", { [KIT]: kit, "src/ui.ts": L(["export * from \"./components/ui/kit\";"]),
        "src/app/page.tsx": page(["import * as UI from \"@/ui\";"], "<UI.MotionBox />") })),
      nsLink: rowsOf(project("ns-link", { [KIT]: kit, "src/ui.ts": L(["export * as Kit from \"./components/ui/kit\";"]),
        "src/app/page.tsx": page(["import { Kit } from \"@/ui\";"], "<Kit.MotionBox />") })),
      nsDefault: rowsOf(project("ns-default", { [KIT]: kit, "src/ui.ts": L(["export * as default from \"./components/ui/kit\";"]),
        "src/app/page.tsx": page(["import K from \"@/ui\";"], "<K.MotionBox />") })),
      // `default as` (an ESM spec with its extension: `./spinners.js` for spinners.tsx)
      defaultAs: rowsOf(project("default-as", { [SPIN]: spin, "src/ui.ts": L(["export { default as Spin } from \"./components/ui/spinners.js\";"]),
        "src/app/page.tsx": page(["import { Spin } from \"@/ui\";"], "<Spin />") })),
      // a name imported, then exported again — in a list, and as the default — under local names of its own (the import's
      // own name is what is followed: MotionBox, the default)
      again: rowsOf(project("again", { [KIT]: kit, [SPIN]: spin,
        "src/ui.ts": L(["import { MotionBox as MB } from \"./components/ui/kit\";", "import Sp1 from \"./components/ui/spinners\";", "export { MB as MotionBox };", "export default Sp1;"]),
        "src/app/page.tsx": page(["import { MotionBox } from \"@/ui\";", "import Sp from \"@/ui\";"], "<MotionBox><Sp /></MotionBox>") })),
      // a list over lines that closes — its names passed on, renamed too — and the statement right below it still read
      lines: rowsOf(project("lines", { [KIT]: kit, "src/ui.ts": L(["export {", "  MotionBox,", "  Glide as Gliding,", "} from \"./components/ui/kit\";", "export { Late } from \"./components/ui/kit\";"]),
        "src/app/page.tsx": page(["import { MotionBox, Gliding, Late } from \"@/ui\";"], "<MotionBox><Gliding /><Late /></MotionBox>") })),
      // `./x` is both `x.ts` and `x/index.ts` (a component folder's barrel)
      both: rowsOf(project("both", { [KIT]: kit, "src/ui.ts": L(["export { MotionBox } from \"./components/ui/kit\";"]), "src/ui/index.ts": L(["export { Glide } from \"../components/ui/kit\";"]),
        "src/app/page.tsx": page(["import { MotionBox, Glide } from \"@/ui\";"], "<MotionBox><Glide /></MotionBox>") })),
    };
    all("1.35.4: a name imported through a barrel is followed to the file that declares it, through what the module's own file passes on — `export { MotionBox } from` (beside another package's link: skipped, no row), `export *` (beside another package's star), a namespace import of the barrel (`<UI.MotionBox />`), `export * as Kit` (`<Kit.MotionBox />`), `export * as default`, `export { default as Spin } from \"./spinners.js\"`, a name imported and exported again (`export { MotionBox }`, `export default Spin`), a closed list over lines (renamed: `Glide as Gliding`, and the statement below it still read), `./ui` as both `ui.ts` and `ui/index.ts` — what is never rendered stays out (got " + js(got) + ")", {
      named: () => has(got.named, "MotionBox") && !has(got.named, "Glide") && !has(got.named, "Drawer"),
      star: () => has(got.star, "MotionBox") && !has(got.star, "Glide"),
      nsImport: () => has(got.nsImport, "MotionBox") && !has(got.nsImport, "Glide"),
      nsLink: () => has(got.nsLink, "MotionBox") && !has(got.nsLink, "Glide"),
      nsDefault: () => has(got.nsDefault, "MotionBox"),
      defaultAs: () => got.defaultAs.Spin === SPIN,
      again: () => has(got.again, "MotionBox") && got.again.Spin === SPIN && !has(got.again, "Glide"),
      lines: () => has(got.lines, "MotionBox") && has(got.lines, "Glide") && has(got.lines, "Late"),
      both: () => has(got.both, "MotionBox") && has(got.both, "Glide"),
    });
  }

  // --- a package's src/index, chains of stars, namespaces and renames; a subpath reaching outside; a lowercase alias -----------
  {
    const PKG = (name) => js({ name });
    const chakra = rowsOf(project("chakra", {
      "packages/kit/package.json": PKG("@acme/kit"),
      "packages/kit/src/index.ts": L(["export * from \"./components\";"]),
      "packages/kit/src/components/index.ts": L(["export * from \"./tooltip\";"]),
      "packages/kit/src/components/tooltip/index.ts": L(["export { TooltipRoot, TooltipTrigger } from \"./tooltip\";", "export * as Tooltip from \"./namespace\";"]),
      "packages/kit/src/components/tooltip/namespace.ts": L(["export {", "  TooltipRoot as Root,", "  TooltipTrigger as Trigger,", "} from \"./tooltip\";"]),
      "packages/kit/src/components/tooltip/tooltip.tsx": L(["export const TooltipRoot = withRootProvider(Ark.Root);", "export const TooltipTrigger = withContext(Ark.Trigger, \"trigger\");", "export const TooltipArrow = withContext(Ark.Arrow, \"arrow\");"]),
      "apps/web/package.json": REACT,
      // (the page writes Tooltip, T, Root, Trigger — none a name the files ask: the namespace a barrel passes on widens the search)
      "apps/web/src/page.tsx": L(["import { Tooltip as T } from \"@acme/kit\";", "export const P = () => <T.Root><T.Trigger /></T.Root>;"]),
    }));
    const primer = rowsOf(project("primer", {
      "packages/kit/package.json": PKG("@acme/kit"),
      "packages/kit/src/experimental/index.ts": L(["export { DataTable } from \"../components/tables\";"]),
      "packages/kit/src/components/tables.tsx": L(["export const DataTable = createTable(config);"]),
      "apps/web/package.json": REACT,
      "apps/web/src/page.tsx": L(["import { DataTable } from \"@acme/kit/experimental\";", "export const P = () => <DataTable />;"]),
    }));
    const gutenberg = rowsOf(project("gutenberg", {
      "packages/components/package.json": PKG("@acme/components"),
      "packages/components/src/index.ts": L(["export { TreeGridItem as __experimentalTreeGridItem } from \"./tree-grid\";"]),
      "packages/components/src/tree-grid/index.tsx": L(["export { default as TreeGridItem } from \"./item\";"]),
      "packages/components/src/tree-grid/item.tsx": L(["const TreeGridItem = makeItem(config);", "export default TreeGridItem;"]),
      "apps/editor/package.json": REACT,
      "apps/editor/src/page.tsx": L(["import { __experimentalTreeGridItem as TreeGridItem } from \"@acme/components\";", "export const P = () => <TreeGridItem />;"]),
    }));
    all("1.35.4: a workspace package's root import starts at its `src/index` and goes on through `export *` (two folders down), a component folder's `export * as Tooltip from \"./namespace\"` and a list over lines of renames (`TooltipRoot as Root`) to the declaring file — `<T.Root>` through `import { Tooltip as T }` is TooltipRoot, a part never rendered (TooltipArrow) stays out —; a subpath's own index re-exports from outside its folder (`@acme/kit/experimental` → `../components/tables`); a name the module exports in lower case (`__experimentalTreeGridItem`) is followed though the search never asks it (got " + js({ chakra, primer, gutenberg }) + ")", {
      chakra: () => has(chakra, "TooltipRoot") && has(chakra, "TooltipTrigger") && !has(chakra, "TooltipArrow"),
      primer: () => primer.DataTable === "packages/kit/src/components/tables.tsx",
      gutenberg: () => has(gutenberg, "TreeGridItem"),
    });
  }

  // --- what is not followed, and what a file's own link hides --------------------------------------------------------------
  {
    const filler = Array.from({ length: 200 }, (_, i) => "  X" + i + ",");
    const got = {
      // the barrel passes another name on
      other: rowsOf(project("other", { [KIT]: kit, "src/ui.ts": L(["export { Glide } from \"./components/ui/kit\";"]), "src/app/page.tsx": page(["import { MotionBox } from \"@/ui\";"], "<MotionBox />") })),
      // a star never passes a default
      starDefault: rowsOf(project("star-default", { [SPIN]: spin, "src/ui.ts": L(["export * from \"./components/ui/spinners\";"]), "src/app/page.tsx": L(["import S from \"@/ui\";", "// Spin", "export const P = () => <S />;"]) })),
      // a file's own `export { Shared } from` hides its stars: the one row is two.tsx's (one.tsx is the shorter path)
      shadow: rowsOf(project("shadow", { "src/components/ui/one.tsx": L(["export const Shared = motion(Base);"]), "src/components/ui/two.tsx": L(["export const Shared = motion(Base);"]),
        "src/ui.ts": L(["export * from \"./components/ui/one\";", "export * from \"./components/ui/two\";", "export { Shared } from \"./components/ui/two\";"]),
        "src/app/page.tsx": page(["import { Shared } from \"@/ui\";"], "<Shared />") })),
      // cycles of stars and of renames end, and a later query is still followed
      cycles: rowsOf(project("cycles", { [KIT]: kit, "src/a.ts": L(["export * from \"./b\";", "export { MotionBox } from \"./components/ui/kit\";"]), "src/b.ts": L(["export * from \"./a\";"]),
        "src/c.ts": L(["export { X as Y } from \"./d\";"]), "src/d.ts": L(["export { Y as X } from \"./c\";"]),
        "src/app/p.tsx": L(["import { Y } from \"@/c\";", "import { MotionBox } from \"@/b\";", "export const P = () => <><Y /><MotionBox /></>;"]),
        "src/g.ts": L(["export { Glide } from \"./components/ui/kit\";"]), "src/zzzzzzzzzzzzzzzzzzzz/late.tsx": L(["import { Glide } from \"@/g\";", "export const Q = () => <Glide />;"]) })),
      // a list that never closes passes nothing, and its lines go with it (DS_EXPORT_LIST_LINES: the star right below it is
      // not read, one 201 lines below is)
      unclosed: rowsOf(project("unclosed", { [KIT]: kit, "src/ui.ts": L(["import { MotionBox } from \"./components/ui/kit\";", "export {", "  MotionBox,"]), "src/app/page.tsx": page(["import { MotionBox } from \"@/ui\";"], "<MotionBox />") })),
      unclosedNear: rowsOf(project("unclosed-near", { [KIT]: kit, "src/ui.ts": L(["export {", "export * from \"./components/ui/kit\";"]), "src/app/page.tsx": page(["import { MotionBox } from \"@/ui\";"], "<MotionBox />") })),
      unclosedFar: rowsOf(project("unclosed-far", { [KIT]: kit, "src/ui.ts": L(["export {"].concat(filler, ["export * from \"./components/ui/kit\";"])), "src/app/page.tsx": page(["import { MotionBox } from \"@/ui\";"], "<MotionBox />") })),
      // an ambient module's re-export is indented: not the file's
      ambient: rowsOf(project("ambient", { [KIT]: kit, "src/ui.ts": L(["declare module \"@/ui\" {", "  export * from \"./components/ui/kit\";", "}"]), "src/app/page.tsx": page(["import { MotionBox } from \"@/ui\";"], "<MotionBox />") })),
      // a call through a barrel is the same binding's evidence: a weak helper the project calls is none
      called: rowsOf(project("called", { [KIT]: kit + "export function FormatPrice(value) { return value.toFixed(2); }\n", "src/lib.ts": L(["export { FormatPrice, MotionBox } from \"./components/ui/kit\";"]),
        "src/app/page.tsx": L(["import { FormatPrice, MotionBox } from \"@/lib\";", "export const p = FormatPrice(3);", "export const P = () => <MotionBox />;"]) })),
    };
    all("1.35.4: what is not followed — a name the barrel does not pass on (`export { Glide }` and `<MotionBox />`), a default through `export *` (ES: a star never passes one), an indented `export *` (an ambient `declare module`), a list that never closes (it passes nothing, and its DS_EXPORT_LIST_LINES lines go with it: a star right below it is not read, one 201 lines below is) —; a file's own `export { Shared } from \"./two\"` hides its stars (the row is two.tsx's, not the shorter one.tsx); cycles of stars (a ↔ b) and of renames (c ↔ d) end and a later query is still followed; a weak helper called through a barrel is none, as when imported directly (got " + js(got) + ")", {
      other: () => !has(got.other, "MotionBox") && !has(got.other, "Glide"),
      starDefault: () => !has(got.starDefault, "Spin"),
      shadow: () => got.shadow.Shared === "src/components/ui/two.tsx",
      cycles: () => has(got.cycles, "MotionBox") && has(got.cycles, "Glide"),
      unclosed: () => !has(got.unclosed, "MotionBox"),
      unclosedNear: () => !has(got.unclosedNear, "MotionBox"),
      unclosedFar: () => has(got.unclosedFar, "MotionBox"),
      ambient: () => !has(got.ambient, "MotionBox"),
      called: () => !has(got.called, "FormatPrice") && has(got.called, "MotionBox"),
    });
  }

  // --- what widens the search: a namespace a barrel read before it passes on — never a name passed on as it is ----------------
  {
    // the page writes Passed and M — not Moving, the default export's name: it is read only when Passed is a name looked for
    const widen = (tag, line) => rowsOf(project("widen-" + tag, { "src/components/ui/kit.tsx": L(["const Moving = motion(Box);", "export default Moving;"]),
      "src/components/ui/index.ts": L([line]),
      "src/app/page.tsx": page(["import { Passed } from \"@/components/ui\";", "import M from \"@/components/ui/kit\";"], "<Passed><M /></Passed>") }));
    const got = { namespace: widen("namespace", "export * as Passed from \"./all\";"), own: widen("own", "export { Passed } from \"./all\";") };
    all("1.35.4: a namespace a component folder's barrel passes on (`export * as Passed from \"./all\"`) is a name the search looks for — the page that writes it is read, and the default import it renders (`<M />`: Moving) settled —; a name passed on as it is (`export { Passed } from \"./all\"`) widens nothing: that page is never read (got " + js(got) + ")", {
      namespace: () => got.namespace.Moving === "src/components/ui/kit.tsx",
      own: () => !has(got.own, "Moving"),
    });
  }

  // --- the follow's bounds: files and characters read for it, one bound of steps — each ending it without a word --------------
  {
    const KIT2 = L(["export const Moving = motion(Box);", "export const Glide = motion(Box);", "export const Late = motion(Box);"]);
    const late = (p) => {
      write(p, "src/late.ts", L(["export { Late } from \"./components/ui/kit\";"]));
      write(p, "src/zzzzzzzzzzzzzzzzzzzzzzzzzzzzzz/late-page.tsx", L(["import { Late } from \"@/late\";", "export const Q = () => <Late />;"]));
    };
    const boundProject = (tag, build) => { const p = project("bound-" + tag, { [KIT]: KIT2 }); build(p); return p; };
    // files read: a chain of n stars; a component file's follow of kit.tsx costs no read (read before the search)
    const chainOf = (n, pad) => (p) => {
      if (!pad) write(p, "src/components/ui/user.tsx", L(["import { Glide } from \"./kit\";", "export function User() { return <Glide />; }"]));
      for (let i = 0; i < n; i++) write(p, "src/b/b" + i + ".ts", (i + 1 < n ? "export * from \"./b" + (i + 1) + "\";\n" : "export { Moving } from \"../components/ui/kit\";\n") + (pad || ""));
      write(p, "src/app/page.tsx", L(["import { Moving } from \"@/b/b0\";", "export const P = () => <Moving />;"]));
    };
    const r = {};
    r.files2000 = rowsOf(boundProject("files-2000", chainOf(2000)));
    r.files2001 = rowsOf(boundProject("files-2001", chainOf(2001)));
    // characters read: 8 MB — 32 files of 256K are read, the 33rd is not
    const pad = "// " + "x".repeat(270000) + "\n";
    r.chars32 = rowsOf(boundProject("chars-32", chainOf(32, pad)));
    r.chars33 = rowsOf(boundProject("chars-33", chainOf(33, pad)));
    // a rename chain of 200 files asked from 600 folders is followed once: a later query still has steps
    r.memo = rowsOf(boundProject("memo", (p) => {
      for (let i = 0; i < 200; i++) write(p, "src/r/r" + i + ".ts", i + 1 < 200 ? "export { M" + (i + 1) + " as M" + i + " } from \"./r" + (i + 1) + "\";\n" : "export { Moving as M199 } from \"../components/ui/kit\";\n");
      for (let j = 0; j < 600; j++) write(p, "src/app/f" + j + "/page.tsx", L(["import { M0 } from \"@/r/r0\";", "// Moving", "export const P = () => <M0 />;"]));
      late(p);
    }));
    // a file's star closure is indexed once: 400 names asked of a barrel of 100 stars, then a later query (once a name it
    // was 120,000 steps)
    r.closure = rowsOf(boundProject("closure", (p) => {
      write(p, "src/ui.ts", Array.from({ length: 100 }, (_, i) => "export * from \"./s/s" + i + "\";").join("\n") + "\n");
      for (let i = 0; i < 100; i++) write(p, "src/s/s" + i + ".ts", "export const v" + i + " = 1;\n");
      const rows = Array.from({ length: 4 }, (_, k) => Array.from({ length: 100 }, (_, j) => "Q" + (k * 100 + j)));
      write(p, "src/app/page.tsx", L(rows.map((q) => "import { " + q.join(", ") + " } from \"@/ui\";").concat(["// Moving", "export const P = () => <>"], rows.map((q) => q.map((n) => "<" + n + " />").join("")), ["</>;"])));
      late(p);
    }));
    // a module's keys and files are charged where a star or a link reaches it: 300 folders of one package name
    const keysOf = (n, links) => (p) => {
      for (let i = 0; i < 300; i++) write(p, "packages/p" + i + "/ui/package.json", js({ name: "@x/ui" }));
      if (!links) write(p, "src/ui.ts", "export * from \"@x/ui\";\n".repeat(n) + "export * from \"./components/ui/kit\";\n");
      else {
        write(p, "src/ui.ts", Array.from({ length: n }, (_, i) => "export * from \"./p/b" + i + "\";").join("\n") + "\n");
        for (let i = 0; i < n; i++) write(p, "src/p/b" + i + ".ts", i + 1 < n ? "export { Moving } from \"@x/ui\";\n" : "export { Moving } from \"../components/ui/kit\";\n");
      }
      write(p, "src/app/page.tsx", L(["import { Moving } from \"@/ui\";", "export const P = () => <Moving />;"]));
    };
    r.stars300 = rowsOf(boundProject("stars-300", keysOf(300, false)));
    r.stars400 = rowsOf(boundProject("stars-400", keysOf(400, false)));
    r.links300 = rowsOf(boundProject("links-300", keysOf(300, true)));
    r.links400 = rowsOf(boundProject("links-400", keysOf(400, true)));
    // …and its files: 150 folders of one package name, each with its `src/index.ts` (the files the root import is)
    const filesOfModule = (n) => (p) => {
      for (let i = 0; i < 150; i++) { write(p, "packages/q" + i + "/ui/package.json", js({ name: "@y/ui" })); write(p, "packages/q" + i + "/ui/src/index.ts", "export {};\n"); }
      write(p, "src/ui.ts", "export * from \"@y/ui\";\n".repeat(n) + "export * from \"./components/ui/kit\";\n");
      write(p, "src/app/page.tsx", L(["import { Moving } from \"@/ui\";", "export const P = () => <Moving />;"]));
    };
    r.modFiles300 = rowsOf(boundProject("mod-files-300", filesOfModule(300)));
    r.modFiles400 = rowsOf(boundProject("mod-files-400", filesOfModule(400)));
    // the names a file passes on are charged once a closure: barrels of 15,000 names
    const namesOf = (n) => (p) => {
      write(p, "src/ui.ts", Array.from({ length: n }, (_, i) => "export * from \"./n/n" + i + "\";").join("\n") + "\n");
      for (let i = 0; i < n; i++) {
        const lines = Array.from({ length: 100 }, (_, l) => "export { " + Array.from({ length: 150 }, (_, k) => "N" + i + "_" + (l * 150 + k)).join(", ") + " } from \"./x\";");
        if (i === n - 1) lines.push("export * from \"../components/ui/kit\";");
        write(p, "src/n/n" + i + ".ts", L(lines));
      }
      write(p, "src/app/page.tsx", L(["import { Moving } from \"@/ui\";", "export const P = () => <Moving />;"]));
    };
    r.names5 = rowsOf(boundProject("names-5", namesOf(5)));
    r.names7 = rowsOf(boundProject("names-7", namesOf(7)));
    // the candidates a lookup compares are charged: 900 files declare Root, n barrels are asked for it (each file named
    // root.tsx: their rows are one, the seed's 500 hold them all)
    const lookupsOf = (n) => (p) => {
      for (let i = 0; i < 900; i++) write(p, "src/components/ui/k" + i + "/root.tsx", "export const Root = make(config);\n");
      write(p, "src/leaf.ts", "export const leaf = 1;\n");
      for (let j = 0; j < n; j++) write(p, "src/b/b" + j + ".ts", "export * from \"../leaf\";\n");
      for (let j = 0; j < n; j++) write(p, "src/app/p" + j + ".tsx", L(["import { Root } from \"@/b/b" + j + "\";", "export const P = () => <Root />;"]));
      late(p);
    };
    r.lookups60 = rowsOf(boundProject("lookups-60", lookupsOf(60)));
    r.lookups120 = rowsOf(boundProject("lookups-120", lookupsOf(120)));
    const view = Object.fromEntries(Object.entries(r).map(([k, rows]) => [k, ["Moving", "Late"].filter((n) => has(rows, n))]));
    all("1.35.4: the follow reads up to DS_PASS_FILES (2,000) files and DS_PASS_CHARS (8 MB) for what they pass on — a chain of 2,000 barrels is followed, 2,001 is not; 32 of 256K are, 33 are not; a component file's own follow of kit.tsx reads nothing again —, and every operation is charged to DS_PASS_STEPS (100,000): a rename chain asked from 600 folders is followed once and a barrel's star closure indexed once (400 names asked of 100 stars: a later query still has steps), a module's keys and files where a star or a link reaches it (300 stars of a 300-folder package fit, 400 do not; the same through the links of a query; 300 stars of a 150-folder package whose folders each hold a `src/index.ts` fit, 400 do not), the names a file passes on (5 barrels of 15,000 names fit, 7 do not), the candidates a lookup compares (900 files declaring Root asked by 60 barrels leave room for a later query, by 120 none) — past each the follow ends without a word (got " + js(view) + ")", {
      files: () => has(r.files2000, "Moving") && !has(r.files2001, "Moving"),
      chars: () => has(r.chars32, "Moving") && !has(r.chars33, "Moving"),
      memo: () => has(r.memo, "Moving") && has(r.memo, "Late"),
      closure: () => has(r.closure, "Late"),
      stars: () => has(r.stars300, "Moving") && !has(r.stars400, "Moving"),
      links: () => has(r.links300, "Moving") && !has(r.links400, "Moving"),
      moduleFiles: () => has(r.modFiles300, "Moving") && !has(r.modFiles400, "Moving"),
      names: () => has(r.names5, "Moving") && !has(r.names7, "Moving"),
      lookups: () => has(r.lookups60, "Late") && !has(r.lookups120, "Late"),
    });
  }

  // --- what it costs: a star clique ends at the bound, a name passed on widens nothing, an unclosed `export {` is linear, a
  // module's files are found once ------------------------------------------------------------------------------------------------
  {
    // 1,000 component folders' barrels passing on a hub that passes on all of them (the clique), against the same barrels
    // passing on a leaf (flat: none of the bound reached) — the clique costs no more, and a later query is not followed
    const clique = (tag, isClique) => {
      const p = project("cost-" + tag, { [KIT]: L(["export const Moving = motion(Box);", "export const Late = motion(Box);"]) });
      for (let i = 0; i < 1000; i++) write(p, "src/components/k" + i + "/index.ts", isClique ? "export * from \"../hub\";\n" : "export * from \"../leaf\";\n");
      write(p, "src/components/hub/index.ts", isClique ? Array.from({ length: 1000 }, (_, i) => "export * from \"../k" + i + "\";").join("\n") + "\nexport * from \"../ui/kit\";\n" : "export {};\n");
      write(p, "src/components/leaf/index.ts", "export * from \"../ui/kit\";\n");
      for (let i = 0; i < 1000; i++) write(p, "src/app/p" + i + ".tsx", L(["import { Moving } from \"../components/k" + i + "\";", "export const P = () => <Moving />;"]));
      write(p, "src/late.ts", L(["export { Late } from \"./components/ui/kit\";"]));
      write(p, "src/zzzzzzzzzzzzzzzzzzzzzzzzzzzzzz/late-page.tsx", L(["import { Late } from \"@/late\";", "export const Q = () => <Late />;"]));
      return p;
    };
    const ch = clique("clique", true), cf = clique("flat", false);
    const cliqueRows = rowsOf(ch), flatRows = rowsOf(cf);
    const cms = remeasure(() => { const t0 = Date.now(); S.designSystemReport(ch); const t1 = Date.now(); S.designSystemReport(cf); return [t1 - t0, Date.now() - t1]; }, (s) => s[0] < 2.5 * s[1] + 150);
    // what a component folder's barrel passes on as it is never widens the search: 500 names of the project's own file, 60
    // pages that write one of them — never parsed —, against the same pages and a namespace of that name (parsed)
    const widen = (tag, line) => {
      const p = project("cost-widen-" + tag, { [KIT]: L(["export const Moving = motion(Box);"]), "src/components/ui/index.ts": line + "\n" });
      for (let i = 0; i < 60; i++) write(p, "src/app/p" + i + ".tsx", "import { X1 } from \"@/components/ui\";\n" + "<Item key={1} a={b} />\n".repeat(12000));
      return p;
    };
    const wo = widen("own", "export {\n" + Array.from({ length: 50 }, (_, l) => "  " + Array.from({ length: 10 }, (_, k) => "X" + (l * 10 + k) + ",").join(" ")).join("\n") + "\n} from \"./all\";");
    const wn = widen("namespace", "export * as X1 from \"./all\";");
    const wms = remeasure(() => { const t0 = Date.now(); S.designSystemReport(wo); const t1 = Date.now(); S.designSystemReport(wn); return [t1 - t0, Date.now() - t1]; }, (s) => s[0] * 1.5 < s[1]);
    // 28,000 `export {` lines that never close, in three pages the search parses and three barrels the follow reads: each
    // list is given up with its lines (×9 when every line joined the 200 below it) — against the same files of `export {}`
    // lines, which close at once
    const unclosed = (tag, line) => {
      const p = project("cost-unclosed-" + tag, { [KIT]: L(["export const Moving = motion(Box);"]) });
      for (let i = 0; i < 3; i++) {
        write(p, "src/app/p" + i + ".tsx", "import { Moving } from \"@/components/ui/kit\";\n" + line.repeat(28000));
        write(p, "src/b/b" + i + ".ts", "import { Moving } from \"@/components/ui/kit\";\n" + line.repeat(28000));
      }
      write(p, "src/ui.ts", L(["export * from \"./b/b0\";", "export * from \"./b/b1\";", "export * from \"./b/b2\";"]));
      write(p, "src/app/page.tsx", L(["import { Moving } from \"@/ui\";", "export const P = () => <Moving />;"]));
      return p;
    };
    const uh = unclosed("open", "export {\n"), us = unclosed("closed", "export {}\n");
    const ums = remeasure(() => { const t0 = Date.now(); S.designSystemReport(uh); const t1 = Date.now(); S.designSystemReport(us); return [t1 - t0, Date.now() - t1]; }, (s) => s[0] < 2.5 * s[1] + 150);
    // the files a module is are found once a place: 50 pages of 400 names each from a package of 300 folders (×11 when they
    // were found again for each name) — against the same pages naming a module of the project's own (3 keys)
    const manyNames = (tag, spec) => {
      const p = project("cost-files-" + tag, { [KIT]: L(["export const Moving = motion(Box);"]) });
      for (let i = 0; i < 300; i++) write(p, "packages/p" + i + "/ui/package.json", js({ name: "@x/ui" }));
      for (let j = 0; j < 50; j++) {
        const rows = Array.from({ length: 4 }, (_, k) => Array.from({ length: 100 }, (_, n) => "Q" + j + "_" + (k * 100 + n)));
        write(p, "src/app/p" + j + ".tsx", L(rows.map((q) => "import { " + q.join(", ") + " } from \"" + spec + "\";").concat(["// Moving", "export const P = () => <>"], rows.map((q) => q.map((n) => "<" + n + " />").join("")), ["</>;"])));
      }
      return p;
    };
    const fh = manyNames("package", "@x/ui"), fsoft = manyNames("own", "@/lib/own");
    const fms = remeasure(() => { const t0 = Date.now(); S.designSystemReport(fh); const t1 = Date.now(); S.designSystemReport(fsoft); return [t1 - t0, Date.now() - t1]; }, (s) => s[0] < 2.5 * s[1] + 150);
    all("1.35.4: what the follow costs — a star clique of 1,000 component folders' barrels ends at DS_PASS_STEPS (Moving settled, the later Late not; the flat twin settles both) for no more than the flat twin; the names a component folder's barrel passes on as they are (500 of the project's own file) never widen the search — 60 pages that write one are not parsed, as they are when it is a namespace's name —; 28,000 `export {` lines that never close, in pages the search parses and barrels the follow reads, cost no more than the same lines closed; 50 pages of 400 names from a package of 300 folders cost no more than from a module of the project's own (the files a module is found once a place) (got " + js({ cms, wms, ums, fms, clique: ["Moving", "Late"].filter((n) => has(cliqueRows, n)), flat: ["Moving", "Late"].filter((n) => has(flatRows, n)) }) + ")", {
      clique: () => has(cliqueRows, "Moving") && !has(cliqueRows, "Late") && has(flatRows, "Late") && cms[0] < 2.5 * cms[1] + 150,
      widen: () => wms[0] * 1.5 < wms[1],
      unclosed: () => ums[0] < 2.5 * ums[1] + 150,
      files: () => fms[0] < 2.5 * fms[1] + 150,
    });
  }
};
