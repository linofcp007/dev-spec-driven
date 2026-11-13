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
  isNetworkPath, isTestFile, packageDependencies, projectLang, readFileHead, readIfExists, realRootOf, specsRoot, stripEnds, toPosix, unitIn, walkProject,
  withRoadmapLock, writeFileAtomic, RE_DS_COMPONENT_HEAD, RE_DS_COL, dsCell, dsNameSlot;
function __link(E) { ({ activeDesign, appendSpecText, DESIGN_SYSTEM_FILE, designSystemFindings, designSystemRegistry, designSystemUsage,
  detectTracks, dsKey, existingFeature, featureDirs, featureFilesOf, featureLang, FOLD_CASE, forgetCached, gitignoreRules, implementsPath,
  isDirSafe, isInsideDir, isNetworkPath, isTestFile, packageDependencies, projectLang, readFileHead, readIfExists, realRootOf, specsRoot, stripEnds, toPosix,
  unitIn, walkProject, withRoadmapLock, writeFileAtomic, RE_DS_COMPONENT_HEAD, RE_DS_COL, dsCell, dsNameSlot } = E); }

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
function packageLibraries(root) {
  const names = packageDependencies(root); // (quality.js: the root manifest read as the scan reads one — contained, bounded)
  const out = UI_LIBRARIES.filter((l) => names.has(l));
  if ([...names].some((n) => n.startsWith("@radix-ui/react-")) && !out.includes("@radix-ui/themes")) out.push("@radix-ui");
  return out;
}
// Comments out of one line of a stylesheet or a view file — `/* … */` (it may span lines: st.block), `<!-- … -->` (st.html) and,
// with o.slashSlash, a `//` comment at the line's start or after a blank. o.sheet: the line is a stylesheet's — there a `/*`
// opens a comment anywhere; in markup and code only where one can start (the line's start, after a blank or one of `{ ( ; ,` —
// JSX's `{/* … */}`): `accept="image/*"` and `path="/app/*"` hold none (read as one, the rest of the file went unseen). And
// never inside a quoted string of a stylesheet's line (quotedPlaces): Tailwind 4's `@source "../components/*.tsx";` and
// sass-glob's `@import "mixins/*";` opened one that never closed — a globals.css read as holding no token (review 7). Linear.
// → the places of a stylesheet's line that lie inside a quoted string (1), comments followed as withoutComments follows them
//   (block: the line starts inside one); null when the line holds no quote or no `/*` — nothing to tell apart.
function quotedPlaces(line, block) {
  if (!line.includes("/*") || !(line.includes("\"") || line.includes("'"))) return null;
  const mask = new Uint8Array(line.length);
  let quote = "", comment = block;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (comment) { if (c === "*" && line[i + 1] === "/") { comment = false; i++; } continue; }
    if (quote) {
      mask[i] = 1;
      if (c === BS) { if (++i < line.length) mask[i] = 1; } else if (c === quote) quote = "";
      continue;
    }
    if (c === "/" && line[i + 1] === "*") { comment = true; i++; continue; }
    if (c === "\"" || c === "'") { quote = c; mask[i] = 1; }
  }
  return mask;
}
function withoutComments(line, st, o) {
  const quoted = o.sheet ? quotedPlaces(line, st.block) : null;
  // nb, h: the next `/*` that opens a comment past where one can only open by its place, and the next `<!--`, at or after i
  // (-2: not looked for yet, -1: none left). Each is looked for ONCE past a position and its "none left" is KEPT — re-scanned
  // from i after every comment, a line of `<!---->` and `a/*` runs was quadratic (review 3: h; review 4: the `/*`; review
  // 5: a `/*` right at i overwrote the cached -1, and `<!---->/**/` runs rescanned the rest of the line each time).
  let out = "", i = 0, nb = -2, h = -2;
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
        while (nb !== -1 && (o.sheet ? quoted != null && quoted[nb] === 1 : !/[\s{(;,]/.test(line[nb - 1]))) nb = line.indexOf("/*", nb + 2);
      }
      b = nb;
    }
    if (h !== -1 && h < i) h = line.indexOf("<!--", i);
    const next = b === -1 ? h : h === -1 ? b : Math.min(b, h);
    const seg = next === -1 ? line.slice(i) : line.slice(i, next);
    if (o.slashSlash) {
      const m = /(?:^|\s)\/\//.exec(seg);
      if (m) return out + seg.slice(0, m.index);
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
  // on, unless it holds a declaration of its own (`.button-variant(@color; @background;` then its defaults — review 10).
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
    let inside = paren > 0, declared = false; // declared: the line holds a declaration of its own
    for (let i = 0; i <= masked.length; i++) {
      const ch = i < masked.length ? masked[i] : "";
      // (a quoted string holds no delimiter: `--q: "{"`, `content: ";"` — it ends with its line)
      if (quote !== "" && ch !== "") { if (ch === BS && i + 1 < masked.length) i++; else if (ch === quote) quote = ""; continue; }
      if (ch === "\"" || ch === "'") { quote = ch; continue; }
      if (ch === "(") paren++; else if (ch === ")" && paren > 0) paren--;
      if (ch !== "" && ch !== ";" && ch !== "{" && ch !== "}") continue;
      const piece = masked.slice(from, i);
      from = i + 1;
      const within = inside && !config;
      if (prelude === "" && !inside) config = /^\s*@(?:use|forward)(?![\w-])/.test(piece);
      if (ch === "{" || ch === "}") paren = 0;
      else if (ch === "" && paren > paren0 && !(last1 === "," || last1 === "(" || (less && last1 === ";" && !declared))) paren = paren0;
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
      if (entry) declared = true;
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
function scanCode(root) {
  const realRoot = realRootOf(root);
  const byKey = new Map(), views = [], tokenFiles = [], sheets = [], found = [], routerRoots = new Set(), pageDirs = new Set(), nextConfigs = new Set();
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
    if (!isViewFile(rel)) return;
    views.push({ rel, full });
    if (isTestFile(rel)) return;
    const c = componentOf(rel);
    if (c) found.push(c);
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
  for (const c of found) {
    if (c.route && routed(dirOf(c.path))) continue;
    const had = byKey.get(c.key);
    // one component per name: its own file before a folder's index, then the shorter path
    if (!had || (had.index && !c.index) || (had.index === c.index && c.path.length < had.path.length)) byKey.set(c.key, c);
  }
  const tokens = [], sources = [], twins = [], seen = new Set();
  // A bound that cut what is read — the reports say so (`limits`), never "in sync". Each is set only when something WAS cut:
  //   tokenFiles — a file that IS a source found the sources full;   candidates — files named like one were left unread;
  //   tokens — a token was left past the cap;   fileSize — the first token file longer than a file's read (its path).
  const capped = { tokenFiles: false, candidates: false, tokens: false, fileSize: null };
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
  return { components, tokens, sources, twins, libraries: packageLibraries(root), views, files: walk.files, truncated: walk.truncated, capped, realRoot };
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
// DS_TOKEN_READS) · file-size (a token file longer than a file's read: `file`, the first) · tokens · registry-rows (rows
// past the reader's cap are not checked for a gone path) · view-files (a feature's). `truncated`: one of them — and then the
// report is never `inSync`: what it did not read it cannot vouch for. A bound that cut nothing is not said (a report that
// names one can never be in sync: said of a project that lost nothing, it would be a false alarm for good).
const scanLimits = (scan) => [scan.truncated ? { code: "files", read: scan.files } : null, scan.capped.tokenFiles ? { code: "token-files", read: DS_TOKEN_FILES } : null,
  scan.capped.candidates ? { code: "token-candidates", read: DS_TOKEN_READS } : null,
  scan.capped.fileSize ? { code: "file-size", read: DS_READ_CHARS, file: scan.capped.fileSize } : null,
  scan.capped.tokens ? { code: "tokens", read: DS_TOKENS_MAX } : null].filter(Boolean);
function designSystemReport(projectDir, opts = {}) {
  const root = path.resolve(projectDir);
  const lang = projectLang(projectDir);
  if (!isDirSafe(root)) return { ok: false, root, error: i18n.msg(lang).brownfield.notFolder(root) };
  const named = opts.name != null && String(opts.name).trim() !== "";
  const f = named ? existingFeature(projectDir, opts.name) : null;
  if (f && !f.ok) return { ok: false, error: f.error, code: f.code };
  const reg = designSystemRegistry(specsRoot(projectDir));
  const scan = scanCode(root);
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
  // (the token-FILE bounds reach a feature's report too: a stylesheet left out of the sources is read for raw values)
  const limits = scanLimits(scan).filter((l) => l.code !== "tokens");
  let viewFiles = 0;
  for (const rel of mine) {
    if (tokenFiles.has(fold(rel)) || isTokenFile(rel)) continue;
    if (viewFiles >= DS_VIEW_FILES) { limits.push({ code: "view-files", read: DS_VIEW_FILES }); break; }
    const text = readFileHead(byRel.get(rel) || path.join(root, rel), DS_READ_CHARS);
    if (text == null) continue;
    viewFiles++;
    for (const v of rawValuesOf(text, rel)) {
      counts[v.kind]++;
      const token = v.kind === "color" ? tokenOf.get(colorKey(v.value)) : undefined;
      if (raw.length < DS_LIST) raw.push(Object.assign({ file: rel, line: v.line, kind: v.kind, value: v.value }, token ? { token } : {}));
    }
  }
  const own = new Map();
  for (const rel of mine) { const c = componentOf(rel); if (c && !own.has(c.key)) own.set(c.key, rel); }
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
    // the table the file ends in: its header (the line above its separator row), when its first cell names components
    const lines = raw.trimEnd().split(/\r?\n/);
    let top = lines.length - 1;
    while (top >= 0 && /^\s*\|/.test(lines[top])) top--;
    const head = lines.length - 1 - top >= 2 && RE_SEP_ROW.test(lines[top + 2]) ? lines[top + 1].trim().replace(/^\|/, "").replace(/\|\s*$/, "").split("|").map((x) => x.trim()) : null;
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
  const rep = featureReport(projectDir, root, f, reg, scanCode(root));
  const pending = rep.newComponents.filter((c) => !c.registered);
  let registered = [];
  if (opts.write && opts.ready && pending.length) registered = registerComponents(projectDir, pending.map((c) => ({ name: c.name, key: dsKey(c.name), path: c.path, feature: f.slug })));
  return { raw: { total: rep.total, counts: rep.counts, top: rep.raw.slice(0, 3) }, tokens: reg.total.tokens > 0 || reg.sources.length > 0, registered,
    unregistered: pending.map((c) => c.name).filter((n) => !registered.includes(n)) };
}

module.exports = { designSystemReport, designSystemSeed, designSystemFinish, __link };
