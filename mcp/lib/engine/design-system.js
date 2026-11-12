"use strict";

/**
 * dev-spec-driven engine — the design system against the code (1.35): spec_scan {designSystem: true} / `dev-spec design-system`,
 * the registry steering_scaffold seeds from the code, and spec_finish's part. The registry itself — .specs/steering/
 * design-system.md, its reader, doctor's `ui-design-system` and the brief's part — lives in quality.js (every doctor and brief
 * reads it); this module is what READS THE CODE, so it loads on first use (the lazy tier):
 *   - the project report: the components (view files in a component folder) and the tokens (token files' custom properties,
 *     Sass variables and JSON leaves) the code holds, against the registry — what it lacks, the rows whose path names nothing;
 *   - the feature report: its [UI] Design System Usage rows against the registry, and the RAW values in its view files — a
 *     hard-coded colour, a pixel spacing or font size;
 *   - the seed: the registry stub with the code's components and tokens in place of its slot rows;
 *   - finish: the raw values as a warning, and a READY written finish adds the feature's New components to the registry.
 * Heuristic, bounded (a file cap, a bounded read of each file, a bounded line), read-only except the registry rows finish
 * appends, deterministic. What it does NOT read: tokens kept in JS / TS / YAML files (listed as sources, their values unread),
 * a size in a JSX `style={{…}}` object, a component in a lower-case .js file.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const i18n = require("../i18n.js");
// Owned by other engine modules — used at call time only; engine/index.js links them once the tier has loaded.
let activeDesign, appendSpecText, DESIGN_SYSTEM_FILE, designSystemFindings, designSystemRegistry, designSystemUsage, detectTracks, dsKey,
  existingFeature, featureDirs, featureFilesOf, featureLang, FOLD_CASE, forgetCached, gitignoreRules, implementsPath, isDirSafe, isInsideDir,
  isNetworkPath, isTestFile, projectLang, readFileHead, readIfExists, realRootOf, specsRoot, stripEnds, toPosix, unitIn, walkProject,
  withRoadmapLock, writeFileAtomic, RE_DS_COMPONENT_HEAD, RE_DS_COL;
function __link(E) { ({ activeDesign, appendSpecText, DESIGN_SYSTEM_FILE, designSystemFindings, designSystemRegistry, designSystemUsage,
  detectTracks, dsKey, existingFeature, featureDirs, featureFilesOf, featureLang, FOLD_CASE, forgetCached, gitignoreRules, implementsPath,
  isDirSafe, isInsideDir, isNetworkPath, isTestFile, projectLang, readFileHead, readIfExists, realRootOf, specsRoot, stripEnds, toPosix,
  unitIn, walkProject, withRoadmapLock, writeFileAtomic, RE_DS_COMPONENT_HEAD, RE_DS_COL } = E); }

const DS_FILE_CAP = 20000; // view / style / token files a walk counts (`truncated` past it)
const DS_READ_CHARS = 256 * 1024; // a file's characters read (a larger one is read up to there)
const DS_LINE_MAX = 2000; // a line's characters read (a longer one — minified — is read up to there)
const DS_TOKEN_FILES = 20; // token files read (by path; past them: the report's `limits` says so)
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
// A lower-case file name that is a helper or a framework's special file, never a component (`Layout.tsx`, `Loading.tsx` and
// `Error.tsx` ARE components: the names are matched as written).
const NOT_COMPONENT = new Set(["index", "utils", "util", "helpers", "helper", "types", "constants", "styles", "style", "hooks", "context", "config", "theme",
  "tokens", "stories", "mocks", "i18n", "page", "layout", "route", "template", "loading", "error", "not-found", "main", "app", "provider", "providers", "store"]);
// A folder whose index file is a barrel, never a component named after it (packages/ui/src/index.tsx, icons/index.tsx).
const GENERIC_DIRS = new Set(["src", "lib", "libs", "app", "apps", "common", "shared", "core", "base", "utils", "helpers", "hooks", "styles", "assets", "icons",
  "images", "types", "internal", "generated", "dist", "build", "test", "tests", "stories"]);
const dirName = (d) => d.toLowerCase().replace(/^_+/, ""); // Next's private `_components/` is a component folder
function componentOf(rel) {
  const segs = rel.split("/");
  const file = segs[segs.length - 1];
  const ng = RE_NG_COMPONENT.test(file), js = !ng && RE_JS_COMPONENT.test(file);
  if (!(ng || js || RE_COMPONENT_EXT.test(file)) || RE_NOT_COMPONENT_FILE.test(file)) return null;
  let kind = null;
  for (let i = segs.length - 2; i >= 0 && !kind; i--) { const d = dirName(segs[i]); kind = COMPONENT_DIRS.has(d) ? "component" : PAGE_DIRS.has(d) ? "page" : null; }
  if (kind !== "component") return null;
  let stem = (ng ? file.replace(RE_NG_COMPONENT, "") : file.replace(/\.[^.]+$/, "")).replace(RE_PLATFORM_INFIX, "");
  const index = stem.toLowerCase() === "index";
  if (index) stem = segs[segs.length - 2] || "";
  const low = stem.toLowerCase();
  // (a helper's name as written — lower-case — is none, as a file or as an index's folder: config/index.tsx, context/index.tsx)
  if (NOT_COMPONENT.has(stem) || (index ? GENERIC_DIRS.has(low) || COMPONENT_DIRS.has(dirName(stem)) : stem === low && COMPONENT_DIRS.has(low))) return null;
  if (!/^[A-Za-z][A-Za-z0-9._-]{0,79}$/.test(stem) || /^use(?:[A-Z]|[-_.])/.test(stem)) return null;
  if (js && !/^[A-Z][A-Za-z0-9]*$/.test(stem)) return null; // a .js file is a component only by a PascalCase name (Button.js)
  const name = stem.split(/[-_.]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join("");
  return { name, key: dsKey(name), path: rel, index };
}
// A token file by its name AND its place (tokenFileKind):
//   style — a stylesheet named for its tokens (tokens.css, _tokens.scss, tokens.dark.css, _variables.scss, theme.css): anywhere;
//   named — a name that can only mean design tokens, in any format (design-tokens.json, colors.tokens.json,
//           tailwind.config.ts): anywhere;
//   theme — theme.json / theme.ts where a project keeps its UI theme: its root, RIGHT inside a source folder (src/theme.ts,
//           apps/web/src/theme.ts) or in a telling folder — `src/store/theme.ts` is a state slice, `server/models/theme.js` a model;
//   plain — tokens.json / tokens.ts only at the project's root or in a telling folder: `src/auth/tokens.ts` and
//           `src/ui/auth/tokens.ts` hold access tokens, not colours. Never the singular `token.json` (an OAuth client's file).
// "In a folder": source folders aside — packages/ui/src/tokens.ts lives in `ui` (homeDir). And a JSON one is read only when
// its CONTENT is a design file's (jsonTokens): a name is no proof. (A name's further parts are letters and digits only: with
// the separator inside the part's class, `tokens-a-a-a-…` backtracked exponentially.)
const RE_TOKEN_STYLE = /^(?:_?(?:design[-_.]?)?tokens(?:[-_.][A-Za-z0-9]+)*|_?variables|theme)\.(?:css|scss|sass|less)$/i;
const RE_TOKEN_NAMED = /^(?:design[-_.]?tokens?(?:[-_.][A-Za-z0-9]+)*\.(?:json|ya?ml|js|cjs|mjs|ts)|[A-Za-z0-9_-]+\.tokens\.(?:json|ya?ml)|tailwind\.config\.(?:js|cjs|mjs|ts))$/i;
const RE_TOKEN_THEME = /^theme\.(?:json|ya?ml|js|cjs|mjs|ts)$/i;
const RE_TOKEN_PLAIN = /^tokens\.(?:json|ya?ml|js|cjs|mjs|ts)$/i;
const TOKEN_DIRS = new Set(["styles", "style", "theme", "themes", "design", "design-system", "designsystem", "design-tokens", "tokens", "ui"]);
const SOURCE_DIRS = new Set(["src", "lib", "source", "app"]);
// The folder a file lives in, source folders aside (packages/ui/src/tokens.ts → "ui"); "" at the project's root or source root.
const homeDir = (segs) => { let i = segs.length - 2; while (i >= 0 && SOURCE_DIRS.has(segs[i].toLowerCase())) i--; return i < 0 ? "" : segs[i].toLowerCase(); };
function tokenFileKind(rel) {
  const segs = rel.split("/"), name = segs[segs.length - 1];
  if (RE_TOKEN_STYLE.test(name)) return "style";
  if (RE_TOKEN_NAMED.test(name)) return "named";
  const theme = RE_TOKEN_THEME.test(name);
  if (!theme && !RE_TOKEN_PLAIN.test(name)) return null;
  if (segs.length === 1 || TOKEN_DIRS.has(homeDir(segs))) return theme ? "theme" : "plain";
  return theme && SOURCE_DIRS.has(segs[segs.length - 2].toLowerCase()) ? "theme" : null;
}
const isTokenFile = (rel) => tokenFileKind(rel) != null;
// …and a global stylesheet that declares the custom properties itself (the shadcn / Tailwind 4 habit): a token file once it
// holds at least this many.
const RE_GLOBAL_CSS = /^(?:globals?|index|app|main|styles?|base|root)\.(?:css|scss)$/i;
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
  const text = readFileHead(path.join(root, "package.json"), DS_READ_CHARS);
  if (text == null) return [];
  let pkg;
  try { pkg = JSON.parse(text); } catch { return []; }
  const names = new Set();
  for (const k of ["dependencies", "devDependencies", "peerDependencies"]) {
    const d = pkg && pkg[k];
    if (d && typeof d === "object" && !Array.isArray(d)) for (const n of Object.keys(d)) names.add(n);
  }
  const out = UI_LIBRARIES.filter((l) => names.has(l));
  if ([...names].some((n) => n.startsWith("@radix-ui/react-")) && !out.includes("@radix-ui/themes")) out.push("@radix-ui");
  return out;
}
// Comments out of one line of a stylesheet or a view file — `/* … */` (it may span lines: st.block), `<!-- … -->` (st.html) and,
// with o.slashSlash, a `//` comment at the line's start or after a blank. o.sheet: the line is a stylesheet's — there a `/*`
// opens a comment anywhere; in markup and code only where one can start (the line's start, after a blank or one of `{ ( ; ,` —
// JSX's `{/* … */}`): `accept="image/*"` and `path="/app/*"` hold none (read as one, the rest of the file went unseen). Linear.
function withoutComments(line, st, o) {
  let out = "", i = 0, h = -2; // h: the next `<!--` at or after i (-2: not looked for yet, -1: none left — looked for once)
  while (i < line.length) {
    if (st.block || st.html) {
      const close = st.block ? "*/" : "-->";
      const e = line.indexOf(close, i);
      if (e === -1) return out;
      i = e + close.length;
      st.block = st.html = false;
      continue;
    }
    let b = line.indexOf("/*", i);
    while (b > i && !o.sheet && !/[\s{(;,]/.test(line[b - 1])) b = line.indexOf("/*", b + 2);
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
// The tokens a stylesheet declares: custom properties (`--name: value`) and Sass variables (`$name: value`), in file order.
function styleTokens(text, plainCss) {
  const out = [];
  const st = { block: false, html: false };
  for (const raw of text.split(/\r?\n/)) {
    for (const piece of withoutComments(raw.length > DS_LINE_MAX ? raw.slice(0, DS_LINE_MAX) : raw, st, { slashSlash: !plainCss, sheet: true }).split(/[;{}]/)) {
      const m = /^\s*(--[A-Za-z0-9_-]+|\$[A-Za-z0-9_-]+)\s*:\s*(\S.*)$/.exec(piece);
      if (!m) continue;
      let value = m[2].trim();
      if (value.endsWith("!default")) value = value.slice(0, -8).trim();
      out.push({ name: m[1], value: value.slice(0, 80) });
    }
  }
  return out;
}
// A JSON token file's leaves: `{color: {primary: {$value: "#1d4ed8"}}}` (the design-tokens format, or `value`) and plain
// nested values → color.primary. Iterative, depth and count bounded. → { list, secret, design, more }:
//   secret — a key that names a CREDENTIAL holds a string that is no design value (Google's OAuth token.json, a saved
//            tokens.json: token, refresh_token, client_secret, api_key…). The file is no design file: the caller reads,
//            lists and writes NOTHING of it — its values would land in tool output and in a steering file a team commits;
//   design — it shows what it is: a `$value` / `$type` key, or a leaf that is a colour or a length (never a bare number —
//            `expires_in: 3599`). A plain tokens.json is read only with it;
//   more   — leaves were left past the cap.
// And no leaf is kept whose value is one long opaque run (a key, a hash, a signed URL): no design value looks like that.
const RE_SECRET_KEY = /^(?:token|bearer|(?:access|refresh|id|auth|session|bearer|api)[-_ ]?token|client[-_ ]?(?:secret|id)|api[-_ ]?key|secret(?:[-_ ]?key)?|private[-_ ]?key|passw(?:or)?d|credentials?|token[-_ ]?(?:uri|url|type))$/i;
const RE_DESIGN_VALUE = /^(?:#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$|(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|var|calc|clamp)\(|-?(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|em|%|ms|s|pt|vh|vw|deg)$)/i;
const opaqueValue = (v) => v.length > 40 && !/[\s(),]/.test(v);
function jsonTokens(text) {
  const res = { list: [], secret: false, design: false, more: false };
  let doc;
  try { doc = JSON.parse(text); } catch { return res; }
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const leaf = (at, v0) => {
    const v = String(v0);
    const shown = RE_DESIGN_VALUE.test(v.slice(0, 80));
    if (shown && typeof v0 === "string") res.design = true;
    if (!shown && typeof v0 === "string" && RE_SECRET_KEY.test(at[at.length - 1])) { res.secret = true; return; }
    if (!opaqueValue(v)) res.list.push({ name: at.join("."), value: v.slice(0, 80) });
  };
  const stack = [[doc, [], 0]];
  while (stack.length) {
    if (res.list.length >= DS_TOKENS_MAX) { res.more = true; break; }
    const [node, at, depth] = stack.pop();
    if (node == null || typeof node !== "object" || Array.isArray(node)) {
      if (at.length && (typeof node === "string" || typeof node === "number")) leaf(at, node);
      continue;
    }
    if (own(node, "$value") || own(node, "$type")) res.design = true;
    const v = own(node, "$value") ? node.$value : own(node, "value") ? node.value : undefined;
    if (at.length && (typeof v === "string" || typeof v === "number")) { leaf(at, v); continue; }
    if (depth >= 8) continue;
    const keys = Object.keys(node).filter((k) => !k.startsWith("$"));
    for (let i = keys.length - 1; i >= 0; i--) stack.push([node[keys[i]], at.concat(keys[i]), depth + 1]);
  }
  return res;
}
// ONE walk of the project → { components (by name), tokens, sources (the token files), libraries, views (every view / style
// file — a feature's are picked among them), files, truncated }. The scan's corpus: no node_modules / .git / .specs / dist /
// build / hidden folder, nor one the root .gitignore names.
function scanCode(root) {
  const realRoot = realRootOf(root);
  const byKey = new Map(), views = [], tokenFiles = [], globals = [];
  const counts = (rel) => isViewFile(rel) || isTokenFile(rel);
  const walk = walkProject(root, DS_FILE_CAP, (rel, full, name) => {
    const kind = tokenFileKind(rel);
    if (kind) tokenFiles.push({ rel, full, kind });
    else if (RE_GLOBAL_CSS.test(name)) globals.push({ rel, full });
    if (!isViewFile(rel)) return;
    views.push({ rel, full });
    if (isTestFile(rel)) return;
    const c = componentOf(rel);
    if (!c) return;
    const had = byKey.get(c.key);
    // one component per name: its own file before a folder's index, then the shorter path
    if (!had || (had.index && !c.index) || (had.index === c.index && c.path.length < had.path.length)) byKey.set(c.key, c);
  }, { counts, gitignore: gitignoreRules(root, realRoot) });
  const tokens = [], sources = [], seen = new Set();
  const capped = { tokenFiles: false, tokens: false }; // a bound that cut what is read: the reports say so, never "in sync"
  const take = (file, list) => {
    sources.push(file.rel);
    for (const t of list) {
      if (seen.has(t.name)) continue;
      if (tokens.length >= DS_TOKENS_MAX) { capped.tokens = true; break; }
      seen.add(t.name);
      tokens.push({ name: t.name, value: t.value, source: file.rel });
    }
  };
  const order = (a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0);
  let read = 0;
  for (const f of tokenFiles.sort(order)) {
    if (read >= DS_TOKEN_FILES) { capped.tokenFiles = true; break; }
    read++;
    const json = /\.json$/i.test(f.rel);
    const text = json || RE_STYLE_EXT.test(f.rel) ? readFileHead(f.full, DS_READ_CHARS) : null; // (a JS / TS / YAML one: a source, its values unread)
    if (!json) { take(f, text == null ? [] : styleTokens(text, /\.css$/i.test(f.rel))); continue; }
    const j = text == null ? null : jsonTokens(text);
    // a JSON file whose content is no design file's — a credential in it, or a plain tokens.json that shows no design value
    // (unreadable or unparsable included): not a source, nothing of it read
    if (j ? j.secret || (f.kind === "plain" && !j.design) : f.kind === "plain") continue;
    if (j && j.more) capped.tokens = true;
    take(f, j ? j.list : []);
  }
  read = 0;
  for (const f of globals.sort(order)) {
    if (sources.length >= DS_TOKEN_FILES || read >= DS_TOKEN_FILES) { capped.tokenFiles = true; break; }
    read++;
    const text = readFileHead(f.full, DS_READ_CHARS);
    const list = text == null ? [] : styleTokens(text, /\.css$/i.test(f.rel)).filter((t) => t.name.startsWith("--"));
    if (list.length >= GLOBAL_CSS_MIN) take(f, list);
  }
  const components = [...byKey.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return { components, tokens, sources, libraries: packageLibraries(root), views, files: walk.files, truncated: walk.truncated, capped, realRoot };
}

// --- raw values: what a feature's view files hard-code ------------------------------------------------------------------------
// A colour: a hex literal, or a functional one with literal arguments (rgb(…), hsl(…), oklch(…) — never rgb(var(--x))).
// Where a hex is read:
//   - a stylesheet (a .css / .scss… file, a <style> block of a markup file, a declaration-shaped line of a CSS-in-JS template):
//     in a declaration's VALUE only — never a selector (`.page:hover #fab {`, `#fab,`) nor an at-rule's prelude;
//   - markup and code: 6 / 8 digits right after a quote or one of `[ ( : = ,` (a string, a Tailwind arbitrary value, an
//     attribute) — "Ticket #204518" is prose; 3 / 4 digits only as a Tailwind arbitrary value `[#fff]` or a quoted "#fff".
// Never an anchor or a reference (href="#abcdef", url(#clip), querySelector("#add")) nor an HTML entity (&#123;).
const RE_HEX = /(?<![&\w#])#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-zA-Z_-])/g;
// What stands right before a hex that is no colour (read on a 40-character tail):
//   - an attribute that takes an anchor or an id, under any prefix: href="#abc", to="#add", data-bs-target="#add",
//     hx-target="#feed", xlink:href="#fade" — and JSX's xlinkHref / dataTarget (RE_HEX_REF_CAMEL: only Href and Target,
//     `gradientTo="#1d4ed8"` is a colour);
//   - an `href:` / `id:` / `hash:` key — a WHOLE word: `invalid: '#dc2626'`, `solid: "#1d4ed8"` and a gradient's
//     `to: "#fff"` are colours;
//   - `url(#clip)`, a DOM lookup, a selection or a scroll / tween target: querySelector("#add"), $("#add"), .find("#add"),
//     d3.select("#fade"), gsap.to("#face"), scrollTo('#fed').
const RE_HEX_REF_BEFORE = /(?<![\w-])(?:(?:[\w:-]*[-:])?(?:href|src|id|for|htmlFor|to|path|hash|target)\s*=\s*\{?\s*["'`]?|(?:href|id|hash)\s*:\s*["'`]|url\(\s*["'`]?|(?:querySelector(?:All)?|getElementById|closest|matches|jQuery|\$|find|select(?:All)?|scrollTo|to|fromTo)\s*\(\s*["'`])$/i;
const RE_HEX_REF_CAMEL = /(?<![\w-])[a-z][A-Za-z0-9]*(?:Href|Target)\s*=\s*\{?\s*["'`]?$/;
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
// there never right after an identifier: `useState<style>(null)` is a type (read as a block's start, the rest of the file
// was a stylesheet).
const RE_STYLE_BLOCK_EXT = /\.(?:vue|svelte|astro|html?|erb|cshtml|razor|twig|hbs|handlebars|mustache|ejs|pug)$|\.blade\.php$/i;
const RE_STYLE_OPEN = /<style[\s>]/i;
const RE_STYLE_OPEN_JSX = /(?<![\w$.)\]])<style[\s>]/;
const RE_STYLE_CLOSE = /<\/style\s*>/i;
const isQuote = (c) => c === "\"" || c === "'" || c === "`";
function rawValuesOf(text, rel) {
  const out = [], seen = new Set();
  const sheet = RE_STYLE_EXT.test(rel), plainCss = /\.css$/i.test(rel);
  const open = sheet ? null : RE_STYLE_BLOCK_EXT.test(rel) ? RE_STYLE_OPEN : RE_STYLE_OPEN_JSX;
  const st = { block: false, html: false };
  let inStyle = false; // inside a <style> block of a markup or JSX file
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
      if (RE_HEX_REF_BEFORE.test(tail) || RE_HEX_REF_CAMEL.test(tail)) continue;
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
    let block = inStyle;
    if (open) {
      if (open.test(src)) inStyle = block = true;
      if (RE_STYLE_CLOSE.test(src)) inStyle = false;
    }
    const l = withoutComments(src, st, { slashSlash: !plainCss, sheet: sheet || block });
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
// Is a registry row's path gone? Only a cell that NAMES A FILE OF THE PROJECT can be — a reading counts when its last
// segment has a file extension (`src/components/Card` may be Card.tsx or a folder: not judged) and its FIRST segment is on
// disk: `next/link`, `primereact/button`, `~/components/Button.vue`, `storybook.example.com/button.html`, "Built into the
// layout." and "n/a (custom)" start nowhere in the project, so they are never stale. The readings, in order:
//   1. the whole cell on disk → there (a path may hold a blank: `src/components/Form Controls/DatePicker.tsx`);
//   2. the FIRST word that names a file decides — a markdown link's target, a path beside a note: `Gone.tsx (see README.md)`
//      and `Gone.tsx — replaced by Card.tsx` are gone, whatever the note names;
//   3. no such word → the whole cell, when it names a file (a path with a blank that is gone).
const RE_FILE_EXT = /\.[A-Za-z][A-Za-z0-9]{0,9}$/;
const DS_PATH_WORDS = 20; // words of a path cell read
function stalePath(root, cell) {
  const text = stripEnds(String(cell || "").slice(0, 400).trim(), unitIn("`")).trim();
  if (!text) return false;
  // a reading → null (it names no file of the project) | true (the file is there) | false (it is gone)
  const there = (w) => {
    const rel = projectPath(root, w);
    if (rel == null || !RE_FILE_EXT.test(rel) || !onDisk(root, rel.split("/")[0])) return null;
    return onDisk(root, rel);
  };
  const whole = projectPath(root, text);
  if (whole != null && onDisk(root, whole)) return false;
  for (const w of text.split(/[\s,;]+/).slice(0, DS_PATH_WORDS)) {
    const t = there(stripEnds(w.replace(/^.*\]\(/, ""), unitIn("([`"), unitIn(")]`")));
    if (t != null) return !t;
  }
  return there(text) === false;
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
// that an unfinished feature's design declares New — its finish adds them: [{name, path, feature}]), pendingTotal, stale (the registry rows
// whose path names no file: [{name, path}]), staleTotal, newTokens (the code's tokens the registry doesn't list, the first
// DS_LIST: [{name, value}]), newTokensTotal, newSources / newLibraries (token files / UI libraries the registry doesn't name),
// inSync, scanned: {files}, limits, truncated }. opts.name: a feature → { ok, feature, registry, usage ({reuse, extend, new} |
// null: its design names no row), problems ([{code, name, near?, text}] — doctor's ui-design-system findings), viewFiles, raw
// (the first DS_LIST: [{file, line, kind: color | size, value, token? (a registry token of that colour)}]), counts: {color,
// size}, total, newComponents ([{name, path, registered}]), scanned, limits, truncated }. Stable keys, English; the CLI
// renders it.
// `limits`: the bounds that cut what was read — [{code, read}], code: files (the walk's file cap) · token-files · tokens ·
// registry-rows (rows past the reader's cap are not checked for a gone path) · view-files (a feature's). `truncated`: one was
// reached — and then the report is never `inSync`: what it did not read it cannot vouch for.
const scanLimits = (scan) => [scan.truncated ? { code: "files", read: scan.files } : null, scan.capped.tokenFiles ? { code: "token-files", read: DS_TOKEN_FILES } : null,
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
  const newSources = scan.sources.filter((s) => !named1.has(fold(s)));
  const libs = new Set((reg ? reg.libraries : []).map((l) => l.toLowerCase()));
  const newLibraries = scan.libraries.filter((l) => !libs.has(l.toLowerCase()));
  const tokenNames = reg ? reg.tokenNames : new Set(); // every token the file lists, past the reader's cap too
  const newTokens = scan.tokens.filter((t) => !tokenNames.has(t.name.toLowerCase())).map((t) => ({ name: t.name, value: t.value }));
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
  const tokenFiles = new Set([...scan.sources, ...(reg ? reg.sources : [])].map((s) => fold(s.replace(/^(?:\.\/)+/, ""))));
  const want = (rel) => isViewFile(rel) && !isTestFile(rel) && !RE_NOT_COMPONENT_FILE.test(rel);
  const found = scan.views.filter((x) => want(x.rel));
  const mine = [...featureFilesOf(root, scan.realRoot, f.dir, found, want)].sort();
  const byRel = new Map(found.map((x) => [x.rel, x.full]));
  const tokenOf = new Map();
  for (const t of reg ? reg.tokens : []) { const k = colorKey(t.value); if (k && !tokenOf.has(k)) tokenOf.set(k, t.name); }
  const raw = [], counts = { color: 0, size: 0 };
  const limits = scanLimits(scan).filter((l) => l.code === "files"); // (the token caps cut nothing a feature's report reads)
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
    if (/^_Token sources:/.test(l) && scan.sources.length) { out.push("_Token sources: " + scan.sources.join(", ") + "_"); continue; }
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
