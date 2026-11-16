"use strict";
// The design-system registry — 1.35.1: what 1.35 left as known limits. The project's dependencies are its root package.json
// AND its workspace packages' (a monorepo's library sits in `apps/web/package.json`); a component file gives every component it
// exports (a kit's `card.tsx`: Card, CardHeader, CardTitle…), by what each declaration IS; a registry that ends in a
// commented-out table takes a finish's rows where its reader sees them; a design that uses no component is not told to create a
// registry. And its first review's findings: a bound counts the manifests READ, a declaration's `=` is the one that ends its
// annotation, an alias is of a name the file imports.

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
  const BOM = String.fromCharCode(0xfeff);
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
  // a feature approved through its tasks, its one task done: ready to finish (it implements `implement`; its files: `files`)
  const ready = (p, list, implement, files) => {
    const f = S.createFeature(p, { name: "Price Tag", tracks: ["ui"], summary: "Show a price" });
    fs.writeFileSync(path.join(f.dir, "requirements.md"), REQ);
    fs.writeFileSync(path.join(f.dir, "design.md"), design(rows(list)));
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Build the price tag\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n  - _Implements: " + implement + "_\n  - _Verify: npm test_\n");
    for (const [rel, text] of Object.entries(files)) write(p, rel, text);
    approveBefore(p, f.slug, "requirements");
    for (const ph of ["requirements", "design", "tasks"]) S.approvePhase(p, f.slug, ph, "t");
    S.completeTask(p, f.slug, 1, { command: "npm test", exitCode: 0, summary: "42/42 passing" });
    return f;
  };
  const REFUSED = "refused:ui-design-system";
  // is the short name `antd` (of `_Libraries: antd 5_`) backed by a package of the project, and does the scan name the library?
  const backed = (p) => { write(p, REG, "# DS\n\n" + CARD + "_Libraries: antd 5_\n"); return !registry(p).weakLibraries.has("antd") + ":" + js(S.designSystemReport(p).found.libraries); };
  const yes = "true:" + js(["antd"]), no = "false:" + js([]);

  // --- the project's dependencies: the root manifest and its workspaces' -----------------------------------------------------------------
  {
    const WEB = { "apps/web/package.json": deps(["antd", "react"]) };
    const ROOT = { "package.json": js({ private: true }) };
    const layouts = {
      root: { "package.json": deps(["antd"]) },
      npm: Object.assign({ "package.json": js({ private: true, workspaces: ["apps/*", "packages/*"] }) }, WEB),
      yarn: Object.assign({ "package.json": js({ private: true, workspaces: { packages: ["apps/*"] } }) }, WEB),
      backslash: Object.assign({ "package.json": js({ private: true, workspaces: ["apps\\web"] }) }, WEB), // written on Windows
      pnpm: Object.assign({ "pnpm-workspace.yaml": "packages:\n  # the libraries\n  - \"packages/*\"\n\n  - 'apps/*' # each app\n\ncatalog:\n  react: ^19\n" }, ROOT, WEB),
      pnpmFlow: Object.assign({ "pnpm-workspace.yaml": "packages: [packages/*, 'apps/*'] # one line\n" }, WEB),
      pnpmFlowLines: Object.assign({ "pnpm-workspace.yaml": "packages: [\n  'packages/*', # the libraries\n# the apps\n  \"apps/*\",\n]\ncatalog:\n  react: ^19\n" }, ROOT, WEB),
      pnpmBom: Object.assign({ "pnpm-workspace.yaml": BOM + "packages:\n  - 'apps/*'\n" }, ROOT, WEB),
      pnpmQuoted: Object.assign({ "pnpm-workspace.yaml": "\"packages\":\n  - apps/*\n" }, ROOT, WEB),
      lerna: { "lerna.json": js({ packages: ["modules/*"] }), "modules/web/package.json": deps(["antd"]) },
      lernaDefault: { "lerna.json": js({ version: "1.0.0" }), "packages/web/package.json": deps(["antd"]) }, // Lerna's own default: packages/*
      undeclared: { "manage.py": "print(1)\n", "frontend/package.json": deps(["antd"]) },
      tooling: { "package.json": js({ private: true, devDependencies: { concurrently: "1.0.0" } }), "client/package.json": deps(["antd"]), "server/package.json": deps(["express"]) },
      emptyDeps: { "package.json": js({ private: true, dependencies: {} }), "client/package.json": deps(["antd"]) }, // no dependency of its own
      none: { "manage.py": "print(1)\n" },
      deeper: { "services/web/package.json": deps(["antd"]) }, // two levels below an undeclared root: looked for since 1.35.3 (15-quality-design-system-usage.js)
      ownRoot: { "package.json": deps(["react", "vite"]), "docs/package.json": deps(["antd"]) }, // the root is the app: its docs site's kit is not its own
      pnpmAfter: Object.assign({ "pnpm-workspace.yaml": "packages:\n  - 'packages/*'\nonlyBuiltDependencies:\n  - 'apps/*'\n" }, ROOT, WEB),
      pnpmNested: Object.assign({ "pnpm-workspace.yaml": "overrides:\n  packages:\n    - 'apps/*'\n" }, ROOT, WEB), // the key at the margin only
      pnpmOpen: Object.assign({ "pnpm-workspace.yaml": "packages: [\n  'apps/*',\n" }, ROOT, WEB), // a flow list that never closes names none
      elsewhere: { "package.json": js({ private: true, workspaces: ["packages/*"] }), "legacy/package.json": deps(["antd"]) }, // declared: only what is declared
      pnpmOther: Object.assign({ "pnpm-workspace.yaml": "catalog:\n  - 'apps/*'\npackagesExtra:\n  - 'apps/*'\n" }, ROOT, WEB),
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
    all("1.35.1: the project's dependencies are its root package.json AND its workspace packages' — the folders it DECLARES: package.json `workspaces` (an array, or Yarn's `{packages}`; a `\\` is a separator), pnpm-workspace.yaml's `packages` (a block list with quotes, comments and blank lines, a flow list on its line or over several, the key quoted, a BOM), lerna.json's `packages` (or Lerna's default, `packages/*`) — or, when it declares none, the folders one level down (two since 1.35.3): `frontend/package.json` beside a Django app, `client/` beside a root that only holds tooling. With the root manifest alone a monorepo's `antd 5` + `antd Table` was refused at size m though `apps/web` depends on antd, and its seed declared no library (1.35 review 10). Never a folder beside declared ones, never below a root that is a package of its own with dependencies (an app's `docs/` site keeps another kit), never another key of the YAML file, a nested one, the list of the key after `packages` nor a flow list that never closes (got " +
      js({ got, gate, seeded }) + ")", {
      declared: () => ["root", "npm", "yarn", "backslash", "pnpm", "pnpmFlow", "pnpmFlowLines", "pnpmBom", "pnpmQuoted", "lerna", "lernaDefault"].every((k) => got[k] === yes),
      undeclared: () => got.undeclared === yes && got.tooling === yes && got.emptyDeps === yes && got.deeper === yes,
      none: () => ["none", "ownRoot", "elsewhere", "pnpmOther", "pnpmAfter", "pnpmNested", "pnpmOpen"].every((k) => got[k] === no),
      gate: () => js(gate) === js(["approved", REFUSED, "approved"]),
      seeded: () => js(seeded) === js([true, true]),
    });
  }

  // --- a workspace pattern: what it names, what it never reaches, its bounds -----------------------------------------------------------------
  {
    const ws = (patterns, files) => Object.assign({ "package.json": js({ private: true, workspaces: patterns }) }, files);
    const ANTD = deps(["antd"]);
    const WEB = { "apps/web/package.json": ANTD };
    // a real `packages/**`: each package holds folders that are no packages — they cost nothing of the manifests' bound
    const tree = (n) => { const files = { "packages/web/package.json": ANTD }; for (let i = 0; i < n; i++) for (const d of ["package.json", "src/a.ts", "dist/a.js", "test/a.ts", "docs/a.md"]) files["packages/pkg-" + String(i).padStart(2, "0") + "/" + d] = d === "package.json" ? deps(["left-pad"]) : "x\n"; return files; };
    const empties = (n) => { const files = { "manage.py": "print(1)\n", "frontend/package.json": ANTD }; for (let i = 0; i < n; i++) files["app" + String(i).padStart(3, "0") + "/README.md"] = "x\n"; return files; };
    const cases = {
      twoLevels: ws(["packages/**"], { "packages/group/ui/package.json": ANTD }),
      itself: ws(["packages/**"], { "packages/package.json": ANTD }),
      wildcard: ws(["packages/ui-*"], { "packages/ui-kit/package.json": ANTD }),
      suffix: ws(["packages/*-kit"], { "packages/ui-kit/package.json": ANTD }),
      twoStars: ws(["packages/*-ui-*"], { "packages/acme-ui-kit/package.json": ANTD }),
      exact: ws(["tools/cli"], { "tools/cli/package.json": ANTD }),
      dotSlash: ws(["./apps/*/"], WEB),
      beside: ws(["!apps/old", "{apps,libs}/*", "x".repeat(300), "apps/*"], WEB), // the patterns it cannot read name none — the others still do
      realTree: ws(["packages/**"], tree(30)), // 30 packages × 4 folders: counted by folders named, the 100 were spent before `web`
      order: ws(["packages/**", "apps/*"], Object.assign(tree(30), WEB, { "packages/web/package.json": deps(["left-pad"]) })), // …and the pattern after it is still followed
      manyFolders: empties(120), // an undeclared root of 120 folders that are no packages, and one that is
    };
    const never = {
      threeLevels: ws(["packages/**"], { "packages/a/b/c/package.json": ANTD }),
      otherName: ws(["packages/ui-*"], { "packages/core/package.json": ANTD }),
      before: ws(["packages/ui-*"], { "packages/my-ui-kit/package.json": ANTD }), // the pattern is the WHOLE name
      after: ws(["packages/*-kit"], { "packages/ui-kit-old/package.json": ANTD }),
      dotted: ws(["apps/w.b*"], WEB), // a `.` is a dot
      negation: ws(["!apps/web"], WEB),
      braces: ws(["{apps}/*"], WEB), // (a brace list of ONE names none; a real list is expanded since 1.35.2)
      threeStars: ws(["apps/*w*e*"], WEB), // two `*` a segment at most
      tooLong: ws(["./".repeat(150) + "apps/*"], WEB), // 306 characters: a pattern is 200 at most…
      tooDeep: ws([Array(13).fill("**").join("/")], WEB), // …and 12 segments
      hidden: ws(["apps/*"], { "apps/.cache/package.json": ANTD, "apps/node_modules/package.json": ANTD }),
      hiddenUndeclared: { ".cache/package.json": ANTD, "node_modules/package.json": ANTD },
      outside: ws(["../proj-dsw-outside/*", "/proj-dsw-outside/*", "apps/../../proj-dsw-outside/*"], {}),
    };
    write(tmp, "proj-dsw-outside/pkg/package.json", ANTD);
    const got = {}, not = {};
    for (const [k, files] of Object.entries(cases)) got[k] = backed(project("pat-" + k, files));
    for (const [k, files] of Object.entries(never)) not[k] = backed(project("not-" + k, files));
    // a workspace folder that is a link to a folder outside the project is never read — by a `*` nor by its own name —, nor a
    // workspace's package.json that is a link out of it
    const linked = project("pat-link", ws(["apps/*", "apps/linked"], {}));
    fs.mkdirSync(path.join(linked, "apps"), { recursive: true });
    let link = false, fileLink = false;
    try { fs.symlinkSync(path.join(tmp, "proj-dsw-outside", "pkg"), path.join(linked, "apps", "linked"), "junction"); link = true; } catch { /* no link support here */ }
    const viaLink = link ? backed(linked) : null;
    const manifest = project("pat-file-link", ws(["apps/*"], { "apps/web/README.md": "x\n" }));
    try { fs.symlinkSync(path.join(tmp, "proj-dsw-outside", "pkg", "package.json"), path.join(manifest, "apps", "web", "package.json"), "file"); fileLink = true; } catch { /* no symlink privilege here */ }
    const viaFileLink = fileLink ? backed(manifest) : null;
    // the bounds: DS_WORKSPACE_MANIFESTS (100) workspace manifests READ, by name — the 101st is not, and the report says so
    const many = (n, at) => { const files = {}; for (let i = 0; i < n; i++) files["packages/p" + String(i).padStart(3, "0") + "/package.json"] = i === at ? ANTD : deps(["left-pad"]); return ws(["packages/*"], files); };
    const inP = project("pat-many-in", many(105, 99)), outP = project("pat-many-out", many(105, 100)), atP = project("pat-many-at", Object.assign(many(100, 99), { "packages/zz-notes/README.md": "x\n" }));
    const bound = [backed(inP), backed(outP), backed(atP)];
    const cut = [S.designSystemReport(outP), S.designSystemReport(atP)].map((r) => js(r.limits) + ":" + r.inSync);
    // …DS_WORKSPACE_PATTERNS (50) patterns — the 51st is not followed —, DS_WORKSPACE_DIRS (200) folders listed: `groups/*/*`
    // lists `groups/` and then one folder a group, by name — the 200th group is not looked into
    const fillers = (n) => Array.from({ length: n }, (_, i) => "none-" + i + "/*");
    const groups = (at) => { const files = {}; for (let i = 0; i < 205; i++) files["groups/g" + String(i).padStart(3, "0") + (i === at ? "/ui/package.json" : "/README.md")] = i === at ? ANTD : "x\n"; return ws(["groups/*/*"], files); };
    const caps = [backed(project("pat-pats-in", ws(fillers(49).concat(["apps/*"]), WEB))), backed(project("pat-pats-out", ws(fillers(50).concat(["apps/*"]), WEB))),
      backed(project("pat-dirs-in", groups(198))), backed(project("pat-dirs-out", groups(199)))];
    // …and DS_WORKSPACE_ASKED (2,000) folders asked: three folders (3 asked) of 900 empty ones — `c/d196` is the 2,000th
    // asked, `c/d197` is not
    const wide = (tag, at) => {
      const p = project(tag, ws(["a/*", "b/*", "c/*"], { ["c/d" + at + "/package.json"]: ANTD }));
      for (const d of ["a", "b", "c"]) for (let i = 0; i < 900; i++) fs.mkdirSync(path.join(p, d, "d" + String(i).padStart(3, "0")), { recursive: true });
      return p;
    };
    const asked = [backed(wide("pat-asked-in", 196)), backed(wide("pat-asked-out", 197))];
    const said = ["en", "pt", "es"].map((l) => { const say = i18n.msg(l).cliOutput.dsLimit["workspace-manifests"]; return typeof say === "function" ? say(100) : null; });
    all("1.35.1: a workspace pattern is followed folder by folder — a name (`tools/cli`), a `*` within one (`apps/*`, `packages/ui-*`, `packages/*-kit`, `*-ui-*`: the whole name, a `.` being a dot), `**` (that folder and two levels below it), a leading `./` and a trailing `/` aside; a `!negation`, a brace list of one (`{apps}/*`), a segment of more than two `*`, a pattern of more than 200 characters or 12 segments and a path that leaves the project (`../x/*`, an absolute one) name NONE — and throw nothing: the patterns beside them are still followed; a dot folder, node_modules and a folder reached through a link (a `*` match or its own name) are never read, nor a package.json that is a link out of the project. Bounded by what is READ — the first 100 manifests by name: a folder that is no package costs none of them (review 1: counted by folders named, `packages/**` over 20 packages spent the hundred on their `src/` and `dist/`, and 120 folders hid the one app), and the report says a bound that cut (`limits`: workspace-manifests, in EN / PT / ES; never in sync) —, 50 patterns, 200 folders listed, 2,000 asked, the names read so far standing (got " +
      js({ got, not, viaLink, viaFileLink, bound, cut, caps, asked, said: said.map((s) => typeof s === "string" && s.includes("100")) }) + ")", {
      names: () => Object.values(got).every((v) => v === yes),
      never: () => Object.values(not).every((v) => v === no),
      link: () => viaLink == null || viaLink === no,
      fileLink: () => viaFileLink == null || viaFileLink === no,
      bound: () => js(bound) === js([yes, no, yes]),
      cut: () => js(cut) === js([js([{ code: "workspace-manifests", read: 100 }]) + ":false", "[]:true"]),
      caps: () => js(caps) === js([yes, no, yes, no]),
      asked: () => js(asked) === js([yes, no]),
      said: () => said.every((s) => typeof s === "string" && s.includes("100")) && new Set(said).size === 3,
    });
  }

  // --- what else a component file exports -----------------------------------------------------------------------------------------------------
  {
    const p = project("exports", { "package.json": deps(["react"]) });
    write(p, "src/components/ui/card.tsx", ["\"use client\";", "import * as React from \"react\";", "import * as DialogPrimitive from \"@radix-ui/react-dialog\";", "import {", "  Slot,", "  type SlotProps,", "} from \"@radix-ui/react-slot\";", "",
      "enum LoginStep { Credentials }", "const Card =", "  React.forwardRef<HTMLDivElement, P>((props, ref) => <div ref={ref} />);", "Card.displayName = \"Card\";",
      "const CardHeader = React.forwardRef<HTMLDivElement, P>((props, ref) => <div ref={ref} />);", "const CardTitle = (props: P) => <h3 {...props} />;", "function CardFooter(props: P) {", "  const Inner = () => null;", "  return <div />;", "}",
      "const CardContext = React.createContext<null>(null);", "const cardVariants = cva(\"rounded\");", "type CardProps = { wide?: boolean };", "const DialogClose = DialogPrimitive.Close;", "const CardSlot = Slot;", "const CardHeading = CardTitle;", "const SlotName = Slot.displayName;",
      "const Step = LoginStep.Credentials;", "const CardAction =", "  React.forwardRef<HTMLButtonElement, P>((props, ref) => <button ref={ref} />);",
      "", "export {", "  Card,", "  CardHeader, // the header", "  CardTitle,", "  CardFooter,", "  CardContext,", "  cardVariants,", "  type CardProps,", "  DialogClose,", "  CardSlot,", "  CardHeading,", "  SlotName,", "  Step,", "  CardAction,", "  Inner,", "}", ""].join("\n"));
    write(p, "src/components/ui/card-header.tsx", "export function CardHeader() { return null; }\n");
    write(p, "src/components/ui/form.tsx", ["import { FormProvider } from \"react-hook-form\";", "export const Form = FormProvider;", "export function FormItem() { return null; }", "export const useFormField = () => ({});",
      "export const FormSchema = z.object({});", "export const Sizes = { sm: 1 };", "export const Styled = styled.div`color: red;`;", "export const Memo = React.memo(Inner);", "export const Lazy = lazy(() => import(\"./x\"));",
      "export type FormProps = {};", "export interface FormState {}", "export enum FormMode { A }", "export class FormBoundary extends React.Component {}", "export class PureBox extends PureComponent {}", "export class Plain<P> extends Component<P> {}", "export async function FormServer() { return null; }",
      "export const Generic = <T,>(props: P<T>) => null;", "export const Typed: React.FC<P> = (props) => null;", "export const Observed = observer(() => null);", "export const ICON_SIZE = 16;",
      "export const Icons = { logo: () => null };", "export const Memoized = memoize(() => 1);", "export const Shown = isShown === true;", "function Inner() { return null; }", "export default FormItem;",
      "export let Mutable = () => null;", "export var Functional = function () { return null; };", "export const AsyncArrow = async (props) => null;", "export const Bounded = <T extends object>(props: P<T>) => null;",
      "export const Bare = props => null;", "export const Returns = (props: P): JSX.Element => null;", "export const Handler: (props: P) => JSX.Element = (props) => null;", "export const Styledish = styledThing(1);", "export const Defaulted: Record<\"a=b\", string> = (props) => null;", "export const Logo = <svg />;", "export const Mode = modes.dark;", "export const Call = Factory();", "export function FAQ() { return null; }",
      // what review 1 found listed: a constant, a calculation, a choice, an error, a schema or a cache behind a wrapper's name
      "export const Timeout = Infinity;", "export const MaxAttempts = Number.MAX_SAFE_INTEGER;", "export const Total = (1 + 2) * 3;", "export const Picked = (isShown ? FormItem : Inner);", "export class LoginError extends Error {}",
      "export const TreeSchema = z.lazy(() => 1);", "export const Cached = cache.memo(load);", "export const Functionalish = functional(1);", "export const Asyncish = asyncThing(1);", "export function Card_Old() { return null; }",
      "export const Iife = (function () { return 1; })();", "export const Nested = (((props) => null)) as React.FC;",
      // …and what its tighter rules must keep: an arrow in parentheses that is cast, a context's provider
      "export const CastArrow = ((props) => null) as React.FC;", "export const ThemeProvider = ThemeContext.Provider;",
      "export function Botão() { return null; }", ""].join("\n"));
    // a declaration whose `=` is not the first of its line, or not on its line at all (review 1: shadcn's FormField, a typed arrow)
    write(p, "src/components/ui/fields.tsx", ["import * as React from \"react\";", "const FormField = <", "  TFieldValues extends FieldValues = FieldValues,", "  TName extends string = string", ">({", "  ...props",
      "}: ControllerProps<TFieldValues, TName>) => {", "  return null;", "};", "export const ConfirmDialog: React.FC<{ open: boolean; onConfirm: () => void }> = ({ open }) => null;",
      "export const ConfirmBody: React.FC<{", "  title: string;", "  onDone: () => void;", "}> = ({ title }) => null;", "export const ConstGeneric = <const T,>(props: P<T>) => null;",
      "const ThirdLine =", "// one", "", "  React.forwardRef(() => null);", "const FourthLine =", "// one", "", "// two", "  React.forwardRef(() => null);", "export declare const Ambient: React.FC;", "let Pending: React.FC", "const AfterPending = () => null;", "export const Wrapped = ({", "  title,", "}: Props) => null;",
      "async function AsyncDecl() { return null; }", "let LetDecl = () => null;", "var VarDecl = () => null;", "function ListA() { return null; }", "function ListB() { return null; }",
      "export {", "  ListA, // } not the end", "  ListB,", "};", "export { FormField, ThirdLine, FourthLine, AsyncDecl, LetDecl, VarDecl, Pending, AfterPending };",
      // an annotation that goes on over 50 lines is followed to its `=` — over 70, it is not (60 lines)
      "export const Large: React.FC<{"].concat(Array.from({ length: 50 }, (_, i) => "  a" + i + ": string;"), ["}> = () => null;", "export const Huge: React.FC<{"], Array.from({ length: 70 }, (_, i) => "  b" + i + ": string;"), ["}> = () => null;", ""]).join("\n"));
    write(p, "src/components/table/index.tsx", ["export { Row } from \"./row\";", "export * from \"./cell\";", "export function TableCaption() { return null; }", "export {", "  Head,", "} from \"./head\";", "function Head() { return null; }",
      "function Row() { return null; }", "function Body() { return null; }", "export { Body as default, TableCaption as Caption };", ""].join("\n"));
    write(p, "src/components/ui/extra.tsx", "export default function ExtraDefault() { return null; }\n");
    write(p, "src/components/ui/extra2.tsx", "export default class ExtraClass extends React.Component {}\n");
    write(p, "src/components/ui/extra3.tsx", "function ExtraNamed() { return null; }\nexport default ExtraNamed; // the default\n");
    // two files export the same name: the shorter path keeps it — `zz.tsx`, though `aa/long-name.tsx` comes first by name; and
    // `zz/sm.tsx`, though the walk meets `aaa-long-name.tsx` first
    write(p, "src/components/ui/zz.tsx", "export function Shared() { return null; }\n");
    write(p, "src/components/ui/aa/long-name.tsx", "export function Shared() { return null; }\n");
    write(p, "src/components/ui/aaa-long-name.tsx", "export function Shared2() { return null; }\n");
    write(p, "src/components/ui/zz/sm.tsx", "export function Shared2() { return null; }\n");
    write(p, "src/components/ui/misc.tsx", ["// export function Commented() { return null; }", "/*", "export function InBlock() { return null; }", "*/", "  export function Indented() { return null; }",
      "export function Real() { return null; } /* export function Trailing() {} */", "/* legacy */export function AfterComment() { return null; }", "const text = `", "export function InTemplate() {}", "`;", "export default function Misc() { return null; }", ""].join("\n"));
    // what must not hide the rest of a file: a BOM before its first declaration, `<!--` or ` /*` inside a string
    write(p, "src/components/ui/bom.tsx", BOM + "export function BomFirst() { return null; }\n");
    write(p, "src/components/ui/strings.tsx", "const OPEN = \"<!--[if mso]>\";\nconst GLOB = \"src /* not a comment\";\nexport function AfterStrings() { return null; }\n");
    write(p, "src/components/ui/panel.vue", "<script setup>\nexport const VueOther = () => null;\n</script>\n<template><div /></template>\n");
    write(p, "src/components/ui/tile.component.ts", "export class TileComponent {}\nexport class OtherThing {}\n");
    write(p, "src/components/Legacy.js", "export function LegacyItem() { return null; }\nexport default function Legacy() { return null; }\n");
    write(p, "src/components/Gadget.jsx", "export function GadgetPart() { return null; }\n");
    write(p, "src/components/Esm.mjs", "export function EsmPart() { return null; }\n");
    write(p, "src/components/helper.js", "export function Hidden() { return null; }\n");
    write(p, "src/lib/outside.tsx", "export function NotInAComponentFolder() { return null; }\n");
    // a route segment's special file is a page: what it exports is not read (the files beside it are components)
    const next = project("exports-next", { "package.json": deps(["next", "react"]), "app/layout.tsx": "export default function Layout() { return null; }\n",
      "app/components/page.tsx": "export default function Page() { return null; }\nexport function Hero() { return null; }\n", "app/components/widget.tsx": "export function Widget() { return null; }\nexport function WidgetPart() { return null; }\n" });
    const routed = S.designSystemReport(next).missing.map((c) => c.name);
    const total = S.designSystemReport(p).missingTotal;
    S.scaffoldSteeringFile(p, "design-system.md"); // (the report lists its first 50 rows: the seed holds them all)
    const found = Object.fromEntries(registry(p).components.map((c) => [c.name, c.path.split("/").pop()]));
    const approve = sized(p);
    const verdicts = [approve(["| Reuse | CardHeader, CardTitle, CardFooter | the card's parts |", "| Reuse | FormItem · DialogClose · FormField | the form |"]), approve(["| Reuse | CardContext | the card's context |"]),
      approve(["| Reuse | Observed | wrapped by observer() |"]), approve(["| Reuse | Timeout | no component |"])];
    const after = S.designSystemReport(p);
    const NAMES = ["Card", "CardAction", "CardFooter", "CardHeader", "CardTitle", "DialogClose", "CardSlot", "Form", "FormBoundary", "FormItem", "FormServer", "Generic", "Typed", "Mutable", "Functional", "AsyncArrow", "Bounded", "Bare",
      "Lazy", "Memo", "Styled", "FAQ", "Botão", "CastArrow", "ThemeProvider", "CardHeading", "PureBox", "Plain", "Returns", "Handler", "Defaulted", "AfterPending", "Wrapped", "Large", "Fields", "FormField", "ConfirmDialog", "ConfirmBody", "ConstGeneric", "ThirdLine", "AsyncDecl", "LetDecl", "VarDecl", "ListA", "ListB", "Table", "TableCaption", "Body", "Caption", "Misc", "Real",
      "AfterComment", "Indented", "Bom", "BomFirst", "Strings", "AfterStrings", "Panel", "Tile", "Legacy", "LegacyItem", "Gadget", "GadgetPart", "Esm", "EsmPart", "Extra", "Extra2", "Extra3", "ExtraDefault", "ExtraClass", "ExtraNamed",
      "Zz", "LongName", "Shared", "AaaLongName", "Sm", "Shared2"];
    all("1.35.1: a component file gives every component it exports — a kit's `card.tsx`: Card, CardHeader, CardTitle, CardFooter (one name per file left a design reusing CardHeader \"not in the registry\", 1.35 review 10) — by what each DECLARATION is, never by its name: a function, a class that extends React's Component, or a const whose value is a function (an arrow, `async`, a generic one — `<T,>`, `<const T,>`, its `<` alone at the line's end: shadcn's FormField —, typed `React.FC`), one of React's wrappers (`forwardRef`, `memo`, `lazy` — with `React.` or bare; on a line below, a comment between), a `styled` one, or another component under a new name: a name the file imports or declares (`= DialogPrimitive.Close`, `= FormProvider`, `= Slot` of an import over lines). Its `=` is the one that ends its annotation — `React.FC<{ onConfirm: () => void }> = …`, on a later line too. Exported on its declaration (`const`, `let`, `var`), in an `export { … }` list (over lines, a comment inside — a `}` in it too —, under another name: `TableCaption as Caption`) or as the default (`export default function`, `class`, `Name`, `Body as default`); in a .tsx, a .jsx, a .js and a .mjs. Never a type, an interface, an enum, an ambient declaration, a context, an object, a schema, `cva(…)`, any other call (`memoize(…)`, `Factory()`, `functional(…)`, `z.lazy(…)`, `cache.memo(…)`), a JSX element, a calculation or a choice in parentheses, a global (`Infinity`, `Number.MAX_SAFE_INTEGER`), a local enum's member, a class that extends anything else (`LoginError`), a hook, a lower-case or ALL_CAPS name or one with a `_`, a comparison, a name an inner function declares, a re-export (`export { Row } from`, `export *` — on one line or over several, a local function of that name or none), a commented declaration, a line of a template literal (1.35.2: a code sample is text), a value four lines below its `=` — an indented `export` IS read (1.35.2). A name is read whole (`Botão`). A BOM, a `<!--` or a ` /*` inside a string hide nothing. A component of a file of its own keeps that file's path, and of two files that export one name the shorter path does; a route segment's special file is a page and gives none; a `.vue` and an Angular `*.component.ts` give their one component, a lower-case .js and a file outside a component folder none. What it misses — a component wrapped by another function — is still a row to add by hand; what it reads too much, knowingly: a line of a template literal that starts at the margin (`InTemplate`) (got " +
      js({ total, found, verdicts, inSync: after.inSync, routed }) + ")", {
      names: () => js(Object.keys(found).sort()) === js(NAMES.slice().sort()) && total === NAMES.length,
      paths: () => found.CardHeader === "card-header.tsx" && found.CardTitle === "card.tsx" && found.DialogClose === "card.tsx" && found.TableCaption === "index.tsx" && found.LegacyItem === "Legacy.js" && found.Shared === "zz.tsx" &&
        found.Shared2 === "sm.tsx" && found.FormField === "fields.tsx",
      route: () => js(routed.slice().sort()) === js(["Widget", "WidgetPart"]),
      gate: () => js(verdicts) === js(["approved", REFUSED, REFUSED, REFUSED]),
      seeded: () => after.inSync === true && after.missingTotal === 0,
    });
  }

  // --- the exports' bounds: files and characters read, names a file, time; a feature's own New component ---------------------------------
  {
    const small = (n) => { const out = { "package.json": deps(["react"]) }; for (let i = 0; i < n; i++) { const id = String(i).padStart(4, "0"); out["src/components/gen/c" + id + ".tsx"] = "export function Extra" + id + "() { return null; }\n"; } return out; };
    const overP = project("exp-over", small(1001));
    const over = S.designSystemReport(overP), at = S.designSystemReport(project("exp-at", small(1000)));
    // (a feature's report says no bound of what the PROJECT report lists)
    const featureLimits = S.designSystemReport(overP, { name: S.createFeature(overP, { name: "Price Tag", tracks: ["ui"], summary: "x" }).slug }).limits;
    // …and 4 MB of them: 17 files of a read's length (256K) — the 17th is not read
    const FILL = "\n" + ("// " + "x".repeat(124) + "\n").repeat(2100); // 268,800 characters: past a file's read
    const big = (n) => { const out = { "package.json": deps(["react"]) }; for (let i = 0; i < n; i++) { const id = String(i).padStart(2, "0"); out["src/components/gen/b" + id + ".tsx"] = "export function Big" + id + "() { return null; }" + FILL; } return out; };
    const heavy = [S.designSystemReport(project("exp-chars-over", big(17))), S.designSystemReport(project("exp-chars-at", big(16)))].map((r) => r.found.components + ":" + js(r.limits));
    const said = ["en", "pt", "es"].map((l) => { const say = i18n.msg(l).cliOutput.dsLimit["component-files"]; return typeof say === "function" ? say(1000) : null; });
    // one file gives 500 components at most — the report says so —; an `export {` that never closes is given up after 200
    // lines, and what follows is read
    const b = project("exp-bounds", { "package.json": deps(["react"]) });
    // (its first ten are exported twice — in a list too: a name counts once)
    write(b, "src/components/ui/many.tsx", "export { " + Array.from({ length: 10 }, (_, i) => "Part00" + i).join(", ") + " };\n" +
      Array.from({ length: 510 }, (_, i) => "export function Part" + String(i).padStart(3, "0") + "() { return null; }").join("\n") + "\n");
    write(b, "src/components/ui/open.tsx", "export {\n" + Array.from({ length: 250 }, (_, i) => "  part" + i + ",").join("\n") + "\nexport function AfterTheList() { return null; }\n");
    const boundedRep = S.designSystemReport(b);
    const bounded = new Set(boundedRep.missing.map((c) => c.name));
    const b2 = project("exp-bounds-at", { "package.json": deps(["react"]) });
    write(b2, "src/components/ui/many.tsx", Array.from({ length: 500 }, (_, i) => "export function Part" + String(i).padStart(3, "0") + "() { return null; }").join("\n") + "\n");
    const exact = S.designSystemReport(b2);
    // hostile component files, each of lines ONE pattern must give up on (256K characters of them), and a mix
    const h = project("exp-hostile", { "package.json": deps(["react"]) });
    const blank = " ".repeat(1900), wide = " ".repeat(1970), LS = String.fromCharCode(0x2028);
    const hostile = ["export const A" + blank + "y", "export default Foo" + blank + "x", "function" + blank + "(", "export const B: " + "<".repeat(900) + blank, "export const C =" + blank + LS + blank + LS,
      "const D = Aaaa." + "Bbbb.".repeat(300) + blank + "x", "class E" + blank + "x", "import" + blank + "x"];
    // (an `export {` that never closes takes the lines after it, as a list would: the component stands before them)
    // Its calm twin `hc`: the SAME files, each hostile line a plain one as long (a `//` comment: no pattern has anything to give
    // up on in it), scanned at the same moment — a ratio holds on a loaded machine where a time does not (1.35.4 review 2: the
    // absolute 1 s it replaces; a pattern that backtracks costs seconds)
    const hc = project("exp-hostile-calm", { "package.json": deps(["react"]) });
    const plain = (l) => (l.length < 16 ? "q".repeat(l.length) : "const q = 1; // " + "x".repeat(l.length - 16));
    const both = (rel, head, lines) => { write(h, rel, head + lines.join("\n") + "\n"); write(hc, rel, head + lines.map(plain).join("\n") + "\n"); };
    both("src/components/ui/hostile.tsx", "export function Survivor() { return null; }\n", Array.from({ length: 140 }, (_, i) => hostile[i % hostile.length]).concat(["export {" + " a,".repeat(600)]));
    // (six files of each: with a pattern that backtracks, ONE costs 0.4 – 0.7 s — a line is read up to 2,000 characters — and
    // the files a scan may read would cost minutes)
    for (let i = 0; i < 6; i++) {
      both("src/components/ui/alias" + i + ".tsx", "import Aaaa from \"x\";\n", Array.from({ length: 128 }, () => "const D = Aaaa" + wide + "x")); // a value that is ALMOST another component's name
      both("src/components/ui/byname" + i + ".tsx", "", Array.from({ length: 128 }, () => "export default Foo" + wide + "x")); // …almost a default export by name
    }
    const linear = (s) => s[0] < 3 * s[2] + 300;
    const ms = remeasure(() => { const t0 = Date.now(); const r = S.designSystemReport(h); const t1 = Date.now(); S.designSystemReport(hc); return [t1 - t0, r.missing.map((c) => c.name).join(","), Date.now() - t1]; }, linear);
    // a New component a feature's file exports beside the file's own: the finish writes its path — its OWN file when it has
    // one, and no path for a file outside a component folder (the scan would never find it there)
    const f = project("exp-finish", { "package.json": deps(["react"]) });
    write(f, REG, "# DS\n\n| Component | Path | Variants | Notes |\n|---|---|---|---|\n| Button | `src/components/Button.tsx` |  |  |\n");
    const feat = ready(f, ["| Reuse | Button | the action |", "| New | PriceBadge | no listed component shows a price with its currency |", "| New | PriceRow | a row of prices |", "| New | PriceNote | a note under a price |"],
      "src/components/price/, src/features/price.tsx", { "src/components/price/wrap.tsx": "export function Wrap() { return null; }\nexport const PriceBadge = (props) => null;\nexport const PriceRow = (props) => null;\n",
        "src/components/price/price-row.tsx": "export function PriceRow() { return null; }\n", "src/features/price.tsx": "export function PriceNote() { return null; }\n" });
    const newOnes = S.designSystemReport(f, { name: feat.slug }).newComponents.map((c) => c.name + "=" + c.path);
    const fin = S.finishFeature(f, feat.slug, { write: true });
    const row = rd(f, REG).split("\n").filter((l) => /PriceBadge/.test(l));
    all("1.35.1: component files are read for what else they export, the shorter path first, up to 1,000 files and 4 MB — past either the PROJECT report says so (`limits`: component-files, in EN / PT / ES) and is never in sync, a feature's report says nothing of it, and at exactly the bound none does (review 1: at 500 files a project of 520 could never be in sync again, and 500 files of 256K cost seconds on every scan); one file gives 500 components at most, said too, and a name it exports twice counts once; an `export {` that never closes is given up after 200 lines — what follows it is read; files of lines a pattern must give up on (a run of blanks before a stray character — after a name that is almost an alias, almost a default export —, a line a `.` cannot cross, an annotation that never closes) are read in linear time — within 3× + 0.3 s of their calm twin (each such line a plain one as long) scanned at the same moment (1.35.4 review 2: a ratio, no longer an absolute 1 s; ms: [hostile ms, names, twin ms]); and a New component a feature's file exports beside the file's own is registered with that file's path, not a dash — its own file's when it has one, none for a file outside a component folder (got " +
      js({ over: [over.found.components, over.limits], featureLimits, at: [at.found.components, at.limits], heavy, said: said.map((s) => typeof s === "string" && s.includes("1000")),
        bounded: [boundedRep.missingTotal, boundedRep.limits, bounded.has("AfterTheList"), exact.missingTotal, exact.limits], ms, newOnes, registered: fin.designSystem && fin.designSystem.registered, row }) + ")", {
      over: () => over.found.components === 2001 && js(over.limits) === js([{ code: "component-files", read: 1000 }]) && over.truncated === true && over.inSync === false,
      feature: () => js(featureLimits) === js([]),
      at: () => at.found.components === 2000 && at.limits.length === 0,
      chars: () => js(heavy) === js(["33:" + js([{ code: "component-files", read: 16 }]), "32:[]"]),
      said: () => said.every((s) => typeof s === "string" && s.includes("1000")) && new Set(said).size === 3,
      perFile: () => boundedRep.missingTotal === 503 && js(boundedRep.limits) === js([{ code: "component-files", read: 2 }]) && exact.missingTotal === 501 && exact.limits.length === 0, // Many + its first 500, Open, AfterTheList
      list: () => bounded.has("AfterTheList"),
      linear: () => linear(ms) && ms[1] === "Alias0,Alias1,Alias2,Alias3,Alias4,Alias5,Byname0,Byname1,Byname2,Byname3,Byname4,Byname5,Hostile,Survivor",
      path: () => js(newOnes) === js(["PriceBadge=src/components/price/wrap.tsx", "PriceRow=src/components/price/price-row.tsx", "PriceNote=null"]),
      row: () => fin.designSystem && js(fin.designSystem.registered) === js(["PriceBadge", "PriceRow", "PriceNote"]) && row.length === 1 && row[0].includes("`src/components/price/wrap.tsx`") && row[0].includes("_From: " + feat.slug + "_"),
    });
  }

  // --- a registry that ends in a table its reader does not see; a design that uses no component ---------------------------------------------
  {
    const HEAD = "# Design System\n\n## Components\n\n| Component | Path | Variants | Notes |\n|---|---|---|---|\n| Button | `src/components/Button.tsx` | primary |  |";
    const TABLE = "| Component | Path | Variants | Notes |\n|---|---|---|---|\n| OldCard | `src/components/OldCard.tsx` |  |  |";
    // (the code block is left open, as a snippet pasted by hand: the file's last line is the table's last row; `note`: a
    // comment of the visible table's own last row hides nothing)
    const endings = { comment: "\n\n<!-- retired\n" + TABLE + " -->\n", fence: "\n\n```markdown\n" + TABLE + "\n", plain: "\n", note: " <!-- reviewed -->\n" };
    const LIST = ["| Reuse | Button | the action |", "| New | PriceTag | no listed component shows a price with its currency |"];
    const got = {};
    for (const [k, end] of Object.entries(endings)) {
      const p = project("end-" + k, { "package.json": deps(["react"]) });
      write(p, REG, HEAD + end);
      const feat = ready(p, LIST, "src/components/PriceTag.tsx", { "src/components/PriceTag.tsx": "export const PriceTag = () => null;\n" });
      // (the finish, then its design-system part asked twice more — the lazy entry spec_finish calls)
      const first = S.finishFeature(p, feat.slug, { write: true }).designSystem;
      const fins = [first ? first.registered : null].concat([1, 2].map(() => E.designSystemFinish(p, feat.slug, { write: true, ready: true }).registered));
      const text = rd(p, REG);
      got[k] = { fins, rows: text.split("\n").filter((l) => /\| PriceTag \|/.test(l)).length, read: registry(p).keys.has("pricetag"), old: registry(p).keys.has("oldcard"), tables: (text.match(/^\| Component \|/gm) || []).length };
    }
    // a design that uses no component: in a project with no registry yet, and with the stub nobody filled in
    const na = (tag, stub) => {
      const n = project(tag, { "package.json": deps(["react"]) });
      if (stub) S.scaffoldSteeringFile(n, "design-system.md");
      const nf = S.createFeature(n, { name: "Price Tag", tracks: ["ui"], summary: "x", size: "m" });
      fs.writeFileSync(path.join(nf.dir, "requirements.md"), REQ);
      fs.writeFileSync(path.join(nf.dir, "design.md"), design("n/a — a nightly job with no screen of its own"));
      approveBefore(n, nf.slug, "design");
      const check = (S.specDoctor(n, nf.slug).checks || []).find((c) => c.id === "ui-design-system");
      const approved = S.approvePhase(n, nf.slug, "design", "t").ok;
      fs.writeFileSync(path.join(nf.dir, "design.md"), design(rows(["| Reuse | Button | the action |"])));
      const named = (S.specDoctor(n, nf.slug).checks || []).find((c) => c.id === "ui-design-system");
      return { na: check && check.status + ":" + /says n\/a/.test(check.detail), approved, rows: named && named.status + ":" + named.detail.slice(0, 30) };
    };
    const none = na("na", false), stub = na("na-stub", true);
    all("1.35.1: a registry that ends in a table its reader does not see — commented out, the `-->` on its last row, or inside a code block left open — takes a finish's rows in a NEW table after it: appended to the hidden one they were read by nothing, the finish said \"added\" and every later finish added them again (1.35 review 10); a registry that ends in its component table still takes them there — a comment of that last row's own aside (`| Button | … | <!-- reviewed -->`: review 1 started a second table for it). And a design whose Design System Usage says `n/a — <why>` passes with no registry at all, and with the stub nobody filled in: it was told to create one, though it uses no component — one that names components is still told (got " +
      js({ got, none, stub }) + ")", {
      once: () => Object.keys(endings).every((k) => js(got[k].fins) === js([["PriceTag"], [], []]) && got[k].rows === 1 && got[k].read === true),
      hidden: () => got.comment.old === false && got.fence.old === false && got.comment.tables === 3 && got.fence.tables === 3,
      plain: () => got.plain.tables === 1 && got.note.tables === 1,
      na: () => none.na === "pass:true" && none.approved === true && stub.na === "pass:true" && stub.approved === true,
      rows: () => /^warn:no design-system registry yet/.test(none.rows) && /^warn:/.test(stub.rows),
    });
  }

  // --- review 2 of 1.35.1: what the first fix round broke or left unsaid ---------------------------------------------------------------------
  {
    const ws = (patterns, files) => Object.assign({ "package.json": js({ private: true, workspaces: patterns }) }, files);
    const ANTD = deps(["antd"]);
    const WEB = { "apps/web/package.json": ANTD };
    const limitsOf = (p) => js(S.designSystemReport(p).limits);
    const both = (tag, files) => { const p = project(tag, files); return [backed(p), limitsOf(p)]; };
    const CUT0 = js([{ code: "workspace-manifests", read: 0 }]);
    // `packages/**/*` over 40 packages that each hold four folders of their own: looked into, they spent the folders listed
    const tree = (n) => { const files = {}; for (let i = 0; i < n; i++) for (const d of ["package.json", "src/a.ts", "dist/a.js", "test/a.ts", "docs/a.md"]) files["packages/pkg-" + String(i).padStart(2, "0") + "/" + d] = d === "package.json" ? deps(["left-pad"]) : "x\n"; return files; };
    const within = [both("r2-inside", ws(["packages/**/*", "apps/*"], Object.assign(tree(40), WEB))), both("r2-inside-rev", ws(["apps/*", "packages/**/*"], Object.assign(tree(40), WEB)))];
    // a declared pattern that is not followed is SAID: the 51st, one past 200 characters or 12 segments, a brace list, three `*`
    const fillers = (n) => Array.from({ length: n }, (_, i) => "none-" + i + "/*");
    const patsP = project("r2-pats", ws(fillers(50).concat(["apps/*"]), WEB));
    const dropped = {
      patterns: [backed(patsP), limitsOf(patsP)],
      pnpm: both("r2-pnpm", Object.assign({ "package.json": js({ private: true }), "pnpm-workspace.yaml": "packages:\n" + fillers(50).concat(["apps/*"]).map((x) => "  - '" + x + "'\n").join("") }, WEB)),
      tooLong: both("r2-long", ws(["./".repeat(150) + "apps/*"], WEB)),
      tooDeep: both("r2-deep", ws([Array(13).fill("**").join("/")], WEB)),
      braces: both("r2-braces", ws(["{apps}/*"], WEB)), // (a brace list that cannot be expanded: of one)
      threeStars: both("r2-stars", ws(["apps/*w*e*"], WEB)),
    };
    // …a pattern that names nothing by what it IS (a negation, a path out of the project) is not: nothing went unread
    const silent = [both("r2-negation", ws(["!apps/web"], WEB)), both("r2-outside", ws(["../proj-dsw-outside/*"], WEB))];
    // (the walk's own bounds reach the report too — the second block's projects —, and a feature's report says none of it)
    const walked = [limitsOf(path.join(tmp, "proj-dsw-pat-dirs-out")), limitsOf(path.join(tmp, "proj-dsw-pat-asked-out"))];
    const featureLimits = js(S.designSystemReport(patsP, { name: S.createFeature(patsP, { name: "Price Tag", tracks: ["ui"], summary: "x" }).slug }).limits);
    // a manifest that cannot be read costs none of the hundred: 100 packages after one whose package.json is no JSON
    const broken = { "packages/a-broken/package.json": "{ not json" };
    for (let i = 0; i < 100; i++) broken["packages/p" + String(i).padStart(3, "0") + "/package.json"] = i === 99 ? ANTD : deps(["left-pad"]);
    const unread = both("r2-broken", ws(["packages/*"], broken));
    // Lerna's default is for a project that declares no workspace at all; a flow list ends at the `]` that ends its line
    const lerna = both("r2-lerna", ws(["apps/*"], { "lerna.json": js({ version: "1.0.0" }), "packages/legacy/package.json": ANTD }));
    const flow = both("r2-flow", Object.assign({ "package.json": js({ private: true }), "pnpm-workspace.yaml": "packages: ['tools/[x]', 'apps/*']\n" }, WEB));
    const said = ["en", "pt", "es"].map((l) => { const T = i18n.msg(l).cliOutput.dsLimit; return [T["workspace-manifests"](0), T["component-files"](3)]; });

    // what a component file exports — the shapes the first fix round lost, and the lines it read as code
    const BT = String.fromCharCode(96), BS = String.fromCharCode(92);
    const e = project("r2-exports", { "package.json": deps(["react"]) });
    write(e, "src/components/ui/shapes.tsx", ["import * as React from \"react\";",
      // a line that starts with `import` and holds no quote took the lines below it for its clause
      "import Dialog = Radix.Dialog;", "export function AfterImportAlias() { return null; }", "import.meta.env.MODE", "export function AfterImportMeta() { return null; }", "importantSetup()", "export function AfterCall() { return null; }",
      "import {", "  Base as Renamed,// don't rename", "  Other,// it's fine", "  Third,", "} from './base';", "export const FromClause = Third;",
      // a class header: its type parameters over lines, a `>` inside them, `extends` on the next line, a base class of the file
      "export class Table<", "  Row extends { id: string },", "> extends React.Component<Props<Row>> {}", "export class Grid<T extends Array<number>> extends React.PureComponent<T> {}", "export class Broken", "  extends React.Component {}",
      "class BaseModal extends React.Component {}", "export class ConfirmModal extends BaseModal {}", "export class Arrowed<F extends () => void> extends React.Component<F> {}",
      "export class LoginError extends Error {}", "export class Mixed extends mixin(Component) {}", "export class Called extends Component(Base) {}", "export class Fetcher extends ComponentBase {}", "export class Imported extends Other {}",
      "function AppError() {}", "export class ValidationError extends AppError {}",
      // a parenthesis in a default's string, `styled<Props>(…)`, a generic arrow whose parameter has a default
      "export const Smiley = ({ label = \":)\" }) => null;", "export const Box = styled<BoxProps>(\"div\")({});", "export const Defaulted = <T = unknown,>(props: P<T>) => null;",
      // an alias of a function declared below it, of an import that follows it; a context's consumer
      "export const Modal = LaterDialog;", "function LaterDialog() { return null; }", "export const Late = LateImport;", "import LateImport from \"./late\";", "export const ThemeConsumer = ThemeContext.Consumer;",
      "export const Outer = Middle;", "const Middle = Innermost;", "function Innermost() { return null; }", // (a chain declared bottom-up)
      // the value of the SECOND name is not the first's; an `=` inside an annotation's string is not the declaration's
      "let First, Second = () => null;", "export { First };", "export const Typed: Handler<() => void, \"a=b\"> = (props) => null;", ""].join("\n"));
    // an apostrophe (JSX text, a template's text) or a regex's quote before a comment that goes on over lines
    write(e, "src/components/ui/quotes.tsx", ["export function Text() { return <p>Don't</p>; } /*", "export function FakeA() { return null; }", "*/", "const tpl = " + BT + "it's" + BT + "; /*", "export function FakeB() { return null; }", "*/",
      "const re = /\"/; /*", "export function FakeC() { return null; }", "*/",
      // …and a `/*` that IS inside a string — a template's, one after a `/*` no comment can open at, one after an escaped quote — opens none
      "const glob = " + BT + "src /* all" + BT + ";", "const frac = a/*b, label = \"a /* b\";", "const esc = 'a" + BS + "' /* b';", "export function AfterQuotes() { return null; }", ""].join("\n"));
    const exported = S.designSystemReport(e);
    const names = exported.missing.map((c) => c.name).sort();
    // a file of declarations whose annotation never closes, of classes whose header never opens: each read the sixty lines below
    // it — the file's length in all, said
    const spent = (tag, lines) => { const r = S.designSystemReport(project(tag, { "package.json": deps(["react"]), "src/components/ui/open.tsx": "export function Kept() { return null; }\n" + lines.repeat(300) + "export const Tail = () => null;\n" })); return [r.missing.map((c) => c.name).sort(), r.limits]; };
    const budget = [spent("r2-budget", "const A: X<\n"), spent("r2-budget-class", "class B\n")];

    // a registry's end, by position: a hidden copy of the table that ends in the visible one's last row; a row joined by a comment
    const HEAD = "# Design System\n\n## Components\n\n", TH = "| Component | Path | Variants | Notes |\n|---|---|---|---|\n", BTN = "| Button | `src/components/Button.tsx` | primary |  |";
    const endings = {
      twin: HEAD + TH + BTN + "\n\n<!-- old table\n" + TH + BTN + " <!-- x -->\n",
      fenceTwin: HEAD + TH + BTN + "\n\n" + BT.repeat(3) + "\n" + TH + BTN + "\n",
      fenceNote: HEAD + TH + BTN + "\n\n" + BT.repeat(3) + "\n" + TH + BTN + " <!-- x -->\n",
      joined: HEAD + TH + "| Card | `src/components/Card.tsx` |  | <!-- old\n" + BTN + " --> |\n",
      sepNote: HEAD + "| Component | Path | Variants | Notes |\n|---|---|---|---| <!-- none yet -->\n",
    };
    const got = {};
    for (const [k, text] of Object.entries(endings)) {
      const p = project("r2-end-" + k, { "package.json": deps(["react"]) });
      write(p, REG, text);
      const feat = ready(p, ["| New | PriceTag | no listed component shows a price with its currency |"], "src/components/PriceTag.tsx", { "src/components/PriceTag.tsx": "export const PriceTag = () => null;\n" });
      const first = S.finishFeature(p, feat.slug, { write: true }).designSystem;
      const fins = [first ? first.registered : null].concat([1, 2].map(() => E.designSystemFinish(p, feat.slug, { write: true, ready: true }).registered));
      const after = rd(p, REG);
      got[k] = { fins, rows: after.split("\n").filter((l) => /\| PriceTag \|/.test(l)).length, read: registry(p).keys.has("pricetag"), tables: (after.match(/^\| Component \|/gm) || []).length };
    }
    all("1.35.1 review 2: `**` does not look inside a folder that is a package (`packages/**/*` over 40 packages with four folders each spent the folders listed, told a project that had lost nothing it was cut and, with the patterns the other way round, left `apps/web` unread); a declared pattern the reader does not follow is SAID — the 51st, in package.json or pnpm-workspace.yaml, one past 200 characters or 12 segments, a brace list that cannot be expanded, a segment of three `*` — with the manifests it did read (0, never \"only 1\"), a negation and a path out of the project are not, the walk's own bounds are, and a feature's report says none of it; an unreadable manifest costs none of the hundred; Lerna's default `packages/*` is for a project that declares no workspace; a flow list ends at the `]` that ends its line. A component file: a line that starts with `import` and is no import statement (`import Dialog = Radix.Dialog;`, `import.meta…`, `importantSetup();`) takes no line below it, a `//` comment glued to a name ends no clause; a class is read by its header — type parameters over lines or holding a `>`, `extends` on the next line, a component class of the file as its base — never `extends Error`, `extends mixin(Component)`, `extends ComponentBase` or an imported base; a `)` in a default's string, `styled<Props>(…)`, `<T = unknown,>`; an alias of a function declared below it or of an import that follows; `let First, Second = …` gives First no value; an apostrophe of JSX text or of a template, or a regex's quote, before a comment that goes on over lines hides no `/*`; declarations whose annotation never closes read the file's length below them in all, and the report says so. And a registry's end is read by POSITION: a hidden copy of its table that ends in the visible one's last row (in a comment, in a code block left open) takes no row — they were added, unread, on every finish —, a last row joined by a comment and a separator row with a note still take them in their table (got " +
      js({ within, dropped, silent, walked, featureLimits, unread, lerna, flow, names, exportLimits: exported.limits, budget, got }) + ")", {
      inside: () => js(within) === js([[yes, "[]"], [yes, "[]"]]),
      dropped: () => Object.values(dropped).every((v) => js(v) === js([no, CUT0])),
      silent: () => js(silent) === js([[no, "[]"], [no, "[]"]]),
      walked: () => js(walked) === js([CUT0, CUT0]) && featureLimits === "[]",
      unread: () => js(unread) === js([yes, "[]"]),
      declared: () => js(lerna) === js([no, "[]"]) && js(flow) === js([yes, "[]"]),
      // (the manifests READ, 0 too — never "only 1" —, and a bound of the component files that may be a file's names: no "first N")
      said: () => said.every(([w, c]) => / 0 /.test(w) && !/ 1 |only|só |solo /i.test(w) && / ?3 /.test(c) && !/first|primeiros|primeros/i.test(c)) && new Set(said.map((s) => s.join("|"))).size === 3,
      exports: () => js(names) === js(["AfterCall", "AfterImportAlias", "AfterImportMeta", "AfterQuotes", "Arrowed", "Box", "Broken", "ConfirmModal", "Defaulted", "FromClause", "Grid", "Late", "Modal", "Outer", "Quotes", "Shapes", "Smiley",
        "Table", "Text", "ThemeConsumer", "Typed"]) && exported.limits.length === 0,
      budget: () => budget.every((b) => js(b) === js([["Kept", "Open", "Tail"], [{ code: "component-files", read: 1 }]])),
      once: () => Object.keys(endings).every((k) => js(got[k].fins) === js([["PriceTag"], [], []]) && got[k].rows === 1 && got[k].read === true),
      tables: () => got.twin.tables === 3 && got.fenceTwin.tables === 3 && got.fenceNote.tables === 3 && got.joined.tables === 1 && got.sepNote.tables === 1,
    });
  }
};
