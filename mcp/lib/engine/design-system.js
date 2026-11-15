"use strict";

/**
 * dev-spec-driven engine — the design system against the code (1.35): spec_scan {designSystem: true} / `dev-spec design-system`,
 * the registry steering_scaffold seeds from the code, and spec_finish's part. The registry itself — .specs/steering/
 * design-system.md, its reader, doctor's `ui-design-system` and the brief's part — lives in quality.js (every doctor and brief
 * reads it); this module is what READS THE CODE, so it loads on first use (the lazy tier):
 *   - the project report: the components (view files in a component folder) and the tokens (token files' custom properties,
 *     Sass variables and JSON leaves) the code holds, against the registry — what it lacks, the rows naming a code file of the
 *     project that is gone;
 *   - the feature report: its [UI] Design System Usage rows against the registry, and the RAW values in its view files — a
 *     hard-coded colour, a pixel spacing or font size;
 *   - the seed: the registry stub with the code's components and tokens in place of its slot rows;
 *   - finish: the raw values as a warning, and a READY written finish adds the feature's New components to the registry.
 * Heuristic, bounded (a file cap, a bounded read of each file, linear in what it reads), read-only except the registry rows finish
 * appends, deterministic. What it does NOT read: tokens kept in JS / TS / YAML files (listed as sources, their values unread),
 * a size in a JSX `style={{…}}` object, a component in a lower-case .js file — and, out of a token file, any value that has
 * not the shape of a design value (designValue: the files are picked by name, and a name is no proof of what one holds).
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const i18n = require("../i18n.js");
// Owned by other engine modules — used at call time only; engine/index.js links them once the tier has loaded.
let activeDesign, appendSpecText, DESIGN_SYSTEM_FILE, designSystemFindings, designSystemRegistry, designSystemUsage, detectTracks, dsKey,
  existingFeature, featureDirs, featureFilesOf, featureLang, FOLD_CASE, forgetCached, gitignoreRules, implementsPath, isDirSafe, isInsideDir,
  isNetworkPath, isTestFile, packageDependencies, projectDependencies, projectLang, readFileHead, readIfExists, realRootOf, specsRoot, stripEnds, stripFencedCode, stripHtmlComments, toPosix, unitIn,
  walkProject, withRoadmapLock, writeFileAtomic, RE_DS_COMPONENT_HEAD, RE_DS_COL, dsCell, dsNameSlot;
function __link(E) { ({ activeDesign, appendSpecText, DESIGN_SYSTEM_FILE, designSystemFindings, designSystemRegistry, designSystemUsage,
  detectTracks, dsKey, existingFeature, featureDirs, featureFilesOf, featureLang, FOLD_CASE, forgetCached, gitignoreRules, implementsPath,
  isDirSafe, isInsideDir, isNetworkPath, isTestFile, packageDependencies, projectDependencies, projectLang, readFileHead, readIfExists, realRootOf, specsRoot, stripEnds, stripFencedCode,
  stripHtmlComments, toPosix, unitIn, walkProject, withRoadmapLock, writeFileAtomic, RE_DS_COMPONENT_HEAD, RE_DS_COL, dsCell, dsNameSlot } = E); }

const DS_FILE_CAP = 20000; // view / style / token files a walk counts (`truncated` past it)
const DS_READ_CHARS = 256 * 1024; // a file's characters read (a larger one is read up to there)
const DS_LINE_MAX = 2000; // a view file's line read for raw values (a longer one — minified — up to there; a token file's line is read whole)
const DS_TOKEN_FILES = 20; // token files kept as sources (by path; past them: the report's `limits` says so)…
const DS_TOKEN_READS = 100; // …and the candidates read to find them
const DS_TOKENS_MAX = 1000; // tokens kept from the code — what the registry's reader reads with their values (DS_MAX_TOKENS)
const DS_SEED_COMPONENTS = 500; // components the seed writes — what the registry's reader reads with their details
const DS_LIST = 50; // rows a report lists (`missingTotal`, `staleTotal`, `newTokensTotal`, `total` count them all)
const DS_VIEW_FILES = 200; // a feature's view files read
const DS_RAW_PER_FILE = 200; // raw values kept per file
const BS = String.fromCharCode(92); // a backslash, built: an escaped pipe in a table cell

// --- what the code holds ------------------------------------------------------------------------------------------------------
// A component: a view file (React / Vue / Svelte / Astro, an Angular *.component.ts, an older React codebase's PascalCase .js)
// whose NEAREST telling folder is one a team keeps components in — never a page folder below it (components/pages/Home.tsx).
// Its name is the file's — Button.tsx, date-picker.vue → DatePicker, button.component.ts — or its folder's for an index file;
// never a test, a story, a hook (useToggle, use-mobile) or one of the folder's helper files.
const RE_COMPONENT_EXT = /\.(?:tsx|jsx|vue|svelte|astro)$/i;
const RE_NG_COMPONENT = /\.component\.ts$/i;
const RE_JS_COMPONENT = /\.(?:js|mjs)$/i;
const RE_NOT_COMPONENT_FILE = /\.(?:stories|story|test|spec|mock|fixture|d)\.[a-z]+$/i;
const RE_PLATFORM_INFIX = /\.(?:client|server|native|web|ios|android)$/i;
const COMPONENT_DIRS = new Set(["components", "component", "ui", "design-system", "designsystem", "ds", "widgets", "atoms", "molecules", "organisms",
  "primitives", "elements"]);
const PAGE_DIRS = new Set(["pages", "routes", "views", "screens"]);
// A lower-case file name that is a helper or an entry file, never a component (matched as written). NOT a framework's
// special-file names — page, layout, loading, error, not-found, template: those files live in ROUTE folders, and a file is
// read here only when its nearest telling folder is a component folder. There `components/loading.tsx` (the shadcn / Next
// naming), Nuxt's `components/error.vue` and Angular's `loading/loading.component.ts` ARE the components Loading and Error
// (review 5: left out of the seed, the report "in sync", a size m design reusing Loading refused).
const NOT_COMPONENT = new Set(["index", "utils", "util", "helpers", "helper", "types", "constants", "styles", "style", "hooks", "context", "config", "theme",
  "tokens", "stories", "mocks", "i18n", "main", "app", "store"]);
// …of them, an ENTRY file is one only RIGHT inside the telling folder (`src/ui/main.tsx`, where `ui/` is the app — `src/`
// looked through, as homeDir does: `packages/ui/src/main.tsx`): deeper, `components/layout/main.tsx` is the component Main
// (shadcn-admin's — review 6: left out, a design reusing it refused).
const ENTRY_NAMES = new Set(["main", "app"]);
const RE_SRC_DIR = /^(?:src|source)$/i;
// A framework's special files — components under a component folder (above), EXCEPT in a ROUTE SEGMENT of an app router: a
// folder between a router root — an `app/` that holds a root `layout.*`, which Next requires — and a `page.*` / `route.*`
// at or below it. A Next app with a route called components / ui / design-system (a style-guide page) keeps
// `app/components/{page,loading,error}.tsx` there — pages, not Page / Loading / Error (review 6: seeded as components,
// `New | Layout` then "already listed"); so is `app/components/layout.tsx` above `app/components/[name]/page.tsx`. A property
// of the PROJECT, never of the folder alone: review 6 took any folder holding a `page.*` for a segment, and a component
// folder with its own `page.tsx` (`src/components/{page,loading,error}.tsx`, Remix's `app/components/`) lost Loading and
// Error — a design reusing them refused, one declaring them New approved (review 7). scanCode knows the segments once the
// walk is over (routeSegments); componentOf says `route`.
// The router is Next's, and so is the project's (dependsOnNext): a single-page app that keeps `src/app/layout.tsx` beside
// `src/app/components/{page,loading}.tsx` has no route segment (review 8). Its root is the `app/` that holds the top-most
// `layout.*` — through route groups and dynamic segments: next-intl's `app/[locale]/layout.tsx`, `app/(app)/layout.tsx`.
const ROUTE_FILES = new Set(["page", "layout", "loading", "error", "not-found", "template", "default", "global-error"]);
const RE_ROUTE_MARK = /^(?:page|route)\.(?:tsx|jsx|ts|js|mdx)$/;
const RE_ROOT_LAYOUT = /^layout\.(?:tsx|jsx|ts|js)$/;
const RE_ROUTE_PASS = /^(?:\(.*\)|\[.*\])$/;
// → the `app/` a layout file's folder is the root layout of (its own folder, or one above it through groups / segments), or null
function routerRootOf(dir) {
  const segs = dir.split("/");
  let n = segs.length;
  while (n > 0 && RE_ROUTE_PASS.test(segs[n - 1])) n--;
  return n > 0 && segs[n - 1] === "app" ? segs.slice(0, n).join("/") : null;
}
// Is the folder a Next project's — a `next.config.*` or a package.json that depends on `next`, at or above it, inside the
// project (a monorepo's `apps/web/package.json`; an Nx project whose dependencies are hoisted out of the scanned folder
// keeps its config)? memo: each folder's manifest is read once a scan, DS_MANIFESTS of them at most — past that no router
// is found, and a file named like a special one stays the component it may be (review 9: asked per root and per folder
// above it, 10,000 router roots cost 36 s).
const RE_NEXT_CONFIG = /^next\.config\.(?:js|mjs|cjs|ts|mts)$/;
const DS_MANIFESTS = 200;
function dependsOnNext(root, dir, memo, configs) {
  const segs = dir.split("/");
  for (let n = segs.length; n >= 0; n--) {
    const d = segs.slice(0, n).join("/");
    if (configs.has(d)) return true;
    if (!memo.has(d)) memo.set(d, memo.size < DS_MANIFESTS && packageDependencies(path.join(root, d)).has("next"));
    if (memo.get(d)) return true;
  }
  return false;
}
// The route segments: every folder from a router root down to a page — never through a private folder (`_components/`:
// out of routing, with all it holds).
function routeSegments(roots, marks) {
  const out = new Set();
  if (!roots.size) return out;
  for (const m of marks) {
    const segs = m.split("/");
    let r = segs.length;
    while (r > 0 && !roots.has(segs.slice(0, r).join("/"))) r--;
    if (r === 0 || segs.slice(r).some((d) => d.startsWith("_"))) continue;
    for (let i = r; i <= segs.length; i++) out.add(segs.slice(0, i).join("/"));
  }
  return out;
}
// A folder whose index file is a barrel, never a component named after it (packages/ui/src/index.tsx, icons/index.tsx) — in
// any case — …
const GENERIC_DIRS = new Set(["src", "lib", "libs", "app", "apps", "common", "shared", "core", "base", "utils", "helpers", "hooks", "styles", "assets", "icons",
  "images", "types", "internal", "generated", "dist", "build", "test", "tests", "stories"]);
// … and a helper folder's, as written (lower-case: `Store/index.tsx` is a component). A folder `layout/`, `loading/`,
// `error/`, `theme/` or `page/` under components/ holds the component of that name (review 4: with NOT_COMPONENT applied to
// an index's folder, `components/layout/index.tsx` was lost and a design reusing Layout refused).
const HELPER_DIRS = new Set(["config", "context", "store", "constants", "i18n", "mocks", "util", "helper", "tokens", "style"]);
const dirName = (d) => d.toLowerCase().replace(/^_+/, ""); // Next's private `_components/` is a component folder
function componentOf(rel) {
  const segs = rel.split("/");
  const file = segs[segs.length - 1];
  const ng = RE_NG_COMPONENT.test(file), js = !ng && RE_JS_COMPONENT.test(file);
  if (!(ng || js || RE_COMPONENT_EXT.test(file)) || RE_NOT_COMPONENT_FILE.test(file)) return null;
  let kind = null, at = segs.length - 1; // at: the telling folder's place in the path
  while (--at >= 0 && !kind) { const d = dirName(segs[at]); kind = COMPONENT_DIRS.has(d) ? "component" : PAGE_DIRS.has(d) ? "page" : null; }
  if (kind !== "component") return null;
  let stem = (ng ? file.replace(RE_NG_COMPONENT, "") : file.replace(/\.[^.]+$/, "")).replace(RE_PLATFORM_INFIX, "");
  const index = stem.toLowerCase() === "index";
  const route = ROUTE_FILES.has(stem); // (the FILE's own name: an index file is named by its folder below)
  if (index) stem = segs[segs.length - 2] || "";
  const low = stem.toLowerCase();
  // (an Angular `x.component.ts` is a component whatever x is — the suffix says so; `at + 1` is the telling folder: the loop
  // stepped once past it)
  const helper = !ng && NOT_COMPONENT.has(stem) && (!ENTRY_NAMES.has(stem) || segs.slice(at + 2, -1).every((d) => RE_SRC_DIR.test(d)));
  if (index ? GENERIC_DIRS.has(low) || HELPER_DIRS.has(stem) || COMPONENT_DIRS.has(dirName(stem)) : helper || (stem === low && COMPONENT_DIRS.has(low))) return null;
  if (!/^[A-Za-z][A-Za-z0-9._-]{0,79}$/.test(stem) || /^use(?:[A-Z]|[-_.])/.test(stem)) return null;
  if (js && !/^[A-Z][A-Za-z0-9]*$/.test(stem)) return null; // a .js file is a component only by a PascalCase name (Button.js)
  const name = stem.split(/[-_.]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join("");
  return { name, key: dsKey(name), path: rel, index, route };
}
// --- what else a component file exports ---------------------------------------------------------------------------------------
// A file names ONE component, by its file — and a .tsx / .jsx / .js one may export more: a kit's `card.tsx` exports Card,
// CardHeader, CardContent… (1.35.1 — 1.35 review 10, on real file contents: a design reusing CardHeader was told it is
// not in the registry). → { names: the PascalCase names the file EXPORTS and declares as a component, in the file's
// order; more: it holds more than DS_EXPORT_NAMES }:
//   - a function: `export function CardHeader(`, `function CardHeader(` listed in `export { … }` — unless it shows it
//     is no component (isHelper: it takes a component, it takes three parameters, or the file calls it and it renders
//     nothing itself);
//   - a class that extends React's `Component` / `PureComponent` or a component class the file declares above it
//     (classHeader: its type parameters aside, over lines — never `class LoginError extends Error`) — or, whatever it
//     extends (an imported base, a mixin), one that RENDERS: a `render` and JSX in its body (1.35.2);
//   - a const whose value is one: a function (functionValue: `= (props) =>`, `= function`, `= <T,>(props) =>`), one of
//     React's own wrappers (`forwardRef(`, `memo(`, `lazy(` — with `React.`, bare, or under the name the file imports
//     React by: `R.forwardRef(` —, never `z.lazy(`, `cache.memo(`; in parentheses that are cast too), a `styled` one
//     (`styled.div`, `styled(Button)`, `styled<Props>(…)`), a context's `X.Provider` / `X.Consumer`, another component
//     under a new name: a capitalised name the file imports, declares — above or below — or borrows (destructured from
//     an import, a `require`'s), or a member of one, a cast after it aside (`= DialogPrimitive.Root`, `= FormProvider`,
//     `= Origin as Compound` — never `= Infinity`, `= Number.MAX_SAFE_INTEGER`, a local enum's member), or — 1.35.2 —
//     a call of ANY other function that shows what it wraps: it renders (JSX in its statement: `observer(() =>
//     <div />)`, under another wrapper — `inject("s")(observer(() => …))` —, after another argument) and what its
//     last argument list (a later line at its margin may open it: `})((props) => …`) holds FIRST is no object,
//     list or element; or it loads on demand (`dynamic(() =>
//     import(…))`); it is given a `render` that is defined and JSX (`createReactClass({ … })`); or it is applied to
//     a component — its last argument list is one name that is a component of the FILE's own (`withRouter(Nav)`),
//     or, curried, one it imports (`withStyles(styles)(TableCell)`) — the JSX a FUNCTION given renders (1.35.3: with
//     none it is an element handed over, `mount(root, <App />)`);
//   - a part hung on a component the file exports, under that component's exported name — an alias of it too —
//     (1.35.2): `Card.Header = …`, the capitalised keys of `Object.assign(Card, { Header, Body: CardBody })` —
//     `Card.Header`; an `Object.assign` with no such key is the component it is given, when the file declares it,
//     and one around a call (a HOC's, with its arguments) is a component when a part of it is.
// Exported on its declaration, in a list, as the default or by CommonJS (`exports.X = …`, `module.exports = { … }`, 1.35.3).
// Never a type (`export type`, `export { type X }`), a re-export (`export { X } from`, `export *` — a barrel's), a constant
// of any other value (`createContext(…)`, an object, `cva(…)`, `z.object(…)`, `memoize(() => 1)`, a call given an
// object, a list or an element FIRST — whatever JSX it holds), a hook, a lower-case name (`FAQ`, `CTA` are
// components: a constant in capitals is
// none by its VALUE, never by its letters), a name with a `_`. A name is read WHOLE, accents too (`Botão` — review 1 of
// 1.35.1: an ASCII class gave "Bot"). What tells is the DECLARATION — and, since 1.35.2, what its statement HOLDS —,
// never the name: no suffix list ("Context", "Props") is ever complete. Statements at the margin and indented `export`s
// of a declaration (scriptView), a decorator on the line aside, comments aside (a `/*` or a `//` inside a quoted string
// opens none, and `<!--` is no comment in a script), a template literal's lines aside, a BOM dropped; a line is read
// up to DS_LINE_MAX. What one file cannot settle — a component made by a call that shows nothing (`motion(Box)`,
// `createComponent(config)`, `contextConnect(Menu, "Menu")`, `createIcon({ … })`, `createSvgIcon(<path />, "Home")`), a
// class with an imported base that renders through it, a real component taken for a helper, parts hung on an imported
// component, `export const { Header } = Layout`, an element whose text at the margin ended its statement — is a
// CANDIDATE, and what it takes on weaker grounds (a call, an alias of an import, a function or a class with no JSX of
// its own) is WEAK: the project's other files settle both (settle, 1.35.3 — a candidate it renders is a component, a
// weak one it only calls, gives to `useContext` or reads as an object is none). What NO file renders where the reader
// sees it is still a row to add by hand, as the docs say; a helper, an alias on a name that is none or a call whose
// function renders is still listed while the project never calls it; a call given an object with a `render` or
// curried around an import, and a class that renders JSX the project never constructs, too. A stray backtick in an
// element's text hides what stands up to the next one.
const DS_EXPORT_FILES = 1000; // component files read for what else they export…
const DS_EXPORT_CHARS = 4 * 1024 * 1024; // …and the characters read of them: past either, the report's `limits` says so
const DS_EXPORT_NAMES = 500; // components kept of one file (what the registry's reader reads with their details)
const DS_EXPORT_LIST_LINES = 200; // lines an `export { … }` list or an `import` clause may go on over
const DS_DECL_LINES = 60; // lines a declaration's annotation may go on over before its `=`
const RE_EXPORTS_EXT = /\.(?:tsx|jsx|js|mjs)$/i;
const RE_COMPONENT_NAME = /^\p{Lu}[\p{L}\p{N}]*$/u;
const RE_IDENTIFIERS = /[\p{L}_$][\p{L}\p{N}_$]*/gu;
const RE_DECL_FN = /^(export\s+)?(?:default\s+)?(?:async\s+)?(function|class)\s+([\p{L}_$][\p{L}\p{N}_$]*)/u;
const RE_DECL_CONST = /^(export\s+)?(?:const|let|var)\s+([\p{L}_$][\p{L}\p{N}_$]*)/u;
const RE_CLASS_EXTENDS = /^\s*extends\s+((?:[\p{L}_$][\p{L}\p{N}_$]*\.)*[\p{L}_$][\p{L}\p{N}_$]*)(?![\p{L}\p{N}_$.(])/u; // (of classHeader's text) → what it extends
const RE_REACT_CLASS = /^(?:React\.)?(?:Pure)?Component$/;
const RE_IMPORT = /^import(?![\p{L}\p{N}_$.(])/u; // an import STATEMENT: never `import.meta…`, `import(…)`, `importantSetup()`
const RE_IMPORT_END = /["'`;=]/; // where its clause ends: the module's quote — or the statement's own end (`import Dialog = Radix.Dialog;`)
// (a `//` comment right after a name — `B,// it's fine` — is no part of an import's clause: its apostrophe ended it)
const importCut = (l) => { const k = l.indexOf("//"), e = l.search(RE_IMPORT_END); return k !== -1 && (e === -1 || k < e) ? l.slice(0, k) : l; };
const DS_ALIAS_PASSES = 8; // a chain of aliases declared bottom-up is followed that deep
const RE_EXPORT_DEFAULT_NAME = /^export\s+default\s+([\p{L}_$][\p{L}\p{N}_$]*)\s*;?$/u; // (of a line trimmed at its end)
const RE_VALUE_ASYNC = /^async\s*/u;
const RE_VALUE_FUNCTION = /^function(?![\p{L}\p{N}_$])/u;
const RE_VALUE_GENERIC = /^<(?:const\s+)?[\p{L}_$][\p{L}\p{N}_$]*\s*(?:,|=(?!>)|extends(?![\p{L}\p{N}_$]))/u; // (`<T,>`, `<T = unknown,>`, `<T extends X>`)
const RE_VALUE_ARROW = /^[\p{L}_$][\p{L}\p{N}_$]*\s*=>/u;
const RE_VALUE_WRAPPER = /^(?:(?:React\.)?(?:forwardRef|memo|lazy)(?![\p{L}\p{N}_$])|styled(?=[.(<])|[\p{L}_$][\p{L}\p{N}_$]*\.(?:Provider|Consumer)\s*;?$)/u; // (…and a context's `X.Provider`)
const RE_VALUE_ALIAS = /^([\p{L}_$][\p{L}\p{N}_$]*)(?:\.[\p{L}_$][\p{L}\p{N}_$]*)*\s*;?$/u; // (of a trimmed value) → its first name
const RE_VALUE_ALIAS_LAST = /(?:^|\.)\p{Lu}[\p{L}\p{N}_$]*\s*;?$/u; // …whose last name is capitalised
// A script's quoted string closes on its line: → where the quote that opens at s[i] closes (-1: it does not — an
// apostrophe of JSX text, a template's first line). none: the quote characters known not to close further on — each
// is looked for once past a place, so a line of them stays linear. (isQuote: the raw values' reader's, below.)
// An apostrophe right after a letter is a word's (`Don't`, `it's`), never a string's opening: in JSX text and in a comment a
// pair of them quoted what stood between — a `//`, a closing tag (review 2 of 1.35.2). Unless the word is one a value
// follows — minified code's `return'…'`, `case'a':` (1.35.3: the string was read from its closing quote).
const RE_QUOTE_KEYWORD = /(?:^|[^\p{L}\p{N}_$])(?:return|typeof|case|in|of|void|throw|yield|await|else|do|delete)$/u;
const opensString = (s, k) => s[k] !== "'" || k === 0 || !RE_WORD_CHAR.test(s[k - 1]) || RE_QUOTE_KEYWORD.test(s.slice(Math.max(0, k - 9), k));
function quoteEnd(s, i, none) {
  const q = s[i];
  if (none[q]) return -1;
  for (let j = i + 1; j < s.length; j++) {
    if (s[j] === BS) j++;
    else if (s[j] === q) return j;
  }
  none[q] = true;
  return -1;
}
// Is a value a function's? `(props) => …`, `async (props) => …`, `function`, a generic arrow (`<T,>(…) =>` — its `<`
// alone at the line's end when the type parameters follow below: shadcn's FormField), `props => …`. A `(` is a
// parameter list's when its `)` is followed by `=>` or `:` — or does not close on its line (the parameters go on
// below): `(1 + 2) * 3` and `(a ? B : C)` are values (review 1 of 1.35.1: any `(` made `Total` a component).
// — unless what it holds is a function itself that is not called: `((props) => …) as React.FC` (inner: one level).
// A parenthesis inside a quoted string is none (`({ label = ":)" }) => …` — review 2 of 1.35.1).
function functionValue(value, inner) {
  const v = value.replace(RE_VALUE_ASYNC, "");
  if (v === "<" || RE_VALUE_FUNCTION.test(v) || RE_VALUE_GENERIC.test(v) || RE_VALUE_ARROW.test(v)) return true;
  if (v[0] !== "(") return false;
  const none = {};
  let depth = 0;
  for (let i = 0; i < v.length; i++) {
    if (isQuote(v[i])) { const e = quoteEnd(v, i, none); if (e !== -1) i = e; continue; }
    if (v[i] === "(") depth++;
    else if (v[i] === ")" && --depth === 0) {
      const rest = v.slice(i + 1).trimStart();
      return rest.startsWith("=>") || rest[0] === ":" || (!inner && rest[0] !== "(" && functionValue(v.slice(1), true));
    }
  }
  return true;
}
// A declaration's value — what follows the `=` that ENDS its annotation: at no bracket's depth, never an arrow's
// (`const X: React.FC<{ onDone: () => void }> = (…) =>` — review 1 of 1.35.1: the first `=` of the line was taken),
// on the declaration's line or, while a bracket of the annotation is open, on a later one (Prettier breaks
// `React.FC<{` … `}> = (…) =>` so; DS_DECL_LINES). → the value's first line, trimmed — the next line with text when the
// `=` ends its own (`const Card =` then `React.forwardRef(…)`, a comment line between them or none; 3 lines) — or
// null: the declaration has no value. code: the file's lines, comments out; from: where the declared name ends.
// budget.ahead: the characters the file's declarations may still read BELOW their own line — the file's length in all:
// what a real file's declarations read below them never overlaps, and a file of `const A: X<` lines made each one
// read the sixty lines under it (review 2 of 1.35.1: 2 s for 4 MB of them). Spent, a declaration has no value.
function declaredValue(code, i, from, budget) {
  let depth = 0;
  for (let j = i, last = Math.min(code.length - 1, i + DS_DECL_LINES); j <= last; j++) {
    const l = code[j];
    if (j > i && (budget.ahead -= l.length + 1) < 0) return null;
    for (let k = j === i ? from : 0; k < l.length; k++) {
      const c = l[k];
      if (c === "=") {
        if (l[k + 1] === ">") { k++; continue; }
        if (depth > 0) continue; // (a default inside a bracket: `<T = unknown>`)
        let value = l.slice(k + 1).trim();
        for (let m = j + 1; value === "" && m < code.length && m <= j + 3; m++) value = code[m].trim();
        return value;
      }
      if (c === "(" || c === "[" || c === "{" || c === "<") depth++;
      else if ((c === ")" || c === "]" || c === "}" || c === ">") && depth > 0) depth--;
      else if (c === "," && depth === 0) return null; // (`let First, Second = () => …`: the value is the NEXT name's)
    }
    if (depth === 0) return null;
  }
  return null;
}
// A class's header — what follows its name, to the `{` that opens its body — without what its brackets hold: the type
// parameters and arguments (`class Table<Row extends { id: string }> extends React.Component<Props<Row>>`), over the
// next lines too (Prettier breaks a long one before `extends`). A `(` stays, as a mark: `extends mixin(Component)` is
// no `extends Component`. Review 2 of 1.35.1: read on the class's own line with one `<…>` at most, the three were missed.
function classHeader(code, i, from, budget) {
  let depth = 0, out = "";
  for (let j = i, last = Math.min(code.length - 1, i + DS_DECL_LINES); j <= last; j++) {
    const l = code[j];
    if (j > i && (budget.ahead -= l.length + 1) < 0) return out;
    for (let k = j === i ? from : 0; k < l.length; k++) {
      const c = l[k];
      if (c === "=" && l[k + 1] === ">") { k++; continue; } // (an arrow's `>` closes nothing)
      if (c === "{" && depth === 0) return out;
      if (c === "<" || c === "(" || c === "[" || c === "{") { if (c === "(" && depth === 0) out += c; depth++; } else if (c === ">" || c === ")" || c === "]" || c === "}") { if (depth > 0) depth--; } else if (depth === 0) out += c;
    }
    out += " ";
  }
  return out;
}
// --- the file as the export reader reads it (1.35.2) ------------------------------------------------------------------------------
// Until 1.35.2 the reader read one LINE of a declaration. What 1.35.1 left to add by hand needs what a statement HOLDS — does
// the function a HOC wraps render, does a class with an imported base — so the file is read once into a view:
//   code   its lines, comments out (withoutComments, a script's rules) — of a line that starts inside a template literal,
//          what follows the backtick that closes it: a template's text is no code, and no comment opens in it (review 1
//          of 1.35.2: with the comments taken out first, a template that held ` // ` lost its closing backtick — and the
//          file the components below it);
//   tpl    the lines that START inside a template literal: text, never a statement (a code sample in a docs component read
//          as the file's own declarations) — a backtick that never closes is a stray one, and then the file is read again
//          with no template at all, as 1.35.1 read it;
//   next   for a line, where the next STATEMENT starts: a line at the margin that begins a name; one that begins anything
//          else but a closer (`}`, `)`), a `{` (a brace on its own line is the statement's above) or an operator, when
//          the line above ends a statement; or an indented `export` of a declaration (an export is a module's own
//          wherever it is indented). A statement's EXTENT runs to there: its
//          closing lines at the margin are its own — the formatting every formatter gives, and the reason no bracket is
//          ever matched across lines here (a `(` in JSX text, a regex's, would derail one);
//   jsx    the lines that hold JSX: a closing tag or a self-closing one — every element has one, and neither is anything
//          else in a script (`<Name` alone is a type argument's shape too), strings aside;
//   called the capitalised names the file CALLS as a function (`Total(a, b)`) — what a component never is.
const RE_JSX = /<\/[\p{L}][\p{L}\p{N}_$.:-]*\s*>|\/>/u; // (a fragment's `</>` holds the second)
const RE_STATEMENT_START = /^[^\s{})\]>.,?:&|=+\-*\/%<]/;
const RE_NAME_START = /^[\p{L}_$@;]/u;
const RE_INDENTED_EXPORT = /^[ \t]+export(?:\s*\{|\s+(?:const|let|var|function|class|default|async|abstract)(?![\p{L}\p{N}_$]))/u;
const RE_CALLED = /(?<![\p{L}\p{N}_$.])(\p{Lu}[\p{L}\p{N}_$]*)\(/gu;
const RE_CALL_KEYWORD = /(?:^|[^\p{L}\p{N}_$])(?:return|await|new)$/u; // the words a call follows: any other word before a name is a declaration's, or a sentence's
const RE_WORD_CHAR = /[\p{L}\p{N}_$]/u;
const RE_TYPED_PARAM = /^\s*[\p{L}_$][\p{L}\p{N}_$]*\??\s*:/u; // (of what a `(` holds) a parameter with its type: a declaration's list, never a call's
const DS_CALL_PEEK = 80; // characters read after a `(` / a `)` to tell what the name before it is
const RE_DYNAMIC_IMPORT = /(?<![\p{L}\p{N}_$.])import\s*\(/u;
const RE_LOCAL_BEFORE = /(?:^|[^\p{L}\p{N}_$])(?:const|let|var)\s+$/u; // (of the text before a `render =`) a local variable's
const RE_RENDER = /(?<![\p{L}\p{N}_$.])render\s*(?=[=:(])/gu; // a `render` that is no member's: what follows it tells (scriptView's renders)
// a line without what its strings hold — the ones that close on it (quoteEnd): `"</div>"` is no JSX, `"Total(x)"` no call
function withoutStrings(l) {
  if (!(l.includes("\"") || l.includes("'") || l.includes("`"))) return l;
  const none = {};
  let out = "", from = 0;
  for (let k = 0; k < l.length; k++) {
    if (!isQuote(l[k]) || !opensString(l, k)) continue;
    const e = quoteEnd(l, k, none);
    if (e !== -1) { out += l.slice(from, k + 1); from = e; k = e; }
  }
  return out + l.slice(from);
}
// → is a template literal open at the end of `s` (inside: at its start)? A quoted string that closes on the line holds none,
// nor does a regular expression's literal (1.35.3: `/`([^`]+)`/` — a Markdown reader's — opened one, and two of them hid the
// code between: a `/` where a value starts, to the `/` that closes it on the line outside a `[…]`; once one does not close,
// no further one is looked for on the line — linear).
const RE_REGEX_BEFORE = /[(,=:[!&|?;{]/;
const RE_REGEX_KEYWORD = /(?:^|[^\p{L}\p{N}_$])(?:return|typeof|case|in|of|void|throw|yield|await|else|do)$/u;
function regexEnd(s, k) {
  let j = k - 1;
  while (j >= 0 && (s[j] === " " || s[j] === "\t")) j--;
  if (!(j < 0 || RE_REGEX_BEFORE.test(s[j]) || (s[j] === ">" && s[j - 1] === "=") || (RE_WORD_CHAR.test(s[j]) && RE_REGEX_KEYWORD.test(s.slice(Math.max(0, j - 7), j + 1))))) return -1;
  for (let e = k + 1, inClass = false; e < s.length; e++) {
    const c = s[e];
    if (c === BS) e++;
    else if (inClass) { if (c === "]") inClass = false; } else if (c === "[") inClass = true;
    else if (c === "/") return e;
  }
  return -2;
}
function templateOpen(s, inside) {
  if (!s.includes("`")) return inside;
  const none = {};
  for (let k = 0; k < s.length; k++) {
    const c = s[k];
    if (inside) { if (c === BS) k++; else if (c === "`") inside = false; continue; }
    if (c === "`") inside = true;
    else if (c === "\"" || c === "'") { const e = quoteEnd(s, k, none); if (e !== -1) k = e; } else if (c === "/" && !none.regex && s[k + 1] !== "/" && s[k + 1] !== "*") {
      const e = regexEnd(s, k);
      if (e === -2) none.regex = true;
      else if (e !== -1) k = e;
    }
  }
  return inside;
}
// The file's lines, comments out, a template's text out → { code, tpl, open (a template is still open at the file's end) }.
// templates: false reads them as 1.35.1 did — no line is a template's.
function scriptLines(body, templates) {
  const st = { block: false, html: false }, opts = { slashSlash: true, script: true, html: false };
  const raw = body.split(/\r?\n/);
  const code = new Array(raw.length), tpl = new Uint8Array(raw.length);
  let inside = false;
  for (let i = 0; i < raw.length; i++) {
    const l = raw[i];
    let from = 0;
    tpl[i] = inside ? 1 : 0;
    if (inside) {
      while (from < l.length && l[from] !== "`") from += l[from] === BS ? 2 : 1;
      if (from >= l.length) { code[i] = ""; continue; }
      inside = false;
      from++;
    }
    // (a line is read up to DS_LINE_MAX; whether a template opens on it is asked of ALL of it — a long line's closing
    // backtick stands past the cut)
    const long = l.length - from > DS_LINE_MAX;
    code[i] = withoutComments(long ? l.slice(from, from + DS_LINE_MAX) : from ? l.slice(from) : l, st, opts);
    if (!templates) continue;
    inside = templateOpen(code[i], false);
    if (long) inside = templateOpen(l.slice(from + DS_LINE_MAX), inside);
    // (a `/*` after the backtick that stays open is the template's text: no comment is open below it — review 2 of
    // 1.35.2: its `*/` stood in the template's lines, never read, and the file was a comment down to the next one)
    if (inside) st.block = false;
  }
  return { code, tpl, open: inside };
}
function scriptView(text) {
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  let lines = scriptLines(body, true);
  if (lines.open) lines = scriptLines(body, false);
  const { code, tpl } = lines;
  const n = code.length;
  // the lines as code alone: strings emptied, a template's first line cut where the template opens
  const plain = code.map((l, i) => withoutStrings(i + 1 < n && tpl[i + 1] ? l.slice(0, l.lastIndexOf("`") + 1) : l));
  const jsx = new Uint8Array(n);
  const next = new Int32Array(n);
  // Where a statement starts: a line at the margin that begins a NAME (or a decorator, or a `;`), an indented export —
  // or any other margin line that is no closer's and no operator's (`(function () {`, a string) when the line above
  // ENDS a statement (`;` / `}`): text at the margin inside an element — `1. First clause` under a `<pre>` — ends none
  // (review 2 of 1.35.2).
  const starts = new Uint8Array(n);
  for (let i = 0, ended = true; i < n; i++) {
    const l = code[i];
    if (l.trim() === "") continue; // (a line of blanks, a comment's place: it ends and starts nothing)
    if (!tpl[i] && (RE_NAME_START.test(l) || RE_INDENTED_EXPORT.test(l) || (ended && RE_STATEMENT_START.test(l)))) starts[i] = 1;
    const t = l.trimEnd();
    ended = t.endsWith(";") || t.endsWith("}");
  }
  for (let i = n - 1, at = n; i >= 0; i--) {
    next[i] = at;
    if (starts[i]) at = i;
    if ((plain[i].includes("<") || plain[i].includes("/>")) && RE_JSX.test(plain[i])) jsx[i] = 1;
  }
  const called = new Set();
  // where each `(` of a line closes on it (-1: below) — asked once a line, so a line of calls stays linear
  const closers = (p) => {
    const close = new Int32Array(p.length).fill(-1), stack = [];
    for (let k = 0; k < p.length; k++) { if (p[k] === "(") stack.push(k); else if (p[k] === ")" && stack.length) close[stack.pop()] = k; }
    return close;
  };
  // does the line above (the first with text) end a tag — is this one an element's text? (an arrow's `=>` ends none)
  const underTag = (i) => { for (let k = i - 1; k >= 0; k--) { const t = plain[k].trimEnd(); if (t !== "") return t.endsWith(">") && !t.endsWith("=>"); } return false; };
  for (let i = 0; i < n; i++) {
    const p = plain[i];
    if (!p.includes("(")) continue;
    let close = null;
    RE_CALLED.lastIndex = 0;
    for (let m = RE_CALLED.exec(p); m; m = RE_CALLED.exec(p)) {
      const open = m.index + m[0].length;
      // A name before a `(` that is no call — by what it IS: a plural (`File(s)`, `Box(es)`), a regex's (`/Total(\d+)/`), a
      // declaration's (its first parameter is typed: `Item(props: P)`; a `{` follows its `)` — a method's header; a `:`
      // does — a signature's return type, a ternary's after a `?`) …
      if (p.startsWith("s)", open) || p.startsWith("es)", open) || p[m.index - 1] === "/" || RE_TYPED_PARAM.test(p.slice(open, open + DS_CALL_PEEK))) continue;
      let j = m.index - 1;
      while (j >= 0 && (p[j] === " " || p[j] === "\t")) j--;
      if (close == null) close = closers(p);
      const end = close[open - 1];
      const after = end === -1 ? undefined : p.slice(end + 1, end + 1 + DS_CALL_PEEK).trimStart()[0];
      if (after === "{" || (after === ":" && p[j] !== "?")) continue;
      // … and by where it STANDS: first on its line it is a statement's — unless the line above ends a tag, a word
      // follows its `)` (a sentence: `Total(USD) of the order`) or a `,` and more (`Button(primary), never a link`);
      // after a tag's `>` or an expression's `}` it is an element's text (an arrow's `=>` is code); after a word it is
      // a call only after `return` / `await` / `new` — never `function Total(`, `get Total(`, a sentence
      if (j < 0) { if ((after !== undefined && (RE_WORD_CHAR.test(after) || (after === "," && p.slice(end + 1).trim() !== ","))) || underTag(i)) continue; } else if (p[j] === ">") { if (p[j - 1] !== "=") continue; } else if (p[j] === "}") continue;
      else if (RE_WORD_CHAR.test(p[j]) && !RE_CALL_KEYWORD.test(p.slice(Math.max(0, j - 6), j + 1))) continue;
      called.add(m[1]);
    }
  }
  // Does a statement DEFINE a `render`? A method (`render() {`, `render(): Node {` — its `{` on the line below, its list over
  // lines too), a field that is a function (`render = () =>`), createReactClass's `render: function` — never a CALL of one
  // (`render(<App />, el)`, `return render(…)`): what follows its `)` tells. Review 2 of 1.35.2: a pattern of one line
  // missed the brace below, a list over lines, a call in a default, a class on one line. Review 3: a list left open is
  // followed down ONCE a line (each `render(` of a line of them read the sixty lines below: 8.8 s a scan), from the
  // line that closes it (its brace may stand below THAT one); a ternary's call is none. Review 4: the blank lines below
  // that `)` were read through to the statement's end, unbounded, once for each `render(` above it (minutes a scan) —
  // they are read once a line, DS_DECL_LINES deep (readOn).
  const renders = (i) => {
    const readOn = (q, rest) => { for (let r = q + 1; rest === "" && r < next[i] && r <= q + DS_DECL_LINES; r++) rest = plain[r].trimStart(); return rest; };
    for (let k = i; k < next[i]; k++) {
      const p = plain[k];
      if (!p.includes("render")) continue;
      let close = null, below; // below: what follows the `)` that closes a list left open on this line — asked ONCE a line
      RE_RENDER.lastIndex = 0;
      for (let m = RE_RENDER.exec(p); m; m = RE_RENDER.exec(p)) {
        const at = m.index + m[0].length, c = p[at];
        // (a field: `render = () => …`, `render = <T,>(row) => …`, `render = this.renderRow` — never an element's attribute,
        // `render={…}` / `render="…"`, nor a local variable: `const render = this.options.inline` — review 4 of 1.35.2)
        if (c === "=") { const v = p.slice(at + 1, at + 1 + DS_CALL_PEEK).trimStart(); if (!RE_LOCAL_BEFORE.test(p.slice(Math.max(0, m.index - 8), m.index)) && (v[0] === "(" || RE_NAME_HEAD.test(v) || RE_VALUE_GENERIC.test(v))) return true; continue; }
        if (c === ":") { if (RE_VALUE_FUNCTION.test(p.slice(at + 1, at + 1 + DS_CALL_PEEK).trimStart())) return true; continue; }
        let j = m.index - 1;
        while (j >= 0 && (p[j] === " " || p[j] === "\t")) j--;
        if (p[j] === "?") continue; // (a ternary's call: `ready ? render(job) : <Spinner />` — its `:` is no return type)
        if (close == null) close = closers(p);
        let rest;
        if (close[at] !== -1) rest = readOn(k, p.slice(close[at] + 1).trimStart()); // (one `)` ends a line: once a line)
        else {
          if (below === undefined) { below = null; for (let q = k + 1; below == null && q < next[i] && q <= k + DS_DECL_LINES; q++) { const t = plain[q].trimStart(); if (t[0] === ")") below = readOn(q, t.slice(1).trimStart()); } }
          if (below == null) continue;
          rest = below;
        }
        if (rest[0] === "{" || rest[0] === ":") return true;
      }
    }
    return false;
  };
  // a statement's extent: [i, next[i]) — does a line of it …, its last line with text, the first ones after its own
  // (whether a statement holds JSX is asked once a statement: every entry of an `Object.assign` literal or of a
  // `module.exports = { … }` asks it of the statement it stands in — review 1 of 1.35.3, quadratic in the entries)
  const jsxAt = new Map();
  const scan = (i, flags) => { for (let k = i; k < next[i]; k++) if (flags[k]) return true; return false; };
  const holds = (i, flags) => { if (flags !== jsx) return scan(i, flags); if (!jsxAt.has(i)) jsxAt.set(i, scan(i, flags)); return jsxAt.get(i); };
  const matches = (i, re) => { for (let k = i; k < next[i]; k++) if (re.test(plain[k])) return true; return false; };
  const last = (i) => { for (let k = next[i] - 1; k > i; k--) if (code[k].trim() !== "") return k; return i; };
  const rows = (i, max) => { const out = []; for (let k = i + 1; k < next[i] && out.length < max; k++) if (code[k].trim() !== "") out.push(code[k].trim()); return out; };
  const after = (i) => { const below = rows(i, 1); return below.length ? below[0] : null; };
  return { code, body, tpl, next, jsx, plain, called, holds, matches, last, after, rows, renders };
}
// The parameters a function names, read from `from` on ONE line: `(a, b)`, `<T,>(props: P<T>)`, `function Name(a)`,
// `props => …` → { count (null: the list goes on below), first (its first parameter, as written) } | null (no list).
// A `<` is a type argument's only right after a name (`P<A, B>`): `{ wide = width > 600, a }` holds a comparison.
function paramList(s, from) {
  let k = from, angle = 0;
  for (; k < s.length; k++) {
    const c = s[k];
    if (c === "=" && s[k + 1] === ">") { if (angle === 0) return { count: 1, first: s.slice(from, k).trim() }; k++; continue; }
    if (c === "<") angle++;
    else if (c === ">") { if (angle > 0) angle--; } else if (angle === 0 && c === "(") break;
  }
  if (k >= s.length) return null;
  const none = {};
  let depth = 0, count = 0, first = null, text = false;
  angle = 0;
  for (let j = k; j < s.length; j++) {
    const c = s[j];
    if (isQuote(c)) { const e = quoteEnd(s, j, none); if (e !== -1) j = e; text = true; continue; }
    if (c === "=" && s[j + 1] === ">") { j++; text = true; continue; }
    if (c === "<") { if (angle > 0 || RE_WORD_CHAR.test(s[j - 1])) angle++; text = true; continue; }
    if (c === ">") { if (angle > 0) angle--; text = true; continue; }
    if (c === "(" || c === "[" || c === "{") { if (depth > 0) text = true; depth++; continue; }
    if (c === ")" || c === "]" || c === "}") {
      if (--depth === 0) return { count: count + (text ? 1 : 0), first: (first == null ? s.slice(k + 1, j) : first).trim() };
      continue;
    }
    if (c === "," && depth === 1 && angle === 0) { if (first == null) first = s.slice(k + 1, j); count++; text = false; } else if (c !== " " && c !== "\t") text = true;
  }
  return { count: null, first: (first == null ? s.slice(k + 1) : first).trim() };
}
// A PascalCase function that shows it is no component — by a PROPERTY, never its name: it takes a component (its first
// parameter is a capitalised name: `function WithTheme(Component)`, a HOC), or three parameters and more (a component
// takes its props, and a ref), or the file CALLS it as a function (a component is rendered, `<Total />`, or handed
// over — never called) AND it renders nothing itself — no JSX in its own statement: a name before a `(` is not always
// a call (JSX text, a method's name, a regex), and a function that returns JSX is a component whoever calls it
// (review 1 of 1.35.2). 1.35.1 listed every PascalCase function, knowingly; what is still listed is the helper nothing
// tells apart — exported, never called in its file, with one or two lower-case parameters.
const RE_COMPONENT_PARAM = /^\p{Lu}/u;
const isHelper = (name, view, i, params) => (view.called.has(name) && !view.holds(i, view.jsx)) ||
  (params != null && ((params.count != null && params.count >= 3) || RE_COMPONENT_PARAM.test(params.first)));
// The statement of a line without the decorators before it: `@observer export class X …`, `@Component({ … }) class Y …`
// → "" when a decorator stands alone or its arguments go on below (the statement is not on this line: the line ends). Linear.
const RE_DECORATOR_CHAR = /[\p{L}\p{N}_$.]/u;
function undecorated(s) {
  let i = 0;
  for (;;) {
    while (s[i] === " " || s[i] === "\t") i++;
    if (s[i] !== "@") return s.slice(i);
    i++;
    while (i < s.length && RE_DECORATOR_CHAR.test(s[i])) i++;
    if (s[i] !== "(") continue;
    const none = {};
    let depth = 0;
    for (; i < s.length; i++) {
      if (isQuote(s[i])) { const e = quoteEnd(s, i, none); if (e !== -1) i = e; continue; }
      if (s[i] === "(") depth++;
      else if (s[i] === ")" && --depth === 0) { i++; break; }
    }
  }
}
// The entries of a `{ … }` list read from one text, from `from` to the `}` that closes it (or the text's end) — an object
// literal's, a destructuring's: cut at the `,` of its own depth → [[key, value | null (a shorthand)]] (a value holding a
// `:` of its own — a ternary, a type — is kept whole).
function braceEntries(list, from) {
  const out = [], none = {};
  let depth = 0, start = from, k = from;
  const push = (to) => {
    const entry = list.slice(start, to).trim();
    if (entry === "") return;
    const colon = entry.indexOf(":");
    out.push(colon === -1 ? [entry, null] : [entry.slice(0, colon).trim(), entry.slice(colon + 1).trim()]);
  };
  for (; k < list.length; k++) {
    const c = list[k];
    if (isQuote(c)) { const e = quoteEnd(list, k, none); if (e !== -1) k = e; continue; }
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") { if (depth === 0) break; depth--; } else if (c === "," && depth === 0) { push(k); start = k + 1; }
  }
  push(k);
  return out;
}
// A value without the cast after it: `forwardRefWithAs(TabFn) as unknown as Tab`, `Origin as Compound` — cut at the first
// ` as ` / ` satisfies ` that stands in no bracket and no string.
function uncast(v) {
  if (!v.includes(" as ") && !v.includes(" satisfies ")) return v;
  const none = {};
  let depth = 0;
  for (let k = 0; k < v.length; k++) {
    const c = v[k];
    if (isQuote(c)) { const e = quoteEnd(v, k, none); if (e !== -1) k = e; continue; }
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") { if (depth > 0) depth--; } else if (c === " " && depth === 0 && (v.startsWith(" as ", k) || v.startsWith(" satisfies ", k))) return v.slice(0, k);
  }
  return v;
}
// A value in parentheses, unwrapped — a cast inside them aside: `(Root as any)` → `Root` (four deep at most). Linear.
function unwrapped(v) {
  const none = {};
  for (let d = 0; d < 4 && v[0] === "(" && v.endsWith(")"); d++) {
    let depth = 0, k = 0;
    for (; k < v.length; k++) {
      const c = v[k];
      if (isQuote(c)) { const e = quoteEnd(v, k, none); if (e !== -1) k = e; continue; }
      if (c === "(") depth++;
      else if (c === ")" && --depth === 0) break;
    }
    if (k !== v.length - 1) break;
    v = uncast(v.slice(1, -1).trim());
  }
  return v;
}
// A line's statements, cut at each `;` of no bracket's depth and no string's (1.35.3) → their texts, each trimmed at its start. Linear.
function statementsOf(line) {
  const out = [], none = {};
  let depth = 0, from = 0;
  for (let k = 0; k < line.length; k++) {
    const c = line[k];
    if (isQuote(c) && opensString(line, k)) { const e = quoteEnd(line, k, none); if (e !== -1) k = e; continue; }
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") { if (depth > 0) depth--; } else if (c === ";" && depth === 0) { out.push(line.slice(from, k + 1).trimStart()); from = k + 1; }
  }
  const rest = line.slice(from).trimStart();
  if (rest !== "") out.push(rest);
  return out;
}
const RE_LOCAL_NAME = /^[\p{L}_$][\p{L}\p{N}_$]*$/u;
// Where the LAST argument list of a call opens, at the call's own depth: its first `(` — the callee's type arguments
// aside —, then each `(` that follows a `)` back at that depth (`connect(a)(` …; never a `)(` inside an argument:
// `() => select(id)()`). → its place, -1 when the text holds no call. Linear.
function lastList(value) {
  const none = {};
  let open = -1, depth = 0, angle = 0;
  for (let k = 0; k < value.length; k++) {
    const c = value[k];
    if (isQuote(c)) { const e = quoteEnd(value, k, none); if (e !== -1) k = e; continue; }
    if (angle > 0) { if (c === "<") angle++; else if (c === ">") angle--; continue; }
    if (c === "<" && depth === 0 && open === -1) { angle++; continue; }
    if (c === "(" || c === "[" || c === "{") { if (c === "(" && depth === 0 && (open === -1 || value[k - 1] === ")")) open = k; depth++; } else if (c === ")" || c === "]" || c === "}") { if (depth > 0) depth--; }
  }
  return open;
}
// What a call is given FIRST, on its line: the text after the `(` of its last list → "" when the list opens and the
// line ends, null when the text holds no call.
const givenFirst = (value) => { const open = lastList(value); return open === -1 ? null : value.slice(open + 1).trimStart(); };
// The arguments of that list, cut at the commas of its own depth — never one inside a bracket, a string, or the
// arguments of a type (`{ Header } as Record<string, React.FC>`: a `<` right after a name, at the list's own depth — a
// comparison inside a function given, `/a<b/`, opens none: review 4 of 1.35.2) → their texts (the last may
// go on below), null when the text holds no call. Linear.
function givenArgs(value) {
  const open = lastList(value);
  if (open === -1) return null;
  const args = [], none = {};
  const push = (from, to) => { const t = value.slice(from, to).trim(); if (t !== "") args.push(t); };
  let start = open + 1, k = open + 1;
  for (let depth = 0, angle = 0, fresh = true; k < value.length; k++) {
    const c = value[k];
    // (fresh: nothing read yet — a generic arrow that begins the FIRST argument, the one a name or a component is asked of, `<T,>(p) => …`, opens a type's list)
    const begins = fresh && c !== " " && c !== "\t";
    if (begins) fresh = false;
    if (isQuote(c)) { const e = quoteEnd(value, k, none); if (e !== -1) k = e; continue; }
    if (c === "<") { if (depth === 0 && (angle > 0 || RE_WORD_CHAR.test(value[k - 1]) || (begins && RE_VALUE_GENERIC.test(value.slice(k, k + DS_CALL_PEEK))))) angle++; continue; }
    if (c === ">") { if (depth === 0 && angle > 0) angle--; continue; }
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") { if (depth === 0) break; depth--; } else if (c === "," && depth === 0 && angle === 0) { push(start, k); start = k + 1; }
  }
  push(start, k);
  return args;
}
const RE_CURRIED_LINE = /^[\]})]*\)(?=\()/; // a line that opens a call's next list: `)(`, `})(` (Prettier's break of a curried call)
const RE_LONE_NAME = /^(\p{Lu}[\p{L}\p{N}_$]*),?$/u; // a HOC's one argument on a line of its own (a formatter's break of a long line)
const RE_COMPOUND_NAME = /^\p{Lu}[\p{L}\p{N}]*(?:\.\p{Lu}[\p{L}\p{N}]*)?$/u; // a component's name — or a part's: `Card.Header`
const RE_PART_KEY = /^\p{Lu}[\p{L}\p{N}_$]*$/u; // a part's key is a component's name: `Header` — never `displayName`, `defaultProps`
const RE_PART = /^(\p{Lu}[\p{L}\p{N}_$]*)\.(\p{Lu}[\p{L}\p{N}_$]*)\s*=/u; // `Card.Header = …`
const RE_OBJECT_ASSIGN = /^Object\.assign\s*\(/;
const RE_EXPORT_ASSIGN = /^export\s+default\s+Object\.assign\s*\(/;
const RE_EXPORT_DECORATED = /^export\s+(?:default\s+)?(?=@)/;
const RE_DESTRUCTURED = /^(?:export\s+)?(?:const|let|var)\s*\{/;
const RE_REQUIRE = /^require\s*\(\s*["']([^"']*)["']/;
const RE_NAME_HEAD = /^[\p{L}_$][\p{L}\p{N}_$]*/u;
const RE_VALUE_SPACED = /^([\p{L}_$][\p{L}\p{N}_$]*)\.(?:forwardRef|memo|lazy)(?![\p{L}\p{N}_$])/u; // React's wrapper under an import's name: `R.forwardRef(`
const RE_VALUE_CALL = /^(?:[\p{L}_$][\p{L}\p{N}_$]*\.)*[\p{L}_$][\p{L}\p{N}_$]*(?=[(<])/u; // a call: `observer(`, `connect(a)(`, `withStyles<P>(`
const RE_HOC_ARG = /\(\s*(\p{Lu}[\p{L}\p{N}_$]*)\s*\)+\s*;?$/u; // …whose last argument list is ONE capitalised name: `withRouter(Nav)`, `inject("s")(observer(Nav))`
const RE_IIFE_END = /^\s*[})\]]*\)\s*\(/; // the last line of a function called at once: `})();`
const RE_WRAPPED_CALL = /^(?:[\p{L}_$][\p{L}\p{N}_$]*\.)?[\p{L}_$][\p{L}\p{N}_$]*\s*[(<]/u; // (of what a `(` holds) a call: `(React.forwardRef(…)) as X`
// (of a statement's code) a function given: an arrow, `function`, a method's shorthand (`wrapElement(el, props) {` — review 1
// of 1.35.3: a kit's `withProvider("div", "root", { wrapElement(…) { return <…> } })` was lost)
const RE_GIVES_FUNCTION = /=>|(?<![\p{L}\p{N}_$.])function(?![\p{L}\p{N}_$])|(?<![\p{L}\p{N}_$.])[\p{L}_$][\p{L}\p{N}_$]*\s*\([^()]*\)\s*\{/u;
const NONE = 0, WEAK = 1, STRONG = 2; // what a declaration shows (exportedComponents' kindOf)
// a literal's start — and a promise of a module, `import("./chart")`: no component
const RE_PLAIN_VALUE = /^(?:["'`\d.!{[\/+-]|(?:true|false|null|undefined|void|typeof|delete|await)(?![\p{L}\p{N}_$])|import\s*\()/u;
const RE_CREATE_CONTEXT = /^(?:[\p{L}_$][\p{L}\p{N}_$]*\.)?createContext\s*[(<]/u; // React's API, a closed list of one: a context
// (of what a call is given first) a component's name or member — a HOC's shape —, or a string: an element factory's tag
// (`withContext("span", "indicator", { defaultProps: { children: <Icon /> } })`, review 1 of 1.35.3 — the shape of
// `t("hint", { link: <a /> })` too, which is listed knowingly: a component file holds the first far more often)
const RE_HOC_FIRST = /^(?:(?:[\p{L}_$][\p{L}\p{N}_$]*\.)*\p{Lu}[\p{L}\p{N}_$]*\s*(?:[,)]|$)|["'`])/u;
const RE_CJS_EXPORT = /^(?:module\.)?exports\.(\p{Lu}[\p{L}\p{N}_$]*)\s*=(?![=>])/u; // CommonJS: `exports.Button = …`
const RE_CJS_MODULE = /^module\.exports\s*=(?![=>])/; // …`module.exports = { Button }`, `= Button`
const RE_EXPORT_DEFAULT = /^export\s+default\s/;
function exportedComponents(text) {
  const declared = new Set(); // the names declared as a component (a part's too: `Card.Header`)
  const classes = new Set(); // …those declared as a component CLASS: what a class below them may extend
  const imported = new Set(); // the names an `import` clause holds (a superset: its every word), a `require`'s
  const react = new Set(); // …the ones that name React itself, `React` aside: `import * as R from "react"`
  const aliases = []; // [name, the name it stands on — one the file imports or declares] — settled once the whole file is read
  const applies = []; // [name, the name a function is applied to, curried?]: `withRouter(Nav)`, `withStyles(styles)(Cell)`
  const borrowed = []; // [name, the name it was destructured from] — imported once that one is
  const spaced = []; // [name, the name its wrapper is asked of]: `R.forwardRef(…)`
  const parts = new Map(); // a component → the parts the file hangs on it: `Card.Header = …`, `Object.assign(Card, { Header })`
  const exported = []; // [exported name, local name], as the file exports them
  const stands = new Map(); // a name → the component it stands on by its bare name: `const Card = CardRoot`, `Object.assign(CardRoot, …)` — its parts too
  const own = new Set(); // the declared names that are a component by a declaration of the FILE — never by an import alone
  const strong = new Set(); // …those that are one by what they ARE (kindOf's STRONG): what the project's files never settle
  const reexported = []; // the names the file re-exports under a name of its own, or from a package: `export { Root as Dialog } from "…"`
  let defaultName = null; // the name the file's default export has (what `import X from "./file"` brings)
  const plain = new Set(); // the names whose value is a literal (kindOf): no name to settle
  const mine = (name, kind) => { declared.add(name); own.add(name); if (kind === STRONG) strong.add(name); };
  const view = scriptView(text);
  const code = view.code;
  const budget = { ahead: view.body.length }; // (declaredValue)
  const part = (owner, key) => { if (!parts.has(owner)) parts.set(owner, new Set()); parts.get(owner).add(key); };
  // a `{ … }` list that opens on a line and may go on below → { list, rest (what follows its `}`), at (its last line) } | null
  const braces = (i, line) => {
    let list = line.slice(line.indexOf("{") + 1), end = list.indexOf("}"), at = i;
    for (let last = i + DS_EXPORT_LIST_LINES; end === -1 && at + 1 < code.length && at < last;) {
      const more = code[++at];
      const k = more.indexOf("}");
      if (k !== -1) end = list.length + 1 + k;
      list += "," + more;
    }
    return end === -1 ? null : { list: list.slice(0, end), rest: list.slice(end + 1), at };
  };
  // What the LAST argument list of a call over lines holds first, when a later line of its statement opens that list:
  // a line at the statement's OWN margin that begins with closers and `)(` (`})((props) => …`; an indented one is an
  // argument's own call) → its text after the `(` — the next line's when the list opens and the line ends —, null when
  // there is none or only an empty list (`)();`). One pass over the extent.
  const curriedFirst = (i) => {
    const head = view.plain[i], pad = head.length - head.trimStart().length;
    let first = null;
    for (let k = i + 1; k < view.next[i]; k++) {
      const l = code[k];
      const m = RE_CURRIED_LINE.exec(l.slice(pad)); // (read from the statement's margin: an indented one begins with blanks)
      if (!m) continue;
      let given = givenFirst(l.slice(pad + m[0].length));
      if (given === "") { given = null; for (let q = k + 1; given == null && q < view.next[i] && q <= k + DS_DECL_LINES; q++) if (code[q].trim() !== "") given = code[q].trim(); }
      if (given != null && given[0] !== ")") first = given;
    }
    return first;
  };
  // What a declared value is → STRONG (a component by what it is: a function that renders, React's wrapper, a `styled`
  // one) | WEAK (one by what it shows — a function that renders nothing itself, a call: what the project's other files
  // tell may still settle it, 1.35.3) | NONE. What only the whole file can tell waits in `aliases` / `applies` /
  // `spaced`: another component under a new name, a function applied to one, React's wrapper under an import's name.
  // piece: the value is an ENTRY of a list read as one text (an `Object.assign` literal's) and is asked of its own text
  // — never of the statement it stands in (review 1 of 1.35.2: each entry walked the whole statement again — 12 s for a
  // 256K file — and a nested `Object.assign(` read the statement it stood in, forever).
  const kindOf = (name, value, i, piece) => {
    if (value == null || value === "") return NONE;
    // (a literal — a string, a number, an object, a list, `true`, `new X()` — is no component whatever the project does
    // with it: never a name to settle, 1.35.3)
    if (RE_PLAIN_VALUE.test(value)) { plain.add(name); return NONE; }
    const entry = piece != null;
    const last = entry ? i : view.last(i);
    const text = entry ? withoutStrings(piece) : null;
    const renders = () => (entry ? RE_JSX.test(text) : view.holds(i, view.jsx));
    if (value[0] === "(") {
      const inner = value.slice(1).trimStart();
      // an ELEMENT in parentheses (`= (` then `<svg …` — never `<T extends Row>(props) =>`, a generic arrow), React's
      // wrapper in parentheses (`(forwardRef(…)) as X`), a function called at once (`(function () {` … `})();`): by
      // what the statement holds, not by its `(`
      if (!entry && inner === "") { const below = view.after(i); if (below != null && below[0] === "<" && !RE_VALUE_GENERIC.test(below)) return NONE; }
      if (RE_WRAPPED_CALL.test(inner)) {
        if (RE_VALUE_WRAPPER.test(inner)) return STRONG;
        const ns = RE_VALUE_SPACED.exec(inner);
        if (ns) { spaced.push([name, ns[1]]); return NONE; }
      }
      if (last !== i && inner !== "" && functionValue(inner, true) && RE_IIFE_END.test(code[last])) return NONE;
    }
    if (functionValue(value)) return isHelper(name, view, i, paramList(value, 0)) ? NONE : renders() ? STRONG : WEAK;
    if (RE_VALUE_WRAPPER.test(value)) return STRONG;
    const ns = RE_VALUE_SPACED.exec(value);
    if (ns) { spaced.push([name, ns[1]]); return NONE; }
    const bare = uncast(value);
    const alias = RE_VALUE_ALIAS.exec(bare);
    // (a BARE name is what the new one stands on — its parts are this one's too; a member of one is that member alone)
    if (alias && RE_VALUE_ALIAS_LAST.test(bare)) { aliases.push([name, alias[1]]); if (!bare.includes(".")) stands.set(name, alias[1]); return NONE; }
    if (RE_OBJECT_ASSIGN.test(value)) {
      // (an entry that is one itself — `Item: Object.assign(MenuItem, { Icon })` — is the component it is given)
      if (!entry) assigned(name, i);
      else { const first = RE_NAME_HEAD.exec(value.slice(value.indexOf("(") + 1).trimStart()); if (first) aliases.push([name, first[0]]); }
      return NONE;
    }
    if (!RE_VALUE_CALL.test(value)) return NONE;
    // (a context is no component whatever the project does with it — React 19 renders one as its own provider, `<X value>`:
    // review 1 of 1.35.3, fourteen of a kit's)
    if (RE_CREATE_CONTEXT.test(value)) { plain.add(name); return NONE; }
    // Wrapped by any other function — `observer(…)`, a HOC, `dynamic(…)`: a component when its statement holds JSX (what
    // it wraps renders) or a dynamic `import(` (it loads on demand) — UNLESS what it is given FIRST is an object, a
    // list or an element: a configuration, whatever JSX it holds (`columnHelper.display({ cell: () => <b /> })`, a
    // router's routes, `Object.freeze([{ icon: <Home /> }])` — review 1 of 1.35.2), or an element handed over
    // (`renderToString(<p />)`). Review 3: asked instead whether an argument IS a function, the rule cut the arguments
    // apart and lost whatever a comma or a line break stood in (`observer(forwardRef<El, Props>(…))`, a wrapper whose
    // own list goes on below) — the older rule minus one shape loses none of them. `memoize(() => 1)` holds no JSX.
    let first = givenFirst(value);
    const below = !entry && first === "" ? view.rows(i, 2) : [];
    if (below.length) first = below[0];
    // (…of its LAST list, which a later line may open: `withStyles({ … })((props) => …)` over lines is given a function last,
    // `createFileRoute("/a")({ component: … })` an object — review 4 of 1.35.2; a lone `<` opens a generic's parameters)
    if (!entry && first != null) { const later = curriedFirst(i); if (later != null) first = later; }
    // (…and a FUNCTION is given — an arrow, `function`: what renders is a function's body. With none, the JSX is an element
    // handed over — `mount(root, <App />)`, `createRoot(el).render(<App />)`, `t("hint", { link: <a /> })`,
    // `createBrowserRouter(createRoutesFromElements(<Route />))` — and a promise of a module is none: 1.35.3. Unless what it
    // is given first is a component's name, a HOC's shape — `withContext(Ark.Arrow, "arrow", { defaultProps: { children:
    // <Tip /> } })`: review 1 of 1.35.3, six of a kit's lost)
    if (first != null && first[0] !== "{" && first[0] !== "[" && (first[0] !== "<" || first === "<" || RE_VALUE_GENERIC.test(first)) &&
      (RE_HOC_FIRST.test(first) || (entry ? RE_GIVES_FUNCTION.test(text) : view.matches(i, RE_GIVES_FUNCTION)))) {
      if (entry ? RE_JSX.test(text) || RE_DYNAMIC_IMPORT.test(text) : view.holds(i, view.jsx) || view.matches(i, RE_DYNAMIC_IMPORT)) return WEAK;
    }
    // …or what it is given renders as a class does — a `render` and JSX: `createReactClass({ render() { … } })`
    if (!entry && view.renders(i) && view.holds(i, view.jsx)) return WEAK;
    // …or it is applied to a component: its last argument list is that one name, a cast after it aside — one the file
    // DECLARES (`withRouter(Nav)`), or, when the application is CURRIED (`withStyles(styles)(TableCell)`, `connect(…)(List)`
    // — the shape of a HOC), one it imports. Of a name the file only imports a single call says nothing:
    // `Object.freeze(IconSizes)`, `createStore(RootReducer)`, `z.nativeEnum(Status)` were listed (review 1 of 1.35.2).
    const hoc = (t) => { const m = RE_HOC_ARG.exec(t); return m ? [name, m[1], m.index > 0 && t[m.index - 1] === ")"] : null; };
    const applied = hoc(bare.trimEnd()) || (!entry && last !== i ? hoc(uncast(code[last]).trimEnd()) : null);
    if (applied) applies.push(applied);
    // (…that one name on a line of its own, the `)` below it: a long line a formatter broke)
    const lone = below.length === 2 && below[1][0] === ")" ? RE_LONE_NAME.exec(below[0]) : null;
    if (lone) applies.push([name, lone[1], value.trimEnd().endsWith(")(")]);
    return NONE;
  };
  // `Object.assign(Card, { Header: CardHeader, Body })` — a component's parts given at once: the capitalised keys of its
  // literal, each asked of its own text. owner: the name it is assigned to (none: Card itself). → the name of the
  // component it is given | null: none — a component written there, an `Object.assign` of anything else (`({}, defaults)`).
  function assigned(owner, i) {
    const lines = [];
    for (let k = i; k < view.next[i]; k++) lines.push(code[k]);
    const text = lines.join(" ");
    const args = givenArgs(text.slice(text.indexOf("Object.assign")));
    if (!args || !args.length) return null;
    // its parts: the capitalised keys of every literal it is given after its first argument — never a `{` of the first
    // (a cast's type, a component written there)
    const entries = [];
    for (let k = 1; k < args.length; k++) if (args[k][0] === "{") for (const e of braceEntries(args[k], 1)) if (RE_PART_KEY.test(e[0])) entries.push(e);
    const head = unwrapped(uncast(args[0])); // (`Object.assign((Root as any), { Item })`: Root — review 4)
    const first = RE_VALUE_ALIAS.test(head) ? RE_NAME_HEAD.exec(head)[0] : null;
    const to = owner == null ? first : owner;
    if (to == null) return null; // (a component written there, and no name to hang its parts on)
    if (first != null) {
      // a NAME first: with parts it is the compound idiom — that component under a new name; with none (`{ displayName }`,
      // a second name) it is one only of a component of the file's own, as a single call of any function is
      // (a member first — `Object.assign(Card.Root, { Title })` — is that member alone: nothing stands on its owner, review 4)
      if (owner != null) { if (!head.includes(".")) stands.set(owner, first); if (entries.length) aliases.push([owner, first]); else applies.push([owner, first, false]); }
    } else { const k = kindOf(owner, args[0], i, args[0]); if (k) mine(owner, k); } // a component WRITTEN there (`forwardRef(…)`, a function)
    // (the parts are recorded whatever the first argument is — review 3 of 1.35.2: decided first, a HOC's call there
    // returned before them, and `Object.assign(contextConnect(Root, "Menu"), { Item })` lost the menu and its twelve parts)
    for (const [key, value] of entries) {
      part(to, key);
      if (value == null) aliases.push([to + "." + key, key]);
      else { const k = kindOf(to + "." + key, value, i, value); if (k) mine(to + "." + key, k); }
    }
    // (…and a CALL first — a HOC with its arguments — is a component when one of its parts is: the idiom says so; never
    // `{}`, `new Emitter()` — a registry of components is none, review 4 of 1.35.2)
    if (first == null && RE_VALUE_CALL.test(head)) for (const [key] of entries) aliases.push([owner, owner + "." + key]);
    return first;
  }
  // CommonJS (1.35.3): `exports.Button = …` / `module.exports.Button = …` is a declaration, exported; `module.exports = {
  // Button, Card: CardRoot }` an export list (a value written there is asked as a declaration's); `module.exports =
  // Button;` the default. → the statement's last line read, -1 when the line is none of them.
  function commonJs(i, line) {
    const named = RE_CJS_EXPORT.exec(line);
    if (named) {
      let value = line.slice(named[0].length).trim();
      for (let m = i + 1; value === "" && m < view.next[i]; m++) value = code[m].trim();
      const k = kindOf(named[1], value, i);
      if (k) mine(named[1], k);
      exported.push([named[1], named[1]]);
      return i;
    }
    const whole = RE_CJS_MODULE.exec(line);
    if (!whole) return -1;
    const rest = line.slice(whole[0].length).trim();
    if (rest[0] === "{") {
      // (its literal read as one text, by the depth of its brackets — a value may hold braces of its own: `{ A: () => { … }, B }`)
      const lines = [];
      for (let k = i; k < view.next[i]; k++) lines.push(code[k]);
      const text = lines.join(" ");
      for (const [key, value] of braceEntries(text, text.indexOf("{") + 1)) {
        if (!RE_PART_KEY.test(key)) continue;
        if (value == null || RE_LOCAL_NAME.test(value)) { exported.push([key, value == null ? key : value]); continue; }
        const k = kindOf(key, value, i, value);
        if (k) mine(key, k);
        exported.push([key, key]);
      }
      return view.next[i] - 1;
    }
    const bare = RE_EXPORT_DEFAULT_NAME.exec("export default " + rest);
    if (bare) { exported.push([bare[1], bare[1]]); defaultName = bare[1]; }
    return i;
  }
  for (let i = 0; i < code.length; i++) {
    let line = code[i];
    // (a line that starts inside a template is no statement's — scriptView starts none there —, and asked here its extent
    // ran to the next start, the file's end: once a line, quadratic — review 4 of 1.35.2)
    if (view.tpl[i] || line === "") continue;
    let c = line[0];
    // an indented `export` is the module's own; a decorator on the line of what it decorates is not the statement
    if (c === " " || c === "\t") { if (!RE_INDENTED_EXPORT.test(line)) continue; line = line.trimStart(); c = "e"; }
    if (c === "@") line = undecorated(line);
    else if (c === "e" && line.includes("@")) { const d = RE_EXPORT_DECORATED.exec(line); if (d) line = d[0] + undecorated(line.slice(d[0].length)); }
    if (line !== code[i]) { code[i] = line; c = line[0]; } // (the readers below read the statement itself)
    if (c === undefined) continue;
    if (c !== "e" && c !== "f" && c !== "c" && c !== "a" && c !== "l" && c !== "v" && c !== "i") { // export, function, class / const, async, let, var, import
      if (c === "m") { const at = commonJs(i, line); if (at !== -1) { i = at; continue; } }
      if (c >= "a" && c <= "z") continue;
      // …or a part hung on a component: `Card.Header = …`, `Object.assign(Card, { … })` — two on one line too, each asked
      // of its own text (1.35.3: `Card.Header = Header; Card.Body = Body;` gave the first the second's)
      const hung = RE_PART.exec(line);
      if (hung) {
        const pieces = line.indexOf(";") < line.trimEnd().length - 1 ? statementsOf(line) : [line];
        for (let s = 0; s < pieces.length; s++) {
          const h = s === 0 ? hung : RE_PART.exec(pieces[s]);
          if (!h) continue;
          let value = pieces[s].slice(h[0].length).trim();
          if (s === pieces.length - 1) for (let m = i + 1; value === "" && m < view.next[i]; m++) value = code[m].trim();
          part(h[1], h[2]);
          const k = kindOf(h[1] + "." + h[2], value, i, pieces.length > 1 ? value : undefined);
          if (k) mine(h[1] + "." + h[2], k);
        }
      } else if (RE_OBJECT_ASSIGN.test(line)) assigned(null, i);
      continue;
    }
    if (c === "i") {
      // `import X, { a, b as c } from "…"` — its clause may go on over lines, to the module's quote. An import STATEMENT
      // only, and to where one ends: review 2 of 1.35.1 — `import Dialog = Radix.Dialog;`, `import.meta.env.X;` and
      // `importantSetup();` hold no quote, and each took the lines below it for its clause (the declarations there unseen).
      if (!RE_IMPORT.test(line)) continue;
      let clause = importCut(line), end = clause.search(RE_IMPORT_END);
      for (let last = i + DS_EXPORT_LIST_LINES; end === -1 && i + 1 < code.length && i < last;) {
        const more = importCut(code[++i]);
        const at = more.search(RE_IMPORT_END);
        if (at !== -1) end = clause.length + 1 + at;
        clause += " " + more;
      }
      const words = clause.slice(0, end === -1 ? clause.length : end).match(RE_IDENTIFIERS) || [];
      for (const w of words) imported.add(w);
      // (the names of an import of `react` name React: `import * as R from "react"` — `R.forwardRef(…)` is its wrapper)
      if (end !== -1 && /^["']react["']/.test(clause.slice(end))) for (const w of words) react.add(w);
      continue;
    }
    const fn = RE_DECL_FN.exec(line);
    if (fn) {
      if (fn[2] === "function") { if (!isHelper(fn[3], view, i, paramList(line, fn[0].length))) mine(fn[3], view.holds(i, view.jsx) ? STRONG : WEAK); } else {
        // a class is a component by what it EXTENDS — React's own, or a component class declared above it (a base class
        // of the file: a class is declared before the one that extends it) — or, whatever it extends (an imported
        // base, a mixin), by what it DOES: it has a `render` and its body holds JSX (weak: a renderer of anything else
        // has one too — the project's `new Renderer(…)` settles it, 1.35.3)
        const sup = RE_CLASS_EXTENDS.exec(classHeader(code, i, fn[0].length, budget));
        if (sup && (RE_REACT_CLASS.test(sup[1]) || classes.has(sup[1]))) { mine(fn[3], STRONG); classes.add(fn[3]); } else if (view.renders(i) && view.holds(i, view.jsx)) { mine(fn[3], WEAK); classes.add(fn[3]); }
      }
      if (fn[1]) exported.push([fn[3], fn[3]]);
      if (fn[1] && RE_EXPORT_DEFAULT.test(line)) defaultName = fn[3];
      continue;
    }
    const cn = RE_DECL_CONST.exec(line);
    if (cn) {
      const value = declaredValue(code, i, cn[0].length, budget);
      const required = value == null ? null : RE_REQUIRE.exec(value);
      // (`const Radix = require(…)` is an import by another word)
      if (required) { imported.add(cn[2]); if (required[1] === "react") react.add(cn[2]); } else { const k = kindOf(cn[2], value, i); if (k) mine(cn[2], k); }
      if (cn[1]) exported.push([cn[2], cn[2]]);
      continue;
    }
    if (RE_DESTRUCTURED.test(line)) {
      // `const { Root, Trigger: Open } = DialogPrimitive;`, `= require(…)` — names the file BORROWS: what an alias may
      // stand on, as an import's (`export const Close = Root;`). One that never closes is given up as an export list is.
      // Exported so (`export const { Header, Content } = Layout;`), each is a name the project's files may settle (1.35.3).
      const b = braces(i, line);
      if (!b) { i = Math.min(code.length - 1, i + DS_EXPORT_LIST_LINES); continue; }
      i = b.at;
      const rest = b.rest.trimStart();
      if (rest[0] !== "=") continue;
      const source = rest.slice(1).trimStart();
      const from = RE_REQUIRE.test(source) ? null : (RE_NAME_HEAD.exec(source) || [""])[0];
      if (from === "") continue;
      const out = line[0] === "e";
      for (const [key, value] of braceEntries(b.list, 0)) {
        const local = RE_NAME_HEAD.exec(value == null ? key : value); // (`A`, `A: B`, `A = dflt`: the name it gives)
        if (!local) continue;
        borrowed.push([local[0], from]);
        if (out) exported.push([local[0], local[0]]);
      }
      continue;
    }
    const byName = RE_EXPORT_DEFAULT_NAME.exec(line.trimEnd());
    if (byName) { exported.push([byName[1], byName[1]]); defaultName = byName[1]; continue; }
    if (RE_EXPORT_ASSIGN.test(line)) { const owner = assigned(null, i); if (owner) { exported.push([owner, owner]); defaultName = owner; } continue; }
    { const at = commonJs(i, line); if (at !== -1) { i = at; continue; } }
    if (!line.startsWith("export") || !/^export\s*\{/.test(line)) continue;
    // `export { A, B as C, type D }` — it may go on over lines; followed by `from`, it re-exports another file's: a name
    // of its own (`Root as Dialog`) or a package's (`export { Button } from "@acme/ui"`) is one the project may settle
    // (1.35.3) — a file's of the project under its own name is that file's
    const b = braces(i, line);
    if (!b) { i = Math.min(code.length - 1, i + DS_EXPORT_LIST_LINES); continue; }
    i = b.at;
    const from = /^from\s*["']([^"']*)["']/.exec(b.rest.trimStart());
    if (b.rest.trimStart().startsWith("from")) {
      if (from) for (const entry of b.list.split(",")) {
        const words = entry.trim().split(/\s+/);
        if (!words[0] || words[0] === "type") continue;
        if (words[1] === "as" && words[2] && words[2] !== "default") reexported.push(words[2]);
        else if (!words[1] && from[1][0] !== ".") reexported.push(words[0]);
      }
      continue;
    }
    for (const entry of b.list.split(",")) {
      const words = entry.trim().split(/\s+/);
      if (!words[0]) continue; // (`type X`: its "name" is the lower-case word — no component)
      const as = words[1] === "as" && words[2] ? words[2] : words[0];
      exported.push([as === "default" ? words[0] : as, words[0]]);
      if (as === "default") defaultName = words[0];
    }
  }
  // What only the whole file tells — a function declared BELOW is hoisted, an import may follow its use (review 2 of
  // 1.35.1: asked at the declaration, `export const Modal = Dialog;` above `function Dialog()` was no component):
  // React's wrapper under an import's name; a name borrowed from an import's; another component under a new name — a
  // capitalised name the file imports or declares, or a member of one; a function applied to one it declares — or,
  // curried, imports.
  for (const [name, ns] of spaced) if (react.has(ns)) mine(name, STRONG);
  for (let pass = 0, found = aliases.length + applies.length + borrowed.length > 0; found && pass < DS_ALIAS_PASSES; pass++) {
    found = false;
    for (const b of borrowed) if (!imported.has(b[0]) && (b[1] == null || imported.has(b[1]) || declared.has(b[1]))) { imported.add(b[0]); found = true; }
    for (const a of aliases) {
      if (!declared.has(a[0]) && (imported.has(a[1]) || declared.has(a[1]))) { declared.add(a[0]); found = true; }
      if (!own.has(a[0]) && own.has(a[1])) { own.add(a[0]); found = true; }
      if (!strong.has(a[0]) && strong.has(a[1])) { strong.add(a[0]); found = true; } // (another name of a strong one is one)
    }
    // (a single call needs a component of the FILE's own — an alias of an import is one by that import's word alone:
    // `const PMap = Plugins; … Object.entries(PMap)` was listed, review 2 of 1.35.2; a curried one may stand on any)
    for (const a of applies) if (!declared.has(a[0]) && (own.has(a[1]) || (a[2] && (imported.has(a[1]) || declared.has(a[1]))))) { mine(a[0], WEAK); found = true; }
  }
  const exportedOwn = exported.length; // (the names the file exports itself — its parts' are pushed below)
  // A component's parts are exported with it, under each name it is exported by: `Card.Header`. Each name once,
  // DS_EXPORT_NAMES of them in all — the names of a file are kept that far, and a file of 7,000 parts exported under
  // 7,000 names is 49 million names no one reads (review 1 of 1.35.2: the process died of it).
  // Its own and the ones hung on what it stands on (`CardRoot.Header = …; export const Card = CardRoot; Card.Body = …`:
  // DS_ALIAS_PASSES deep); a name exported twice (by name and as the default) is expanded once — else its parts took
  // the room of the next component's, without a word (review 3 of 1.35.2).
  let more = budget.ahead < 0, room = DS_EXPORT_NAMES; // (more: a declaration went unread, a part past the cap — said)
  // (each owner's parts that are components, settled once — never once an exported name; a key hung on the root AND on
  // its alias is one part, and a part that is no component spends no room: review 4 of 1.35.2)
  const expanded = new Set(), settled = new Map();
  const partsOf = (owner) => {
    if (!settled.has(owner)) settled.set(owner, parts.has(owner) ? [...parts.get(owner)].filter((key) => declared.has(owner + "." + key)) : []);
    return settled.get(owner);
  };
  for (let k = 0, n = exported.length; k < n && room >= 0; k++) {
    const [name, local] = exported[k];
    if (expanded.has(name) || !declared.has(local)) continue;
    expanded.add(name);
    const given = new Set();
    chain: for (let owner = local, d = 0; owner != null && d <= DS_ALIAS_PASSES; owner = stands.get(owner), d++) {
      for (const key of partsOf(owner)) {
        if (given.has(key)) continue;
        given.add(key);
        if (room-- === 0) { more = true; break chain; }
        exported.push([name + "." + key, owner + "." + key]);
      }
    }
  }
  const names = [], seen = new Set(), weak = new Set(), locals = new Map();
  for (const [name, local] of exported) {
    if (!declared.has(local) || !RE_COMPOUND_NAME.test(name) || seen.has(name)) continue;
    if (names.length >= DS_EXPORT_NAMES) { more = true; break; }
    seen.add(name);
    names.push(name);
    locals.set(name, local);
    // (weak: what the project may settle — never a top-level alias of an import, which it nearly always renders: listed
    // as the rules have it, and asking each read the project's files for nothing — review 1 of 1.35.3)
    if (!strong.has(local) && (own.has(local) || local.includes("."))) weak.add(name);
  }
  // What the file exports and the rules do not settle (1.35.3) — a name another file may RENDER: `motion(Box)`,
  // `createComponent(config)`, a class that renders through its imported base, `export const { Header } = Layout`, a
  // part hung on an imported component, a re-export under a name of its own. Each name once, DS_EXPORT_NAMES of them.
  const candidates = [];
  let full = false;
  const candidate = (name, local) => {
    if (seen.has(name) || !RE_COMPOUND_NAME.test(name) || plain.has(local)) return;
    if (candidates.length >= DS_EXPORT_NAMES) { more = full = true; return; }
    seen.add(name);
    candidates.push({ name, local });
  };
  // (each owner's parts that are neither a component nor a literal, settled once — never once an exported name: 2,090
  // names of a root with 4,000 statics were 8 million names asked)
  const loose = new Map();
  const looseOf = (owner) => {
    if (!loose.has(owner)) loose.set(owner, parts.has(owner) ? [...parts.get(owner)].filter((key) => !declared.has(owner + "." + key) && !plain.has(owner + "." + key)) : []);
    return loose.get(owner);
  };
  for (let k = 0; k < exportedOwn && !full; k++) {
    const [name, local] = exported[k];
    if (!declared.has(local)) candidate(name, local);
    for (const key of looseOf(local)) candidate(name + "." + key, local + "." + key);
  }
  for (const name of reexported) candidate(name, null);
  return { names, more, weak, locals, candidates, defaultName, view };
}
// --- what the project's files tell of a component file's names (1.35.3) ------------------------------------------------------------
// A name one file cannot settle — a call that shows nothing (`motion(Box)`), a class that renders through its imported
// base, a PascalCase function that renders nothing itself — another file can: a component is RENDERED (`<MotionBox />`,
// `<Card.Header>`), a helper is CALLED (`FormatPrice(value)` — scriptView's `called`), a context is given to `useContext(X)`
// or provides (`<X.Provider>`), and a part that is an enum's member is read as an object (`Button.Sizes.Large`).
// usesOf(view) → { rendered, called, contexts, members — the names as the file writes them (`Card.Header`, `UI.Button`) —,
// imports: local name → { spec (the module), name: the name it has there ("default", "*" for a namespace) } }.
// A tag is `<Name` (capitalised) or `<a.b` (a member: `<motion.div`, `<UI.Button`) where an expression may start — never
// after a name or a `)` / `]` (`a < B`, `useState<Item>(`, `Array<Card>`), never a type's parameter (`<T,>`,
// `<T extends X>`, `<T = unknown>`) — and every closing tag `</Name`. Strings, comments and a template's text aside. Linear.
const RE_TAG_NAME = /<(\/?)([\p{L}_$][\p{L}\p{N}_$]*(?:\.[\p{L}_$][\p{L}\p{N}_$]*)*)/gu;
const RE_TAG_KEYWORD = /(?:^|[^\p{L}\p{N}_$])(?:return|yield|await|default|case|else)$/u; // the words an element may follow
const RE_TYPE_PARAM_AFTER = /^(?:[=,]|extends(?![\p{L}\p{N}_$]))/u;
const RE_CONTEXT_TAG = /^(.+)\.(?:Provider|Consumer)$/;
// a context read: `useContext(X)` (any namespace's), React 19's `use(X)` (bare or React's — never `app.use(Router)`)
const RE_USE_CONTEXT = /(?<![\p{L}\p{N}_$.])(?:(?:[\p{L}_$][\p{L}\p{N}_$]*\.)?useContext|(?:React\.)?use)\s*\(\s*([\p{L}_$][\p{L}\p{N}_$]*(?:\.[\p{L}_$][\p{L}\p{N}_$]*)?)\s*[,)]/gu;
// a part read as an object: `Button.Sizes.Large`, `UI.List.Sizes.Large` (through a namespace) — never in a tag
const RE_MEMBER_READ = /(?<![\p{L}\p{N}_$.<\/])((?:[\p{L}_$][\p{L}\p{N}_$]*\.)?[\p{L}_$][\p{L}\p{N}_$]*\.\p{Lu}[\p{L}\p{N}_$]*)\.[\p{L}_$]/gu;
const RE_SELF_CLOSED = /^[^<>]*\/>/; // (of what follows a tag's name) it closes itself: `Press <Kbd /> to save` — no comparison, no type's arguments
const RE_REQUIRE_DECL = /^(?:export\s+)?(?:const|let|var)\s+(?:([\p{L}_$][\p{L}\p{N}_$]*)|\{([^}]*)\})\s*=\s*require\s*\(\s*["']([^"']+)["']\s*\)/u;
const RE_NAMESPACE_IMPORT = /^\*\s*as\s+([\p{L}_$][\p{L}\p{N}_$]*)$/u;
const RE_FROM_END = /(?:^|\s)from$/;
// an `import` clause (what stands between `import` and the module's quote) → its names, into `into`
function importClause(text, spec, into) {
  let t = text.trim();
  if (RE_FROM_END.test(t)) t = t.slice(0, -4).trim();
  if (t === "") return; // (`import type …` needs no skip: a name only a type is can be neither rendered nor called)
  const open = t.indexOf("{");
  for (const h of (open === -1 ? t : t.slice(0, open)).split(",")) {
    const w = h.trim();
    const ns = RE_NAMESPACE_IMPORT.exec(w);
    if (ns) into.set(ns[1], { spec, name: "*" });
    else if (RE_LOCAL_NAME.test(w)) into.set(w, { spec, name: "default" });
  }
  if (open === -1) return;
  const close = t.indexOf("}", open);
  for (const entry of t.slice(open + 1, close === -1 ? t.length : close).split(",")) {
    const w = entry.trim().split(/\s+/);
    if (!w[0]) continue;
    const local = w[1] === "as" && w[2] ? w[2] : w[0];
    if (RE_LOCAL_NAME.test(local)) into.set(local, { spec, name: w[0] });
  }
}
function usesOf(view) {
  const { code, plain, tpl } = view;
  const rendered = new Set(), contexts = new Set(), providers = new Set(), members = new Set(), imports = new Map();
  for (let i = 0; i < plain.length; i++) {
    if (tpl[i]) continue;
    const p = plain[i];
    const l = code[i];
    // an import — its clause may go on over lines, to the module's quote (an `import X = Y.Z;` has none: no module)
    if (l[0] === "i" && RE_IMPORT.test(l)) {
      let clause = importCut(l), k = i, q = clause.search(RE_IMPORT_END);
      while (q === -1 && k + 1 < code.length && k < i + DS_EXPORT_LIST_LINES) {
        const more = importCut(code[++k]);
        const at = more.search(RE_IMPORT_END);
        if (at !== -1) q = clause.length + 1 + at;
        clause += " " + more;
      }
      if (q !== -1 && isQuote(clause[q])) {
        const e = clause.indexOf(clause[q], q + 1);
        if (e !== -1) importClause(clause.slice(6, q), clause.slice(q + 1, e), imports);
      }
      i = k;
      continue;
    }
    if (l[0] === "c" || l[0] === "l" || l[0] === "v" || l[0] === "e") {
      const r = RE_REQUIRE_DECL.exec(l);
      if (r) {
        if (r[1]) imports.set(r[1], { spec: r[3], name: "*" });
        else for (const [key, value] of braceEntries(r[2], 0)) { const local = value == null ? key : value; if (RE_LOCAL_NAME.test(key) && RE_LOCAL_NAME.test(local)) imports.set(local, { spec: r[3], name: key }); }
        continue;
      }
    }
    if (p.includes("<")) {
      RE_TAG_NAME.lastIndex = 0;
      for (let m = RE_TAG_NAME.exec(p); m; m = RE_TAG_NAME.exec(p)) {
        const name = m[2];
        if (!name.includes(".") && !RE_COMPONENT_PARAM.test(name)) continue; // an intrinsic element: `<div`
        if (!m[1]) {
          const end = m.index + m[0].length, c = p[end];
          if (c !== undefined && c !== " " && c !== "\t" && c !== ">" && c !== "/") continue;
          let j = m.index - 1;
          while (j >= 0 && (p[j] === " " || p[j] === "\t")) j--;
          // (after a name or a `)` / `]`: a comparison or a type's arguments — unless it closes itself, JSX text's `Press <Kbd />`)
          if (j >= 0 && (p[j] === ")" || p[j] === "]" || (RE_WORD_CHAR.test(p[j]) && !RE_TAG_KEYWORD.test(p.slice(Math.max(0, j - 7), j + 1)))) && !RE_SELF_CLOSED.test(p.slice(end, end + DS_CALL_PEEK))) continue;
          if ((c === " " || c === "\t") && RE_TYPE_PARAM_AFTER.test(p.slice(end, end + DS_CALL_PEEK).trimStart())) continue;
        }
        // (a provider's tag, as written: a context's `<X.Provider>` — or a part of a component named so, settle tells)
        if (RE_CONTEXT_TAG.test(name)) providers.add(name);
        else rendered.add(name);
      }
    }
    if (p.includes("use")) { RE_USE_CONTEXT.lastIndex = 0; for (let m = RE_USE_CONTEXT.exec(p); m; m = RE_USE_CONTEXT.exec(p)) contexts.add(m[1]); }
    if (p.includes(".")) { RE_MEMBER_READ.lastIndex = 0; for (let m = RE_MEMBER_READ.exec(p); m; m = RE_MEMBER_READ.exec(p)) members.add(m[1]); }
  }
  return { rendered, called: view.called, contexts, providers, members, imports };
}
// A token file by its name AND its place (tokenFileKind):
//   style — a stylesheet named for its tokens (tokens.css, _tokens.scss, tokens.dark.css, _variables.scss, theme.css): anywhere;
//   named — a name that can only mean design tokens, in any format (design-tokens.json, colors.tokens.json,
//           tailwind.config.ts): anywhere;
//   theme — theme.json / theme.ts: ANYWHERE but in a folder that holds something else by that name (NOT_UI_DIRS:
//           `src/store/theme.ts` is a state slice, `server/models/theme.js` a model). Wide on purpose — a WordPress theme's
//           wp-content/themes/acme/theme.json, Expo's constants/theme.ts, apps/web/theme.ts: listing one too many costs a
//           path in a list, missing one loses the project's tokens (review 4);
//   plain — tokens.json / tokens.ts only at the project's root or in a telling folder: `src/auth/tokens.ts`,
//           `src/ui/auth/tokens.ts` and `ui/lib/tokens.ts` hold access tokens, not colours. NARROW on purpose — the name is
//           everyone's. Never the singular `token.json` (an OAuth client's file).
// "In a folder": `src/` aside — packages/ui/src/tokens.ts lives in `ui` (homeDir). And a name is no proof of what a file
// holds: only a value that IS a design value is ever read out of one (designValue). (A name's further parts are letters and
// digits only: with the separator inside the part's class, `tokens-a-a-a-…` backtracked exponentially.)
const RE_TOKEN_STYLE = /^(?:_?(?:design[-_.]?)?tokens(?:[-_.][A-Za-z0-9]+)*|_?variables|theme)\.(?:css|scss|sass|less)$/i;
const RE_TOKEN_NAMED = /^(?:design[-_.]?tokens?(?:[-_.][A-Za-z0-9]+)*\.(?:json|ya?ml|js|cjs|mjs|ts)|[A-Za-z0-9_-]+\.tokens\.(?:json|ya?ml)|tailwind\.config\.(?:js|cjs|mjs|ts))$/i;
const RE_TOKEN_THEME = /^theme\.(?:json|ya?ml|js|cjs|mjs|ts)$/i;
const RE_TOKEN_PLAIN = /^tokens\.(?:json|ya?ml|js|cjs|mjs|ts)$/i;
const TOKEN_DIRS = new Set(["styles", "style", "theme", "themes", "design", "design-system", "designsystem", "design-tokens", "tokens", "ui"]);
const NOT_UI_DIRS = new Set(["store", "stores", "state", "redux", "slices", "reducers", "models", "model", "entities", "schemas", "schema", "db", "database",
  "migrations", "services", "controllers", "api", "server", "backend", "fixtures", "mocks", "__mocks__", "tests", "test", "__tests__", "e2e", "types", "hooks",
  "context", "contexts", "scripts"]);
// The folder a file lives in, `src/` aside (packages/ui/src/tokens.ts → "ui"); "" at the project's root or source root.
const homeDir = (segs) => { let i = segs.length - 2; while (i >= 0 && RE_SRC_DIR.test(segs[i])) i--; return i < 0 ? "" : segs[i].toLowerCase(); };
function tokenFileKind(rel) {
  const segs = rel.split("/"), name = segs[segs.length - 1];
  if (RE_TOKEN_STYLE.test(name)) return "style";
  if (RE_TOKEN_NAMED.test(name)) return "named";
  if (RE_TOKEN_THEME.test(name)) return segs.slice(0, -1).some((d) => NOT_UI_DIRS.has(d.toLowerCase())) ? null : "theme"; // (any folder above: store/modules/theme.ts)
  if (RE_TOKEN_PLAIN.test(name)) return segs.length === 1 || TOKEN_DIRS.has(homeDir(segs)) ? "plain" : null;
  return null;
}
const isTokenFile = (rel) => tokenFileKind(rel) != null;
// A token's name as the registry's reader gives it back (its cell cleaned, lower-cased; "" for a slot word or a cell with no
// letter): what a token of the code is compared by — `_palette.red` is listed once seeded, though its row reads `palette.red`.
const registryName = (n) => (dsNameSlot(n) ? "" : dsCell(n).toLowerCase());
// …and a global stylesheet that declares the custom properties itself (the shadcn / Tailwind 4 habit): a token file once it
// declares at least this many FOR THE WHOLE PAGE. Two things say so, and neither is the folder it lies in (review 5 listed
// the folders a global sheet may be in and lost six ordinary ones; review 6 listed the folders a component's own sheet is
// in and failed both ways — `ui/Card/index.css` read as global, `modules/web/src/styles/globals.css` not read):
//   - its NAME, when it can only be the page's: `globals.css` / `global.css` — every custom property of it counts,
//     whatever its selector (a theme on `[data-theme]` or `.light` / `.dark` alone, a mixin's);
//   - what it DECLARES, for a name a component's own sheet has too (index, styles, main, app, base, root, site,
//     application, tailwind, custom, input): the custom properties of a page-wide block — styleTokens' `global`.
// A CANDIDATE by its name, never every stylesheet: review 7 read them all, and an Angular component's `:host { --x }`, a
// vendored Bootstrap's 16 dist files and 25 theme files each became a source, filling the 20 for good (review 8). The price,
// said in the user docs: a global sheet under another name is not read — name it in `_Token sources:_` by hand. One that
// turns out to be none costs one read, takes no source's place and says no bound; the search ends at DS_TOKEN_READS.
const RE_SHEET = /\.(?:css|scss)$/i;
const RE_CSS_MODULE = /\.module\.[a-z]+$/i;
const RE_GLOBAL_NAME = /^_?globals?\./i; // (a Sass partial's underscore aside: `_globals.scss`, `_base.scss`)
const RE_COMMON_NAME = /^_?(?:app|application|main|styles?|base|root|site|tailwind|custom|input)\./i;
const RE_INDEX_NAME = /^_?index\./i;
// (0: globals.css · 1: a name an app gives its one stylesheet · 2: index.css — a component folder's too · 3: no candidate)
const sheetRank = (name) => (RE_GLOBAL_NAME.test(name) ? 0 : RE_COMMON_NAME.test(name) ? 1 : RE_INDEX_NAME.test(name) ? 2 : 3);
const isSheetCandidate = (name) => RE_SHEET.test(name) && !RE_CSS_MODULE.test(name) && sheetRank(name) < 3;
const GLOBAL_CSS_MIN = 5;
const RE_STYLE_EXT = /\.(?:css|scss|sass|less|styl)$/i;
// A view or style file — what a feature's raw values are read in (tasks.js RE_VIEW_FILE's text formats, and a component's .js).
const RE_VIEW_EXT = /\.(?:tsx|jsx|vue|svelte|astro|html?|css|scss|sass|less|styl|erb|cshtml|razor|twig|hbs|handlebars|mustache|ejs|pug)$|\.blade\.php$/i;
const isViewFile = (rel) => RE_VIEW_EXT.test(rel) || RE_NG_COMPONENT.test(rel) || (RE_JS_COMPONENT.test(rel) && componentOf(rel) != null);
// The third-party UI libraries a package.json names (dependencies of any kind) — the registry's `_Libraries:_`.
const UI_LIBRARIES = ["@mui/material", "@mui/joy", "antd", "@chakra-ui/react", "@mantine/core", "@headlessui/react", "@headlessui/vue", "react-bootstrap",
  "reactstrap", "primereact", "primevue", "vuetify", "element-plus", "naive-ui", "quasar", "@angular/material", "@ionic/react", "@ionic/vue", "@ionic/angular",
  "@fluentui/react", "@fluentui/react-components", "@nextui-org/react", "@heroui/react", "flowbite-react", "daisyui", "@carbon/react", "@adobe/react-spectrum",
  "react-aria-components", "@ark-ui/react", "bootstrap-vue", "semantic-ui-react", "grommet", "evergreen-ui", "@blueprintjs/core", "@shopify/polaris",
  "@radix-ui/themes", "@skeletonlabs/skeleton", "@nuxt/ui", "bits-ui", "@kobalte/core"];
// → { libraries, cut (a bound of the workspace patterns left a declared folder unread), read (the workspace manifests read) }
function packageLibraries(root) {
  const names = projectDependencies(root); // (quality.js: the root manifest and the workspaces' — contained, bounded)
  const out = UI_LIBRARIES.filter((l) => names.has(l));
  if ([...names].some((n) => n.startsWith("@radix-ui/react-")) && !out.includes("@radix-ui/themes")) out.push("@radix-ui");
  return { libraries: out, cut: names.cut === true, read: names.read || 0 };
}
// Comments out of one line of a stylesheet or a view file — `/* … */` (it may span lines: st.block), `<!-- … -->` (st.html) and,
// with o.slashSlash, a `//` comment at the line's start or after a blank. o.sheet: the line is a stylesheet's — there a `/*`
// opens a comment anywhere; in markup and code only where one can start (the line's start, after a blank or one of `{ ( ; ,` —
// JSX's `{/* … */}`): `accept="image/*"` and `path="/app/*"` hold none (read as one, the rest of the file went unseen). And
// never inside a quoted string of a stylesheet's line (quotedPlaces): Tailwind 4's `@source "../components/*.tsx";` and
// sass-glob's `@import "mixins/*";` opened one that never closed — a globals.css read as holding no token (review 7). Linear.
// → the places of a stylesheet's line that lie inside a quoted string (1), comments followed as withoutComments follows them
//   (block: the line starts inside one); null when the line holds no quote or no `/*` — nothing to tell apart.
//   script: the line is a script's — its strings are `"…"`, `'…'` and `` `…` `` that CLOSE on the line (quoteEnd), and a
//   `/*` opens a comment where withoutComments lets one open. Review 2 of 1.35.1: read by the stylesheet's rule, the
//   apostrophe of `<p>Don't</p>` or of a template's text quoted the rest of its line, and a real `/*` after it opened
//   nothing — the comment's lines were read as code.
const RE_COMMENT_PLACE = /[\s{(;,]/;
function quotedPlaces(line, block, script) {
  if (!(line.includes("/*") || (script && line.includes("//"))) || !(line.includes("\"") || line.includes("'") || (script && line.includes("`")))) return null;
  const mask = new Uint8Array(line.length);
  const none = {};
  let quote = "", comment = block, start = true; // start: the line's start, or right where a comment ended
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (comment) { if (c === "*" && line[i + 1] === "/") { comment = false; i++; start = true; } continue; }
    if (quote) {
      mask[i] = 1;
      if (c === BS) { if (++i < line.length) mask[i] = 1; } else if (c === quote) quote = "";
      continue;
    }
    const opens = !script || start || RE_COMMENT_PLACE.test(line[i - 1]);
    start = false;
    if (c === "/" && line[i + 1] === "*" && opens) { comment = true; i++; continue; }
    if (script) {
      if (isQuote(c) && opensString(line, i)) { const e = quoteEnd(line, i, none); if (e !== -1) { mask.fill(1, i, e + 1); i = e; } }
    } else if (c === "\"" || c === "'") { quote = c; mask[i] = 1; }
  }
  return mask;
}
const RE_LINE_COMMENT = /(?:^|\s)\/\//g;
function withoutComments(line, st, o) {
  // (o.script: a script's line — a `/*` inside a quoted string opens none there either; o.html === false: `<!--` is no
  // comment in a script — 1.35.1: `const OPEN = "<!--[if mso]>"` hid the rest of a component file from the export reader)
  const quoted = o.sheet || o.script ? quotedPlaces(line, st.block, !!o.script) : null;
  // nb, h: the next `/*` that opens a comment past where one can only open by its place, and the next `<!--`, at or after i
  // (-2: not looked for yet, -1: none left). Each is looked for ONCE past a position and its "none left" is KEPT — re-scanned
  // from i after every comment, a line of `<!---->` and `a/*` runs was quadratic (review 3: h; review 4: the `/*`; review
  // 5: a `/*` right at i overwrote the cached -1, and `<!---->/**/` runs rescanned the rest of the line each time).
  let out = "", i = 0, nb = -2, h = o.html === false ? -1 : -2;
  while (i < line.length) {
    if (st.block || st.html) {
      const close = st.block ? "*/" : "-->";
      const e = line.indexOf(close, i);
      if (e === -1) return out;
      i = e + close.length;
      st.block = st.html = false;
      continue;
    }
    let b = i; // right where a comment ended (or the line starts) a `/*` opens one, whatever precedes it
    if (!line.startsWith("/*", i)) {
      if (nb !== -1 && nb <= i) {
        nb = line.indexOf("/*", i + 1);
        while (nb !== -1 && ((quoted != null && quoted[nb] === 1) || (!o.sheet && !/[\s{(;,]/.test(line[nb - 1])))) nb = line.indexOf("/*", nb + 2);
      }
      b = nb;
    }
    if (h !== -1 && h < i) h = line.indexOf("<!--", i);
    const next = b === -1 ? h : h === -1 ? b : Math.min(b, h);
    const seg = next === -1 ? line.slice(i) : line.slice(i, next);
    if (o.slashSlash) {
      // (the `/*` of a `//* …` line comment opens nothing — Bootstrap 3's `//** doc`, a `//*****` banner: the `/` before it
      // is the comment's own; review 11: read as a block comment's opening, every variable below such a line was lost)
      // (a script's `//` inside a string that closes on its line is none — `code={\`pnpm add x // or npm i\`}`: review 1 of
      // 1.35.2 — the mask is the one a `/*` is asked of; a stylesheet's line is read as it always was)
      const text = next !== -1 && next === b ? seg + "/" : seg;
      RE_LINE_COMMENT.lastIndex = 0;
      for (let m = RE_LINE_COMMENT.exec(text); m; m = RE_LINE_COMMENT.exec(text)) {
        if (o.script && quoted != null && quoted[i + m.index + m[0].length - 2] === 1) continue;
        return out + seg.slice(0, m.index);
      }
    }
    out += seg;
    if (next === -1) break;
    if (next === b) st.block = true; else st.html = true;
    i = next + (next === b ? 2 : 4);
  }
  return out;
}
// --- a design value: THE gate on what is read out of a token file --------------------------------------------------------------
// The scan picks token files by NAME, and a name is no proof of what a file holds: a `deploy.tokens.json`, a root
// `tokens.json`, a `_variables.scss` may hold credentials (github_token, aws_secret_access_key, $mapbox-token) — and a value
// read here is printed by the report and WRITTEN into a steering file a team commits. No list of credential key names is
// ever complete (review 4: 14 of 19 credential shapes passed one). So nothing is shown by exclusion: a value is shown only
// when it IS a design value by its shape — a secret is a free string, and a free string has no design shape.
// A design value (≤ DV_MAX characters): parts separated by blanks, commas or slashes, each one of
//   a hex colour · a number with an optional unit · a {reference.path} · a CSS keyword of the list · an arithmetic sign
//   alone (`{spacing.sm} * 2`) · a function — rgb(…), var(…), calc(…), map-get(…), any name or none (a group) — whose
//   ARGUMENTS are design values themselves, read the same way: what guards a function is what it holds, never its name
//   (review 6: "any characters of a set" let `ENC(Xk29…)`, `url(//host/v1/KEY/x)` and `(SecretValue1)` through). Never
//   `url(…)`. Inside the arguments a custom property's name (`var(--x)`) is one too, and plain lower-case words beside a
//   part that is more than a bare number, or in a function CSS knows (`linear-gradient(to right, …)`, `env(safe-area-…)`);
//   in a stylesheet (sass) also a variable's name ($brand, -$gutter, @brand, --brand, `--#{$prefix}radius`), an
//   interpolation (#{$x}), a dotted path as an argument (Tailwind's `theme(spacing.16)`) and, beside a part that is more
//   than a bare number or a word, a plain lower-case word (`opacity .15s linear`, `1px solid tomato`).
// → null (none: a font stack, a quoted string, a url, any free text) | "weak" (it shows nothing that says DESIGN — bare
//   numbers, keywords, a time, a percentage, a `{placeholder}` with no path: `3599`, `none`, `3600s`, `{name}`) | "strong"
//   (a colour, a length, a {reference.path}, a design function — rgb, var, calc… — or a function holding one of them).
//   literal: only a value that holds NO free identifier — no variable, word or function of a name of its own — is one:
//   what is asked beneath a credential key, where `var(--…)` could wrap anything (a {reference.path} names a token).
// An identifier a value holds — a variable's, a function's name — is its author's and is printed with it; only a
// {reference}'s path is asked to be words (wordShaped), as the JSON keys it names are.
// Linear: one pass a level, DV_DEPTH levels.
const DV_MAX = 120;
const DV_DEPTH = 6; // nested functions read
const RE_DV_HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RE_DV_NUMBER = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/;
// (never CSS's `q`, a quarter-millimetre no token uses: "1Q" is a quarter of a year, and it said DESIGN of a file)
const RE_DV_LENGTH = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|em|pt|pc|cm|mm|in|ch|ex|lh|rlh|vh|vw|vi|vb|vmin|vmax|[dsl]v[hw]|cq[whib])$/i;
const RE_DV_MEASURE = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:%|ms|s|deg|rad|turn|fr|dpi|dppx|x)$/i; // a unit a config holds too (ttl: "3600s")
const RE_DV_REF = /^\{[A-Za-z_$][\w$-]*(?:\.[\w$-]+)*\}$/; // {color.primary}, {fontSize.0}
const RE_DV_VARIABLE = /^(?:-?\$[A-Za-z][\w.-]*|@[A-Za-z][\w-]*|--(?:[\w-]|#\{[\w.$-]+\})+|#\{[\w.$-]+\})$/;
const RE_DV_PROPERTY = /^--[\w-]+$/; // a custom property's name: an argument of var(), in any file
const RE_DV_FUNCTION = /^(?:[A-Za-z_-][\w.-]*)?$/; // a function's name — or none: a parenthesised group, `($a + $b) / 2`
// (the functions that SAY design — the strength of a value: `rate(5 minutes)` is a schedule, and is no value at all)
const RE_DV_DESIGN_FUNCTION = /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark|var|calc|clamp|cubic-bezier|(?:repeating-)?(?:linear|radial|conic)-gradient|darken|lighten|tint|shade|mix)$/i;
// (…and the ones CSS — and Tailwind: theme() — knows, whose arguments may be plain words alone: `env(safe-area-inset-top)`,
// `steps(4, end)`, `theme(spacing.16)`)
const RE_DV_CSS_FUNCTION = /^(?:env|min|max|minmax|repeat|fit-content|steps|theme|translate(?:[xyz]|3d)?|scale(?:[xyz]|3d)?|rotate(?:[xyz]|3d)?|skew[xy]?|blur|brightness|contrast|saturate|drop-shadow)$/i;
const RE_DV_WORD = /^[a-z][a-z-]*$/;
const RE_DV_PATH = /^[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+$/;
const DV_KEYWORDS = new Set(["none", "auto", "inherit", "initial", "unset", "transparent", "currentcolor", "solid", "dashed", "dotted", "double", "inset",
  "normal", "bold", "bolder", "lighter", "italic", "uppercase", "lowercase", "capitalize", "ease", "ease-in", "ease-out", "ease-in-out", "linear", "all",
  "infinite", "center", "left", "right", "top", "bottom", "thin", "medium", "thick", "hidden", "visible", "nowrap", "black", "white", "red", "green", "blue",
  "yellow", "orange", "purple", "pink", "gray", "grey", "silver", "gold", "navy", "teal", "cyan", "magenta",
  "display-p3", "rec2020", "a98-rgb", "prophoto-rgb"]); // (…and the colour spaces whose name holds a digit: `color(display-p3 1 0 0)`)
// WORDS — the shape of a JSON key that is printed as a token's name (and of a reference's path, which names such keys). Cut
// at whatever is no letter or digit, each part is letters, digits, or the two with at most two switches between them
// (gray900, 2xl, a11y, 8dp) — or a colour's own hex of 6 digits: a palette keyed by its values, `0d6efd`, `F5F5F5` —, and
// no blank-separated word reaches `max` characters. A NAME is printed as a value is, and nothing else gates one: a secret
// used as a key — a GUID (`3f2504e0-…`), an API key (`sk_live_4eC39Hq…`), a hash, a JWT — is letters and digits
// interleaved, or one long run (reviews 5 – 7: `{"ghp_…": 1700000000}`, a Json.NET map keyed by GUIDs, `{"Bearer eyJ…":
// {…}}` — a length bound with a blank exemption held none of the last two). A SECOND layer, and a statistical one: the
// shorter a key shaped like an API key, the more often it passes — about one in ten at 32 characters, one in four at
// 16 – 20, half at 12; a GUID one in fifty (reviews 8 and 9, 900 keys a shape) — what stands first is that a file must
// show it is a design file (jsonSource). Never asked of a stylesheet's own identifiers: `$color-f5f5f5` and
// `--w1280h720` are names their author chose, and review 7 dropped them with every value that referenced one. Linear.
const DS_KEY_MAX = 40; // a word of that many characters is no KEY's (a 40-character token, a JWT, a hash)…
const DS_REF_MAX = 80; // …a reference's whole path may be longer (`{semantic.color.background.interactive.primary.hover}`)
const DS_NAME_SWITCHES = 2;
function wordShaped(s, max) {
  let word = 0, start = -1, switches = 0, kind = 0, hex = true; // kind — of the last character: 1 a letter · 2 a digit
  for (let i = 0; i <= s.length; i++) {
    const c = i < s.length ? s.charCodeAt(i) : 32;
    if (c <= 32) word = 0; else if (++word >= max) return false;
    const k = c >= 48 && c <= 57 ? 2 : (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c > 127 ? 1 : 0;
    if (k === 0) {
      // a part ends: too many switches — unless it is a hex colour's digits
      if (start !== -1 && switches > DS_NAME_SWITCHES && !(hex && i - start === 6)) return false;
      start = -1;
      switches = kind = 0;
      hex = true;
      continue;
    }
    if (start === -1) start = i;
    if (kind !== 0 && k !== kind) switches++;
    if (k === 1 && !((c >= 65 && c <= 70) || (c >= 97 && c <= 102))) hex = false;
    kind = k;
  }
  return true;
}
// One level of a value → null (a part is none) | { strong (a part that says design), anchored (a part that is more than a
// bare number or a word), words (plain words seen), free (an identifier of the author's: a variable, a word, a function of
// a name of its own), parts }. inner: these are a function's arguments.
function dvScan(v, sass, inner, level) {
  let strong = false, anchored = false, words = false, free = false, start = 0, depth = 0, parts = 0;
  for (let i = 0; i <= v.length; i++) {
    const ch = i < v.length ? v[i] : " ";
    if (ch === "(") { depth++; continue; }
    if (ch === ")") { if (--depth < 0) return null; continue; }
    if (depth > 0 || !(ch === " " || ch === "\t" || ch === "," || ch === "/")) continue;
    const part = v.slice(start, i);
    start = i + 1;
    if (!part) continue;
    parts++;
    const open = part.indexOf("(");
    if (open !== -1) {
      // a function is no url(), and its arguments are design values in turn — one that does not END at its `)`
      // (`var(--a)FAKE`) leaves that `)` unmatched among them: none
      const name = part.slice(0, open);
      if (!RE_DV_FUNCTION.test(name) || /^url$/i.test(name) || level >= DV_DEPTH) return null;
      const args = dvScan(part.slice(open + 1, -1), sass, true, level + 1);
      const known = RE_DV_DESIGN_FUNCTION.test(name) || RE_DV_CSS_FUNCTION.test(name);
      // (…and a NAMED function holds something: `FAKEsecretValue123()` is a name alone)
      if (!args || (name !== "" && !args.parts) || (args.words && !args.anchored && !known)) return null;
      anchored = true;
      if (args.strong || RE_DV_DESIGN_FUNCTION.test(name)) strong = true;
      if (args.free || (name !== "" && !known)) free = true;
    } else if (RE_DV_HEX.test(part)) {
      // (a 4-digit hex — a colour with its alpha — is a value, and says nothing of a file: `#feed`, `#face`, `#dead` are words)
      anchored = true;
      if (part.length !== 5) strong = true;
    } else if (RE_DV_LENGTH.test(part)) strong = anchored = true;
    else if (RE_DV_REF.test(part)) {
      // a reference by its dotted path says design (`{color.primary}`); `{name}` alone is a template's placeholder too.
      // (Never `free`: it names a token of the file — and so it is words, as a key is: a braced GUID is none)
      if (!wordShaped(part, DS_REF_MAX)) return null;
      anchored = true;
      if (part.includes(".")) strong = true;
    } else if ((sass && RE_DV_VARIABLE.test(part)) || (inner && RE_DV_PROPERTY.test(part))) strong = anchored = free = true;
    else if (RE_DV_MEASURE.test(part)) anchored = true;
    else if (RE_DV_NUMBER.test(part) || part === "*" || part === "+" || part === "-" || DV_KEYWORDS.has(part.toLowerCase())) continue;
    else if (((sass || inner) && RE_DV_WORD.test(part)) || (sass && inner && RE_DV_PATH.test(part))) words = free = true;
    else return null;
  }
  return depth !== 0 ? null : { strong, anchored, words, free, parts };
}
function designValue(value, sass, literal) {
  const v = String(value == null ? "" : value).trim();
  if (!v || v.length > DV_MAX) return null;
  const r = dvScan(v, !!sass, false, 0);
  if (!r || !r.parts || (r.words && !r.anchored) || (literal && r.free)) return null;
  return r.strong ? "strong" : "weak";
}
// The tokens a stylesheet declares: custom properties (`--name: value`), Sass variables (`$name: value`) and, in a .less
// file, Less variables (`@name: value`), in file order — every one by its NAME, its value only when it is a design value
// (`$mapbox-token: "pk.…"` is listed with none) → [{ name, value, global }]. global: the token is declared for the whole
// page (pageWide) — what makes a stylesheet with a component's name a GLOBAL one.
// (A Sass interpolation's braces are set aside while a line is cut at `{ } ;` — `calc(100vh - #{$header})` is one value.)
const INTERPOLATION = [String.fromCharCode(1), String.fromCharCode(2)];
function maskInterpolation(l) {
  if (!l.includes("#{")) return l;
  let out = "", i = 0;
  for (;;) {
    const a = l.indexOf("#{", i), b = a === -1 ? -1 : l.indexOf("}", a + 2);
    if (b === -1) return out + l.slice(i);
    out += l.slice(i, a) + "#" + INTERPOLATION[0] + l.slice(a + 2, b) + INTERPOLATION[1];
    i = b + 1;
  }
}
const SASS_FLAGS = ["!default", "!important", "!global"];
const RE_INDENTED_EXT = /\.sass$/i; // the indented syntax: a line's end ends a declaration, no `;`
// A token's name and its colon — the NAME alone is matched, the value is what follows it: `\s*:\s*(.*)$` over a whole line
// was quadratic (review 7: a tail `.` cannot cross — U+2028, a stray CR — after a run of blanks; 56 s for one 256K file).
// (Less: `@page` is the one at-rule a colon may follow — `@page :first` —, never a variable; a blank before the colon is a
// declaration's: Semantic UI's aligned `@primaryColor        : #2185d0;` — review 9: asked right after the name, such a file
// listed nothing.)
const RE_TOKEN_DECL = /^\s*(--[A-Za-z0-9_-]+|\$[A-Za-z0-9_-]+)\s*:/;
const RE_TOKEN_DECL_LESS = /^\s*(--[A-Za-z0-9_-]+|@(?!page(?![\w-]))[A-Za-z_][A-Za-z0-9_-]*)\s*:/;
// A block that declares for the WHOLE PAGE — decided ONCE, when it opens (pageWide), from its prelude and its parent:
//   a rule whose selector is `:root`, `html` or `body` — alone or qualified (`:root[data-theme=dark]`, `html.dark`, inside
//   `:where()` / `:is()`), never with a descendant (`body .card`) —, in any selector of its list (`:root, :host`, `:root,
//   .light`); a rule nested in one that only qualifies it (`:root { &.dark { … } }`); Tailwind 4's `@theme` and a theme
//   plugin's `@plugin "daisyui/theme" { … }`; any other at-rule takes its parent's answer (`@layer base { :root { … } }`,
//   `@media (prefers-color-scheme: dark) { :root { … } }`).
// Never `:host` alone: a web component's own scope (review 8: every Angular component's `:host { --card-padding: … }` was
// a token source). And never asked per declaration: walking the open blocks outward for each one was quadratic on nested
// at-rules (review 8: 16 s for one file).
const DS_PRELUDE = 2000; // a block prelude's characters kept — its END, the selectors nearest the `{`
const RE_ROOT_SELECTOR = /^(?::(?:where|is)\(\s*)?(?::root|html|body)(?![\w-])[^\s>+~]*$/i;
const RE_THEME_RULE = /^@(?:theme|plugin)(?![\w-])/i;
const RE_SELF_RULE = /^&[^\s>+~]*$/; // `&.dark`, `&[data-theme=dark]` — never `& .card`, a descendant
const RE_MIXIN = /^@mixin\s+([\w-]+)/, RE_INCLUDE = /^\s*@include\s+([\w-]+)/;
const RE_LESS_MIXIN = /^\s*[.#]/; // a Less statement that is a mixin's definition or call: `.button-variant(`, `#ns > .mixin(`
function pageWide(prelude, parent) {
  if (prelude[0] === "@") return RE_THEME_RULE.test(prelude) || (parent != null && parent.global);
  if (prelude[0] === "&") return parent != null && parent.global && prelude.split(",").some((x) => RE_SELF_RULE.test(x.trim()));
  return prelude.split(",").some((s) => RE_ROOT_SELECTOR.test(s.trim()));
}
function styleTokens(text, rel) {
  const plainCss = /\.css$/i.test(rel), indented = RE_INDENTED_EXT.test(rel), less = /\.less$/i.test(rel);
  const decl = less ? RE_TOKEN_DECL_LESS : RE_TOKEN_DECL;
  const out = [];
  const st = { block: false, html: false };
  const blocks = []; // the open blocks, innermost last: { id, global }
  let opened = 0; // (a block's id: its place among the blocks the file opens)
  let prelude = ""; // a block's prelude being read: it may start on the lines above its `{` (`:root,` then `.light {`)
  // A declaration no `;` / `}` ends on its line goes on below (a multi-line shadow, a Sass map): listed by its NAME — its
  // first line alone is no value. Two things end one without a `;`: the line's end in an indented file, and the block's end —
  // a block's last declaration needs none (`--gap: 8px` then `}` — or a lone `;` — on the next line with text, or the file's
  // end). Never a value that is none yet or stops at a `,`.
  let last = null; // the declaration the last line with text left open: { entry, value }
  // A `name:` INSIDE the parentheses a statement has opened is a parameter or a map's key, never a declaration — a mixin's
  // `$border: $background,` shadowed the real `$border: 1px solid #ccc` below it (the first of a name is kept). Counted
  // outside quoted strings, and closed by its `)`, by a `{` / `}` — and a STRAY `(` is undone where it stands: a line
  // that opens more than it closes and ends in neither `,` nor `(` goes on nowhere (`// spacing (in px` in a .css,
  // `$typo: fn(1px;`) — but in Less, where a mixin's parameters are separated by `;`: there a line that ends in one goes
  // on when the statement that opened the parenthesis is a mixin's — it begins with `.` or `#`
  // (`.button-variant(@color; @background;` then its defaults — review 10; review 11: asked of the LINE, "it holds no
  // declaration", a value's stray `(` swallowed down to the next brace and a call after a declaration was undone).
  // Undone to the count the line FOUND, never to none (a stray `(` inside an open list leaves the list open) — and never
  // the count a line found open: review 8 closed it at the end of ANY line that did not go on, and the last argument of
  // a call nested in a parameter list (`cubic-bezier(` … `1`) re-opened the parameters after it as declarations
  // (review 9). In an indented file, where no brace closes anything, a line at the margin is a statement
  // of its own. The exception: `@use … with (…)` / `@forward … with (…)`, whose parentheses hold the module's real
  // overrides (`config`).
  let paren = 0, config = false;
  const mixins = new Map(), themes = new Set(); // a mixin's block by its name · the blocks that turn out to be a theme's
  const settle =(ended) => { if (last && ended && designValue(last.value, true)) last.entry.value = last.value; last = null; };
  // a piece that declares a token → its entry (closed: a `;` / `}` ended it on its line), else null
  const declare = (piece, closed) => {
    const m = decl.exec(piece);
    if (!m) return null;
    let value = piece.slice(m[0].length).split(INTERPOLATION[0]).join("{").split(INTERPOLATION[1]).join("}").trim();
    for (const flag of SASS_FLAGS) if (value.endsWith(flag)) value = value.slice(0, -flag.length).trim();
    const whole = value !== "" && !value.endsWith(","); // (of an open declaration: what its line holds may be all of it)
    const block = blocks.length ? blocks[blocks.length - 1] : null;
    const entry = { name: m[1], value: (closed || (indented && whole)) && designValue(value, true) ? value : "", global: block != null && block.global, block: block ? block.id : 0 };
    out.push(entry);
    if (!closed && whole) last = { entry, value };
    return entry;
  };
  for (const raw of text.split(/\r?\n/)) {
    // (the WHOLE line: a minified token file is one line — its length is the file's read, and every step here is linear)
    const line = withoutComments(raw, st, { slashSlash: !plainCss, sheet: true });
    const trimmed = line.trim();
    if (!trimmed) continue;
    settle(trimmed[0] === "}" || trimmed[0] === ";");
    const masked = maskInterpolation(line);
    let from = 0, quote = "";
    const last1 = trimmed[trimmed.length - 1];
    if (indented && line[0] !== " " && line[0] !== "\t") paren = 0;
    const paren0 = paren;
    let inside = paren > 0, mixin = false; // mixin: the statement that opened the line's parenthesis is a Less mixin's
    for (let i = 0; i <= masked.length; i++) {
      const ch = i < masked.length ? masked[i] : "";
      // (a quoted string holds no delimiter: `--q: "{"`, `content: ";"` — it ends with its line)
      if (quote !== "" && ch !== "") { if (ch === BS && i + 1 < masked.length) i++; else if (ch === quote) quote = ""; continue; }
      if (ch === "\"" || ch === "'") { quote = ch; continue; }
      if (ch === "(") { if (less && paren <= paren0) mixin = RE_LESS_MIXIN.test(masked.slice(from, i)); paren++; } else if (ch === ")" && paren > 0) paren--;
      if (ch !== "" && ch !== ";" && ch !== "{" && ch !== "}") continue;
      const piece = masked.slice(from, i);
      from = i + 1;
      const within = inside && !config;
      if (prelude === "" && !inside) config = /^\s*@(?:use|forward)(?![\w-])/.test(piece);
      if (ch === "{" || ch === "}") paren = 0;
      else if (ch === "" && paren > paren0 && !(last1 === "," || last1 === "(" || (last1 === ";" && mixin))) paren = paren0;
      inside = paren > 0;
      const top = blocks.length ? blocks[blocks.length - 1] : null;
      if (ch === "{") {
        const text0 = (prelude + " " + piece).trim().slice(-DS_PRELUDE);
        blocks.push({ id: ++opened, global: pageWide(text0, top) });
        const mixin = RE_MIXIN.exec(text0);
        if (mixin) mixins.set(mixin[1], opened);
        prelude = "";
        continue;
      }
      const entry = within ? null : declare(piece, ch !== "");
      // (a mixin a page-wide block includes declares for the page: `:root { @include light-theme; }`)
      const include = !entry && top != null && top.global ? RE_INCLUDE.exec(piece) : null;
      if (include && mixins.has(include[1])) themes.add(mixins.get(include[1]));
      if (ch === "}") blocks.pop();
      // (a line that ends on neither is a selector going on — or a value's further line: a `;` / `}` drops it)
      prelude = ch === "" && !entry ? (prelude + " " + piece).trim().slice(-DS_PRELUDE) : "";
    }
  }
  settle(true);
  // A block that OVERRIDES the page-wide tokens of the file is a theme of the page — `.dark { --background: …; --sidebar: … }`
  // beside `:root { --background: … }`: what else it declares is a token too (shadcn's dark-only `--sidebar-primary`). At
  // least HALF of what it declares must be overrides: a component rule that re-points ONE page-wide token
  // (`.btn-outline-primary { --bs-gradient: none; … twelve --bs-btn-* }`) is no theme — review 9: its variables were seeded.
  const wide = new Set();
  for (const t of out) if (t.global) wide.add(t.name);
  const over = new Map(), size = new Map();
  for (const t of out) {
    if (t.global) continue;
    size.set(t.block, (size.get(t.block) || 0) + 1);
    if (wide.has(t.name)) over.set(t.block, (over.get(t.block) || 0) + 1);
  }
  for (const [block, n] of over) if (n * 2 >= size.get(block)) themes.add(block);
  if (themes.size) for (const t of out) if (themes.has(t.block)) t.global = true;
  return out;
}
// A key whose LAST word names a credential — token · secret(s) · password(s) · passphrase · credential(s) · api key ·
// secret key · private key · access key · bearer · authorization · jwt: github_token, clientSecret, SECRET_KEY,
// aws_secret_access_key, db_password, _authToken. A second layer under the value gate, never the gate itself: AT such a
// key, and anywhere beneath it (`password: {admin: 1234}`), only a value that could not be a credential is listed — a
// LITERAL that says design (a colour, a length, a function of numbers) or a {reference.path}; never a number, a keyword,
// nor anything that wraps an identifier (`var(--…)`) —, and a free string AT one makes the whole file a credentials file. (Never
// the plural `tokens`: a design file's own wrapper.) pin · otp · passcode GUARD the same way and never refuse a file:
// `map-pin` is an icon's name (review 6: with them among the credential words an icon token dropped its whole file).
const RE_CREDENTIAL_WORD = /(?:^|[-_.\s])(?:token|secrets?|passw(?:or)?ds?|passphrase|credentials?|api[-_]?keys?|apikeys?|secret[-_]?key|private[-_]?key|access[-_]?key|bearer|authorization|jwt)$/i;
const RE_GUARD_WORD = /(?:^|[-_.\s])(?:pin|otp|passcode)$/i;
const keyWords = (k) => String(k).slice(0, 80).replace(/([a-z0-9])([A-Z])/g, "$1_$2");
const credentialKey = (k) => RE_CREDENTIAL_WORD.test(keyWords(k));
const guardKey = (k) => { const w = keyWords(k); return RE_CREDENTIAL_WORD.test(w) || RE_GUARD_WORD.test(w); };
// A `type` that IS a design token's (DTCG, Tokens Studio, Style Dictionary). `value` and `type` are the two most generic
// JSON keys — beside `type: "hash"` / `"string"` they are a database dump's (review 6) —, and `$type` / `$value` are
// Json.NET's too (`{"$type": "System.Byte[], mscorlib", "$value": "…"}`): a `$type` that is a QUALIFIED name — a dot, a
// comma, a blank — is a serializer's (review 7: a serialized dictionary keyed by GUIDs was seeded as tokens through its
// `$type` alone), while a token tool's is ONE word, whichever it is (RE_TYPE_WORD: Tokens Studio's `other` / `text`, a
// `float` — review 8: asked to be a type of the list, `{$value: 4, $type: "float"}` was dropped with its value).
const RE_TOKEN_TYPE = /^(?:color|dimension|number|spacing|sizing|size|space|radius|border(?:Radius|Width)?|opacity|font(?:Famil(?:y|ies)|Weights?|Sizes?|Style)|lineHeights?|letterSpacing|paragraph(?:Spacing|Indent)|text(?:Case|Decoration)|typography|boxShadow|shadow|composition|asset|duration|time|easing|cubicBezier|strokeStyle|transition|gradient|z-?index|breakpoint)$/i;
const tokenType = (t) => typeof t === "string" && RE_TOKEN_TYPE.test(t);
const RE_TYPE_WORD = /^[A-Za-z][A-Za-z0-9-]{0,31}$/;
// (…of them, the words any data holds: `value` beside one is a token — and says nothing of what the FILE is)
const RE_GENERIC_TYPE = /^(?:number|size|space|asset|duration|time)$/i;
// A JSON token file's leaves: `{color: {primary: {$value: "#1d4ed8"}}}` (the design-tokens format; Tokens Studio's and Style
// Dictionary's `value` beside a `type`) and plain nested values → color.primary. Iterative, depth bounded; the whole document
// is walked (a file is read up to DS_READ_CHARS) → { list, secret, format, strong, more }:
//   list   — the leaves that ARE design values (designValue), [{name, value}] — and a token of a FORMAT whose value is free
//            text (a font stack) by its name alone. Nothing else leaves this function: a leaf's NAME is printed too, so a
//            key that is not WORDS (wordShaped: a GUID, an API key, a JWT) is left out with everything under it;
//   secret — a credential key holds a string with no design shape: a credentials file. The caller reads nothing of it;
//   format — a `$value` whose `$type`, if it has one, is a token type (the design-tokens format), or a `value` beside a
//            `type` that is one and no word any data holds (RE_GENERIC_TYPE — review 7: `{"sk_…": {"type": "time",
//            "value": 1700000000}}` made its file a design file);
//   strong — a leaf that SAYS design: a colour, a length, a design function, a {reference.path} (never `3599`, `3600s`,
//            `50%`, `{name}`);
//   more   — a leaf was left past the cap.
function jsonTokens(text) {
  const res = { list: [], secret: false, format: false, strong: false, more: false };
  let doc;
  try { doc = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text); } catch { return res; }
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const push = (at, value) => { if (res.list.length >= DS_TOKENS_MAX) res.more = true; else res.list.push({ name: at.join(".").slice(0, 200), value }); };
  // guarded: a credential (or guard) key is this leaf's own or above it
  const leaf = (at, v0, format, guarded) => {
    const v = String(v0).trim();
    if (guarded) {
      // only a value that could not be a credential: a literal that says design, a {reference.path}
      if (designValue(v, false, true) === "strong") { res.strong = true; push(at, v); }
      // a free string AT a credential key: a credentials file — unless it is a token of a format (`otp: {$value: "Roboto Mono"}`)
      else if (!format && typeof v0 === "string" && credentialKey(at[at.length - 1]) && !designValue(v, true)) res.secret = true;
      return;
    }
    const kind = designValue(v, false);
    if (kind === "strong") res.strong = true;
    if (kind) push(at, v); else if (format) push(at, "");
  };
  // a COMPOSITE token of a format — a shadow, a typography, a font-family list, DTCG's colour and dimension objects: by its
  // name alone (it was not listed at all: a file made of them was no source), or by its `hex` / its `{value, unit}`
  const composite = (at, v, guarded) => {
    if (guarded) return;
    const shown = typeof v.hex === "string" ? v.hex.trim() : typeof v.value === "number" && typeof v.unit === "string" ? v.value + v.unit : "";
    push(at, shown && designValue(shown, false) ? shown : ""); // (a token of a format: the file shows what it is already)
  };
  const stack = [[doc, [], 0, false]];
  while (stack.length) {
    const [node, at, depth, guarded] = stack.pop();
    if (node == null || typeof node !== "object" || Array.isArray(node)) {
      if (at.length && (typeof node === "string" || typeof node === "number")) leaf(at, node, false, guarded);
      continue;
    }
    const dtcg = own(node, "$value") && (!own(node, "$type") || (typeof node.$type === "string" && RE_TYPE_WORD.test(node.$type)));
    const v = dtcg ? node.$value : own(node, "value") ? node.value : undefined;
    const format = dtcg || (v !== undefined && tokenType(node.type));
    if (dtcg || (format && !RE_GENERIC_TYPE.test(node.type))) res.format = true;
    if (at.length && (typeof v === "string" || typeof v === "number")) { leaf(at, v, format, guarded); continue; }
    if (at.length && format && v !== null && typeof v === "object") { composite(at, v, guarded); continue; }
    if (depth >= 8) continue;
    const keys = Object.keys(node).filter((k) => !k.startsWith("$") && wordShaped(k, DS_KEY_MAX));
    for (let i = keys.length - 1; i >= 0; i--) stack.push([node[keys[i]], at.concat(keys[i]), depth + 1, guarded || guardKey(keys[i])]);
  }
  return res;
}
// Is a JSON file named for tokens one? It holds no credential, lists at least one leaf, and SHOWS what it is: the
// design-tokens format, or a value that says design — a colour, a length, a {reference.path}. A NAME is printed too: a map
// keyed by a secret (`{"ghp_…": 1700000000}`, `{"sk-…": {"rate": 100, "ttl": "3600s"}}`) holds no such value, so nothing
// of it is read (review 5: "nothing but design values" had made a numbers-only map a source) — and under that, a key is
// listed only when it is words (jsonTokens). The price: a plain token file of bare numbers only (`{spacing: {sm: 4}}`) is
// not read — its rows are added by hand.
const jsonSource = (j) => !j.secret && j.list.length > 0 && (j.format || j.strong);
// ONE walk of the project → { components (by name), tokens, sources (the token files), libraries, views (every view / style
// file — a feature's are picked among them), files, truncated (the walk's file cap), capped ({tokenFiles, candidates, tokens, fileSize}:
// the token read's bounds that cut something), realRoot }. The scan's corpus: no node_modules / .git / .specs / dist / build /
// hidden folder, nor one the root .gitignore names.
// --- what the project's files settle (1.35.3) -----------------------------------------------------------------------------------
// The names a component file cannot settle — its WEAK components (a call, a function or a class that renders nothing a
// reader can tie to it, a part that stands on an import — never a top-level alias of an import: the project nearly always
// renders one, and asking it read thousands of files for nothing) and its CANDIDATES (exported, taken for none) — asked of
// every script of the project: the component files' own (read for what they export) and then the others, the ones that may
// hold JSX first (DS_USAGE_FILES, DS_USAGE_CHARS — a file that names none of the asked names is read, never viewed). The
// bound ends the search WITHOUT A WORD: what the other files tell is evidence looked for, as the global stylesheets are
// (review 5 of 1.35.0) — past it a name stands as the file's own rules leave it, which is 1.35.2's reading (review 1 of
// 1.35.3: said, it put mui, mantine and gutenberg out of sync for good). A name is followed through the file's imports
// (`import { MotionBox } from "@/components/ui/motion"`, `import * as UI from "../ui"` and `<UI.Card.Header>`, a default
// import: the file's default export's name) to the files the module may be (placeOf). → { dropped, rendered }:
// "path\nname" of the weak ones the project shows are no component and of the candidates it renders. A barrel's weak name
// is a candidate: a `.ts` file holds no JSX.
const DS_USAGE_FILES = 5000;
const DS_USAGE_CHARS = 32 * 1024 * 1024;
const DS_PROJECT_ROOTS = 2000; // folders holding a package.json / tsconfig.json / jsconfig.json the walk keeps (an alias's roots)
const DS_PACKAGE_NAMES = 500; // workspace manifests read for their `name` (a bare or scoped module's package)
const RE_ROOT_FILE = /^(?:package|tsconfig|jsconfig)\.json$/;
const RE_SCRIPT_FILE = /\.(?:tsx|jsx|ts|js|mjs|cjs|mts|cts)$/i;
const RE_NOT_SCRIPT = /\.(?:d\.[cm]?ts|min\.[cm]?js)$/i;
const RE_JSX_FILE = /\.(?:tsx|jsx|js|mjs|cjs)$/i; // a script that may hold JSX
const RE_BARREL = /^index\.[cm]?ts$/i;
const RE_MODULE_EXT = /\.[cm]?[jt]sx?$/i;
const RE_CAPITAL_WORD = /\p{Lu}[\p{L}\p{N}_$]*/gu;
// is a file under a component folder (its NEAREST telling folder is one — componentOf's rule, its name aside)?
function inComponentFolder(rel) {
  const segs = rel.split("/");
  for (let at = segs.length - 2; at >= 0; at--) { const d = dirName(segs[at]); if (COMPONENT_DIRS.has(d)) return true; if (PAGE_DIRS.has(d)) return false; }
  return false;
}
// a module's path as an import names it: lower case, no extension, no platform infix (`Button.native.tsx` → `button`)
const moduleKey = (rel) => rel.toLowerCase().replace(RE_MODULE_EXT, "").replace(RE_PLATFORM_INFIX, "");
// Where an import's module may be → { keys: the moduleKeys it may name — each the file itself or a folder (its index, a
// barrel's file under it) } | null: none of the project's. Review 1 of 1.35.3: a module's segments matched ANYWHERE in the
// project (`@wordpress/components` was every `components/` folder, `@other/ui` any `ui/`), so another package's name
// settled the project's. Now:
//   - a relative path: the path;
//   - an alias of the project — `@/…`, `~/…`, `#…` —: its path from each project root above the importing file (a folder
//     holding a package.json / tsconfig.json / jsconfig.json, the project's own included), and from its `src/`;
//   - a bare or scoped module: a workspace package's — the one whose manifest `name` it is or begins (`@acme/ui`,
//     `@repo/ui/components/kit`: its folder, then the path below it and below its `src/`) —, else, a path of two segments
//     or more, a `baseUrl` path from those roots (`components/ui/kit`: another package's names no file of the project).
// project: { roots (a Set of folders), packages (a Map of lower-cased names → folders) }.
const RE_ALIAS_SPEC = /^(?:[@~]\/|#)/;
function placeOf(spec, fromRel, project) {
  const clean = (segs) => segs.filter((s) => s !== "" && s !== ".");
  if (spec[0] === ".") {
    const out = fromRel.split("/").slice(0, -1);
    for (const s of clean(spec.split("/"))) {
      if (s !== "..") out.push(s);
      else if (!out.length) return null;
      else out.pop();
    }
    return { keys: [moduleKey(out.join("/"))] };
  }
  const low = spec.toLowerCase();
  if (clean(low.split("/")).includes("..")) return null;
  const from = (rest) => {
    const keys = [];
    for (let d = fromRel.slice(0, Math.max(0, fromRel.lastIndexOf("/"))); ; d = d.slice(0, Math.max(0, d.lastIndexOf("/")))) {
      if (d === "" || project.roots.has(d)) { const pre = d === "" ? "" : d + "/"; keys.push(moduleKey(pre + rest), moduleKey(pre + "src/" + rest)); }
      if (d === "") break;
    }
    return keys;
  };
  if (RE_ALIAS_SPEC.test(low)) {
    const rest = clean(low.replace(/^[@~]\//, "").replace(/^#/, "").split("/")).join("/");
    return rest === "" ? null : { keys: from(rest) };
  }
  const segs = clean(low.split("/"));
  for (let n = Math.min(segs.length, 2); n >= 1; n--) {
    const folder = project.packages.get(segs.slice(0, n).join("/"));
    if (folder == null) continue;
    const sub = segs.slice(n).join("/");
    return { keys: sub === "" ? [moduleKey(folder)] : [moduleKey(folder + "/" + sub), moduleKey(folder + "/src/" + sub)] };
  }
  return segs.length >= 2 ? { keys: from(segs.join("/")) } : null;
}
// may a file (its moduleKey) be the module an import names?
const pointsTo = (key, at) => at.keys.some((k) => key === k || key.startsWith(k + "/"));
// the project's roots and its workspace packages' names, from the walk's manifests (read once, on first use)
function projectPlaces(manifests, roots) {
  const packages = new Map();
  for (const m of manifests.slice(0, DS_PACKAGE_NAMES)) {
    const text = readFileHead(m.full, DS_READ_CHARS);
    let json = null;
    try { json = text == null ? null : JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text); } catch { /* no manifest */ }
    if (json && typeof json.name === "string" && json.name !== "" && !packages.has(json.name.toLowerCase())) packages.set(json.name.toLowerCase(), m.dir);
  }
  return { roots, packages };
}
function settle(results, scripts, read, places) {
  const dropped = new Set(), rendered = new Set();
  const asked = new Map(), byName = new Map(), byBase = new Map(), keys = new Map(), defaults = new Map(), exportsOf = new Map(), localsOf = new Map();
  const ask = (path, name, local, kind) => {
    if (!asked.has(path)) asked.set(path, new Map());
    asked.get(path).set(name, { local, kind, rendered: false, called: false, context: false, member: false });
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(path);
  };
  for (const r of results) {
    for (const name of r.found.weak) ask(r.path, name, r.found.locals.get(name), r.barrel ? "unproven" : "weak");
    for (const c of r.found.candidates) ask(r.path, c.name, c.local, "candidate");
    if (r.found.defaultName != null) defaults.set(r.path, r.found.defaultName);
  }
  if (!asked.size) return { dropped, rendered };
  const project = places();
  for (const r of results) {
    // (every name the file gives, a component's or not, and the locals they stand for: a provider's tag may be a part of one)
    exportsOf.set(r.path, new Set(r.found.names.concat(r.found.candidates.map((c) => c.name))));
    localsOf.set(r.path, new Set([...r.found.locals.values()].concat(r.found.candidates.map((c) => c.local))));
  }
  for (const path of asked.keys()) {
    const key = moduleKey(path), segs = key.split("/");
    keys.set(path, key);
    const base = segs[segs.length - 1] === "index" && segs.length > 1 ? segs[segs.length - 2] : segs[segs.length - 1];
    if (!byBase.has(base)) byBase.set(base, []);
    byBase.get(base).push(path);
  }
  const note = (path, name, what) => { const e = asked.has(path) ? asked.get(path).get(name) : null; if (e) e[what] = true; };
  // a provider's tag: the part it names when the file gives one so (`Tooltip.Provider`), else its root used as a context
  const provide = (path, name) => { if (exportsOf.has(path) && exportsOf.get(path).has(name)) note(path, name, "rendered"); else note(path, name.slice(0, name.lastIndexOf(".")), "context"); };
  const placesOf = new Map(), targets = new Map();
  const tell = (rel, uses) => {
    const file = rel.slice(rel.lastIndexOf("/") + 1);
    const tests = isTestFile(rel) || RE_NOT_COMPONENT_FILE.test(file); // (a story or a test may CALL a component: never a helper's sign — review 1)
    const mine = asked.get(rel);
    if (mine) for (const e of mine.values()) if (e.local != null) {
      if (uses.rendered.has(e.local)) e.rendered = true;
      if (uses.called.has(e.local)) e.called = true; // (a component file is never a story's or a test's)
      if (uses.contexts.has(e.local)) e.context = true;
    }
    if (mine) for (const p of uses.providers) { if (localsOf.get(rel).has(p)) { for (const e of mine.values()) if (e.local === p) e.rendered = true; } else { const root = p.slice(0, p.lastIndexOf(".")); for (const e of mine.values()) if (e.local === root) e.context = true; } }
    if (!uses.imports.size) return;
    const dir = rel.slice(0, rel.lastIndexOf("/") + 1);
    // → the [path, name] a written name stands for, through the file's import — once a folder, a module and a name
    const resolve = (written) => {
      const dot = written.indexOf(".");
      const imp = uses.imports.get(dot === -1 ? written : written.slice(0, dot));
      if (!imp) return [];
      const rest = dot === -1 ? "" : written.slice(dot);
      const tk = dir + "\n" + imp.spec + "\n" + imp.name + "\n" + rest;
      if (targets.has(tk)) return targets.get(tk);
      const pk = dir + "\n" + imp.spec;
      if (!placesOf.has(pk)) placesOf.set(pk, placeOf(imp.spec, rel, project));
      const at = placesOf.get(pk), out = [];
      if (at && imp.name === "default") {
        const last = at.keys[0].slice(at.keys[0].lastIndexOf("/") + 1);
        for (const path of byBase.get(last) || []) if (defaults.has(path) && pointsTo(keys.get(path), at)) out.push([path, defaults.get(path) + rest]);
      } else if (at) {
        const name = imp.name === "*" ? rest.slice(1) : imp.name + rest;
        if (name !== "" && byName.has(name)) for (const path of byName.get(name)) if (pointsTo(keys.get(path), at)) out.push([path, name]);
        // (a provider's tag may name a part no one asks: its file is followed all the same)
        if (name !== "" && RE_CONTEXT_TAG.test(name)) { const root = name.slice(0, name.lastIndexOf(".")); if (byName.has(root)) for (const path of byName.get(root)) if (pointsTo(keys.get(path), at)) out.push([path, name]); }
      }
      targets.set(tk, out);
      return out;
    };
    for (const n of uses.rendered) for (const [path, name] of resolve(n)) note(path, name, "rendered");
    if (!tests) for (const n of uses.called) for (const [path, name] of resolve(n)) note(path, name, "called");
    for (const n of uses.contexts) for (const [path, name] of resolve(n)) note(path, name, "context");
    for (const n of uses.providers) for (const [path, name] of resolve(n)) provide(path, name);
    // (an object's member read settles a PART alone: `UI.Badge.displayName` is a component's static — review 1)
    for (const n of uses.members) for (const [path, name] of resolve(n)) if (name.includes(".")) note(path, name, "member");
  };
  for (const r of results) tell(r.path, r.uses);
  // the other scripts — a file that writes none of the names asked (nor a default export's) tells nothing: never viewed
  const wanted = new Set(defaults.values());
  for (const name of byName.keys()) { const dot = name.indexOf("."); wanted.add(dot === -1 ? name : name.slice(0, dot)); }
  const names = (text) => { RE_CAPITAL_WORD.lastIndex = 0; for (let m = RE_CAPITAL_WORD.exec(text); m; m = RE_CAPITAL_WORD.exec(text)) if (wanted.has(m[0])) return true; return false; };
  const done = new Set(read);
  // (a `.ts` file renders nothing: with no weak name asked — a candidate is settled by a render alone — it is never read: an
  // Angular project's thousands of them; the files that may hold JSX are read first)
  const calls = [...asked.values()].some((m) => [...m.values()].some((e) => e.kind === "weak"));
  const order = (a, b) => (RE_JSX_FILE.test(b.rel) - RE_JSX_FILE.test(a.rel)) || a.rel.length - b.rel.length || (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0);
  let files = 0, chars = 0;
  for (const s of scripts.filter((f) => !done.has(f.rel) && (calls || RE_JSX_FILE.test(f.rel))).sort(order)) {
    if (files >= DS_USAGE_FILES || chars >= DS_USAGE_CHARS) break;
    const text = readFileHead(s.full, DS_READ_CHARS);
    files++;
    if (text == null) continue;
    chars += text.length;
    if (names(text)) tell(s.rel, usesOf(scriptView(text)));
  }
  for (const [path, m] of asked) for (const [name, e] of m) {
    if (e.kind === "candidate") { if (e.rendered && !e.context) rendered.add(path + "\n" + name); } else if (e.kind === "unproven" ? !e.rendered || e.context : e.context || (!e.rendered && (e.called || e.member))) dropped.add(path + "\n" + name);
  }
  return { dropped, rendered };
}
function scanCode(root, withComponents = true) {
  const realRoot = realRootOf(root);
  const byKey = new Map(), views = [], tokenFiles = [], sheets = [], found = [], routerRoots = new Set(), pageDirs = new Set(), nextConfigs = new Set();
  const fullOf = new Map(); // a component file's full path, by its relative one
  const scripts = [], barrels = []; // every script file; a component folder's barrel (`index.ts`): read for what it re-exports
  const roots = new Set(), packageFiles = []; // the folders that hold a package.json / tsconfig.json / jsconfig.json; the manifests
  const counts = (rel) => isViewFile(rel) || isTokenFile(rel);
  const dirOf = (rel) => rel.slice(0, Math.max(0, rel.lastIndexOf("/")));
  const walk = walkProject(root, DS_FILE_CAP, (rel, full, name) => {
    // an app router's root and its pages: what lies between them is a route segment (routeSegments)
    if (RE_ROUTE_MARK.test(name)) pageDirs.add(dirOf(rel));
    if (RE_NEXT_CONFIG.test(name)) nextConfigs.add(dirOf(rel));
    const routed = RE_ROOT_LAYOUT.test(name) ? routerRootOf(dirOf(rel)) : null;
    if (routed != null) routerRoots.add(routed);
    const kind = tokenFileKind(rel);
    if (kind) tokenFiles.push({ rel, full, kind });
    else if (isSheetCandidate(name)) sheets.push({ rel, full, rank: sheetRank(name), depth: rel.split("/").length });
    // (every script: what it renders, calls and imports may settle a component file's names — 1.35.3; and where the
    // project's roots and packages are, which its imports name)
    if (RE_SCRIPT_FILE.test(name) && !RE_NOT_SCRIPT.test(name)) scripts.push({ rel, full });
    else if (RE_ROOT_FILE.test(name) && roots.size < DS_PROJECT_ROOTS) { roots.add(dirOf(rel)); if (name === "package.json") packageFiles.push({ dir: dirOf(rel), full }); }
    if (RE_BARREL.test(name) && !isTestFile(rel) && inComponentFolder(rel)) barrels.push({ path: rel, full });
    if (!isViewFile(rel)) return;
    views.push({ rel, full });
    if (isTestFile(rel)) return;
    const c = componentOf(rel);
    if (c) { found.push(c); fullOf.set(rel, full); }
  }, { counts, gitignore: gitignoreRules(root, realRoot) });
  // (known only once the walk is over: a folder's files come in any order)
  // (asked only of the router roots above a component named like a special file: the others change nothing)
  const wanted = new Set();
  for (const c of found) if (c.route) for (let d = dirOf(c.path); ; d = dirOf(d)) { if (routerRoots.has(d)) wanted.add(d); if (d === "") break; }
  const manifests = new Map();
  const segments = routeSegments(new Set([...wanted].filter((d) => dependsOnNext(root, d, manifests, nextConfigs))), pageDirs);
  // (…and a parallel slot, a group or a dynamic folder right under a segment is routing too, with no page of its own:
  // `app/ui/@modal/default.tsx`)
  const routed = (dir) => {
    for (let d = dir; ; d = dirOf(d)) {
      if (segments.has(d)) return true;
      const name = d.slice(d.lastIndexOf("/") + 1);
      if (d === "" || !(name[0] === "@" || RE_ROUTE_PASS.test(name))) return false;
    }
  };
  const files = []; // the component files, a route segment's special files aside
  for (const c of found) {
    if (c.route && routed(dirOf(c.path))) continue;
    files.push(c);
    const had = byKey.get(c.key);
    // one component per name: its own file before a folder's index, then the shorter path
    if (!had || (had.index && !c.index) || (had.index === c.index && c.path.length < had.path.length)) byKey.set(c.key, c);
  }
  const tokens = [], sources = [], twins = [], seen = new Set();
  // A bound that cut what is read — the reports say so (`limits`), never "in sync". Each is set only when something WAS cut:
  //   tokenFiles — a file that IS a source found the sources full;   candidates — files named like one were left unread;
  //   tokens — a token was left past the cap;   fileSize — the first token file longer than a file's read (its path).
  //   exports — component files were left unread for what else they export, or one held more names than are kept (how
  //   many files were read; 0: nothing cut);   workspaces — a bound of the workspace patterns left a declared folder
  //   unread (manifests: how many workspace manifests WERE read — none, when the first pattern was the one not followed).
  //   (What the project's other scripts tell — settle — is looked for up to its bound and ends there without a word: 1.35.3.)
  const capped = { tokenFiles: false, candidates: false, tokens: false, fileSize: null, exports: 0, workspaces: false, manifests: 0 };
  // What else a component file exports (exportedComponents) — a name no file of its own holds; the shorter path first, as
  // above. Read after every file's own name is known: `card.tsx`'s CardHeader never takes `card-header.tsx`'s place.
  // Bounded in files AND in characters read (DS_EXPORT_FILES, DS_EXPORT_CHARS — review 1 of 1.35.1: 500 files of 256K
  // cost seconds on every scan, and a project of 520 small ones could never be in sync again).
  // A component folder's barrel (`index.ts`) is read too, for the names it re-exports under its own (1.35.3).
  // (withComponents: false — a feature's report — reads none of it: it asks no component's name)
  for (const b of barrels) fullOf.set(b.path, b.full);
  const byPath = (a, b) => a.path.length - b.path.length || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  // (the barrels after the component files, by a count of their own: a kit of `button/index.ts` + `button/button.tsx`
  // folders reads as many component files as before, and a barrel's name never takes a component file's place)
  const readable = withComponents ? files.filter((c) => RE_EXPORTS_EXT.test(c.path)).sort(byPath) : [];
  let filesRead = 0, cutNames = false;
  const results = [], readPaths = []; // [the file's path, what it exports (exportedComponents), what it tells (usesOf)] — in reading order
  for (const [list, kind] of [[readable, "file"], [withComponents ? barrels.sort(byPath) : [], "barrel"]]) {
    let n = 0, chars = 0;
    for (const c of list) {
      if (n >= DS_EXPORT_FILES || chars >= DS_EXPORT_CHARS) { capped.exports = capped.exports || readPaths.length; break; }
      const text = readFileHead(fullOf.get(c.path), DS_READ_CHARS);
      n++;
      if (kind === "file") filesRead++;
      readPaths.push(c.path);
      if (text == null) continue;
      chars += text.length;
      const found1 = exportedComponents(text);
      if (found1.more) cutNames = true;
      results.push({ path: c.path, found: found1, uses: usesOf(found1.view), barrel: kind === "barrel" });
      found1.view = null; // (a view holds the file twice over: what it tells is kept, the view is not)
    }
  }
  if (cutNames && !capped.exports) capped.exports = filesRead;
  // What the project's files tell of the names those files do not settle (1.35.3 — settle(), below): a WEAK component is
  // dropped when the project calls it as a function or gives it to `useContext`, never rendering it; a CANDIDATE — a name
  // exported that the rules took for none — is one when the project renders it.
  let placed = null;
  const verdict = settle(results, scripts, readPaths, () => placed || (placed = projectPlaces(packageFiles, roots)));
  // (every file's names before any candidate: a barrel's re-export takes no row's path from the file that declares it —
  // review 1 of 1.35.3, `export { default as FiltersToggle } from "./toggle"`)
  const add = (r, name) => { const key = dsKey(name); if (key && !byKey.has(key)) byKey.set(key, { name, key, path: r.path, index: false, route: false }); };
  for (const r of results) for (const name of r.found.names) if (!verdict.dropped.has(r.path + "\n" + name)) add(r, name);
  for (const r of results) for (const { name } of r.found.candidates) if (verdict.rendered.has(r.path + "\n" + name)) add(r, name);
  const take = (file, list) => {
    sources.push(file.rel);
    for (const t of list) {
      // (a name the registry's reader would not give back — a slot word, nothing but punctuation — is no row: it would be
      // "not in the registry" for good)
      if (seen.has(t.name) || !registryName(t.name)) continue;
      if (tokens.length >= DS_TOKENS_MAX) { capped.tokens = true; break; }
      seen.add(t.name);
      tokens.push({ name: t.name, value: t.value, source: file.rel });
    }
  };
  // DS_TOKEN_FILES SOURCES at most, DS_TOKEN_READS candidates read to find them: a candidate that turns out to be none (a
  // JSON file of something else, a stylesheet that declares no custom property) takes no source's place.
  let read = 0;
  // → { text (a file's first DS_READ_CHARS characters), over (it holds more: one character further is asked for, so a file
  //   of exactly that length is not "longer") }
  const head = (f) => {
    read++;
    const t = readFileHead(f.full, DS_READ_CHARS + 1);
    const over = t != null && t.length > DS_READ_CHARS;
    return { text: over ? t.slice(0, DS_READ_CHARS) : t, over };
  };
  // (cut: the rest of a stylesheet is unread, and a cut JSON file does not parse — said of a file that IS a token file)
  const cut = (f, over) => { if (over && !capped.fileSize) capped.fileSize = f.rel; };
  // a file known to BE a source joins them — unless they are full: said, and the walk of the candidates ends
  const source = (f, list) => {
    if (sources.length >= DS_TOKEN_FILES) { capped.tokenFiles = true; return; }
    take(f, list);
  };
  const order = (a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0);
  // (the files whose values ARE read first: 21 `tailwind.config.ts` — listed, unread — must not take tokens.css's place)
  const unread = (f) => (/\.json$/i.test(f.rel) || RE_STYLE_EXT.test(f.rel) ? 0 : 1);
  for (const f of tokenFiles.sort((a, b) => unread(a) - unread(b) || order(a, b))) {
    if (capped.tokenFiles) break;
    if (unread(f)) { source(f, []); continue; } // a JS / TS / YAML one: a source, its values unread
    if (read >= DS_TOKEN_READS) { capped.candidates = true; break; }
    const { text, over } = head(f);
    cut(f, over); // a token file by its NAME
    if (!/\.json$/i.test(f.rel)) { source(f, text == null ? [] : styleTokens(text, f.rel)); continue; }
    const j = text == null ? null : jsonTokens(text);
    if (!j || !jsonSource(j)) continue; // no design file after all (unreadable, unparsable, credentials, nothing that says design)
    if (j.more) capped.tokens = true;
    source(f, j.list);
  }
  // The global stylesheets, the likeliest first: by its name (`globals.css`, then a name an app gives its one stylesheet,
  // then `index.css`), then root-most — a monorepo's 100 `Widget/index.css` never stand before the one
  // `styles/globals.css`. One is a source by its custom properties of the whole page — all of them in a `globals.css`,
  // styleTokens' `global` ones in a sheet whose name a component's has too —, GLOBAL_CSS_MIN of them, and only when it
  // brings a NAME no earlier source holds: a twin (`main.min.css` beside `main.css`) or one sheet per theme takes no place
  // and says no bound (review 8). The search ENDS at the read bound without a word: these are candidates, not "files named
  // like a token file" — saying a bound of them made a project that had lost nothing "not in sync" for good (review 5).
  for (const f of sheets.sort((a, b) => a.rank - b.rank || a.depth - b.depth || order(a, b))) {
    if (capped.tokenFiles || read >= DS_TOKEN_READS) break;
    const { text, over } = head(f);
    const list = text == null ? [] : styleTokens(text, f.rel).filter((t) => t.name.startsWith("--") && (f.rank === 0 || t.global));
    if (list.length < GLOBAL_CSS_MIN) continue; // no token file: it takes no place and says no bound
    // (a twin takes no source's place — and is a token file all the same: a feature that edits it is never told to "use
    // the token" on the line that declares it; review 9: of three apps' identical globals.css only the first was one)
    if (!list.some((t) => !seen.has(t.name))) { twins.push(f.rel); continue; }
    cut(f, over);
    source(f, list);
  }
  const components = [...byKey.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const packages = packageLibraries(root);
  capped.workspaces = packages.cut;
  capped.manifests = packages.read;
  return { components, tokens, sources, twins, libraries: packages.libraries, views, files: walk.files, truncated: walk.truncated, capped, realRoot };
}

// --- raw values: what a feature's view files hard-code ------------------------------------------------------------------------
// A colour: a hex literal, or a functional one with literal arguments (rgb(…), hsl(…), oklch(…) — never rgb(var(--x))).
// Where a hex is read:
//   - a stylesheet (a .css / .scss… file, a <style> block of a markup or JSX file, a declaration-shaped line of a CSS-in-JS template):
//     in a declaration's VALUE only — never a selector (`.page:hover #fab {`, `#fab,`) nor an at-rule's prelude;
//   - markup and code: 6 / 8 digits right after a quote or one of `[ ( : = ,` (a string, a Tailwind arbitrary value, an
//     attribute) — "Ticket #204518" is prose; 3 / 4 digits only as a Tailwind arbitrary value `[#fff]` or a quoted "#fff".
// Never an anchor or a reference (href="#abcdef", url(#clip), querySelector("#add")) nor an HTML entity (&#123;).
const RE_HEX = /(?<![&\w#])#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-zA-Z_-])/g;
// What stands right before a hex that is no colour (read on a 40-character tail):
//   - an attribute that takes an anchor or an id — href="#abc", to="#add", id / for / target / src / path / hash —, also
//     under a data- / aria- / hx- prefix or a namespace (data-bs-target="#add", hx-target="#feed", xlink:href="#fade", Vue's
//     :to="'#add'" — a bound attribute's two quotes) and as JSX's xlinkHref / dataTarget (RE_HEX_REF_CAMEL: only Href and Target). NOT any prop that merely
//     ends so: `gradient-to="#9333ea"`, `gradientTo="#1d4ed8"` and `invalid="#dc2626"` are colours;
//   - an `href:` / `id:` / `hash:` key — a WHOLE word: `invalid: '#dc2626'`, `solid: "#1d4ed8"` and a gradient's
//     `to: "#fff"` are colours;
//   - `url(#clip)` and a DOM lookup: querySelector("#add"), getElementById, closest, matches, $("#add");
//   - RE_HEX_REF_LOOSE, for a 3 / 4-digit hex only (an id that happens to spell one — #add, #fade, #face): a selection or
//     a scroll / tween target, .find("#add"), d3.select("#fade"), gsap.to("#face"), scrollTo('#fed'). With 6 digits those
//     calls take colours too: picker.select("#1d4ed8"), tween.to("#00ffaa", 300).
const RE_HEX_REF_BEFORE = /(?<![\w-])(?:(?:(?:data|aria|hx)-(?:\w+-)*|[\w-]*:)?(?:href|src|id|for|htmlFor|to|path|hash|target)\s*=\s*\{?\s*["'`]{0,2}|(?:href|id|hash)\s*:\s*["'`]|url\(\s*["'`]?|(?:querySelector(?:All)?|getElementById|closest|matches|jQuery|\$)\s*\(\s*["'`])$/i;
const RE_HEX_REF_CAMEL = /(?<![\w-])[a-z][A-Za-z0-9]*(?:Href|Target)\s*=\s*\{?\s*["'`]{0,2}$/;
const RE_HEX_REF_LOOSE = /(?:\.(?:find|select(?:All)?|to|fromTo)|(?<![\w$])scrollTo)\s*\(\s*["'`]$/;
const RE_COLOR_FN = /(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(\s*[\d.+-][^()]{0,60}\)/gi;
// A size, where a spacing / type / radius token belongs: a stylesheet declaration of margin, padding, gap, font-size or
// border-radius with a px / rem / em literal (never 0 or a 1px hairline — any of its literals counts: `padding: 1px 16px` —,
// never a value built from a variable or calc()), and a Tailwind arbitrary value on those utilities (p-[13px], text-[15px]).
// Each pattern is linear on a line of DS_LINE_MAX characters: a number is `\d+(\.\d+)?` (never `\d*\.?\d+` — two ways to
// split a digit run), the blank run after a colon ends at a non-blank, the Tailwind variants are counted.
const RE_DECL = /^\s*(--[\w-]+|\$[\w-]+|[A-Za-z-]+)\s*:\s*(\S.*)$/;
const RE_DECL_LINE = /^\s*(?:--[\w-]+|[a-z][a-z-]*)\s*:\s*[^;{}\s][^;{}]*;\s*$/i;
const RE_DECL_GOES_ON = /^\s*[\w$-]+\s*:\s/; // `prop: value,` — a blank after the colon: no selector (`a:hover,`)
const RE_SIZE_PROP = /^(?:(?:margin|padding)(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?|gap|row-gap|column-gap|font-size|border-radius|border-(?:top|bottom)-(?:left|right)-radius)$/i;
const RE_SIZE_LITERAL = /(?<![\w.-])(\d+(?:\.\d+)?|\.\d+)(px|rem|em)(?![\w-])/g;
const RE_SIZE_BUILT = /var\(|calc\(|theme\(|[$@]|#\{/;
const RE_TW_SIZE = /(?<![\w-])(?:[a-z0-9-]{1,24}:){0,4}(?:p[trblxyse]?|m[trblxyse]?|gap(?:-[xy])?|space-[xy]|text|rounded(?:-[a-z]{1,2})?|leading|tracking)-\[(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|em)\]/g;
// A <style> block: in a markup file (Vue / Svelte / Astro / HTML…, any case) and in JSX (styled-jsx's `<style jsx>{`…`}`) —
// there never right after an identifier or a quote: `useState<style>(null)` is a type and "<style>" a string (read as a
// block's start, the rest of the file was a stylesheet). And a SELF-CLOSING tag holds none: `<style dangerouslySetInnerHTML=
// {…} />` (review 4: it blinded the rest of the file) — the opening tag is followed to its `>` (styleTagEnd), over lines.
const RE_STYLE_BLOCK_EXT = /\.(?:vue|svelte|astro|html?|erb|cshtml|razor|twig|hbs|handlebars|mustache|ejs|pug)$|\.blade\.php$/i;
const RE_STYLE_OPEN = /<style(?=[\s>]|$)/i; // (`<style` may end its line: the tag's attributes follow on the next ones)
const RE_STYLE_OPEN_JSX = /(?<![\w$.)\]"'`])<style(?=[\s>]|$)/;
const RE_STYLE_CLOSE = /<\/style\s*>/i;
// The `>` that ends a tag, from `from` on (never an arrow's: `onLoad={() => x}`) → its index, -1 when the line holds none.
const styleTagEnd = (s, from) => { let g = s.indexOf(">", from); while (g > 0 && s[g - 1] === "=") g = s.indexOf(">", g + 1); return g; };
const isQuote = (c) => c === "\"" || c === "'" || c === "`";
function rawValuesOf(text, rel) {
  const out = [], seen = new Set();
  const sheet = RE_STYLE_EXT.test(rel), plainCss = /\.css$/i.test(rel);
  const open = sheet ? null : RE_STYLE_BLOCK_EXT.test(rel) ? RE_STYLE_OPEN : RE_STYLE_OPEN_JSX;
  const st = { block: false, html: false };
  let inStyle = false, inTag = false; // inside a <style> block of a markup or JSX file · inside its opening tag (no `>` yet)
  const add = (line, kind, value) => {
    const k = line + ":" + value;
    if (seen.has(k) || out.length >= DS_RAW_PER_FILE) return;
    seen.add(k);
    out.push({ line, kind, value });
  };
  // (what stands before a match is read from a bounded tail: one slice per match, never the whole line again)
  const colours = (s, line, strict) => {
    for (const m of s.matchAll(RE_HEX)) {
      const at = m.index, tail = s.slice(Math.max(0, at - 40), at);
      if (RE_HEX_REF_BEFORE.test(tail) || RE_HEX_REF_CAMEL.test(tail) || (m[1].length < 6 && RE_HEX_REF_LOOSE.test(tail))) continue;
      if (strict) {
        const prev = at > 0 ? s[at - 1] : "";
        if (m[1].length < 6 ? !(prev === "[" || (isQuote(prev) && isQuote(s[at + m[0].length] || ""))) : !/["'`[(:=,]/.test(tail.trimEnd().slice(-1))) continue;
      }
      add(line, "color", m[0]);
    }
    for (const m of s.matchAll(RE_COLOR_FN)) add(line, "color", m[0].replace(/\s+/g, " "));
  };
  // a stylesheet's line, piece by piece: what a `{` follows is a selector or an at-rule's prelude, and so is a line ending in
  // `,` (a selector list going on: `#fab,`) — unless it reads `prop: value,` (a multi-value declaration going on:
  // `box-shadow: 0 0 0 1px #1d4ed8,`)
  const styleLine = (l, line) => {
    let start = 0;
    for (let i = 0; i <= l.length; i++) {
      const ch = i < l.length ? l[i] : "";
      if (ch !== "" && ch !== ";" && ch !== "{" && ch !== "}") continue;
      const piece = l.slice(start, i);
      start = i + 1;
      if (ch === "{" || (ch === "" && /,\s*$/.test(piece) && !RE_DECL_GOES_ON.test(piece))) continue;
      const d = RE_DECL.exec(piece);
      if (!d) continue;
      colours(d[2], line, false);
      if (!RE_SIZE_PROP.test(d[1]) || RE_SIZE_BUILT.test(d[2])) continue;
      for (const v of d[2].matchAll(RE_SIZE_LITERAL)) {
        if (Number(v[1]) > 0 && !(v[2] === "px" && Number(v[1]) <= 1)) { add(line, "size", d[1].toLowerCase() + ": " + d[2].trim().slice(0, 40)); break; }
      }
    }
  };
  const lines = text.split(/\r?\n/);
  for (let n = 0; n < lines.length && out.length < DS_RAW_PER_FILE; n++) {
    const src = lines[n].length > DS_LINE_MAX ? lines[n].slice(0, DS_LINE_MAX) : lines[n];
    let block = inStyle, l;
    // the opening tag from `from` on: its `>` ends it — `/>` (a self-closing <style … />) and there is no block
    const tag = (s, from) => { const end = styleTagEnd(s, from); if (end !== -1) { inTag = false; if (s[end - 1] === "/") inStyle = block = false; } };
    if (!open || inStyle) {
      // a stylesheet's line, or one inside a <style> block: its opening tag may still be open, `</style>` ends the block
      if (open && inTag) tag(src, 0);
      if (open && inStyle && RE_STYLE_CLOSE.test(src)) inStyle = false;
      l = withoutComments(src, st, { slashSlash: !plainCss, sheet: sheet || block });
    } else {
      // code or markup: its comments first — a <style> named in one (`// injects a <style> tag`, `{/* the <style> */}`,
      // `<!-- the <style> below -->`) opens nothing (review 5: read on the raw line, it blinded the rest of the file)
      l = withoutComments(src, st, { slashSlash: !plainCss, sheet: false });
      const m = open.exec(l);
      if (m) {
        inStyle = inTag = block = true;
        tag(l, m.index + 6);
        if (inStyle && RE_STYLE_CLOSE.test(l)) inStyle = false;
      }
    }
    if (!l.trim()) continue;
    if (sheet || block || RE_DECL_LINE.test(l)) { styleLine(l, n + 1); continue; }
    colours(l, n + 1, true);
    for (const m of l.matchAll(RE_TW_SIZE)) add(n + 1, "size", m[0]);
  }
  return out;
}
// A colour as tokens are compared: lower-cased, a 3 / 4-digit hex written out (#fff = #ffffff).
function colorKey(v) {
  const s = String(v).trim().toLowerCase();
  const m = /^#([0-9a-f]{3,4})$/.exec(s);
  return m ? "#" + m[1].split("").map((c) => c + c).join("") : s.replace(/\s+/g, "");
}

// --- the registry against the code ---------------------------------------------------------------------------------------------
// A word of a registry row's path cell as a project path — decided on its TEXT before any fs call (the Reuse section's rule: a
// network path, an absolute path elsewhere or a `..` out of the project names nothing) — or null when it is no path of the
// project: a package (`@mui/x-data-grid`), `n/a`, a URL, prose. A `:12` / `#L12` anchor is dropped (implementsPath).
function projectPath(root, word) {
  const w = implementsPath(word);
  if (!w || w.startsWith("@") || /^https?:/i.test(w) || /^n\/a$/i.test(w) || !/[/.]/.test(w) || /[<>"|?*]/.test(w) || isNetworkPath(w)) return null;
  const abs = path.resolve(root, w);
  return abs !== root && isInsideDir(root, abs) ? toPosix(path.relative(root, abs)) : null;
}
// Does the project path name something on disk — reached WITHOUT following a link: a symlink or a junction on the way (it may
// lead out of the project, or to a share) is where the walk stops, and counts as there.
function onDisk(root, rel) {
  let cur = root;
  for (const seg of rel.split("/")) {
    cur = path.join(cur, seg);
    let st;
    try { st = fs.lstatSync(cur); } catch { return false; }
    if (st.isSymbolicLink()) return true;
  }
  return true;
}
// Is a registry row's path gone? Only a cell that NAMES A CODE FILE OF THE PROJECT can be. A reading is such a name when its
// last segment has a file extension (`src/components/Card` may be Card.tsx or a folder: not judged) that is no document's or
// image's (a note cites README.md, a screenshot), and its FIRST segment is on disk: `next/link`, `primereact/button`,
// `~/components/Button.vue`, `storybook.example.com/button.html`, "Built into the layout." and "n/a (custom)" start nowhere
// in the project. The readings:
//   1. the whole cell on disk → there (a path may hold a blank: `src/components/Form Controls/DatePicker.tsx`);
//   2. its words, each a reading (a markdown link's target, a path beside a note): ONE that is there → there — "was
//      src/old/Card.jsx, now src/components/Card.tsx" names its file; gone when a word names a file and none of them is
//      there (`src/components/Gone.tsx (see README.md)`, `[Gone](src/components/Gone.tsx)`);
//   3. no word names one → the whole cell, when it does (a path with a blank that is gone).
// A wrong "gone" sends a team to fix a registry that is right, so every doubt reads as "not judged": a root-level file, a
// path whose first folder is gone as a whole, `src/components/Gone.tsx — replaced by src/components/Card.tsx` (a file it
// names is there).
const RE_FILE_EXT = /\.[A-Za-z][A-Za-z0-9]{0,9}$/;
const RE_DOC_EXT = /\.(?:md|mdx|markdown|txt|rst|adoc|pdf|png|jpe?g|gif|webp|svg|fig|sketch)$/i;
const DS_PATH_WORDS = 20; // words of a path cell read
function stalePath(root, cell) {
  const text = stripEnds(String(cell || "").slice(0, 400).trim(), unitIn("`")).trim();
  if (!text) return false;
  // a reading → null (it names no code file of the project) | true (the file is there) | false (it is gone)
  const there = (w) => {
    const rel = projectPath(root, w);
    if (rel == null || !RE_FILE_EXT.test(rel) || RE_DOC_EXT.test(rel) || !onDisk(root, rel.split("/")[0])) return null;
    return onDisk(root, rel);
  };
  const whole = projectPath(root, text);
  if (whole != null && onDisk(root, whole)) return false;
  let gone = false;
  for (const w of text.split(/[\s,;]+/).slice(0, DS_PATH_WORDS)) {
    const t = there(stripEnds(w.replace(/^.*\]\(/, ""), unitIn("([`"), unitIn(")]`")));
    if (t === true) return false;
    if (t === false) gone = true;
  }
  return gone || there(text) === false;
}
// The registry as a report names it: its project path, whether it exists, the rows it holds.
const registryView = (root, reg) => ({ file: toPosix(path.relative(root, reg ? reg.file : path.join(specsRoot(root), "steering", DESIGN_SYSTEM_FILE))),
  exists: !!reg, components: reg ? reg.total.components : 0, tokens: reg ? reg.total.tokens : 0 });
// The components the ACTIVE +ui features' designs declare New — key → the feature: a component in the code that one of them is
// still building is not "missing from the registry" (its finish adds it), and a row pasted for it would read as already listed.
function pendingNew(projectDir) {
  const out = new Map();
  for (const fd of featureDirs(projectDir)) {
    if (fd.archived) continue;
    const tracks = detectTracks(fd.dir);
    if (!tracks.includes("ui")) continue;
    const design = readIfExists(path.join(fd.dir, "design.md"));
    const usage = design == null ? null : designSystemUsage(activeDesign(design, tracks));
    for (const r of usage ? usage.rows : []) if (r.kind === "new" && !out.has(r.key)) out.set(r.key, fd.slug);
  }
  return out;
}
// spec_scan {designSystem: true} / `dev-spec design-system [feature]`. Without a feature: the registry against the code →
// { ok, registry: {file, exists, components, tokens}, found: {components, tokens (counts), sources, libraries}, missing (the
// code's components the registry doesn't list, the first DS_LIST: [{name, path}]), missingTotal, pending (components in the code
// that an unfinished feature's design declares New — its finish adds them: [{name, path, feature}]), pendingTotal, stale (the
// registry rows naming a file of the project that is gone: [{name, path}]), staleTotal, newTokens (the code's tokens the registry doesn't list, the first
// DS_LIST: [{name, value}]), newTokensTotal, newSources / newLibraries (token files / UI libraries the registry doesn't name),
// inSync, scanned: {files}, limits, truncated }. opts.name: a feature → { ok, feature, registry, usage ({reuse, extend, new} |
// null: its design names no row), problems ([{code, name, near?, text}] — doctor's ui-design-system findings), viewFiles, raw
// (the first DS_LIST: [{file, line, kind: color | size, value, token? (a registry token of that colour)}]), counts: {color,
// size}, total, newComponents ([{name, path, registered}]), scanned, limits, truncated }. Stable keys, English; the CLI
// renders it.
// `limits`: the bounds that CUT what was read — [{code, read, file?}], code: files (the walk's file cap) · token-files (a
// token file found the DS_TOKEN_FILES sources full) · token-candidates (files named like a token file left unread past
// DS_TOKEN_READS) · file-size (a token file longer than a file's read: `file`, the first) · tokens · component-files (a
// bound of what else the component files export: the files or characters read, the names kept of one — `read`: the
// files read) · workspace-manifests (a bound of the workspace patterns left a declared folder unread — `read`: the
// workspace manifests read, 0 too) · registry-rows (rows
// past the reader's cap are not checked for a gone path) · view-files (a feature's). `truncated`: one of them — and then the
// report is never `inSync`: what it did not read it cannot vouch for. A bound that cut nothing is not said (a report that
// names one can never be in sync: said of a project that lost nothing, it would be a false alarm for good).
const scanLimits = (scan) => [scan.truncated ? { code: "files", read: scan.files } : null, scan.capped.tokenFiles ? { code: "token-files", read: DS_TOKEN_FILES } : null,
  scan.capped.candidates ? { code: "token-candidates", read: DS_TOKEN_READS } : null,
  scan.capped.fileSize ? { code: "file-size", read: DS_READ_CHARS, file: scan.capped.fileSize } : null,
  scan.capped.tokens ? { code: "tokens", read: DS_TOKENS_MAX } : null,
  scan.capped.exports ? { code: "component-files", read: scan.capped.exports } : null,
  scan.capped.workspaces ? { code: "workspace-manifests", read: scan.capped.manifests } : null].filter(Boolean);
function designSystemReport(projectDir, opts = {}) {
  const root = path.resolve(projectDir);
  const lang = projectLang(projectDir);
  if (!isDirSafe(root)) return { ok: false, root, error: i18n.msg(lang).brownfield.notFolder(root) };
  const named = opts.name != null && String(opts.name).trim() !== "";
  const f = named ? existingFeature(projectDir, opts.name) : null;
  if (f && !f.ok) return { ok: false, error: f.error, code: f.code };
  const reg = designSystemRegistry(specsRoot(projectDir));
  const scan = scanCode(root, !f); // (a feature's report reads no component's name: neither what files export nor what the others tell)
  if (f) return featureReport(projectDir, root, f, reg, scan);
  const listed = reg ? reg.keys : new Set();
  const building = pendingNew(projectDir);
  const missing = [], pending = [];
  for (const c of scan.components) {
    if (listed.has(c.key)) continue;
    if (building.has(c.key)) pending.push({ name: c.name, path: c.path, feature: building.get(c.key) });
    else missing.push({ name: c.name, path: c.path });
  }
  const stale = (reg ? reg.components : []).filter((c) => stalePath(root, c.path)).map((c) => ({ name: c.name, path: c.path }));
  const fold = FOLD_CASE ? (s) => s.toLowerCase() : (s) => s;
  const named1 = new Set((reg ? reg.sources : []).map((s) => fold(s.replace(/^(?:\.\/)+/, ""))));
  // (a path with a `,` / `;` cannot be named in the marker — its entries are cut there: never "not named" for good)
  const newSources = scan.sources.filter((s) => !named1.has(fold(s)) && !/[,;]/.test(s));
  const libs = new Set((reg ? reg.libraries : []).map((l) => l.toLowerCase()));
  const newLibraries = scan.libraries.filter((l) => !libs.has(l.toLowerCase()));
  const tokenNames = reg ? reg.tokenNames : new Set(); // every token the file lists, past the reader's cap too
  const newTokens = scan.tokens.filter((t) => !tokenNames.has(registryName(t.name))).map((t) => ({ name: t.name, value: t.value }));
  const limits = scanLimits(scan);
  if (reg && reg.total.components > reg.components.length) limits.push({ code: "registry-rows", read: reg.components.length });
  return { ok: true, registry: registryView(root, reg),
    found: { components: scan.components.length, tokens: scan.tokens.length, sources: scan.sources, libraries: scan.libraries },
    missing: missing.slice(0, DS_LIST), missingTotal: missing.length, pending: pending.slice(0, DS_LIST), pendingTotal: pending.length,
    stale: stale.slice(0, DS_LIST), staleTotal: stale.length,
    newTokens: newTokens.slice(0, DS_LIST), newTokensTotal: newTokens.length, newSources, newLibraries,
    inSync: !!reg && !limits.length && !missing.length && !stale.length && !newTokens.length && !newSources.length && !newLibraries.length,
    scanned: { files: scan.files }, limits, truncated: limits.length > 0 };
}
// The feature's part: its usage rows against the registry, the raw values in its view files (its _Implements:_ view / style
// files, token files and tests aside), its New components and where each lives.
function featureReport(projectDir, root, f, reg, scan) {
  const lang = featureLang(projectDir, f.slug);
  const Q = i18n.msg(lang).quality;
  const tracks = detectTracks(f.dir);
  const design = readIfExists(path.join(f.dir, "design.md"));
  const usage = design == null ? null : designSystemUsage(activeDesign(design, tracks));
  const find = reg && usage && usage.rows.length ? designSystemFindings(usage, reg, f.slug) : null;
  const fold = FOLD_CASE ? (s) => s.toLowerCase() : (s) => s;
  const tokenFiles = new Set([...scan.sources, ...scan.twins, ...(reg ? reg.sources : [])].map((s) => fold(s.replace(/^(?:\.\/)+/, ""))));
  const want = (rel) => isViewFile(rel) && !isTestFile(rel) && !RE_NOT_COMPONENT_FILE.test(rel);
  const found = scan.views.filter((x) => want(x.rel));
  const mine = [...featureFilesOf(root, scan.realRoot, f.dir, found, want)].sort();
  const byRel = new Map(found.map((x) => [x.rel, x.full]));
  const tokenOf = new Map();
  for (const t of reg ? reg.tokens : []) { const k = colorKey(t.value); if (k && !tokenOf.has(k)) tokenOf.set(k, t.name); }
  const raw = [], counts = { color: 0, size: 0 };
  const exportsOf = []; // [a component file of the feature, what else it exports] — a New component's path below
  // (the token-FILE bounds reach a feature's report too: a stylesheet left out of the sources is read for raw values)
  // (…and never the bounds of what the PROJECT report lists: the tokens read, the component files read for their exports)
  const limits = scanLimits(scan).filter((l) => l.code !== "tokens" && l.code !== "component-files" && l.code !== "workspace-manifests");
  let viewFiles = 0;
  for (const rel of mine) {
    if (tokenFiles.has(fold(rel)) || isTokenFile(rel)) continue;
    if (viewFiles >= DS_VIEW_FILES) { limits.push({ code: "view-files", read: DS_VIEW_FILES }); break; }
    const text = readFileHead(byRel.get(rel) || path.join(root, rel), DS_READ_CHARS);
    if (text == null) continue;
    viewFiles++;
    if (RE_EXPORTS_EXT.test(rel) && componentOf(rel)) exportsOf.push([rel, exportedComponents(text).names]);
    for (const v of rawValuesOf(text, rel)) {
      counts[v.kind]++;
      const token = v.kind === "color" ? tokenOf.get(colorKey(v.value)) : undefined;
      if (raw.length < DS_LIST) raw.push(Object.assign({ file: rel, line: v.line, kind: v.kind, value: v.value }, token ? { token } : {}));
    }
  }
  const own = new Map();
  for (const rel of mine) { const c = componentOf(rel); if (c && !own.has(c.key)) own.set(c.key, rel); }
  for (const [rel, names] of exportsOf) for (const n of names) { const k = dsKey(n); if (k && !own.has(k)) own.set(k, rel); }
  const seenNew = new Set();
  const newComponents = [];
  for (const r of usage ? usage.rows : []) {
    if (r.kind !== "new" || seenNew.has(r.key)) continue;
    seenNew.add(r.key);
    newComponents.push({ name: r.name, path: own.get(r.key) || null, registered: !!reg && reg.keys.has(r.key) });
  }
  return { ok: true, feature: f.slug, registry: registryView(root, reg),
    usage: usage && usage.rows.length ? { reuse: usage.rows.filter((r) => r.kind === "reuse").length, extend: usage.rows.filter((r) => r.kind === "extend").length, new: newComponents.length } : null,
    problems: find ? find.problems.map((p) => Object.assign({}, p, { text: Q.dsProblem[p.code](p.name, p.near) })) : [],
    viewFiles, raw, counts, total: counts.color + counts.size, newComponents, scanned: { files: scan.files }, limits, truncated: limits.length > 0 };
}

// --- the seed: steering_scaffold design-system.md ------------------------------------------------------------------------------
const cell = (s) => String(s).replace(/\r?\n/g, " ").split("|").join(BS + "|");
const RE_SEP_ROW = /^[\s|:-]+$/;
// The registry stub with the code's components, tokens, token files and UI libraries in place of its slots → { text, components,
// tokens } — or null when the code holds none of them (the caller writes the plain stub). A table the code has no row for keeps
// its slot row.
function designSystemSeed(projectDir, lang) {
  const root = path.resolve(projectDir);
  if (!isDirSafe(root)) return null;
  const scan = scanCode(root);
  if (!scan.components.length && !scan.tokens.length && !scan.sources.length && !scan.libraries.length) return null;
  const stub = i18n.steeringStub(DESIGN_SYSTEM_FILE, lang);
  const rows = {
    component: scan.components.slice(0, DS_SEED_COMPONENTS).map((c) => `| ${cell(c.name)} | ${"`" + cell(c.path) + "`"} |  |  |`),
    token: scan.tokens.map((t) => `| ${cell(t.name)} | ${cell(t.value)} |  |`),
  };
  const out = [];
  const lines = stub.split("\n");
  let kind = null; // the table being read: its slot rows are replaced once
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    // (a path with a `,` / `;` cannot be an entry of the marker: left out, as the report never asks for it)
    const named = scan.sources.filter((x) => !/[,;]/.test(x));
    if (/^_Token sources:/.test(l) && named.length) { out.push("_Token sources: " + named.join(", ") + "_"); continue; }
    if (/^_Libraries:/.test(l) && scan.libraries.length) { out.push("_Libraries: " + scan.libraries.join(", ") + "_"); continue; }
    if (!l.startsWith("|")) { kind = null; out.push(l); continue; }
    if (i + 1 < lines.length && RE_SEP_ROW.test(lines[i + 1]) && lines[i + 1].includes("-")) {
      const head = l.split("|")[1].trim().toLowerCase();
      kind = head.startsWith("component") ? "component" : head.startsWith("token") ? "token" : null;
      out.push(l, lines[++i]);
      if (kind && rows[kind].length) out.push(...rows[kind]); else kind = null;
      continue;
    }
    if (!kind) out.push(l); // a slot row of a table the code filled is dropped
  }
  return { text: out.join("\n"), components: Math.min(scan.components.length, DS_SEED_COMPONENTS), tokens: scan.tokens.length };
}

// --- finish ---------------------------------------------------------------------------------------------------------------------
// A name and a path safe to write into a table row: a component name as people write one, a path of ordinary characters.
const RE_SAFE_NAME = /^[\p{L}\p{N}][\p{L}\p{N} ._/@-]{0,79}$/u;
const RE_SAFE_PATH = /^[\p{L}\p{N}_@.()[\] /-]{1,300}$/u;
// Appends one row per component to the registry (under the roadmap lock — the project's own writes; read again there, past the
// call's read cache, so two features finishing at once add each row once): into the component table the file ENDS in when it
// has a column for the origin (its columns: the path where its header says, `_From: <feature>_` in its last other column) —
// else as a new table. The origin is what keeps the feature's own New row New. → the names added.
function registerComponents(projectDir, list) {
  const sroot = specsRoot(projectDir);
  const file = path.join(sroot, "steering", DESIGN_SYSTEM_FILE);
  const Q = i18n.msg(projectLang(projectDir)).quality;
  const done = withRoadmapLock(projectDir, () => {
    forgetCached(file); // the registry as it is NOW: this call read it before the lock (doctor, the report)
    const raw = readIfExists(file);
    const reg = raw == null ? null : designSystemRegistry(sroot);
    if (!reg) return [];
    const have = new Set(reg.keys); // every name the file lists, past the reader's cap too
    const add = [];
    for (const c of list) {
      if (!RE_SAFE_NAME.test(c.name) || have.has(c.key)) continue;
      have.add(c.key);
      add.push(c);
    }
    if (!add.length) return [];
    // The table the file ends in: its header (the line above its separator row), when its first cell names components —
    // read in the lines the registry's READER reads (mdTables': comments and fenced code out, line for line), whose
    // last one IS the file's last line. A table inside a comment or a code block — `| Old | … | -->` as the file's last
    // line — would take the rows where nothing reads them, the finish would say "added", and every later finish would
    // add them again (1.35 review 10): then a new table takes them, after it. A note on the last row
    // (`| Button | … | <!-- reviewed -->`) hides nothing (review 1 of 1.35.1). By POSITION, never by text: review 2 of
    // 1.35.1 — the reader's text trimmed and its last line compared with the file's, a hidden copy of the table that
    // ended in the visible one's last row passed for it, and its rows were added, unread, on every finish.
    const seen = stripFencedCode(stripHtmlComments(raw.trimEnd().split(/\r?\n/).join("\n"))).split("\n");
    let top = seen.length - 1;
    while (top >= 0 && /^\s*\|/.test(seen[top])) top--;
    const head = seen.length - 1 - top >= 2 && RE_SEP_ROW.test(seen[top + 2]) && seen[top + 2].includes("-") ? seen[top + 1].trim().replace(/^\|/, "").replace(/\|\s*$/, "").split("|").map((x) => x.trim()) : null;
    const isTable = !!head && RE_DS_COMPONENT_HEAD.test(head[0].replace(/[`*_]/g, ""));
    // the columns as the registry's reader finds them: by their header, else by place (the path second, the variants third)
    const colOf = (re, place) => { const i = isTable ? head.findIndex((h, k) => k > 0 && re.test(h.replace(/[`*_]/g, ""))) : -1; return i > 0 ? i : place; };
    const at = colOf(RE_DS_COL.path, 1), variants = colOf(RE_DS_COL.variants, 2);
    let note = -1; // the last column that is neither: where the origin goes
    if (isTable) for (let i = head.length - 1; i > 0 && note < 0; i--) if (i !== at && i !== variants) note = i;
    const ends = note > 0; // (a table with no such column — Component | Path — can't hold the origin: a new table takes the rows)
    const cols = ends ? head.length : 4;
    if (!ends) note = 3;
    const row = (c) => {
      const cells = Array(cols).fill("");
      cells[0] = cell(c.name);
      cells[ends ? at : 1] = c.path && RE_SAFE_PATH.test(c.path) ? "`" + c.path + "`" : "—";
      cells[note] = "_From: " + c.feature + "_";
      return "| " + cells.join(" | ") + " |";
    };
    const body = add.map(row).join("\n") + "\n";
    const text = ends ? appendSpecText(raw, body, { trim: true, join: "\n" }) : appendSpecText(raw, Q.dsTable.components + "\n|---|---|---|---|\n" + body);
    // best-effort: a registry the write gate refuses (a link, a folder of that name) or that can't be replaced now is left as
    // it is — the finish it is part of stands, and the components stay `unregistered`
    try { writeFileAtomic(file, text); } catch { return []; }
    return add.map((c) => c.name);
  }, () => []);
  return Array.isArray(done) ? done : [];
}
// spec_finish's part for a +ui feature of a project that keeps a registry → null (not one) | { raw: {total, counts, top (the
// first 3)}, tokens (does the registry hold tokens or name token files — only then is a raw value something to replace),
// registered (the New components this call added to the registry — only a READY written finish adds them), unregistered (New
// components not in the registry yet) }.
function designSystemFinish(projectDir, slug, opts = {}) {
  const f = existingFeature(projectDir, slug);
  if (!f.ok || !detectTracks(f.dir).includes("ui")) return null;
  const reg = designSystemRegistry(specsRoot(projectDir));
  if (!reg) return null;
  const root = path.resolve(projectDir);
  const rep = featureReport(projectDir, root, f, reg, scanCode(root, false));
  const pending = rep.newComponents.filter((c) => !c.registered);
  let registered = [];
  if (opts.write && opts.ready && pending.length) registered = registerComponents(projectDir, pending.map((c) => ({ name: c.name, key: dsKey(c.name), path: c.path, feature: f.slug })));
  return { raw: { total: rep.total, counts: rep.counts, top: rep.raw.slice(0, 3) }, tokens: reg.total.tokens > 0 || reg.sources.length > 0, registered,
    unregistered: pending.map((c) => c.name).filter((n) => !registered.includes(n)) };
}

module.exports = { designSystemReport, designSystemSeed, designSystemFinish, __link };
