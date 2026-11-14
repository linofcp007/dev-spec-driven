"use strict";
// The design-system registry — 1.35.2: the limits 1.35.1 shipped saying. Workspaces: a brace list is expanded, rush.json's
// projects are read, a workspace package's own `workspaces` are followed. A component file: a component wrapped by another
// function, a class with an imported base, a decorator on the class's line, an indented `export`, a part hung on a component
// (`Card.Header = …`, `Object.assign`) — and a PascalCase function that shows it is no component is not listed.

const fs = require("fs");
const path = require("path");

exports.run = async ({ all, S, tmp, approveBefore, remeasure, require, __dirname }) => {
  const js = (v) => JSON.stringify(v);
  const E = require(path.join(__dirname, "lib", "engine", "index.js"));
  const write = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  const rd = (dir, rel) => fs.readFileSync(path.join(dir, rel), "utf8");
  const REG = ".specs/steering/design-system.md";
  const CARD = "| Component | Path | Variants | Notes |\n|---|---|---|---|\n| Card | `src/ui/Card.tsx` |  |  |\n\n";
  const BOM = String.fromCharCode(0xfeff), BT = String.fromCharCode(96), BS = String.fromCharCode(92);
  const L = (lines) => lines.join("\n") + "\n";
  const deps = (list) => js({ dependencies: Object.fromEntries(list.map((d) => [d, "1.0.0"])) });
  const project = (tag, files) => {
    const p = path.join(tmp, "proj-dsl-" + tag);
    for (const [rel, text] of Object.entries(files || {})) write(p, rel, text);
    S.initProject(p, ["ui"], "en");
    return p;
  };
  const registry = (p) => E.designSystemRegistry(path.join(p, ".specs"));
  const REQ = "# Feature: Price Tag\n\n## Summary\nShow a price.\n\n## User Stories\n### US-1 (P1): See a price\nAs a buyer I want to see a price.\n**Independent Test:** open one product.\n\n" +
    "#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN the buyer opens a product THE SYSTEM SHALL show its price with the currency.\n" +
    "2. **US-1.AC-2** — IF the price is missing THEN THE SYSTEM SHALL show a dash.\n\n## Success Criteria\n- **SC-001** — every product page shows a price.\n\n" +
    "## Edge Cases & Error Handling\n- **EC-1** — WHEN the currency is unknown THE SYSTEM SHALL show the amount alone.\n\n## Non-Functional Requirements\n- **NFR-1** — renders in under 16 ms.\n\n## Out of Scope\n- Discounts.\n";
  const design = (usage) => "# Design: Price Tag\n\n## Overview\nA price with its currency.\n\n## Architecture\n```mermaid\ngraph TD\n  P[PriceTag] --> F[format]\n```\n\n" +
    "## Reuse & Integration\n| Kind | What | Where (path) | Why / notes |\n|---|---|---|---|\n| Reuse | the money formatter | `src/lib/money.ts` | it formats a price |\n\n" +
    "## Alternatives & Trade-offs\n| Decision | Option | Pros | Cons | Cost if wrong | Chosen |\n|---|---|---|---|---|---|\n| Shape | A component | Shared markup | One more file | A rename | ✓ |\n| Shape | A helper | Small | Markup repeated | Drift | ✗ |\n\n" +
    "## Data Models\nPrice {amount, currency}.\n\n## Error Handling\nSee the IF…THEN criteria.\n\n## Testing Strategy\nComponent tests.\n\n## Risks\n- A missing currency — low — the amount alone.\n\n" +
    "## Constitution Check\n- [x] Small components — complies.\n\n## Complexity Tracking\nNone.\n\n" +
    "## [UI] Design System Usage\n" + usage + "\n\n## [UI] UI States\nLoading: a skeleton. Error: a dash. Reference: design/price.png.\n\n## [UI] Accessibility\nWCAG 2.2 AA; axe in the component tests.\n\n" +
    "## [UI] Responsiveness & i18n\nOne line at 360 px.\n\n## [UI] UI Performance Budget\nNo layout shift.\n";
  const rows = (list) => "Built from the system.\n\n| Kind | Component | Why / notes |\n|---|---|---|\n" + list.join("\n");
  // a size m feature whose design is ready for its approval → approve(rows): "approved" | "refused:<failing checks>"
  const sized = (p) => {
    const f = S.createFeature(p, { name: "Price Tag", tracks: ["ui"], summary: "x", size: "m" });
    fs.writeFileSync(path.join(f.dir, "requirements.md"), REQ);
    fs.writeFileSync(path.join(f.dir, "design.md"), design(rows(["| Reuse | Placeholder | x |"])));
    approveBefore(p, f.slug, "design");
    return (list) => { fs.writeFileSync(path.join(f.dir, "design.md"), design(rows(list))); const a = S.approvePhase(p, f.slug, "design", "t"); return a.ok ? "approved" : "refused:" + (a.failing || []).join(","); };
  };
  // is the short name `antd` (of `_Libraries: antd 5_`) backed by a package of the project, and does the scan name the library?
  const backed = (p) => { write(p, REG, "# DS\n\n" + CARD + "_Libraries: antd 5_\n"); return !registry(p).weakLibraries.has("antd") + ":" + js(S.designSystemReport(p).found.libraries); };
  const yes = "true:" + js(["antd"]), no = "false:" + js([]);
  const limitsOf = (p) => js(S.designSystemReport(p).limits);
  const both = (tag, files) => { const p = project(tag, files); return [backed(p), limitsOf(p)]; };
  const CUT = (read) => js([{ code: "workspace-manifests", read }]);
  const ANTD = deps(["antd"]), PAD = deps(["left-pad"]);
  const ws = (patterns, files) => Object.assign({ "package.json": js({ private: true, workspaces: patterns }) }, files);
  const WEB = { "apps/web/package.json": ANTD };

  // --- workspaces: a brace list, rush.json, a workspace package's own workspaces ------------------------------------------------------------
  {
    write(tmp, "proj-dsl-outside/pkg/package.json", ANTD);
    const RUSH = L(["// the monorepo's projects", "{", "  /* the version", "     of Rush */", "  \"rushVersion\": \"5.100.0\", // pinned", "  \"note\": \"a // b /* c */ d\",", "  \"projects\": [",
      "    { \"packageName\": \"web\", \"projectFolder\": \"apps/web\", },", "    { \"packageName\": \"core\", \"projectFolder\": \"libs/core\" },", "  ],", "}"]);
    const SHELL = (workspaces) => js({ name: "shell", workspaces, dependencies: {} });
    const sixty = { "package.json": js({ private: true, workspaces: Array.from({ length: 60 }, (_, i) => "pkgs/p" + String(i).padStart(2, "0")) }) };
    for (let i = 0; i < 60; i++) sixty["pkgs/p" + String(i).padStart(2, "0") + "/package.json"] = i === 59 ? ANTD : PAD;
    const read = {
      braces: ws(["{apps,libs}/*"], WEB),
      bracesNested: ws(["{packages,{libs,apps}}/web"], WEB), // (the innermost list first)
      bracesTwice: ws(["{libs,apps}/{docs,web}"], WEB),
      bracesInName: ws(["apps/{web,admin}-ui"], { "apps/web-ui/package.json": ANTD }),
      bracesFourteen: ws(["{libs,{apps,b,c,d,e,f}}/{web,y}"], WEB), // 14 folders: a nested list adds its names, it does not multiply
      pnpmLong: Object.assign({ "package.json": js({ private: true }), "pnpm-workspace.yaml": "packages:\n" + Array.from({ length: 520 }, (_, i) => "  - none/q" + i + "\n").join("") + "  - apps/web\n" }, WEB), // past its 500th line
      pnpmFlowLong: Object.assign({ "package.json": js({ private: true }), "pnpm-workspace.yaml": "packages: [\n" + Array.from({ length: 520 }, (_, i) => "  none/q" + i + ",\n").join("") + "  apps/web\n]\n" }, WEB),
      repeated: (() => { const files = { "packages/web/package.json": ANTD }; for (let i = 0; i < 60; i++) files["packages/p" + i + "/package.json"] = SHELL(["packages/*"]); return ws(["packages/*"], files); })(), // sixty packages repeat the root's
      rush: { "rush.json": RUSH, "apps/web/package.json": ANTD, "libs/core/package.json": PAD },
      rushBom: { "rush.json": BOM + RUSH, "apps/web/package.json": ANTD },
      // (a string keeps what looks like a trailing comma; the folder's name holds it)
      rushString: { "rush.json": js({ projects: [{ projectFolder: "libs/kit, ]ui" }] }), "libs/kit, ]ui/package.json": ANTD },
      rushBesideRoot: { "package.json": deps(["react"]), "rush.json": RUSH, "apps/web/package.json": ANTD }, // declared: the root's own dependencies decide nothing
      nested: ws(["apps/*"], { "apps/shell/package.json": SHELL(["plugins/*"]), "apps/shell/plugins/ui/package.json": ANTD }),
      nestedYarn: ws(["apps/*"], { "apps/shell/package.json": SHELL({ packages: ["./plugins/*"] }), "apps/shell/plugins/ui/package.json": ANTD }),
      nestedTwice: ws(["apps/*"], { "apps/shell/package.json": SHELL(["plugins/*"]), "apps/shell/plugins/a/package.json": SHELL(["kits/*"]), "apps/shell/plugins/a/kits/ui/package.json": ANTD }),
      nestedUndeclared: { "manage.py": "print(1)\n", "frontend/package.json": SHELL(["packages/*"]), "frontend/packages/ui/package.json": ANTD }, // one level down, then that package's own
      sixty, // sixty folders named in full: the fifty are the patterns that are WALKED
      // 900 folders named in full under one that is asked once: asked each time, the 2,000 were spent before the last
      asked: ws(Array.from({ length: 900 }, (_, i) => "a/b/q" + i).concat(["apps/web"]), Object.assign({ "a/b/README.md": "x\n" }, WEB)),
    };
    const said = {
      bracesMany: [ws(["{apps,b,c,d,e}/{web,b,c,d,e}"], WEB), 0], // 25 patterns: a list gives 20 at most
      bracesOpen: [ws(["{apps,libs/*"], WEB), 0],
      bracesClose: [ws(["apps}/*", "apps/*}"], {}), 0], // (no folder is named so: never opened, it is no list)
      rushBroken: [{ "rush.json": "{ projects: [ }", "apps/web/package.json": ANTD }, 0], // there, and no JSON: declared and unread
      thousand: [ws(Array.from({ length: 1000 }, (_, i) => "none/q" + i).concat(["apps/web"]), WEB), 0], // the 1,001st folder named in full
      nestedDeep: [ws(["apps/*"], { "apps/shell/package.json": SHELL(["plugins/*"]), "apps/shell/plugins/a/package.json": SHELL(["kits/*"]), "apps/shell/plugins/a/kits/b/package.json": SHELL(["more/*"]),
        "apps/shell/plugins/a/kits/b/more/ui/package.json": ANTD }), 3], // the third level is declared, and not followed
      nestedMany: [ws(["apps/*"], { "apps/shell/package.json": SHELL(Array.from({ length: 2000 }, (_, i) => "none-" + i + "/*").concat(["plugins/*"])), "apps/shell/plugins/ui/package.json": ANTD }), 1], // more than can be asked
    };
    const silent = {
      nestedRoot: ws(["apps/*"], { "apps/shell/package.json": SHELL(["/plugins/*", "!plugins/ui", "../../../proj-dsl-outside/*"]), "apps/shell/plugins/ui/package.json": ANTD }), // a path from a root, a negation, a way out
      nestedDrive: ws(["apps/*"], { "apps/shell/package.json": SHELL([BS + "plugins/*"]), "apps/shell/plugins/ui/package.json": ANTD }), // …written with a backslash
      nestedNegation: ws(["apps/*"], { "apps/shell/package.json": SHELL(["plugins/*"]), "apps/shell/plugins/a/package.json": SHELL(["kits/*"]), "apps/shell/plugins/a/kits/b/package.json": SHELL(["!x"]) }), // a negation past the last level followed: nothing unread
      rushOutside: { "rush.json": js({ projects: [{ projectFolder: "../proj-dsl-outside/pkg" }, { projectFolder: 5 }, "apps/web", { projectFolder: "" }] }), "apps/web/package.json": ANTD },
      rushNoProjects: { "rush.json": js({ rushVersion: "5" }), "apps/web/package.json": ANTD }, // it declares none: its folders are not looked through
    };
    const got = {}, not = {}, quiet = {};
    for (const [k, files] of Object.entries(read)) got[k] = both("ws-" + k, files);
    for (const [k, [files]] of Object.entries(said)) not[k] = both("said-" + k, files);
    for (const [k, files] of Object.entries(silent)) quiet[k] = both("quiet-" + k, files);
    all("1.35.2: the workspaces 1.35.1 left unread — a brace list is expanded (`{apps,libs}/*`, a nested one — its names added, never multiplied: 14 of them —, two lists, one inside a name; 20 patterns a list at most, and one it cannot expand — of one, never closed — is said); rush.json's `projects` are read, each a folder named in full (`projectFolder` — comments, trailing commas and a BOM aside, a string kept as written; beside a root with dependencies too; a rush.json that is no JSON is declared and unread: said; one that names no project declares none); a workspace package's own `workspaces` are followed for its folder (an array or Yarn's `{packages}`, two levels deep, under an undeclared root's first level too — a third level, or more of them than can be asked, is said — sixty packages that repeat the root's are not; a path from a root, a negation (past the last level too) and a way out name none); a folder named in full is not one of the fifty patterns — those are the ones that are walked (1,000 of them, the 1,001st said; a pnpm list past its 500th line too, a block one and a flow one) — and a folder two patterns share is asked once (got " +
      js({ got, not, quiet }) + ")", {
      braces: () => ["braces", "bracesNested", "bracesTwice", "bracesInName", "bracesFourteen"].every((k) => js(got[k]) === js([yes, "[]"])),
      rush: () => ["rush", "rushBom", "rushString", "rushBesideRoot"].every((k) => js(got[k]) === js([yes, "[]"])),
      nested: () => ["nested", "nestedYarn", "nestedTwice", "nestedUndeclared", "repeated"].every((k) => js(got[k]) === js([yes, "[]"])),
      exact: () => js(got.sixty) === js([yes, "[]"]) && js(got.asked) === js([yes, "[]"]) && js(got.pnpmLong) === js([yes, "[]"]) && js(got.pnpmFlowLong) === js([yes, "[]"]),
      said: () => Object.entries(said).every(([k, [, n]]) => js(not[k]) === js([no, CUT(n)])),
      silent: () => Object.values(quiet).every((v) => js(v) === js([no, "[]"])),
    });
  }

  // --- a component file: what 1.35.1 left to add by hand --------------------------------------------------------------------------------------
  const UI = "src/components/ui/";
  {
    const p = project("found", { "package.json": deps(["react"]) });
    write(p, UI + "wrapped.tsx", L(["import Base from \"./base\";", "import { observer } from \"mobx-react-lite\";",
      // wrapped by another function: it renders (a closing tag, a self-closing one, a fragment), on its line or below
      "export const Counter = observer(() => <div>0</div>);", "export const Meter = observer(() => <meter />);", "export const Group = observer(() => <>a</>);",
      "export const Board = observer(function Board(props) {", "  const total = props.rows.length;", "  return (", "    <table>", "      <caption>{total}</caption>", "    </table>", "  );", "});",
      // …it is a component itself: one the file declares, one it imports — on its line, over lines, wrapped twice
      "function Nav() { return null; }", "export const RoutedNav = withRouter(Nav);", "export const Connected = connect(", "  mapState,", "  mapDispatch,", ")(Nav);", "export const Injected = inject(\"store\")(observer(Nav));", "export const Curried = connect(mapState)(function Curried(props) { return <b />; });",
      "export const Fwd = observer(forwardRef((props, ref) => <i ref={ref} />));", "import TableCell from \"@mui/material/TableCell\";", "export const StyledCell = withStyles((theme) => ({", "  head: {},", "}))(TableCell);",
      "export const Legacy = createReactClass({", "  displayName: \"Legacy\",", "  render: function () {", "    return <div />;", "  },", "});", "export const Casted = withData(source as Source)(Nav);",
      // …the function it is given: under a wrapper, after another argument, after a list that closes on a later line, with a
      // `)(` of its own inside it, after the callee's type arguments
      "export const TodoList = inject(\"store\")(observer(({ store }) => {", "  return <ul />;", "}));", "export const Field2 = createField(\"text\", (props) => {", "  return <input {...props} />;", "});",
      "export const Counter2 = connect(", "  mapStateToProps,", ")(function Counter2({ count }) {", "  return <b>{count}</b>;", "});", "export const Picker = observer(({ id }) => <li onClick={() => select(id)()} />);",
      "export const Typed3 = observer<{ onPick: () => void }>((props) => <div />);",
      // …a comma in a wrapper's type arguments, a generic arrow given, a wrapper whose own list goes on below, a function
      // given on a line of its own after another argument (review 3: an argument asked "are you a function?" was cut at them)
      "export const Input2 = observer(forwardRef<HTMLInputElement, InputProps>((props, ref) => {", "  return <input ref={ref} {...props} />;", "}));", "export const List2 = typedMemo(<T,>({ items }: Props<T>) => { return <ul />; });",
      "export const Header2 = observer(", "  React.forwardRef<HTMLTableCellElement, HeaderProps>(", "    ({ title }, ref) => {", "      return <th ref={ref}>{title}</th>;", "    },", "  ),", ");",
      "export const Field3 = createField(", "  \"text\",", "  (props) => <input {...props} />,", ");",
      // a single call around a const's and a class's component (the file's own, not a function's alone); a name on a line
      // of its own under a curried application may be an import's
      "const Base2 = () => <i />;", "export const Wrapped2 = withRouter(Base2);", "class Klass extends React.Component {}", "export const Wrapped3 = withRouter(Klass);",
      "export const LongCurried = connect(mapState)(", "  TableCell,", ");",
      // what it is given FIRST is asked of its LAST list (an object in the first one configures the HOC), past the
      // callee's type arguments (a function type's `({ id })` is no argument)
      "export const Themed = withStyles({ root: {} })((props) => <div className={props.classes.root} />);", "export const Doc2 = observer(() => (", "  <pre>", "{header}", "{body}", "  </pre>", "));",
      "export const Styled2 = observer(() => {", "  const css2 = " + BT, "    color: red;", "  " + BT + ";", "  return <div className={css2} />;", "});",
      "export const Counter3 = connect(", "  (s) => ({ count: s.count }),", "  { load }", ")(function Counter3({ count }) {", "  return <b>{count}</b>;", "});", "export const Typed5 = observer<({ id }: Row) => void>((props) => <div />);", "export const Typed4 = track<(id: string) => void>((props) => <div />);",
      "const Inner3 = Nav;", "export const Routed2 = withRouter(Inner3);",
      // …a HOC's argument on a line of its own; a cast after it on the statement's last line
      "export const LongName = withRouter(", "  Nav,", ");", "export const Casted2 = connect(", "  mapState,", ")(Nav) as React.ComponentType;",
      // an apostrophe after a letter opens no string: a tag between two of them, a `//` after one
      "export const Hint2 = observer(() => {", "  return <p>Don't</p>; // it's the only line", "});", "export const Tip2 = observer(() => {", "  const s = 0; return <b>Don't</b>; const t = 'won';", "});", "export const Allman = observer(function Allman(props)", "{", "  return <div />;", "});", "function TabFn() { return null; }", "export const Tab = forwardRefWithAs(TabFn) as unknown as TabComponent;",
      // …an indented line that begins with the word `export` is no statement: the function's extent goes on past it
      "export const Toolbar = observer(function Toolbar(props) {", "  const actions = {", "    export: () => download(),", "  };", "  return <div />;", "});",
      // …it is loaded on demand
      "export const Help = observer(() => show(" + BT, "usage: run it", BT + ", <Hint />));", "export const Chart = dynamic(() => import(\"./chart\"), { ssr: false });", "export const Editor = loadable(", "  () => import(\"./editor\"),", ");", ""]));
    write(p, UI + "classes.tsx", L(["import { Base } from \"./base\";", "import * as React from \"react\";",
      // a class by what it DOES: a `render` and JSX, whatever it extends
      "export class Panel extends Base {", "  render() {", "    return <section />;", "  }", "}", "export class Mixed extends mixin(Component) {", "  public override render() { return <i />; }", "}",
      "export class Field extends Base {", "  render = () => <input />;", "}",
      // …its brace on the line below, the class on one line, its list over lines, a call in a default; text at the margin in an element
      "export class Allman2 extends Base", "{", "  render()", "  {", "    return <div />;", "  }", "}", "export class OneLine extends Base { render() { return <div />; } }",
      "export class Over extends Base {", "  render(", "    props: Props,", "  ): React.ReactNode {", "    return <div />;", "  }", "}", "export class Dflt extends Base {", "  render(props, state = initial()) { return <div />; }", "}",
      "export class Terms extends Base {", "  render() {", "    return (", "      <pre>", "1. First clause", "      </pre>", "    );", "  }", "}",
      "export const Legacy2 = createReactClass({ render: function () { return <div />; } });",
      "export class Memo2 extends Base {", "  render = memoize(() => {", "    return <div />;", "  });", "}", "export class Both extends Base", "{", "  render(", "    props,", "    state", "  )", "  {", "    return <div />;", "  }", "}",
      // a decorator: on the line above, on the class's line (with arguments, a `)` in a string), after `export`, with arguments over lines
      "@observer", "export class DecoA extends React.Component {}", "@observer export class DecoB extends React.Component {}", "export @observer class DecoC extends React.Component {}",
      "@Component({ selector: \"x)\" }) @observer export class DecoD extends React.Component {}", "export default @observer class DecoE extends React.Component {}",
      "@Component({", "  selector: \"y\",", "})", "export class DecoF extends React.Component {}", ""]));
    write(p, UI + "indent.tsx", L(["  export function Indented() { return null; }", "\texport const Tabbed = () => null;", "export namespace UI {", "  export const NsButton = () => null;", "  const hidden = 1;", "}", ""]));
    write(p, UI + "compound.tsx", L(["function Card() { return null; }", "function CardHeader() { return null; }",
      // a part hung on a component: an alias, a function, a value on the next line — exported under the component's exported name
      "Card.Header = CardHeader;", "Card.Body = (props) => <div {...props} />;", "Card.Footer = function CardFooter() { return null; };", "Card.Wide =", "  (props) => null;", "Card.displayName = \"Card\";", "Card.Size = 5;",
      "export { Card, Card as Panel2 };",
      "export default function Menu() { return null; }", "Menu.Item = function MenuItem() { return null; };",
      // `Object.assign`: as a value, as a statement, as the default export — a shorthand key, a function, a lower-case key
      "function DialogRoot() { return null; }", "function DialogTitle() { return null; }", "const Close = () => null;",
      "export const Dialog = Object.assign(DialogRoot, {", "  Title: DialogTitle,", "  Close,", "  Body: (props) => <div {...props} />,", "  Obs: observer(() => <s />),", "  size: 3,", "});",
      "function Tabs() { return null; }", "function TabList() { return null; }", "Object.assign(Tabs, { List: TabList });", "export { Tabs };",
      "function ButtonRoot(props) { return <button {...props} />; }", "export const Button = Object.assign(ButtonRoot, { displayName: \"Button\" });",
      "function MenuItem2() { return null; }", "export const Menu2 = Object.assign(function Menu2() { return <ul />; }, { Item: MenuItem2 });",
      "function CardRoot3() { return null; }", "export const Card3 = Object.assign(CardRoot3 as React.FC<{ title: string }>, { Header: CardHeader });",
      "function PanelRoot() { return null; }", "PanelRoot.Title = CardHeader;", "export const Panel3 = PanelRoot;",
      "import { contextConnect } from \"./context\";", "function Unforwarded(props, ref) { return <div ref={ref} />; }", "function MenuItem3() { return <li />; }",
      "export const Menu3 = Object.assign(contextConnect(Unforwarded, \"Menu3\"), { Item: MenuItem3 });", "export const Menu4 = Object.assign(withRouter(Unforwarded), { Item: MenuItem3 });",
      "export const Card4 = Object.assign(CardRoot3, { Header: CardHeader }, extras);", "export const Card5 = Object.assign(CardRoot3, { Header: CardHeader } as Record<string, React.FC>);",
      "export const Card6 = Object.assign(CardRoot3, extras, { Body: CardHeader });",
      // (its arguments end at its `)`: ONE argument is that name — the component itself, its parts too)
      "export const Same = Object.assign(RootB);", "export const Menu5 = Object.assign(observer<MenuProps, HTMLUListElement>((props) => <ul />), { displayName: \"Menu5\" });",
      "function RootA() { return null; }", "RootA.Header = CardHeader;", "export const CardA = RootA;", "CardA.Body = CardHeader;",
      "function RootB() { return null; }", "RootB.Icon = CardHeader;", "export const ButtonB = Object.assign(RootB, { displayName: \"ButtonB\" });",
      "export const TabList2 = Tabs.List;", "import ImportedRoot from \"./root\";", "export const Sheet3 = Object.assign(ImportedRoot, { Title: SheetTitle });",
      "import Extra from \"./extra\";", "function SheetRoot() { return null; }", "function SheetTitle() { return null; }", "export const Sheet2 = Object.assign(SheetRoot, { Title: SheetTitle }) as Compound<{ Other: Extra }>;", ""]));
    // a literal of functions written in it, seventy lines long; an `Object.assign` inside one (a lower-case key's, a part's own)
    write(p, UI + "lengthy.tsx", L(["function WideRoot() { return null; }", "const Third = () => null;", "export const Wide = Object.assign(WideRoot, {", "  First: (props) => {"].concat(Array.from({ length: 35 }, (_, i) => "    step" + i + "();"),
      ["    return <div />;", "  },", "  Second: function (props) {"], Array.from({ length: 35 }, (_, i) => "    step" + i + "();"), ["    return null;", "  },", "  Third,", "  header: Third,", "});", ""])));
    write(p, UI + "crumbs.tsx", L(["function Crumb(props) { return <li {...props} />; }", "function CrumbItem() { return null; }", "function CrumbIcon() { return null; }", "export default Object.assign(Crumb, {", "  displayName: \"Crumb\",",
      "  defaultProps: Object.assign({}, Base.defaultProps, { size: \"md\" }),", "  Item: Object.assign(CrumbItem, { Icon: CrumbIcon }),", "});", ""]));
    write(p, UI + "assigned.tsx", L(["function Tree() { return null; }", "function Leaf() { return null; }", "export default Object.assign(Tree, { Leaf });", ""]));
    write(p, UI + "names.tsx", L(["import * as R from \"react\";", "import * as DialogPrimitive from \"@radix-ui/react-dialog\";", "import Origin from \"./origin\";", "const RR = require(\"react\");", "const Radix = require(\"@radix-ui/react-tabs\");",
      // React under an import's name; its wrapper in parentheses, cast
      "export const SpacedA = R.forwardRef((p, r) => null);", "export const SpacedB = RR.memo(function SpacedB() { return null; });", "export const CastA = (React.forwardRef((p, r) => null)) as Poly;",
      "export const CastB = (forwardRef<El, P>((p, r) => null)) as Poly;", "export const CastC = (R.forwardRef((p, r) => null)) as Poly;",
      // a name the file borrows: destructured from an import (renamed, with a default, over lines), from a `require`
      "const { Root, Trigger: Open, Portal = Fallback } = DialogPrimitive;", "const {", "  Overlay,", "  Content,", "} = DialogPrimitive;", "const { List } = require(\"@radix-ui/react-tabs\");",
      "export const Sheet = Root;", "export const SheetOpen = Open;", "export const SheetPortal = Portal;", "export const SheetContent = Content;", "export const TabsRoot = Radix.Root;", "export const TabStrip = List;", "export const Typography = Origin as Compounded;", ""]));
    const report = S.designSystemReport(p);
    S.scaffoldSteeringFile(p, "design-system.md");
    const reg = registry(p);
    const found = reg.components.map((c) => c.name).sort();
    const approve = sized(p);
    const verdicts = [approve(["| Reuse | Card.Header, Dialog.Title · Menu.Item | the parts |", "| Reuse | Counter, Panel, DecoB | wrapped, a class, decorated |"]), approve(["| Reuse | CardHeader | the part, as its function is named |"]),
      approve(["| Reuse | Card.Size | no component |"]), approve(["| Reuse | Dialog.Missing | no such part |"])];
    const after = S.designSystemReport(p);
    const NAMES = ["Wrapped", "Help", "Input2", "List2", "Header2", "Field3", "Wrapped2", "Wrapped3", "LongCurried", "Memo2", "Both", "Menu3", "Menu3.Item", "Menu4", "Menu4.Item", "Card4", "Card4.Header", "Card5", "Card5.Header",
      "CardA", "CardA.Header", "CardA.Body", "Themed", "Typed5", "Card6", "Card6.Body", "Menu5", "Same", "Same.Icon", "Doc2", "Counter3", "Styled2", "ButtonB", "ButtonB.Icon", "TabList2", "Sheet3", "Sheet3.Title", "Typed4", "Routed2", "TodoList", "Field2", "Counter2", "Picker", "Typed3", "LongName", "Casted2", "Hint2", "Tip2", "Allman2", "OneLine", "Over", "Dflt", "Terms", "Legacy2",
      "Button", "Menu2", "Menu2.Item", "Card3", "Card3.Header", "Panel3", "Panel3.Title", "Dialog.Obs", "Casted", "Allman", "Sheet2", "Sheet2.Title", "StyledCell", "Legacy", "Curried", "Fwd", "Tab", "Toolbar", "Lengthy", "Wide", "Wide.First", "Wide.Second", "Wide.Third", "Crumbs", "Crumb", "Crumb.Item", "Typography", "Counter", "Meter", "Group", "Board", "RoutedNav", "Connected", "Injected", "Chart", "Editor",
      "Classes", "Panel", "Mixed", "Field", "DecoA", "DecoB", "DecoC", "DecoD", "DecoE", "DecoF",
      "Indent", "Indented", "Tabbed", "NsButton",
      "Compound", "Card", "Card.Header", "Card.Body", "Card.Footer", "Card.Wide", "Panel2", "Panel2.Header", "Panel2.Body", "Panel2.Footer", "Panel2.Wide", "Menu", "Menu.Item",
      "Dialog", "Dialog.Title", "Dialog.Close", "Dialog.Body", "Tabs", "Tabs.List",
      "Assigned", "Tree", "Tree.Leaf",
      "Names", "SpacedA", "SpacedB", "CastA", "CastB", "CastC", "Sheet", "SheetOpen", "SheetPortal", "SheetContent", "TabsRoot", "TabStrip"];
    all("1.35.2: what a component file exports and 1.35.1 left to add by hand — a component wrapped by another function (`observer(…)`, a HOC, `dynamic(…)`): when what it wraps renders (its statement holds JSX — a closing tag, a self-closing one, a fragment —, on its line or below, past a template's lines), holds JSX and is given no object, list or element first (`connect(a)(function …)`, `observer(forwardRef<El, Props>(…))`, a wrapper whose own list goes on below, a function after another argument on its own line), is applied to a component the file DECLARES (`withRouter(Nav)`, `connect(…)(Nav)` over lines, `inject(\"s\")(observer(Nav))`, a cast after it: `hoc(TabFn) as unknown as Tab` — or, curried, to one it imports: `withStyles(…)(TableCell)`), is given a `render` and JSX (`createReactClass({ render: function () { … } })`, on one line too) or is loaded on demand (a dynamic `import(`) — an indented line that begins with the word `export` (an object's key) ends no statement, nor does a `{` on its own line; a class by what it does — a `render` that is DEFINED (a method — with modifiers, its brace on the line below, its list over lines, a call in a default, the class on one line —, a field: a function, a call of one, a member —, its list over lines AND its brace below) and JSX, text at the margin inside its element or not — whatever it extends (an imported base, a mixin); a decorator on the line above, on the class's line (several, with arguments, a `)` in a string), after `export` / `export default`, with arguments over lines; an indented `export` (blanks, a tab, a namespace's); a part hung on a component — `Card.Header = CardHeader`, a function, a value on the next line — exported under the component's exported name (`Panel2.Header`), `Object.assign(Root, { Title: X, Close, Body: fn })` as a value, a statement and the default export — its literal read whole (seventy lines of functions) and to the `}` that closes it (a cast's type after it holds no part), an `Object.assign` inside it read as the component it is given (never the statement again: it recursed forever), a lower-case key no part; one with no part at all (`{ displayName }`) is the component it is given when the file declares that one; a component written as its first argument, a cast on it; the parts of the component an alias stands on AND its own (`Root.Title = …; export const Panel = Root; Panel.Body = …`), never under an alias of a member (`Tabs.List`); around a HOC's call (`Object.assign(contextConnect(Root, \"Menu\"), { Item })`), with a literal that is not its last argument (nor its second), a type's comma in the cast after it or in the type arguments of the call it is given, an imported root; React under an import's name (`R.forwardRef`, a `require`'s), its wrapper in parentheses that is cast; and an alias of a name the file borrows — destructured from an import (renamed, with a default, over lines), from a `require` —, of an import that is cast (`Origin as Compounded`). The seed lists them, a size m design that cites `Card.Header` / `Dialog.Title` passes (the part's key is its function's: `CardHeader` too), one that cites a part that is no component is refused (got " +
      js({ total: report.missingTotal, found, verdicts, inSync: after.inSync }) + ")", {
      names: () => js(found) === js(NAMES.slice().sort()) && report.missingTotal === NAMES.length,
      gate: () => js(verdicts) === js(["approved", "approved", "refused:ui-design-system", "refused:ui-design-system"]),
      seeded: () => after.inSync === true && after.missingTotal === 0 && /^\| Card\.Header \| `src\/components\/ui\/compound\.tsx` \|/m.test(rd(p, REG)),
    });
  }

  // --- …and what is no component: what the new rules must not take, what 1.35.1 read too much -----------------------------------------------
  {
    const p = project("not", { "package.json": deps(["react"]) });
    write(p, UI + "calls.tsx", L(["import { Base } from \"./base\";", "import cache from \"lru\";",
      // a call that renders nothing, wraps no component and loads nothing
      "export const Observed = observer(() => null);", "export const Memoized = memoize(() => 1);", "export const Schema = z.object({ a: z.string() });", "export const Ctx = createContext(null);",
      "export const Theme = createTheme({", "  palette: {},", "});", "export const Cached = cache.memo(load);", "export const Upper = String(name);", "export const Odd = wrap(Unknown);",
      // a function applied to a name the file only IMPORTS, a call given an object or a list that holds JSX, an `Object.assign` of no part
      "import DefaultTheme, { IconSizes, Status, RootReducer } from \"./theme\";", "export const ThemeContext = React.createContext(DefaultTheme);", "export const Sizes = Object.freeze(IconSizes);",
      "export const StatusSchema = z.nativeEnum(Status);", "export const Store = createStore(RootReducer);", "export const Wired = inject(\"store\")(observer(Base));", "const PMap = DefaultTheme;", "export const PluginEntries = Object.entries(PMap);",
      // a configuration that holds a `)(` line, an element handed over, a line of blanks before a statement that begins no name,
      // a name on a line of its own under a SINGLE call that is an import's
      "export const Table3 = createTable({", "  cell: compose(", "    bold,", "  )((v) => <b>{v}</b>),", "});", "export const Rendered = renderToString(<p>x</p>);", "export const Table4 = createTable({ cell: compose(bold)((v) => <b>{v}</b>) });",
      "export const Routes3 = createRoutes(", "  [", "    { path: \"/\", element: <Home /> },", "  ],", ");", "export const Kit = Object.assign({ Header: Base }, extras);", "export const Opts = configure({ render: function () { return 1; } });", "export const Named2 = Object.assign(Base as Poly, { displayName: \"Base\" });", "export const Booted = new Runner(() => <App />);", "import { Other } from \"./other\";", "export const Odd3 = Object.assign(Base, XOther);",
      "export const Limit = memoize((n) => n * 2);", "   ", "(function boot() { mount(<App />); })();", "export const LongSingle = withRouter(", "  Base,", ");",
      "function Local2() { return <i />; }", "export const Pair2 = combine(", "  Local2,", "  other,", ");", "export const MotionBox = motion(Base);",
      "export const Columns = defineColumns([{ title: \"A\", render: (v) => <a>{v}</a> }]);",
      "export const SelectColumn = columnHelper.display({", "  cell: ({ row }) => <Checkbox checked={row.getIsSelected()} />,", "});", "export const Router = createBrowserRouter([{ path: \"/\", element: <Home /> }]);",
      "export const Merged = Object.assign(Base, overrides);", "export const Named = Object.assign(Base, { displayName: \"Base\" });",
      // a class that CALLS a render, or returns one's result
      "export class ToastManager extends Base {", "  show() {", "    render(<Toast />, this.el);", "  }", "}", "export class Harness {", "  mount() { return render(<App />); }", "}",
      // a value that holds JSX and is no call: an element, an object of render functions
      "export const Mark = <svg />;", "export const Icons = { logo: () => <svg /> };", "export const Sync = loader.import(\"./x\");",
      // a tag in a string, in a template that goes on below, an HTML escape: no JSX
      "export const Tpl = compile(\"<div></div>\");", "export const Html = render(" + BT + "<p/>" + BT + ");", "export const Safe = clean(s.replace(/</g, \"&lt;\"));", "export const Doc = wrap(() => " + BT + "<p></p>", BT + ");",
      // the statement that follows is not this one's: an indented export, a decorated class on the decorator's line
      "export const Plain = configure({", "  a: 1,", "});", "  export const IndentedView = () => <div />;", "export const Counted = configure(() => 1);", "(function () {", "  mount(<App />);", "})();", "export const Setup = configure({});", "@observer export class DecoView extends React.Component { render() { return <b />; } }",
      // a class with an imported base that does not render, one that renders no JSX, one that holds JSX and no `render`
      "export class Model extends Base {", "  toJSON() { return {}; }", "}", "export class Tag extends LitElement {", "  render() {", "    return html" + BT + "<p></p>" + BT + ";", "  }", "}",
      "export class Factory extends Base {", "  build() { return <div />; }", "}",
      "export class Printer extends Base {", "  print(job) { return job.ready ? render(job) : <Spinner />; }", "}",
      "export class Mounter extends Base {", "  mount() {", "    render(", "      { root: el },", "      <App />", "    )", "  }", "}", "export class Trans2 extends Base {", "  build() { return <Trans render=\"span\" />; }", "}",
      "export class Routes2 extends Base {", "  build() { return <Route render={() => <Home />} />; }", "}", "export class Binder extends Base {", "  bind() { this.render = () => <div />; }", "}", "@Injectable() export class Service {}",
      // a part of what is no component, a part that is none; what parentheses hold that is no wrapper's call
      "const Config = { a: 1 };", "Config.Render = () => null;", "export { Config };", "export const Pick = (memo ? 1 : 2);",
      // a name destructured from what is no import; an indented declaration that is no export
      "const { Up } = local;", "export const Arrow = Up;", "  function NotExported() { return null; }", "export { NotExported };", ""]));
    write(p, UI + "pricing.tsx", L([
      // a PascalCase function that shows it is none: the file calls it (in an expression, after a keyword, after an arrow, as a statement)
      "function FormatPrice(n) { return n.toFixed(2); }", "function Compute(x) { return x * 2; }", "function Shorten(s) { return s.slice(0, 3); }", "function Register(c) { registry.push(c); }",
      "function Tally(x) { return x }", "(function () {", "  mount(<App />, Tally(1));", "})();", "function Track(c) { log.push(c); }", "function Pick(a) { return a[0]; }", "function Build(a) { return [a]; }", "function Launch(n) { return n + 1; }", "const run = () =>", "  Launch(1);", "function Open(a, b) { return a + b; }", "function Fetch(x) { return load(x); }", "function Store(x) { this.x = x; }",
      "export async function Price({ value }) {", "  if (!value) return Compute(0);", "  Register(Price);", "  Track(Price)", "  Open(", "    value,", "    1,", "  );", "  const data = await Fetch(value);", "  const first = value ? Pick(value) : null;", "  const all = [", "    Build(value),", "  ];", "  const store = new Store(data);",
      "  return <b>{FormatPrice(value)} {[value].map((v) => Shorten(v))}</b>;", "}",
      "export { FormatPrice, Compute, Shorten, Register, Track, Open, Fetch, Store, Launch, Pick, Build, Tally };",
      // …it takes a component, or three parameters
      "export function WithTheme(Component) { return (props) => <Component {...props} />; }", "export const WithTyped = (Wrapped: React.ComponentType<P>) => (props: P) => <Wrapped {...props} />;",
      "export function Clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }", "export const Lerp = (a, b, t) => a + (b - a) * t;",
      "export const Mix = <F extends () => void>(a, b, c) => null;", "export const Cmp = (a = lo < hi, b, c) => a;", "export const Wrap2 = Component => props => <Component {...props} />;",
      // an element in parentheses, a function called at once — over lines
      "export const Logo = (", "  <svg />", ");", "export const Api = (function () {", "  return {};", "})();",
      // a code sample in a template literal (its escaped backtick ends nothing), between two strings that hold a backtick
      "const sample = " + BT + "a " + BS + BT + " b", "export function InTemplate() {}", "  export const AlsoInTemplate = () => null;", BT + ";",
      "const sample2 = " + BT, "a " + BS + BT + " b", "export function InTemplate2() {}", BT + ";",
      "const big = " + BT + "x".repeat(2100) + BT + ";", "export function AfterLong() { return null; }",
      "const tick = \"" + BT + "\";", "export function BetweenTicks() { return null; }", "const tock = \"" + BT + "\";", ""]));
    write(p, UI + "stays.tsx", L([
      // a component stays one: its parameters (a destructuring's commas, a default's, type parameters holding a list), one or two
      "export function Stay({ a, b, c }: Props) { return null; }", "export function Row(props, ref) { return null; }", "export const Cell = ({ a, b, c }, ref) => null;", "export function Pair(a, b,) { return null; }",
      "export const Quoted = (label = \"a, b, c\") => null;", "export function Sel<F extends (a: A, b: B, c: C) => void>(props: P<F>) { return null; }",
      // …rendered, never called: a tag, a name beside a `(` that is text (after a tag, a plural, a line of text, a signature, a method's header, a member's call)
      "export function Tree({ nodes }) {", "  return <ul>{nodes.map((n) => <Tree key={n.id} nodes={n.children} />)}</ul>;", "}",
      "export function Label() { return null; }", "export function LabelNote() { return <b>Label(optional)</b>; }",
      "export function Report() { return null; }", "export function ReportLine() { return <p>See Report(2024) for details</p>; }", "export function File() { return null; }", "export function FileCount() { return <p>- File(s)</p>; }",
      "export function Box() { return null; }", "export function BoxCount() { return <p>- Box(es)</p>; }",
      "const api2 = { Draw(props) { return 1; } };", "export function Draw() { return null; }", "type Parts3 = { Empty(): JSX.Element };", "export function Empty() { return null; }",
      "interface Parts4 {", "  Entry(props: EntryProps);", "}", "export function Entry() { return null; }", "const re2 = /Sum(" + BS + "d+)/;", "export function Sum() { return null; }",
      "export function Amount() { return null; }", "export function AmountLine({ n }) { return <p>{n} Amount(USD)</p>; }",
      "export function Button2() { return null; }", "export function Note() {", "  return (", "    <p>", "      Use it,", "      Button2(primary), never a link", "    </p>", "  );", "}", "export function Total() { return null; }", "export function TotalNote() {", "  return (", "    <p>", "      The sum is", "      Total(USD) of the order", "    </p>", "  );", "}",
      "const base = css" + BT + " /* a note that", "  goes on */", "  color: red;", BT + ";", "export function AfterCss() { return null; }",
      "export function Chip({ value }) { return <i>{value}</i>; }", "export const Chips = ({ list }) => <p>{list.map((v) => Chip({ value: v }))}</p>;",
      // a template that holds ` // ` on its line, a sample whose last line holds one before the closing backtick: what follows them is read
      "export function Install() { return <CodeBlock code={" + BT + "pnpm add @acme/ui // or npm i" + BT + "} />; }", "export function Between() { return <hr />; }", "export function Tested() { return <CodeBlock code={" + BT + "pnpm test // runs vitest" + BT + "} />; }",
      "const usage = " + BT, "npm run build // builds it" + BT + ";", "export function AfterUsage() { return null; }", "const usage2 = " + BT, "npm test // tests it" + BT + ";", "export function AfterUsage2() { return null; }",
      // a statement that begins with a `(` is the next one; a HOC in parentheses and a generic arrow in parentheses, over lines
      "export const Framed = (props) => {", "  return <div />;", "};", "(function () {", "  setup();", "})();", "export const Formed = (", "  connect(mapState)", ")(FormView);",
      "export const Typed2 = (", "  <T extends Row>(props: P<T>) => {", "    return null;", "  }", ") as GenericTable;",
      // a comparison in a default, a type's arguments: one parameter
      "export function Bar({ wide = width > 600, a, b }) { return null; }", "export function Wide3(props: Props<A, B, C>) { return null; }",
      "export function Summary() { return null; }", "export function SummaryNote() {", "  return (", "    <p>", "      Summary(USD)", "    </p>", "  );", "}", "interface Parts {", "  Item(props: ItemProps): JSX.Element;", "}", "export function Item() { return null; }", "const api = {", "  Render(props) {", "    return 1;", "  },", "};", "export function Render() { return null; }",
      "registry.Slot(1);", "export function Slot() { return null; }", "function Inner() { return null; }", "export const Outer = React.memo(Inner);",
      // parameters over lines, a function in parentheses that is cast — over lines
      "export const Kept = (", "  props: Props,", ") => null;", "export const Cast = ((props) => {", "  return null;", "}) as React.FC;",
      // a backtick that never closes is a stray one: the file is read as it was; a template on one line hides nothing
      "const one = " + BT + "a ${b} c" + BT + ";", "export function AfterTemplate() { return null; }", ""]));
    write(p, UI + "apostrophe.tsx", L(["export function Before2() { return <p>Don't</p>; } // it's a " + BT + " tick", "export function Between2() { return null; }",
      "export function After2() { return <p>Can't</p>; } // isn't a " + BT + " tick", "export function Last2() { return null; }", ""]));
    // a backtick that never closes is a stray one: its file is read as 1.35.1 read it — in a file of its own (the files
    // above keep their template state)
    write(p, UI + "stray.tsx", L(["const stray = /" + BT + "/;", "export function AfterStray() { return null; }", "const sample = " + BT, "export function Sampled() {}", BT + ";", ""]));
    const report = S.designSystemReport(p);
    S.scaffoldSteeringFile(p, "design-system.md"); // (the report lists its first 50 rows: the seed holds them all)
    const names = registry(p).components.map((c) => c.name).sort();
    const WANT = ["Calls", "IndentedView", "DecoView", "Pricing", "Price", "BetweenTicks", "AfterLong", "Stays", "Stay", "Row", "Cell", "Pair", "Quoted", "Sel", "Tree", "Label", "File", "Box", "Apostrophe", "Before2", "Between2", "After2", "Last2", "AfterCss", "FileCount", "BoxCount", "LabelNote", "Report", "ReportLine", "TotalNote", "SummaryNote", "Stray", "Sampled", "Draw", "Empty", "Entry", "Sum", "Amount", "AmountLine", "Button2", "Note", "Total", "Summary", "Chip", "Chips", "Install", "Between", "Tested", "AfterUsage", "AfterUsage2", "Framed", "Formed", "Typed2", "Bar", "Wide3", "Item", "Render", "Slot", "Outer", "Kept", "Cast", "AfterTemplate", "AfterStray"];
    all("1.35.2: …and what is no component — a call that renders nothing, wraps no component and loads nothing (`observer(() => null)`, `memoize(…)`, `z.object(…)`, `createContext(…)`, `cache.memo(…)`, `wrap(Unknown)`, a member named `import`), a single call of a function with a name the file only imports (`createContext(DefaultTheme)`, `Object.freeze(IconSizes)`, `createStore(RootReducer)`, `motion(Base)`) or an alias of one (`const PMap = Plugins; … Object.entries(PMap)`), a call given two names on lines of their own, a configuration that holds a `)(` (on its line, on a later one), a list of routes on the line below its `(`, an object with a `render` that returns no JSX, an instance (`new Runner(() => <App />)`), an `Object.assign` of no part around an import that is cast, an `Object.assign` whose FIRST argument is a literal of components, an element handed over (`renderToString(<p />)`), a single call around an import on a line of its own, the statement after a line of blanks, a call given an object or a list that holds JSX (a table's column, a router's routes), an `Object.assign` with no capitalised key, a value that holds JSX and is no call (an element, an object of render functions); a class that calls `render(…)` and has none; a tag in a string, in a template that goes on below, an HTML escape (`/</g`); the statement that follows a call — an indented export, a class on its decorator's line, one that begins with a `(` — is not the call's; a class with an imported base that has no `render`, one that renders no JSX, one that holds JSX and no `render` of its own (a render prop it gives an element — a function or a string —, a `render` it assigns to a member, one it CALLS: in a ternary, with its list over lines and no `;`); a part of what is no component; `(memo ? 1 : 2)`; a name destructured from what is no import; an indented declaration that is no export. And what 1.35.1 listed, knowingly: a PascalCase function the file CALLS (in an expression, after `return` / `await` / `new`, after an arrow, first on its line — with or without a `;`, a `,` alone after it, its list going on below, under an arrow's `=>` —, in a ternary), one that takes a component (a HOC — typed, an arrow's bare parameter), one of three parameters (after type parameters that hold an arrow too; a comparison in a default is no type argument); the statement below a helper that ends with a `}` is not its own; an element in parentheses and a function called at once, over lines; a code sample in a template literal (an escaped backtick ends none; a backtick in a string opens none: what stands between two such strings is read; one that closes past a long line's cut is closed). A component stays one: a destructuring's commas, a default's (a comparison's `>` in it), a trailing one, a list inside its type parameters or its type's arguments; one the file calls that renders JSX itself; what follows a template that holds ` // `, or a `/*` that closes inside it; a comment after an element's text when both hold an apostrophe (`Don't` … `// it's`); a statement before one that begins with a `(`; a HOC and a generic arrow in parentheses over lines; a name beside a `(` that is text — after a tag, a plural (`- File(s)`, `Box(es)`), a sentence (`See Report(2024) for details`), a line of text (a `,` and more after its `)` too), a line under a tag, text after an expression's `}`, a regex's — each of a component that renders nothing itself, so that the rule alone answers —, a signature (a typed parameter, a `:` after its `)`), a method's header (a `{` after its `)`, on one line too), a member's call; parameters over lines, a function in parentheses that is cast; and a backtick that never closes is a stray one — its file is read as 1.35.1 read it, a sample in it too (got " +
      js({ names, limits: report.limits }) + ")", {
      names: () => js(names) === js(WANT.slice().sort()) && report.missingTotal === WANT.length && report.limits.length === 0,
    });
  }

  // --- hostile lines: every new pattern gives up in linear time ----------------------------------------------------------------------------
  // (F and G: a parameter list that never closes is one that goes on below — a function's)
  {
    const h = project("hostile", { "package.json": deps(["react"]) });
    const wide = " ".repeat(1900);
    const hostile = ["export const A = f(</" + "a".repeat(1900), "export const B = f(" + "</a ".repeat(480), "export const C = f(</a" + wide + "x", "A(".repeat(990), "export const D = f(" + "(A ".repeat(600), "export const E = f((A" + wide + "x",
      "@a(".repeat(600), "@" + "a.".repeat(900), "export const F = (" + "a,".repeat(900), "export const G = (a" + "<".repeat(900), "Object.assign(A, {" + "B:".repeat(900), "A.B =" + wide + "x", BT.repeat(1999), "'" + BT + "'".repeat(990),
      "  render" + wide + "x", "  a ".repeat(480) + "render", "const {" + "a,".repeat(900), "import(" + wide + "x", "export default Object.assign(" + wide + "x"];
    for (let i = 0; i < 6; i++) write(h, UI + "hostile" + i + ".tsx", "export function Survivor" + i + "() { return null; }\n" + Array.from({ length: 120 }, (_, k) => hostile[k % hostile.length]).join("\n") + "\n");
    // what review 1 of 1.35.2 found: parts × exported names (2,000 × 2,090, in lists of 190: 500 names are kept, and said), the entries of an
    // `Object.assign` each asked of the whole statement (4,000 entries in one of 20,000 lines), a destructuring that never closes
    write(h, UI + "product.tsx", "function A() { return null; }\n" + Array.from({ length: 2000 }, (_, i) => "A.B" + i + " = A;").join("\n") + "\n" + Array.from({ length: 11 }, (_, g) => "export {\n" + Array.from({ length: 190 }, (_, i) => "  A as A" + (g * 190 + i) + ",").join("\n") + "\n};").join("\n") + "\n");
    write(h, UI + "entries.tsx", "function A() { return null; }\nexport const K = Object.assign(A, {\n" + "  B: wrap(() => 1),\n".repeat(4000) + "});\n" + "  step();\n".repeat(20000));
    for (let i = 0; i < 6; i++) write(h, UI + "open" + i + ".tsx", "let{\n".repeat(60000));
    // a statement's extent has no cap: a wrapped component whose JSX stands 4,000 lines below its `=`
    write(h, UI + "long.tsx", "export const Long = observer(function Long() {\n" + "  step();\n".repeat(4000) + "  return <div />;\n});\n");
    // rush.json at a manifest's read, of what a comment and a comma reader must give up on
    write(h, "rush.json", "{ \"projects\": [" + ("," + " ".repeat(100)).repeat(1200) + "/".repeat(60000) + "\"" + BS.repeat(60000) + "\n");
    // what review 3 of 1.35.2 found: every unclosed `render(` of a line asked the 60 lines below for the one that closes its
    // list (16 files of 256K: 8.8 s a scan) — a line's open lists are followed down ONCE. In a project of its own: the files
    // above are the 4 MB a scan reads.
    const hr = project("renders", { "package.json": deps(["react"]) });
    for (let i = 0; i < 4; i++) write(hr, UI + "renders" + i + ".tsx", "export class Renders" + i + " extends Base {\n" + (" ".repeat(1000) + "render(".repeat(140) + "\n").repeat(128) + "}\n");
    write(hr, UI + "renders4.tsx", "export class Renders4 extends Base {\n" + "  render(\n".repeat(25000) + "}\n");
    const rms = remeasure(() => { const t0 = Date.now(); const r = S.designSystemReport(hr); return [Date.now() - t0, r.missingTotal, js(r.limits)]; }, (s) => s[0] < 1000);
    // the parts' room (DS_EXPORT_NAMES): a component exported twice — by name and as the default — is expanded once (its
    // 300 parts took the room of the next component's, and nothing said so); parts that DO run out of room are said — here
    // 300 keys hung on a root and on the alias that stands on it: 600 asked, 300 names
    const many = (n, fn) => Array.from({ length: n }, (_, i) => fn(i));
    const hp = project("room", { "package.json": deps(["react"]) });
    write(hp, UI + "icons.tsx", L(["function H() { return null; }", "export function Icons() { return <i />; }"].concat(many(300, (i) => "Icons.P" + i + " = H;"), ["export default Icons;", "export function Card() { return <div />; }", "Card.Header = H;", ""])));
    const hq = project("roomcut", { "package.json": deps(["react"]) });
    write(hq, UI + "wide.tsx", L(["function H() { return null; }", "function WRoot() { return null; }"].concat(many(300, (i) => "WRoot.P" + i + " = H;"), ["export const Wide = WRoot;"], many(300, (i) => "Wide.P" + i + " = H;"), ["export function Tail() { return null; }", "Tail.Part = H;", ""])));
    write(hp, UI + "cycle.tsx", L(["import CycB from \"./b\";", "var CycA = CycB;", "var CycB = CycA;", "export { CycA, CycB };", ""]));
    const roomy = S.designSystemReport(hp), cut = S.designSystemReport(hq);
    S.scaffoldSteeringFile(hp, "design-system.md");
    const room = [registry(hp).components.map((c) => c.name).filter((x) => !/^Icons\.P\d+$/.test(x)).sort().join(","), roomy.missingTotal, js(roomy.limits), cut.missingTotal, js(cut.limits)];
    const ms = remeasure(() => { const t0 = Date.now(); const r = S.designSystemReport(h); return [Date.now() - t0, r.missing.map((c) => c.name).filter((x) => !/^A\d|^A\./.test(x)).sort().join(","), js(r.limits), r.missingTotal]; }, (s) => s[0] < 1000);
    all("1.35.2: files of lines each new pattern must give up on (a closing tag that never closes, runs of calls and of `(A`, decorators, parameter lists, an `Object.assign` and a destructuring that never close, 1,999 backticks, a `render` after 1,900 blanks) are read in linear time, a statement's extent has no cap (JSX 4,000 lines below its `=` is found), 2,000 parts under 2,000 exported names give the 500 names a file keeps — said — and not four million, the 4,000 entries of an `Object.assign` are not each asked of its 20,000-line statement, a destructuring that never closes is given up once, and a rush.json that is no JSON costs nothing and is said; four files of 128 lines of 140 unclosed `render(` each, and one of 25,000 lines of one, cost no more (each line's lists are followed down once, sixty lines deep); two names that stand on each other are followed eight deep, not for ever; a component exported by name AND as the default takes its 300 parts once — the next component's part keeps its room —, and parts that run out of room (300 keys on a root and on its alias) are said (got " + js(ms) + " " + js(rms) + " " + js(room) + ")", {
      linear: () => ms[0] < 1000,
      read: () => ms[3] > 500 && /"component-files"/.test(ms[2]) && /"workspace-manifests","read":0/.test(ms[2]),
      renders: () => rms[0] < 1000 && rms[1] === 5 && rms[2] === "[]",
      room: () => room[0] === "Card,Card.Header,CycA,CycB,Cycle,Icons" && room[1] === 306 && room[2] === "[]" && room[3] === 302 && /"component-files"/.test(room[4]),
    });
  }
};
