"use strict";
// The design-system registry — 1.35.3: what the project's other files settle. A name one component file cannot settle — a
// call that shows nothing, a class that renders through its imported base, a PascalCase function that renders nothing —
// is a component when the project RENDERS it, and a weak one is none when the project calls it, gives it to useContext
// or reads it as an object; a call that is given no function hands an element over; two parts on one line, CommonJS, a
// barrel's re-exports; a regex's backtick, `return'…'`; a workspace `!negation` and a root that declares none.

const fs = require("fs");
const path = require("path");

exports.run = async ({ all, S, tmp, remeasure, require, __dirname }) => {
  const js = (v) => JSON.stringify(v);
  const E = require(path.join(__dirname, "lib", "engine", "index.js"));
  const i18n = require(path.join(__dirname, "lib", "i18n.js"));
  const write = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  const BT = String.fromCharCode(96);
  const L = (lines) => lines.join("\n") + "\n";
  const deps = (list) => js({ dependencies: Object.fromEntries(list.map((d) => [d, "1.0.0"])) });
  const project = (tag, files) => {
    const p = path.join(tmp, "proj-dsu-" + tag);
    for (const [rel, text] of Object.entries(files || {})) write(p, rel, text);
    S.initProject(p, ["ui"], "en");
    return p;
  };
  const UI = "src/components/ui/";
  const missing = (p) => S.designSystemReport(p).missing.map((m) => m.name).sort();
  const registry = (p) => E.designSystemRegistry(path.join(p, ".specs"));

  // --- what the project renders, calls and imports settles a component file's names ---------------------------------------------
  {
    const p = project("settle", { "package.json": deps(["react"]) });
    write(p, UI + "kit.tsx", L([
      "import { motion } from \"framer-motion\";", "import { Box } from \"./box-lib\";", "import { Layout } from \"antd\";", "import { Tabs } from \"@radix-ui/react-tabs\";",
      "import { contextConnect } from \"./context\";", "import { Base } from \"./base\";", "import { Sizes } from \"./sizes\";",
      // what 1.35.2 left to add by hand: each is rendered by the page below
      "export const MotionBox = motion(Box);", "export const Fancy = createComponent(config);", "export const HomeIcon = createSvgIcon(<path d=\"M0\" />, \"Home\");",
      "export const TextField = createField({ type: \"text\" }, (props) => <input {...props} />);", "export const AppIcon = createIcon({ path: <path d=\"M1\" /> });",
      "function MenuRoot() { return <ul />; }", "export const Menu = contextConnect(MenuRoot, \"Menu\");", "export class Panel extends Base {}",
      "export const { Header, Content, Footer } = Layout;", "Tabs.Panel = TabPanel;", "export { Tabs };",
      "export const Poem = observer(() => (", "  <pre>", "1. One;", "2. Two", "  </pre>", "));",
      "export function Portal(props, ref, extra) { return createPortal(props.children, document.body); }",
      // …rendered in this file itself
      "export const Glow = motion(Base);", "export function Lit() { return <Glow />; }",
      // …and what 1.35.2 listed knowingly: the project calls it, gives it to useContext or provides it, constructs it, reads it as an object
      "export function FormatPrice(value) { return value.toFixed(2); }", "export const RenderIcon = memoize((name) => <i className={name} />);",
      "export const RenderRow = memoize((row) => <tr />);", "export function Rows({ list }) { return <tbody>{list.map((r) => RenderRow(r))}</tbody>; }",
      "export const ButtonContext = createContext(MenuRoot);", "export const ToastContext = createContext(MenuRoot);",
      "export class Renderer extends Marked { render() { return <p />; } }",
      "function ListRoot() { return <ul />; }", "ListRoot.Sizes = Sizes;", "export const List = ListRoot;",
      // what stays as the rules say: a weak one rendered AND called, one the project never names, a strong one it calls, a
      // strong one's other name it calls, a candidate never rendered
      "export const Total = makeTotal(() => <b />);", "export const Quiet = observer(() => <div />);", "export function Price({ value }) { return <b>{value}</b>; }",
      "function PanelImpl() { return <section />; }", "export const Box2 = PanelImpl;", "export const Unused = motion(Box);",
      // an arrow that renders nothing, called (none) — one that renders, called (stays)
      "export const Shorten = (s) => s.slice(0, 3);", "export const Badge3 = (props) => <b>{props.x}</b>;",
      "import * as R from \"react\";", "export const Spaced = R.forwardRef((p, r) => null);", "export class Legacy3 extends React.Component {}",
      // a HOC applied to a component is weak: the project calls it
      "function Nav() { return <nav />; }", "export const Routed = withRouter(Nav);",
      // a context given to useContext in its own file; a React 19 context rendered AND given to useContext (a candidate, a weak one)
      "export const ThemeCtx = createContext(MenuRoot);", "export function Themed() { const t = useContext(ThemeCtx); return <b>{t}</b>; }",
      "export const Theme19 = createContext(null);", "export const Ctx19 = createContext(MenuRoot);",
      // what a tag is not: a comparison, a generic arrow's type parameter (`<T,>`, `<T extends X>`)
      "export const Limit = makeLimit(config);", "export const Item7 = makeItem(config);", "export const Item8 = makeItem(config);",
      // read by a CommonJS file, through a folder's barrel, through a renamed import
      "export const Grid2 = createGrid(config);", "export const Shade = motion(Base);",
      ""]));
    write(p, UI + "pill/index.tsx", L(["export const PillGroup = makeGroup(config);"]));
    write(p, UI + "tools.tsx", L(["export const Column = createColumnHelper();", "const Spinner = createSpinner(config);", "export default Spinner;", "export const Sheet = makeSheet(config);"]));
    // a file's default export, each way it is written — what `import X from` brings
    write(p, UI + "one.tsx", L(["const Wrapped1 = wrap(Base);", "export { Wrapped1 as default };"]));
    write(p, UI + "two.tsx", L(["export default function Helper2(a, b, c) { return null; }"]));
    write(p, UI + "Three.js", L(["const Spin3 = makeSpin();", "module.exports = Spin3;"]));
    write(p, UI + "four.tsx", L(["function Root4() { return null; }", "function Item4() { return <li />; }", "export default Object.assign(Root4, { Item: Item4 });"]));
    // CommonJS, a PascalCase .js file
    write(p, UI + "Chips.js", L(["const React = require(\"react\");", "function Badge() { return React.createElement(\"span\"); }", "exports.Badge = Badge;",
      "module.exports.Chip = function Chip() { return null; };", "exports.Badge4 = function Badge4() { return null; };", "module.exports = {", "  Badge,", "  Inline: (props) => { return <b>{props.x}</b>; },", "  Tag: Badge,", "};"]));
    // a component folder's barrel: re-exported under a name of its own, a package's under its own — a weak name of its own is
    // one only when rendered (a `.ts` file holds no JSX); one outside a component folder is not read
    write(p, UI + "index.ts", L(["export { Root as Dialog, Trigger as DialogTrigger } from \"@radix-ui/react-dialog\";", "export { Toaster } from \"sonner\";", "export { Card } from \"./kit\";", "export * from \"./kit\";",
      "export function Make9(x) { return x; }"]));
    write(p, "src/lib/index.ts", L(["export { Root as Drawer } from \"vaul\";"]));
    // a workspace package's kit, imported by its package name
    write(p, "packages/ui-kit/src/components/ui/effects.tsx", L(["import { motion } from \"framer-motion\";", "export const Slide = motion(Base);"]));
    write(p, "src/app/page.tsx", L([
      "import { MotionBox, Fancy as Fz, TextField, AppIcon, Menu, Panel, Header, Tabs, Poem, Portal } from \"@/components/ui/kit\";",
      "import { HomeIcon } from \"../components/ui\";", "import { PillGroup } from \"../components/ui/pill\";",
      "import * as UI from \"../components/ui/kit\";",
      "import { FormatPrice, RenderIcon, ButtonContext, ToastContext, Renderer, List, Total, Price, Box2, Spaced, Legacy3, Routed, Theme19, Ctx19, Limit, Item7, Item8, Shorten, Badge3 } from \"@/components/ui/kit\";",
      "import { Dialog, Toaster, Drawer, Make9 } from \"@/components/ui\";", "import { Drawer as Drawer2 } from \"@/lib\";",
      "import { Badge, Chip, Tag } from \"../components/ui/Chips\";", "import { Slide } from \"@acme/ui-kit\";",
      "import W1 from \"@/components/ui/one\";", "import H2 from \"../components/ui/two\";", "import S3 from \"../components/ui/Three\";", "import Menu4 from \"@/components/ui/four\";",
      "import { useContext } from \"react\";",
      "export default function Page() {",
      "  const theme = useContext(ButtonContext);", "  const price = FormatPrice(3);", "  const icon = RenderIcon(\"x\");", "  const md = new Renderer();", "  const s = List.Sizes.Large;",
      "  const t = Total(1);", "  const p = Price({ value: 1 });", "  const b = Box2({});", "  Menu4();", "  const sp = Spaced({});", "  const lg = new Legacy3();", "  const rt = Routed();",
      "  const v19 = useContext(Theme19), c19 = useContext(Ctx19);", "  const short = Shorten(\"abc\"), b3 = Badge3({ x: 1 });", "  const over = count <Limit ? 1 : 2;", "  const pick = <Item7,>(x: Item7) => x;", "  const pick2 = <Item8 extends object>(x: Item8) => x;",
      "  return (",
      "    <MotionBox>",
      "      <Fz /><HomeIcon /><TextField /><AppIcon /><Menu /><Panel /><Header /><PillGroup />",
      "      <Tabs.Panel /><Poem /><Portal /><Total />",
      "      <UI.Content /><Dialog /><Toaster /><Drawer2 /><Badge /><Chip /><Tag /><Slide />",
      "      <W1 /><H2 /><S3 /><Menu4.Item /><Theme19 value={1} /><Ctx19 value={2} />",
      "      <ToastContext.Provider value={1}>{price}{icon}</ToastContext.Provider>",
      "    </MotionBox>",
      "  );",
      "}"]));
    write(p, "src/app/legacy.js", L(["const { Grid2 } = require(\"../components/ui/kit\");", "const KitNs = require(\"../components/ui/kit\");", "module.exports = () => <div><Grid2 /><KitNs.Footer /><KitNs.Shade /></div>;"]));
    // the same names from another module: settle nothing
    write(p, "src/app/other.tsx", L(["import { Column } from \"antd\";", "import Loader from \"@/components/ui/tools\";", "import { Sheet } from \"@/components/ui/tools-old\";",
      "import { Unused } from \"@/components/ui/unused\";", "export function Other() { return <Column><Loader /><Sheet /><Unused /></Column>; }"]));
    const got = missing(p);
    const WANT = ["AppIcon", "Badge", "Box2", "Chip", "Chips", "Content", "Dialog", "Fancy", "Four", "Glow", "Header", "Helper2", "HomeIcon", "Inline", "Kit", "List", "Lit", "Menu", "MotionBox", "One", "Panel", "Poem",
      "Portal", "Price", "Quiet", "Rows", "Slide", "Spin3", "Spinner", "Tabs.Panel", "Tag", "TextField", "Three", "Toaster", "Tools", "Total", "Two", "Root4.Item", "Wrapped1", "Effects",
      "Spaced", "Legacy3", "Themed", "Grid2", "Footer", "Shade", "PillGroup", "Pill", "Badge3", "Badge4"];
    const report = S.designSystemReport(p);
    all("1.35.3: a name one component file cannot settle is settled by the project's files — a component when a file renders it (`<MotionBox />`, `<Tabs.Panel>`, `<UI.Content />` through a namespace, a default import under its own name — `export default Name`, `export { X as default }`, `export default function`, `module.exports = X` —, a barrel's re-export under a name of its own or a package's, a workspace package imported by its name, its own file): `motion(Box)`, `createComponent(config)`, `createSvgIcon(<path />, …)`, `createField({ … }, fn)`, `createIcon({ … })`, `contextConnect(Menu, \"Menu\")`, a class that renders through its imported base, `export const { Header } = Layout`, a part hung on an imported component, an element whose text at the margin ended its statement, a component of three parameters, CommonJS (`exports.X`, `module.exports.X = …`, `module.exports = { … }`); none when the project calls it as a function and never renders it (`FormatPrice(3)`, a memoized renderer — in its own file too —, `new Renderer()`, a default export called), gives it to `useContext` or provides it (`<X.Provider>`), or reads a part as an object (`List.Sizes.Large`). A weak one rendered and called stays, a strong one called stays (JSX of its own, another name of one), one the project never names stays as the rules say; the same name rendered from another module (`antd`'s Column, another file's) settles nothing, nor does a barrel outside a component folder (got " + js({ got, limits: report.limits }) + ")", {
      names: () => js(got) === js(WANT.slice().sort()),
      limits: () => report.limits.length === 0,
    });
  }

  // --- a call is given a function, or it hands an element over; two parts on one line; a promise of a module -------------------------
  {
    const p = project("calls", { "package.json": deps(["react"]) });
    write(p, UI + "calls.tsx", L([
      "export const Root = createRoot(el).render(<App />);", "export const Router = createBrowserRouter(createRoutesFromElements(<Route path=\"/\" />));",
      "export const Hint = t(\"hint\", { link: <a href=\"#\" /> });", "export const Mounted = mount(root, <App />);", "export const Lazy = import(\"./chart\");",
      "export const Chart2 = loadable(() => import(\"./chart\"));", "export const Observed = observer(function Observed() { return <div />; });", "export const Wrapped = observer((props) => <div />);",
      "function CardRoot() { return <div />; }", "function CardHeader() { return <h2 />; }", "function CardBody() { return <div />; }",
      "CardRoot.Header = CardHeader; CardRoot.Body = CardBody;", "CardRoot.A = observer(() => <a />); CardRoot.B = observer(() => null);", "CardRoot.Size = 3; CardRoot.Note = \"x; y\";",
      "CardRoot.Mount = mount(root, <App />); CardRoot.Ok = observer(() => <b />);", "CardRoot.Doc = \"see; CardRoot.Fake = observer(() => <b />)\";",
      "export const Card = CardRoot;", ""]));
    const got = missing(p);
    all("1.35.3: a call is a component when it is given a FUNCTION that renders (`observer(() => …)`, `observer(function … )`, `loadable(() => import(…))`) — never when its JSX is an element handed over (`createRoot(el).render(<App />)`, `createBrowserRouter(createRoutesFromElements(<Route />))`, `t(\"hint\", { link: <a /> })`, `mount(root, <App />)`) nor a promise of a module (`import(\"./chart\")`); two parts on one line are two parts, each asked of its own text (`Card.Header = Header; Card.Body = Body;`, a wrapped part beside one that renders nothing, a literal beside a string that holds a `;`) (got " + js(got) + ")", {
      names: () => js(got) === js(["Calls", "Card", "Card.A", "Card.Body", "Card.Header", "Card.Ok", "Chart2", "Observed", "Wrapped"]),
    });
  }

  // --- the lexer: a regex's backtick, a string right after `return` ----------------------------------------------------------------
  {
    const p = project("lexer", { "package.json": deps(["react"]) });
    // four regexes that hold a backtick — after `(`, `=>`, `return`, `=` —: none opens a template, and what stands between them is read
    write(p, UI + "regex.tsx", L(["const strip = (s) => s.replace(/" + BT + "/g, \"\");", "export function First() { return null; }", "const f = () => /" + BT + "+/;",
      "export function Second() { return null; }", "function g() { return /[" + BT + "]/; }", "export function Third() { return null; }", "const re = /" + BT + "([^" + BT + "]+)" + BT + "/;",
      "export function Fourth() { return null; }",
      // a division is no regex: the template after it opens and closes on its line, and a backtick in a string closes nothing
      "const q = a / b + " + BT + "/" + BT + ";", "export function AfterDivision() { return null; }", "const z = \"" + BT + "\";",
      // a `/` inside a class ends no regex
      "const cls = /[/" + BT + "]/;", "export function Fifth() { return null; }", "const w = \"" + BT + "\";", ""]));
    // minified code: a string right after `return` / `case` is a string — its `</b>` is no element, its call no call
    write(p, UI + "Min.tsx", L(["export const Fake=wrap(()=>{if(a)return'</b>';return null});var q=1", "export const Fake2=wrap(()=>{switch(k){case'</b>':return 1}return 2})",
      "export const Real=wrap(()=>{if(a)return'x';return <b/>})", ""]));
    const got = missing(p);
    all("1.35.3: a regular expression's literal holds no template — one after `(`, `=>`, `return`, `=`, its class too (`/[`]/`, `/`([^`]+)`/`): the declarations between four such regexes are read (they were a template's text) —, a division is none (the template after it opens and closes on its line), and in minified code a string right after `return` / `case` is a string: its `</b>` makes no component, a real element after one still does (got " + js(got) + ")", {
      names: () => js(got) === js(["AfterDivision", "Fifth", "First", "Fourth", "Min", "Real", "Regex", "Second", "Third"]),
    });
  }

  // --- workspaces: a negation takes its folders out; a root that declares none is looked through two levels down ------------------------
  {
    const ANTD = deps(["antd"]), PAD = deps(["left-pad"]);
    const libs = (files) => S.designSystemReport(project("ws-" + Object.keys(files).length + "-" + Math.abs(js(files).split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)), files));
    const ws = (patterns, files) => Object.assign({ "package.json": js({ private: true, workspaces: patterns }) }, files);
    const cases = {
      negated: libs(ws(["packages/*", "!packages/legacy"], { "packages/web/package.json": PAD, "packages/legacy/package.json": ANTD })),
      negatedStar: libs(ws(["packages/**", "!**/legacy-*"], { "packages/web/package.json": PAD, "packages/legacy-ui/package.json": ANTD })),
      negatedBraces: libs(ws(["apps/*", "!apps/{old,legacy}"], { "apps/web/package.json": PAD, "apps/old/package.json": ANTD, "apps/legacy/package.json": ANTD })),
      negatedNested: libs(ws(["apps/*"], { "apps/shell/package.json": js({ name: "shell", workspaces: ["plugins/*", "!plugins/old"] }), "apps/shell/plugins/ui/package.json": PAD, "apps/shell/plugins/old/package.json": ANTD })),
      kept: libs(ws(["packages/*", "!packages/legacy"], { "packages/web/package.json": ANTD, "packages/legacy/package.json": PAD })),
      twoDown: libs({ "manage.py": "print(1)\n", "services/web/package.json": ANTD }),
      insidePackage: libs({ "manage.py": "print(1)\n", "frontend/package.json": PAD, "frontend/vendor/package.json": ANTD }), // never inside a package
      threeDown: libs({ "manage.py": "print(1)\n", "a/b/c/package.json": ANTD }),
      declaredEmpty: libs({ "pnpm-workspace.yaml": "packages: []\n", "services/web/package.json": ANTD }), // a workspace file: one level, as before
    };
    // a guess's bound is no declared folder left unread: 210 folders of two each, one with the library
    const many = { "manage.py": "print(1)\n", "z9/web/package.json": ANTD };
    for (let i = 0; i < 210; i++) { many["d" + i + "/a/x.txt"] = "x\n"; many["d" + i + "/b/x.txt"] = "x\n"; }
    const guessed = libs(many);
    const L2 = (r) => js(r.found.libraries) + ":" + js(r.limits);
    const view = Object.fromEntries(Object.entries(cases).map(([k, r]) => [k, L2(r)]));
    all("1.35.3: a workspace `!negation` takes its folders out — a name, `**` and a `*` in a name, a brace list, a workspace package's own for its folder — and a folder it does not name is still read; a project that declares none is looked through two levels down (`services/web/package.json`), never inside a package (`frontend/vendor/`) nor three down, one with a workspace file that names nothing it can read one level as before; a bound of that guess is never said — 210 folders of two each (got " + js({ view, guessed: L2(guessed) }) + ")", {
      negated: () => ["negated", "negatedStar", "negatedBraces", "negatedNested"].every((k) => view[k] === "[]:[]"),
      kept: () => view.kept === "[\"antd\"]:[]",
      twoDown: () => view.twoDown === "[\"antd\"]:[]" && view.insidePackage === "[]:[]" && view.threeDown === "[]:[]" && view.declaredEmpty === "[]:[]",
      guessed: () => L2(guessed) === "[]:[]" || L2(guessed) === "[\"antd\"]:[]",
    });
  }

  // --- the bound of the other files: said when names are asked, never else; in EN / PT / ES; a feature's report reads none -----------------
  {
    // (each page longer than a file's read — 256K: the 128 read are the 32 MB, and the 129th is past them)
    const filler = "const x = compute(1, \"value\");\n".repeat(8500);
    const big = (tag, kit) => {
      const p = project(tag, { "package.json": deps(["react"]) });
      write(p, UI + "kit.tsx", kit);
      for (let i = 0; i < 129; i++) write(p, "src/app/page" + String(i).padStart(3, "0") + ".tsx", "import { MotionBox } from \"@/components/ui/kit\";\n" + filler);
      write(p, "src/app/zzzz/last.tsx", L(["import { MotionBox } from \"@/components/ui/kit\";", "export const Last = () => <MotionBox />;"]));
      return p;
    };
    const asked = big("bound-asked", L(["export const MotionBox = motion(Box);", "export function Kit() { return <div />; }"]));
    // (a literal — an object, a string — is no name to settle)
    const none = big("bound-none", L(["export function Kit() { return <div />; }", "export function KitPart() { return <b />; }", "export const Sizes = { sm: 1 };", "export const Label = \"x\";", "KitPart.Variant = \"lg\";"]));
    const ra = S.designSystemReport(asked), rn = S.designSystemReport(none);
    // a `.ts` file renders nothing: read only when a weak name is asked (one it may CALL) — 129 of them, a candidate alone asked, then a weak one too
    const ts = project("bound-ts", { "package.json": deps(["react"]) });
    write(ts, UI + "kit.tsx", L(["export const MotionBox = motion(Box);"]));
    for (let i = 0; i < 129; i++) write(ts, "src/lib/util" + String(i).padStart(3, "0") + ".ts", "import { MotionBox } from \"@/components/ui/kit\";\n" + filler);
    const rts = S.designSystemReport(ts);
    write(ts, UI + "kit.tsx", L(["export const MotionBox = motion(Box);", "export const Quiet = observer(() => <div />);"]));
    const rtw = S.designSystemReport(ts);
    // a barrel counts apart from the component files: 1,000 of them and one barrel are read whole, its re-export settled
    const kit = project("bound-barrel", { "package.json": deps(["react"]) });
    for (let i = 0; i < 1000; i++) write(kit, UI + "c" + String(i).padStart(4, "0") + "/item" + i + ".tsx", "export function Item" + i + "() { return <i />; }\n");
    write(kit, UI + "index.ts", L(["export { Root as Dialog } from \"@radix-ui/react-dialog\";"]));
    write(kit, "src/app/page.tsx", L(["import { Dialog } from \"@/components/ui\";", "export const P = () => <Dialog />;"]));
    const rb = S.designSystemReport(kit);
    const said = ["en", "pt", "es"].map((l) => { const say = i18n.msg(l).cliOutput.dsLimit["usage-files"]; return typeof say === "function" ? say(128) : null; });
    all("1.35.3: the project's other script files are read up to 5,000 files and 32 MB — past either, with names to settle, the report says so (`limits`: usage-files, how many were read; never in sync; in EN / PT / ES) and a name only the rest renders is not compared; with no name to settle nothing is said; a `.ts` file — it renders nothing — is read only when a weak name is asked; a component folder's barrel counts apart from the component files (1,000 of them and a barrel: nothing said, its re-export settled) (got " + js({ asked: ra.limits, none: rn.limits, missing: ra.missing.map((m) => m.name), ts: [rts.limits, rtw.limits], barrel: [rb.limits, rb.missingTotal, rb.missing.some((m) => m.name === "Dialog")], said }) + ")", {
      said: () => js(ra.limits) === js([{ code: "usage-files", read: 128 }]) && ra.inSync === false && !ra.missing.some((m) => m.name === "MotionBox"),
      none: () => rn.limits.length === 0,
      ts: () => rts.limits.length === 0 && js(rtw.limits) === js([{ code: "usage-files", read: 128 }]),
      barrel: () => rb.limits.length === 0 && rb.missingTotal === 1001 && rb.missing.some((m) => m.name === "Dialog"),
      lang: () => said.every((s) => typeof s === "string" && s.includes("128")) && new Set(said).size === 3,
    });
  }

  // --- what it costs: the usage reader gives up in linear time; a feature's report reads none of it ------------------------------------
  {
    // hostile usage files (no component file names them: each is viewed by the name it holds) — runs of tags, of members, an
    // import clause that never closes, a line of `(/` with a backtick: against the same files with the hostile shapes spelled
    // out of reach (`x` for `<` / `.`), a ratio
    // (lt / dot / sl: `<`, `.`, `(` in the hostile files; `x` in the others)
    const hostile = (tag, lt, dot, sl) => {
      const p = project("cost-" + tag, { "package.json": deps(["react"]) });
      write(p, UI + "kit.tsx", L(["export const Moving = motion(Box);"]));
      const lines = ["import { Moving } from \"@/components/ui/kit\";", (lt + "Moving").repeat(600), (lt + "/A").repeat(600), ("a" + dot + "Moving").repeat(600), "useContext(" + sl.repeat(1900),
        ("(" + sl + "/").repeat(900) + BT, "import {"].concat(Array.from({ length: 200 }, () => "  Moving,"));
      for (let i = 0; i < 6; i++) write(p, "src/app/h" + i + ".tsx", Array.from({ length: 140 }, (_, k) => lines[k % 7 === 6 ? 6 + (k % 200) : k % 7]).join("\n") + "\n" + ("(" + sl + "/").repeat(100000) + BT + "\n");
      return p;
    };
    const hard = hostile("hard", "<", ".", "("), soft = hostile("soft", "x", "x", "x");
    // the candidates of a file: 2,000 parts that are calls (no literal: each may be a component) under 2,090 exported names
    // — 500 kept, said, and never four million asked — against the same parts as literals, in projects of their own
    const parts = (tag, value) => {
      const d = project("cost-parts-" + tag, { "package.json": deps(["react"]) });
      write(d, UI + "parts.tsx", "function A() { return null; }\n" + Array.from({ length: 2000 }, (_, i) => "A.P" + i + " = " + value + ";").join("\n") + "\n" +
        Array.from({ length: 11 }, (_, g) => "export {\n" + Array.from({ length: 190 }, (_, i) => "  A as A" + (g * 190 + i) + ",").join("\n") + "\n};").join("\n") + "\n");
      return d;
    };
    const ph = parts("hard", "make()"), psoft = parts("soft", "\"x\"");
    // a file that writes none of the names asked is read, never parsed: 60 pages of 256K of tags — one project's never name
    // the kit's candidate, the other's do (once, at their top)
    const pages = (tag, head) => {
      const d = project("cost-pages-" + tag, { "package.json": deps(["react"]) });
      write(d, UI + "kit.tsx", L(["export const Moving = motion(Box);"]));
      for (let i = 0; i < 60; i++) write(d, "src/app/p" + i + ".tsx", head + "<Item key={1} a={b} />\n".repeat(12000));
      return d;
    };
    const quiet = pages("quiet", ""), named = pages("named", "import { Moving } from \"@/components/ui/kit\";\n");
    const qms = remeasure(() => { const t0 = Date.now(); S.designSystemReport(quiet); const t1 = Date.now(); S.designSystemReport(named); return [t1 - t0, Date.now() - t1]; }, (s) => s[0] * 1.5 < s[1]);
    const pms = remeasure(() => { const t0 = Date.now(); const r = S.designSystemReport(ph); const t1 = Date.now(); S.designSystemReport(psoft); return [t1 - t0, Date.now() - t1, js(r.limits)]; }, (s) => s[0] < 2.5 * s[1] + 100);
    const ms = remeasure(() => { const t0 = Date.now(); const r = S.designSystemReport(hard); const t1 = Date.now(); S.designSystemReport(soft); return [t1 - t0, Date.now() - t1, js(r.limits)]; }, (s) => s[0] < 2.5 * s[1] + 150);
    // a feature's report on a project of many pages reads none of them for what they render
    const p = project("cost-feature", { "package.json": deps(["react"]) });
    write(p, UI + "kit.tsx", L(["export const Moving = motion(Box);"]));
    for (let i = 0; i < 400; i++) write(p, "src/app/p" + i + ".tsx", L(["import { Moving } from \"@/components/ui/kit\";", "export const P" + i + " = () => <Moving />;"]));
    S.createFeature(p, { name: "Price Tag", tracks: ["ui"], summary: "x" });
    const fms = remeasure(() => { const t0 = Date.now(); S.designSystemReport(p); const t1 = Date.now(); S.designSystemReport(p, { name: "price-tag" }); return [t1 - t0, Date.now() - t1]; }, (s) => s[1] * 2 < s[0]);
    all("1.35.3: the usage reader gives up in linear time — runs of tags, closing tags and members, a `useContext(` of 1,900 brackets, an import clause that never closes, lines of `(/` with a backtick (a regex that never closes is looked for once a line) — no slower than the same files spelled out of reach; and a feature's report reads none of the project's pages for what they render — half the project report's time at most on 400 of them; 2,000 parts that are calls under 2,090 exported names are settled once an owner, 500 candidates kept and said; a page that writes none of the names asked is never parsed (got " + js({ ms, pms, qms, fms }) + ")", {
      linear: () => ms[0] < 2.5 * ms[1] + 150,
      unparsed: () => qms[0] * 1.5 < qms[1],
      parts: () => pms[0] < 2.5 * pms[1] + 100 && /"component-files"/.test(pms[2]),
      feature: () => fms[1] * 2 < fms[0],
    });
  }
};
