"use strict";
// The design-system registry — 1.35.1: what 1.35 left as known limits. The project's dependencies are its root package.json
// AND its workspace packages' (a monorepo's library sits in `apps/web/package.json`); a component file gives every component it
// exports (a kit's `card.tsx`: Card, CardHeader, CardTitle…), by what each declaration IS; a registry that ends in a
// commented-out table takes a finish's rows where its reader sees them; a design that uses no component is not told to create a
// registry.

const fs = require("fs");
const path = require("path");

exports.run = async ({ all, S, tmp, approveBefore, remeasure, require, __dirname }) => {
  const js = (v) => JSON.stringify(v);
  const E = require(path.join(__dirname, "lib", "engine", "index.js"));
  const i18n = require(path.join(__dirname, "lib", "i18n.js"));
  const write = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  const rd = (dir, rel) => fs.readFileSync(path.join(dir, rel), "utf8");
  const REG = ".specs/steering/design-system.md";
  const CARD = "| Component | Path | Variants | Notes |\n|---|---|---|---|\n| Card | `src/ui/Card.tsx` |  |  |\n\n";
  const deps = (list) => js({ dependencies: Object.fromEntries(list.map((d) => [d, "1.0.0"])) });
  const project = (tag, files) => {
    const p = path.join(tmp, "proj-dsw-" + tag);
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
  // a feature approved through its tasks, its one task done: ready to finish (its file: `implement`, written with `source`)
  const ready = (p, list, implement, source) => {
    const f = S.createFeature(p, { name: "Price Tag", tracks: ["ui"], summary: "Show a price" });
    fs.writeFileSync(path.join(f.dir, "requirements.md"), REQ);
    fs.writeFileSync(path.join(f.dir, "design.md"), design(rows(list)));
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Build the price tag\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n  - _Implements: " + implement + "_\n  - _Verify: npm test_\n");
    write(p, implement, source);
    approveBefore(p, f.slug, "requirements");
    for (const ph of ["requirements", "design", "tasks"]) S.approvePhase(p, f.slug, ph, "t");
    S.completeTask(p, f.slug, 1, { command: "npm test", exitCode: 0, summary: "42/42 passing" });
    return f;
  };
  const REFUSED = "refused:ui-design-system";
  // is the short name `antd` (of `_Libraries: antd 5_`) backed by a package of the project, and does the scan name the library?
  const backed = (p) => { write(p, REG, "# DS\n\n" + CARD + "_Libraries: antd 5_\n"); return !registry(p).weakLibraries.has("antd") + ":" + js(S.designSystemReport(p).found.libraries); };

  // --- the project's dependencies: the root manifest and its workspaces' -----------------------------------------------------------------
  {
    const WEB = { "apps/web/package.json": deps(["antd", "react"]) };
    const layouts = {
      root: { "package.json": deps(["antd"]) },
      npm: Object.assign({ "package.json": js({ private: true, workspaces: ["apps/*", "packages/*"] }) }, WEB),
      yarn: Object.assign({ "package.json": js({ private: true, workspaces: { packages: ["apps/*"] } }) }, WEB),
      pnpm: Object.assign({ "package.json": js({ private: true }), "pnpm-workspace.yaml": "packages:\n  # the libraries\n  - \"packages/*\"\n\n  - 'apps/*' # each app\n\ncatalog:\n  react: ^19\n" }, WEB),
      pnpmFlow: Object.assign({ "pnpm-workspace.yaml": "packages: [packages/*, 'apps/*'] # one line\n" }, WEB),
      lerna: { "lerna.json": js({ packages: ["modules/*"] }), "modules/web/package.json": deps(["antd"]) },
      undeclared: { "manage.py": "print(1)\n", "frontend/package.json": deps(["antd"]) },
      none: { "manage.py": "print(1)\n" },
      deeper: { "services/web/package.json": deps(["antd"]) }, // two levels below an undeclared root: not looked for
      pnpmAfter: { "package.json": js({ private: true }), "pnpm-workspace.yaml": "packages:\n  - 'packages/*'\nonlyBuiltDependencies:\n  - 'apps/*'\n", "apps/web/package.json": deps(["antd"]) },
      pnpmNested: { "package.json": js({ private: true }), "pnpm-workspace.yaml": "overrides:\n  packages:\n    - 'apps/*'\n", "apps/web/package.json": deps(["antd"]) }, // the key at the margin only
      elsewhere: { "package.json": js({ private: true, workspaces: ["packages/*"] }), "legacy/package.json": deps(["antd"]) }, // declared: only what is declared
      pnpmOther: { "pnpm-workspace.yaml": "catalog:\n  - 'apps/*'\npackagesExtra:\n  - 'apps/*'\n", "apps/web/package.json": deps(["antd"]), "package.json": js({ private: true }) },
    };
    const got = {};
    for (const [k, files] of Object.entries(layouts)) got[k] = backed(project("ws-" + k, files));
    // the gate itself, in a monorepo and with no manifest at all
    const mono = project("ws-gate", layouts.npm), bare = project("ws-gate-none", layouts.none);
    write(mono, REG, "# DS\n\n" + CARD + "_Libraries: antd 5_\n");
    write(bare, REG, "# DS\n\n" + CARD + "_Libraries: antd 5_\n");
    const gate = [sized(mono)(["| Reuse | antd Table | the list |"]), sized(bare)(["| Reuse | antd Table | the list |"]), sized(project("ws-gate-lib", layouts.npm))(["| Reuse | Buton | the list |"])];
    // a library-only registry seeded in a monorepo is a checked one
    const lib = path.join(tmp, "proj-dsw-ws-gate-lib");
    S.scaffoldSteeringFile(lib, "design-system.md");
    const seeded = [/^_Libraries: antd_$/m.test(rd(lib, REG)), registry(lib).packaged];
    const yes = "true:" + js(["antd"]), no = "false:" + js([]);
    all("1.35.1: the project's dependencies are its root package.json AND its workspace packages' — the folders it DECLARES: package.json `workspaces` (an array, or Yarn's `{packages}`), pnpm-workspace.yaml's `packages` (a block list with quotes and comments, or a flow list), lerna.json's `packages` — or, when it declares none, the folders one level down (`frontend/package.json` beside a Django app). With the root manifest alone a monorepo's `antd 5` + `antd Table` was refused at size m though `apps/web` depends on antd, and its seed declared no library (1.35 review 10). Never two levels below an undeclared root, never an undeclared folder beside declared ones, never another key of the YAML file nor the list of the key after `packages` (got " +
      js({ got, gate, seeded }) + ")", {
      declared: () => ["root", "npm", "yarn", "pnpm", "pnpmFlow", "lerna"].every((k) => got[k] === yes),
      undeclared: () => got.undeclared === yes,
      none: () => ["none", "deeper", "elsewhere", "pnpmOther", "pnpmAfter", "pnpmNested"].every((k) => got[k] === no),
      gate: () => js(gate) === js(["approved", REFUSED, "approved"]),
      seeded: () => js(seeded) === js([true, true]),
    });
  }

  // --- a workspace pattern: what it names, what it never reaches, its bounds -----------------------------------------------------------------
  {
    const ws = (patterns, files) => Object.assign({ "package.json": js({ private: true, workspaces: patterns }) }, files);
    const ANTD = deps(["antd"]);
    const cases = {
      twoLevels: ws(["packages/**"], { "packages/group/ui/package.json": ANTD }),
      itself: ws(["packages/**"], { "packages/package.json": ANTD }),
      wildcard: ws(["packages/ui-*"], { "packages/ui-kit/package.json": ANTD }),
      suffix: ws(["packages/*-kit"], { "packages/ui-kit/package.json": ANTD }),
      twoStars: ws(["packages/*-ui-*"], { "packages/acme-ui-kit/package.json": ANTD }),
      exact: ws(["tools/cli"], { "tools/cli/package.json": ANTD }),
      dotSlash: ws(["./apps/*/"], { "apps/web/package.json": ANTD }),
      beside: ws(["!apps/old", "{apps,libs}/*", "apps/*"], { "apps/web/package.json": ANTD }), // the patterns it cannot read name none — the others still do
    };
    const never = {
      threeLevels: ws(["packages/**"], { "packages/a/b/c/package.json": ANTD }),
      otherName: ws(["packages/ui-*"], { "packages/core/package.json": ANTD }),
      before: ws(["packages/ui-*"], { "packages/my-ui-kit/package.json": ANTD }), // the pattern is the WHOLE name
      after: ws(["packages/*-kit"], { "packages/ui-kit-old/package.json": ANTD }),
      dotted: ws(["apps/w.b*"], { "apps/web/package.json": ANTD }), // a `.` is a dot
      negation: ws(["!apps/web"], { "apps/web/package.json": ANTD }),
      braces: ws(["{apps,libs}/*"], { "apps/web/package.json": ANTD }),
      manyStars: ws(["apps/*w*e*b*"], { "apps/web/package.json": ANTD }),
      hidden: ws(["apps/*"], { "apps/.cache/package.json": ANTD, "apps/node_modules/package.json": ANTD }),
      hiddenUndeclared: { ".cache/package.json": ANTD, "node_modules/package.json": ANTD },
      outside: ws(["../proj-dsw-outside/*", "/proj-dsw-outside/*", "apps/../../proj-dsw-outside/*"], {}),
    };
    write(tmp, "proj-dsw-outside/pkg/package.json", ANTD);
    const got = {}, not = {};
    for (const [k, files] of Object.entries(cases)) got[k] = backed(project("pat-" + k, files));
    for (const [k, files] of Object.entries(never)) not[k] = backed(project("not-" + k, files));
    // a workspace folder that is a link to a folder outside the project is never read — by a `*` nor by its own name
    const linked = project("pat-link", ws(["apps/*", "apps/linked"], {}));
    fs.mkdirSync(path.join(linked, "apps"), { recursive: true });
    let link = false;
    try { fs.symlinkSync(path.join(tmp, "proj-dsw-outside", "pkg"), path.join(linked, "apps", "linked"), "junction"); link = true; } catch { /* no link support here */ }
    const viaLink = link ? backed(linked) : null;
    // the bound: DS_WORKSPACE_MANIFESTS (100) workspace manifests, by name — the 101st is not read
    const many = (at) => { const files = {}; for (let i = 0; i < 105; i++) files["packages/p" + String(i).padStart(3, "0") + "/package.json"] = i === at ? ANTD : deps(["left-pad"]); return ws(["packages/*"], files); };
    const bound = [backed(project("pat-many-in", many(99))), backed(project("pat-many-out", many(100)))];
    // …DS_WORKSPACE_PATTERNS (50) patterns — the 51st is not followed —, DS_WORKSPACE_DIRS (200) folders listed: `groups/*/*`
    // lists `groups/` and then one folder a group, by name — the 200th group is not looked into
    const fillers = (n) => Array.from({ length: n }, (_, i) => "none-" + i + "/*");
    const groups = (at) => { const files = {}; for (let i = 0; i < 205; i++) files["groups/g" + String(i).padStart(3, "0") + (i === at ? "/ui/package.json" : "/README.md")] = i === at ? ANTD : "x\n"; return ws(["groups/*/*"], files); };
    const caps = [backed(project("pat-pats-in", ws(fillers(49).concat(["apps/*"]), { "apps/web/package.json": ANTD }))), backed(project("pat-pats-out", ws(fillers(50).concat(["apps/*"]), { "apps/web/package.json": ANTD }))),
      backed(project("pat-dirs-in", groups(198))), backed(project("pat-dirs-out", groups(199)))];
    const yes = "true:" + js(["antd"]), no = "false:" + js([]);
    all("1.35.1: a workspace pattern is followed folder by folder — a name (`tools/cli`), a `*` within one (`apps/*`, `packages/ui-*`, `packages/*-kit`: the whole name, a `.` being a dot), `**` (that folder and two levels below it), a leading `./` and a trailing `/` aside; a `!negation`, a brace list, a segment of more than two `*` and a path that leaves the project (`../x/*`, an absolute one) name NONE, and the patterns beside them still do; a dot folder, node_modules and a folder reached through a link (a `*` match or its own name) are never read; bounded — the first 100 manifests by name, 50 patterns, 200 folders listed —, the names read so far standing (got " +
      js({ got, not, viaLink, bound, caps }) + ")", {
      names: () => Object.values(got).every((v) => v === yes),
      never: () => Object.values(not).every((v) => v === no),
      link: () => viaLink == null || viaLink === no,
      bound: () => js(bound) === js([yes, no]),
      caps: () => js(caps) === js([yes, no, yes, no]),
    });
  }

  // --- what else a component file exports -----------------------------------------------------------------------------------------------------
  {
    const p = project("exports", { "package.json": deps(["react"]) });
    write(p, "src/components/ui/card.tsx", ["import * as React from \"react\";", "", "const Card =", "  React.forwardRef<HTMLDivElement, P>((props, ref) => <div ref={ref} />);", "Card.displayName = \"Card\";",
      "const CardHeader = React.forwardRef<HTMLDivElement, P>((props, ref) => <div ref={ref} />);", "const CardTitle = (props: P) => <h3 {...props} />;", "function CardFooter(props: P) {", "  const Inner = () => null;", "  return <div />;", "}",
      "const CardContext = React.createContext<null>(null);", "const cardVariants = cva(\"rounded\");", "type CardProps = { wide?: boolean };", "const DialogClose = DialogPrimitive.Close;",
      "const CardAction =", "  React.forwardRef<HTMLButtonElement, P>((props, ref) => <button ref={ref} />);",
      "", "export {", "  Card,", "  CardHeader, // the header", "  CardTitle,", "  CardFooter,", "  CardContext,", "  cardVariants,", "  type CardProps,", "  DialogClose,", "  CardAction,", "  Inner,", "}", ""].join("\n"));
    write(p, "src/components/ui/card-header.tsx", "export function CardHeader() { return null; }\n");
    write(p, "src/components/ui/form.tsx", ["export const Form = FormProvider;", "export function FormItem() { return null; }", "export const useFormField = () => ({});", "export const FormSchema = z.object({});",
      "export const Sizes = { sm: 1 };", "export const Styled = styled.div`color: red;`;", "export const Memo = React.memo(Inner);", "export const Lazy = lazy(() => import(\"./x\"));",
      "export type FormProps = {};", "export interface FormState {}", "export enum FormMode { A }", "export class FormBoundary extends React.Component {}", "export async function FormServer() { return null; }",
      "export const Generic = <T,>(props: P<T>) => null;", "export const Typed: React.FC<P> = (props) => null;", "export const Observed = observer(() => null);", "export const ICON_SIZE = 16;",
      "export const Icons = { logo: () => null };", "export const Memoized = memoize(() => 1);", "export const Shown = isShown === true;", "function Inner() { return null; }", "export default FormItem;",
      "export let Mutable = () => null;", "export var Functional = function () { return null; };", "export const AsyncArrow = async (props) => null;", "export const Bounded = <T extends object>(props: P<T>) => null;",
      "export const Bare = props => null;", "export const Logo = <svg />;", "export const Mode = modes.dark;", "export const Call = Factory();", "export function FAQ() { return null; }", ""].join("\n"));
    write(p, "src/components/table/index.tsx", ["export { Row } from \"./row\";", "export * from \"./cell\";", "export function TableCaption() { return null; }", "export {", "  Head,", "} from \"./head\";", "function Head() { return null; }",
      "function Row() { return null; }", "function Body() { return null; }", "export { Body as default, TableCaption as Caption };", ""].join("\n"));
    write(p, "src/components/ui/extra.tsx", "export default function ExtraDefault() { return null; }\n");
    write(p, "src/components/ui/extra2.tsx", "export default class ExtraClass extends React.Component {}\n");
    write(p, "src/components/ui/extra3.tsx", "function ExtraNamed() { return null; }\nexport default ExtraNamed;\n");
    // two files export the same name: the shorter path keeps it (`zz.tsx`, though `aa/long-name.tsx` comes first by name)
    write(p, "src/components/ui/zz.tsx", "export function Shared() { return null; }\n");
    write(p, "src/components/ui/aa/long-name.tsx", "export function Shared() { return null; }\n");
    // a route segment's special file is a page: what it exports is not read (the files beside it are components)
    const next = project("exports-next", { "package.json": deps(["next", "react"]), "app/layout.tsx": "export default function Layout() { return null; }\n",
      "app/components/page.tsx": "export default function Page() { return null; }\nexport function Hero() { return null; }\n", "app/components/widget.tsx": "export function Widget() { return null; }\nexport function WidgetPart() { return null; }\n" });
    const routed = S.designSystemReport(next).missing.map((c) => c.name);
    write(p, "src/components/ui/misc.tsx", ["// export function Commented() { return null; }", "/*", "export function InBlock() { return null; }", "*/", "  export function Indented() { return null; }",
      "export function Real() { return null; } /* export function Trailing() {} */", "/* legacy */export function AfterComment() { return null; }", "const text = `", "export function InTemplate() {}", "`;", "export default function Misc() { return null; }", ""].join("\n"));
    write(p, "src/components/ui/panel.vue", "<script setup>\nexport const VueOther = () => null;\n</script>\n<template><div /></template>\n");
    write(p, "src/components/ui/tile.component.ts", "export class TileComponent {}\nexport class OtherThing {}\n");
    write(p, "src/components/Legacy.js", "export function LegacyItem() { return null; }\nexport default function Legacy() { return null; }\n");
    write(p, "src/components/helper.js", "export function Hidden() { return null; }\n");
    write(p, "src/lib/outside.tsx", "export function NotInAComponentFolder() { return null; }\n");
    const rep = S.designSystemReport(p);
    const found = Object.fromEntries(rep.missing.map((c) => [c.name, c.path.split("/").pop()]));
    S.scaffoldSteeringFile(p, "design-system.md");
    const approve = sized(p);
    const verdicts = [approve(["| Reuse | CardHeader, CardTitle, CardFooter | the card's parts |", "| Reuse | FormItem · DialogClose | the form |"]), approve(["| Reuse | CardContext | the card's context |"]),
      approve(["| Reuse | Observed | wrapped by observer() |"])];
    const after = S.designSystemReport(p);
    const NAMES = ["Card", "CardAction", "CardFooter", "CardHeader", "CardTitle", "DialogClose", "Form", "FormBoundary", "FormItem", "FormServer", "Generic", "Typed", "Mutable", "Functional", "AsyncArrow", "Bounded", "Bare", "Lazy", "Memo",
      "Styled", "FAQ", "Table", "TableCaption", "Body", "Caption", "Misc", "Real", "AfterComment", "InTemplate", "Panel", "Tile", "Legacy", "LegacyItem", "Extra", "Extra2", "Extra3", "ExtraDefault", "ExtraClass", "ExtraNamed", "Zz", "LongName", "Shared"];
    all("1.35.1: a component file gives every component it exports — a kit's `card.tsx`: Card, CardHeader, CardTitle, CardFooter (one name per file left a design reusing CardHeader \"not in the registry\", 1.35 review 10) — by what each DECLARATION is, never by its name: a function or a class, or a const whose value is a function (an arrow, a generic one, typed `React.FC`), one of React's wrappers (`forwardRef`, `memo`, `lazy`, on the next line too), a `styled` one or another component under a new name (`= DialogPrimitive.Close`, `= FormProvider`) — exported on its declaration (`const`, `let`, `var`), in an `export { … }` list (over lines, a comment inside, under another name: `TableCaption as Caption`) or as the default (`export default function`, `export default class`, `export default Name`, `Body as default`). Never a type, an interface, an enum, a context, an object, a schema, `cva(…)`, any other call (`memoize(…)`, `Factory()`), a JSX element, a lower-case member (`modes.dark`), a hook, a lower-case or ALL_CAPS name, a comparison, a name the list exports but an inner function declares, a re-export (`export { Row } from`, `export *` — on one line or over several, a local function of that name or none), a commented or an indented declaration; a component of a file of its own keeps that file's path, and of two files that export one name the shorter path does; a route segment's special file is a page and gives none; a `.vue` and an Angular `*.component.ts` give their one component, a lower-case .js and a file outside a component folder none. What it misses — a component wrapped by another function — is still a row to add by hand; what it reads too much, knowingly: a line of a template literal that starts at the margin (`InTemplate`) (got " +
      js({ found, verdicts, inSync: after.inSync, routed }) + ")", {
      names: () => js(Object.keys(found).sort()) === js(NAMES.slice().sort()),
      paths: () => found.CardHeader === "card-header.tsx" && found.CardTitle === "card.tsx" && found.DialogClose === "card.tsx" && found.TableCaption === "index.tsx" && found.LegacyItem === "Legacy.js" && found.Shared === "zz.tsx",
      route: () => js(routed.slice().sort()) === js(["Widget", "WidgetPart"]),
      gate: () => js(verdicts) === js(["approved", REFUSED, REFUSED]),
      seeded: () => after.inSync === true && after.missingTotal === 0,
    });
  }

  // --- the exports' bounds: files read, time; a feature's own New component -----------------------------------------------------------------
  {
    const files = (n) => { const out = { "package.json": deps(["react"]) }; for (let i = 0; i < n; i++) { const id = String(i).padStart(3, "0"); out["src/components/gen/c" + id + ".tsx"] = "export function Extra" + id + "() { return null; }\n"; } return out; };
    const overP = project("exp-over", files(501));
    const over = S.designSystemReport(overP), at = S.designSystemReport(project("exp-at", files(500)));
    // (a feature's report says no bound of what the PROJECT report lists)
    const featureLimits = S.designSystemReport(overP, { name: S.createFeature(overP, { name: "Price Tag", tracks: ["ui"], summary: "x" }).slug }).limits;
    const said = ["en", "pt", "es"].map((l) => { const say = i18n.msg(l).cliOutput.dsLimit["component-files"]; return typeof say === "function" ? say(500) : null; });
    // one file gives 50 components at most; an `export {` that never closes is given up after 200 lines, and what follows is read
    const b = project("exp-bounds", { "package.json": deps(["react"]) });
    // (its first ten are exported twice — in a list too: a name counts once)
    write(b, "src/components/ui/many.tsx", "export { " + Array.from({ length: 10 }, (_, i) => "Part0" + i).join(", ") + " };\n" +
      Array.from({ length: 60 }, (_, i) => "export function Part" + String(i).padStart(2, "0") + "() { return null; }").join("\n") + "\n");
    write(b, "src/components/ui/open.tsx", "export {\n" + Array.from({ length: 250 }, (_, i) => "  part" + i + ",").join("\n") + "\nexport function AfterTheList() { return null; }\n");
    const boundedTotal = S.designSystemReport(b).missingTotal;
    S.scaffoldSteeringFile(b, "design-system.md"); // (the report lists its first 50 rows: the seed holds them all)
    const bounded = registry(b).keys;
    // hostile component files, each of lines ONE pattern must give up on (256K characters of them), and a mix
    const h = project("exp-hostile", { "package.json": deps(["react"]) });
    const blank = " ".repeat(1900), wide = " ".repeat(1970), LS = String.fromCharCode(0x2028);
    const hostile = ["export const A" + blank + "y", "export default Foo" + blank + "x", "function" + blank + "(", "export const B: " + "<".repeat(900) + blank, "export const C =" + blank + LS + blank + LS,
      "const D = Aaaa." + "Bbbb.".repeat(300) + blank + "x", "export {" + " a,".repeat(600)];
    // (an `export {` that never closes takes the lines after it, as a list would: the component stands before them)
    write(h, "src/components/ui/hostile.tsx", "export function Survivor() { return null; }\n" + Array.from({ length: 140 }, (_, i) => hostile[i % hostile.length]).join("\n") + "\n");
    // (six files of each: with a pattern that backtracks, ONE costs 0.4 – 0.7 s — a line is read up to 2,000 characters — and
    // the 500 files a scan may read would cost minutes)
    for (let i = 0; i < 6; i++) {
      write(h, "src/components/ui/alias" + i + ".tsx", Array.from({ length: 128 }, () => "const D = Aaaa" + wide + "x").join("\n") + "\n"); // a value that is ALMOST another component's name
      write(h, "src/components/ui/byname" + i + ".tsx", Array.from({ length: 128 }, () => "export default Foo" + wide + "x").join("\n") + "\n"); // …almost a default export by name
    }
    const ms = remeasure(() => { const t0 = Date.now(); const r = S.designSystemReport(h); return [Date.now() - t0, r.missing.map((c) => c.name).join(",")]; }, (s) => s[0] < 1000);
    // a New component a feature's file exports beside the file's own: the finish writes its path
    const f = project("exp-finish", { "package.json": deps(["react"]) });
    write(f, REG, "# DS\n\n| Component | Path | Variants | Notes |\n|---|---|---|---|\n| Button | `src/components/Button.tsx` |  |  |\n");
    const feat = ready(f, ["| Reuse | Button | the action |", "| New | PriceBadge | no listed component shows a price with its currency |"], "src/components/price.tsx",
      "export function Price() { return null; }\nexport const PriceBadge = (props) => null;\n");
    const newOnes = S.designSystemReport(f, { name: feat.slug }).newComponents;
    const fin = S.finishFeature(f, feat.slug, { write: true });
    const row = rd(f, REG).split("\n").filter((l) => /PriceBadge/.test(l));
    all("1.35.1: the first 500 component files are read for what else they export, the shorter path first — past them the PROJECT report says so (`limits`: component-files, in EN / PT / ES) and is never in sync, a feature's report says nothing of it, and with exactly 500 none does; one file gives 50 components at most, and an `export {` that never closes is given up after 200 lines — what follows it is read; files of lines a pattern must give up on (a run of blanks before a stray character — after a name that is almost an alias, almost a default export —, a line a `.` cannot cross, an unclosed `export {`) are read in linear time; and a New component a feature's file exports beside the file's own is registered with that file's path, not a dash (got " +
      js({ over: [over.found.components, over.limits], featureLimits, at: [at.found.components, at.limits], said: said.map((s) => typeof s === "string" && s.includes("500")), bounded: [boundedTotal, bounded.has("part49"), bounded.has("part50"), bounded.has("afterthelist")], ms, newOnes,
        registered: fin.designSystem && fin.designSystem.registered, row }) + ")", {
      over: () => over.found.components === 1001 && js(over.limits) === js([{ code: "component-files", read: 500 }]) && over.truncated === true && over.inSync === false,
      feature: () => js(featureLimits) === js([]),
      at: () => at.found.components === 1000 && at.limits.length === 0,
      said: () => said.every((s) => typeof s === "string" && s.includes("500")) && new Set(said).size === 3,
      perFile: () => boundedTotal === 53 && bounded.has("part49") && !bounded.has("part50"), // Many + its first 50, Open, AfterTheList
      list: () => bounded.has("afterthelist"),
      linear: () => ms[0] < 1000 && ms[1] === "Alias0,Alias1,Alias2,Alias3,Alias4,Alias5,Byname0,Byname1,Byname2,Byname3,Byname4,Byname5,Hostile,Survivor",
      path: () => js(newOnes) === js([{ name: "PriceBadge", path: "src/components/price.tsx", registered: false }]),
      row: () => fin.designSystem && js(fin.designSystem.registered) === js(["PriceBadge"]) && row.length === 1 && row[0].includes("`src/components/price.tsx`") && row[0].includes("_From: " + feat.slug + "_"),
    });
  }

  // --- a registry that ends in a table its reader does not see; a design that uses no component ---------------------------------------------
  {
    const HEAD = "# Design System\n\n## Components\n\n| Component | Path | Variants | Notes |\n|---|---|---|---|\n| Button | `src/components/Button.tsx` | primary |  |\n\n";
    const TABLE = "| Component | Path | Variants | Notes |\n|---|---|---|---|\n| OldCard | `src/components/OldCard.tsx` |  |  |";
    // (the code block is left open, as a snippet pasted by hand: the file's last line is the table's last row)
    const endings = { comment: "<!-- retired\n" + TABLE + " -->\n", fence: "```markdown\n" + TABLE + "\n", plain: "" };
    const LIST = ["| Reuse | Button | the action |", "| New | PriceTag | no listed component shows a price with its currency |"];
    const got = {};
    for (const [k, end] of Object.entries(endings)) {
      const p = project("end-" + k, { "package.json": deps(["react"]) });
      write(p, REG, HEAD + end);
      const feat = ready(p, LIST, "src/components/PriceTag.tsx", "export const PriceTag = () => null;\n");
      // (the finish, then its design-system part asked twice more — the lazy entry spec_finish calls)
      const first = S.finishFeature(p, feat.slug, { write: true }).designSystem;
      const fins = [first ? first.registered : null].concat([1, 2].map(() => E.designSystemFinish(p, feat.slug, { write: true, ready: true }).registered));
      const text = rd(p, REG);
      got[k] = { fins, rows: text.split("\n").filter((l) => /\| PriceTag \|/.test(l)).length, read: registry(p).keys.has("pricetag"), old: registry(p).keys.has("oldcard"), tables: (text.match(/^\| Component \|/gm) || []).length };
    }
    // a design that uses no component, in a project with no registry yet
    const n = project("na", { "package.json": deps(["react"]) });
    const nf = S.createFeature(n, { name: "Price Tag", tracks: ["ui"], summary: "x", size: "m" });
    fs.writeFileSync(path.join(nf.dir, "requirements.md"), REQ);
    fs.writeFileSync(path.join(nf.dir, "design.md"), design("n/a — a nightly job with no screen of its own"));
    approveBefore(n, nf.slug, "design");
    const check = (S.specDoctor(n, nf.slug).checks || []).find((c) => c.id === "ui-design-system");
    const approved = S.approvePhase(n, nf.slug, "design", "t").ok;
    fs.writeFileSync(path.join(nf.dir, "design.md"), design(rows(["| Reuse | Button | the action |"])));
    const rowsCheck = (S.specDoctor(n, nf.slug).checks || []).find((c) => c.id === "ui-design-system");
    all("1.35.1: a registry that ends in a table its reader does not see — commented out, the `-->` on its last row, or inside a code block — takes a finish's rows in a NEW table after it: appended to the hidden one they were read by nothing, the finish said \"added\" and every later finish added them again (1.35 review 10); a registry that ends in its component table still takes them there. And a design whose Design System Usage says `n/a — <why>` passes with no registry at all: it was told to create one, though it uses no component — one that names components is still told (got " +
      js({ got, na: check && [check.status, check.detail], approved, rows: rowsCheck && [rowsCheck.status, rowsCheck.detail.slice(0, 40)] }) + ")", {
      once: () => ["comment", "fence", "plain"].every((k) => js(got[k].fins) === js([["PriceTag"], [], []]) && got[k].rows === 1 && got[k].read === true),
      hidden: () => got.comment.old === false && got.fence.old === false && got.comment.tables === 3 && got.fence.tables === 3,
      plain: () => got.plain.tables === 1,
      na: () => !!check && check.status === "pass" && /says n\/a/.test(check.detail) && approved === true,
      rows: () => !!rowsCheck && rowsCheck.status === "warn" && /^no design-system registry yet/.test(rowsCheck.detail),
    });
  }
};
