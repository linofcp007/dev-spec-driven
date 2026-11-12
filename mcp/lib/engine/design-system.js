"use strict";

/**
 * dev-spec-driven engine — the design system against the code (1.35): spec_scan {designSystem: true} / `dev-spec design-system`,
 * the registry steering_scaffold seeds from the code, and spec_finish's part. The registry itself — .specs/steering/
 * design-system.md, its reader, doctor's `ui-design-system` and the brief's part — lives in quality.js (every doctor and brief
 * reads it); this module is what READS THE CODE, so it loads on first use (the lazy tier):
 *   - the project report: the components (view files in a component folder) and the tokens (token files' custom properties,
 *     Sass variables and JSON leaves) the code holds, against the registry — what it lacks, the rows whose path names nothing;
 *   - the feature report: its [UI] Design System Usage rows against the registry, and the RAW values in its view files — a
 *     hard-coded colour, a pixel spacing or font size — where the design system has tokens;
 *   - the seed: the registry stub with the code's components and tokens in place of its slot rows;
 *   - finish: the raw values as a warning, and a READY written finish adds the feature's New components to the registry.
 * Heuristic, bounded (a file cap, a bounded read of each file), read-only except the registry rows finish appends, deterministic.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const i18n = require("../i18n.js");
// Owned by other engine modules — used at call time only; engine/index.js links them once the tier has loaded.
let activeDesign, appendSpecText, DESIGN_SYSTEM_FILE, designSystemFindings, designSystemRegistry, designSystemUsage, detectTracks, dsKey,
  existingFeature, featureFilesOf, featureLang, FOLD_CASE, gitignoreRules, isDirSafe, isInsideDir, isNetworkPath, isTestFile, projectLang,
  readFileHead, readIfExists, realRootOf, specsRoot, toPosix, walkProject, withRoadmapLock, writeFileAtomic,
  RE_DS_COMPONENT_HEAD, RE_DS_COL;
function __link(E) { ({ activeDesign, appendSpecText, DESIGN_SYSTEM_FILE, designSystemFindings, designSystemRegistry, designSystemUsage,
  detectTracks, dsKey, existingFeature, featureFilesOf, featureLang, FOLD_CASE, gitignoreRules, isDirSafe, isInsideDir, isNetworkPath, isTestFile,
  projectLang, readFileHead, readIfExists, realRootOf, specsRoot, toPosix, walkProject, withRoadmapLock, writeFileAtomic,
  RE_DS_COMPONENT_HEAD, RE_DS_COL } = E); }

const DS_FILE_CAP = 20000; // view / style / token files a walk counts (`truncated` past it)
const DS_READ_CHARS = 256 * 1024; // a file's characters read (a larger one is read up to there)
const DS_TOKEN_FILES = 20; // token files read
const DS_FOUND_MAX = 300; // components / tokens kept from the code
const DS_LIST = 50; // rows a report lists (`missingTotal` / `staleTotal` count them all)
const DS_VIEW_FILES = 200; // a feature's view files read
const DS_RAW_PER_FILE = 200; // raw values kept per file
const DS_RAW_TOP = 20; // raw values a report lists (`total` / `counts` count them all)
const BS = String.fromCharCode(92); // a backslash, built: an escaped pipe in a table cell

// --- what the code holds ------------------------------------------------------------------------------------------------------
// A component: a view file (React / Vue / Svelte / Astro, an Angular *.component.ts) under a folder a team keeps components in.
// Its name is the file's — Button.tsx, date-picker.vue → DatePicker, button.component.ts — or its folder's for an index file;
// never a test, a story, a hook, a page or one of the folder's helper files.
const RE_COMPONENT_EXT = /\.(?:tsx|jsx|vue|svelte|astro)$/i;
const RE_NG_COMPONENT = /\.component\.ts$/i;
const RE_NOT_COMPONENT_FILE = /\.(?:stories|story|test|spec|mock|fixture|d)\.[a-z]+$/i;
const RE_PLATFORM_INFIX = /\.(?:client|server|native|web|ios|android)$/i;
const COMPONENT_DIRS = new Set(["components", "component", "ui", "design-system", "designsystem", "ds", "widgets", "atoms", "molecules", "organisms",
  "primitives", "elements"]);
const NOT_COMPONENT = new Set(["index", "utils", "util", "helpers", "helper", "types", "constants", "styles", "style", "hooks", "context", "config", "theme",
  "tokens", "stories", "mocks", "i18n", "page", "layout", "route", "template", "loading", "error", "not-found", "main", "app", "provider", "providers", "store"]);
function componentOf(rel) {
  const segs = rel.split("/");
  const file = segs[segs.length - 1];
  const ng = RE_NG_COMPONENT.test(file);
  if (!(ng || RE_COMPONENT_EXT.test(file)) || RE_NOT_COMPONENT_FILE.test(file)) return null;
  if (!segs.slice(0, -1).some((d) => COMPONENT_DIRS.has(d.toLowerCase()))) return null;
  let stem = (ng ? file.replace(RE_NG_COMPONENT, "") : file.replace(/\.[^.]+$/, "")).replace(RE_PLATFORM_INFIX, "");
  const index = stem.toLowerCase() === "index";
  if (index) stem = segs[segs.length - 2] || "";
  const low = stem.toLowerCase();
  if (!/^[A-Za-z][A-Za-z0-9._-]*$/.test(stem) || NOT_COMPONENT.has(low) || COMPONENT_DIRS.has(low) || /^use[A-Z]/.test(stem)) return null;
  const name = stem.split(/[-_.]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join("");
  return { name, key: dsKey(name), path: rel, index };
}
// A token file by its name: a stylesheet named for its tokens (tokens.css, _tokens.scss, _variables.scss, theme.css), a name
// that can only mean design tokens in any format (design-tokens.json, colors.tokens.json, tailwind.config.ts) — and a plain
// `tokens.json` / `tokens.ts` / `theme.json` only under a folder that says so (isTokenFile): `src/auth/tokens.ts` holds
// access tokens, not colours.
const RE_TOKEN_STYLE = /^(?:_?(?:design[-_.]?)?tokens?(?:[-_.][\w-]+)*|_?variables|theme)\.(?:css|scss|sass|less)$/i;
const RE_TOKEN_NAMED = /^(?:design[-_.]?tokens?(?:[-_.][\w-]+)*\.(?:json|ya?ml|js|cjs|mjs|ts)|[\w-]+\.tokens\.(?:json|ya?ml)|tailwind\.config\.(?:js|cjs|mjs|ts))$/i;
const RE_TOKEN_PLAIN = /^(?:tokens?|theme)\.(?:json|ya?ml|js|cjs|mjs|ts)$/i;
const TOKEN_DIRS = new Set(["styles", "style", "theme", "themes", "design", "design-system", "designsystem", "design-tokens", "tokens", "ui"]);
const isTokenFile = (rel) => {
  const segs = rel.split("/"), name = segs[segs.length - 1];
  return RE_TOKEN_STYLE.test(name) || RE_TOKEN_NAMED.test(name) || (RE_TOKEN_PLAIN.test(name) && segs.slice(0, -1).some((d) => TOKEN_DIRS.has(d.toLowerCase())));
};
// …and a global stylesheet that declares the custom properties itself (the shadcn / Tailwind 4 habit): a token file once it
// holds at least this many.
const RE_GLOBAL_CSS = /^(?:globals?|index|app|main|styles?|base|root)\.(?:css|scss)$/i;
const GLOBAL_CSS_MIN = 5;
const RE_STYLE_EXT = /\.(?:css|scss|sass|less|styl)$/i;
// A view or style file — what a feature's raw values are read in (tasks.js RE_VIEW_FILE's text formats).
const RE_VIEW_EXT = /\.(?:tsx|jsx|vue|svelte|astro|html?|css|scss|sass|less|styl|erb|cshtml|razor|twig|hbs|handlebars|mustache|ejs|pug)$|\.blade\.php$/i;
const isViewFile = (rel) => RE_VIEW_EXT.test(rel) || RE_NG_COMPONENT.test(rel);
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
// outside plain CSS, a `//` comment at the line's start or after a blank. Linear.
function withoutComments(line, st, plainCss) {
  let out = "", i = 0;
  while (i < line.length) {
    if (st.block || st.html) {
      const close = st.block ? "*/" : "-->";
      const e = line.indexOf(close, i);
      if (e === -1) return out;
      i = e + close.length;
      st.block = st.html = false;
      continue;
    }
    const b = line.indexOf("/*", i), h = line.indexOf("<!--", i);
    const next = b === -1 ? h : h === -1 ? b : Math.min(b, h);
    const seg = next === -1 ? line.slice(i) : line.slice(i, next);
    if (!plainCss) {
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
    for (const piece of withoutComments(raw, st, plainCss).split(/[;{}]/)) {
      const m = /^\s*(--[A-Za-z0-9_-]+|\$[A-Za-z0-9_-]+)\s*:\s*(\S.*)$/.exec(piece);
      if (m) out.push({ name: m[1], value: m[2].trim().replace(/\s*!default$/, "").slice(0, 80) });
    }
  }
  return out;
}
// A JSON token file's leaves: `{color: {primary: {$value: "#1d4ed8"}}}` (the design-tokens format, or `value`) and plain
// nested values → color.primary. Iterative, depth and count bounded.
function jsonTokens(text) {
  let doc;
  try { doc = JSON.parse(text); } catch { return []; }
  const out = [];
  const stack = [[doc, [], 0]];
  while (stack.length && out.length < DS_FOUND_MAX) {
    const [node, at, depth] = stack.pop();
    if (node == null || typeof node !== "object" || Array.isArray(node)) {
      if (at.length && (typeof node === "string" || typeof node === "number")) out.push({ name: at.join("."), value: String(node).slice(0, 80) });
      continue;
    }
    const v = Object.prototype.hasOwnProperty.call(node, "$value") ? node.$value : Object.prototype.hasOwnProperty.call(node, "value") ? node.value : undefined;
    if (at.length && (typeof v === "string" || typeof v === "number")) { out.push({ name: at.join("."), value: String(v).slice(0, 80) }); continue; }
    if (depth >= 8) continue;
    const keys = Object.keys(node).filter((k) => !k.startsWith("$"));
    for (let i = keys.length - 1; i >= 0; i--) stack.push([node[keys[i]], at.concat(keys[i]), depth + 1]);
  }
  return out;
}
// ONE walk of the project → { components (by name), tokens, sources (the token files), libraries, views (every view / style
// file — a feature's are picked among them), files, truncated }. The scan's corpus: no node_modules / .git / .specs / dist /
// build / hidden folder, nor one the root .gitignore names.
function scanCode(root) {
  const realRoot = realRootOf(root);
  const byKey = new Map(), views = [], tokenFiles = [], globals = [];
  const counts = (rel) => isViewFile(rel) || isTokenFile(rel);
  const walk = walkProject(root, DS_FILE_CAP, (rel, full, name) => {
    if (isTokenFile(rel)) tokenFiles.push({ rel, full });
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
  const take = (file, list) => {
    sources.push(file.rel);
    for (const t of list) { if (!seen.has(t.name) && tokens.length < DS_FOUND_MAX) { seen.add(t.name); tokens.push({ name: t.name, value: t.value, source: file.rel }); } }
  };
  const order = (a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0);
  for (const f of tokenFiles.sort(order).slice(0, DS_TOKEN_FILES)) {
    const text = /\.(?:json|css|scss|sass|less)$/i.test(f.rel) ? readFileHead(f.full, DS_READ_CHARS) : null;
    take(f, text == null ? [] : /\.json$/i.test(f.rel) ? jsonTokens(text) : styleTokens(text, /\.css$/i.test(f.rel)));
  }
  for (const f of globals.sort(order).slice(0, DS_TOKEN_FILES)) {
    if (sources.length >= DS_TOKEN_FILES) break;
    const text = readFileHead(f.full, DS_READ_CHARS);
    const list = text == null ? [] : styleTokens(text, /\.css$/i.test(f.rel)).filter((t) => t.name.startsWith("--"));
    if (list.length >= GLOBAL_CSS_MIN) take(f, list);
  }
  const components = [...byKey.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return { components, tokens, sources, libraries: packageLibraries(root), views, files: walk.files, truncated: walk.truncated, realRoot };
}

// --- raw values: what a feature's view files hard-code ------------------------------------------------------------------------
// A colour: a hex literal (6 / 8 digits anywhere; 3 / 4 only where it can be nothing else — a stylesheet declaration, a Tailwind
// arbitrary value `[#fff]`, a quoted "#fff"), or a functional one with literal arguments (rgb(…), hsl(…), oklch(…) — never
// rgb(var(--x))). Never an anchor or a reference (href="#abcdef", url(#clip)), an HTML entity (&#123;) or a selector line.
const RE_HEX = /(?<![&\w#])#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-zA-Z_-])/g;
const RE_HEX_REF_BEFORE = /(?:href|src|url|id|for|to|path|hash|target)\s*[=:(]\s*["'`(]?$/i;
const RE_COLOR_FN = /(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(\s*[\d.+-][^()]{0,60}\)/gi;
// A size, where a spacing / type / radius token belongs: a stylesheet declaration of margin, padding, gap, font-size or
// border-radius with a px / rem / em literal (never 0 or a 1px hairline, never a value built from a variable), and a Tailwind
// arbitrary value on those utilities (p-[13px], text-[15px], rounded-[10px]).
const RE_SIZE_PROP = /^(?:(?:margin|padding)(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?|gap|row-gap|column-gap|font-size|border-radius|border-(?:top|bottom)-(?:left|right)-radius)$/i;
const RE_SIZE_LITERAL = /(?<![\w.-])(\d*\.?\d+)(px|rem|em)(?![\w-])/;
const RE_TW_SIZE = /(?<![\w-])(?:[a-z0-9-]+:)*(?:p[trblxyse]?|m[trblxyse]?|gap(?:-[xy])?|space-[xy]|text|rounded(?:-[a-z]{1,2})?|leading|tracking)-\[(\d*\.?\d+(?:px|rem|em))\]/g;
function rawValuesOf(text, rel) {
  const out = [];
  const style = RE_STYLE_EXT.test(rel), plainCss = /\.css$/i.test(rel);
  const st = { block: false, html: false };
  const lines = text.split(/\r?\n/);
  const seen = new Set();
  const add = (line, kind, value) => {
    const k = line + ":" + value;
    if (seen.has(k) || out.length >= DS_RAW_PER_FILE) return;
    seen.add(k);
    out.push({ line, kind, value });
  };
  for (let n = 0; n < lines.length && out.length < DS_RAW_PER_FILE; n++) {
    const l = withoutComments(lines[n].length > 2000 ? lines[n].slice(0, 2000) : lines[n], st, plainCss);
    if (!l.trim()) continue;
    const selector = style && /[{,]\s*$/.test(l) && !l.includes(":"); // `#fab,` / `.card #add {`: a selector, no declaration
    if (!selector) {
      for (const m of l.matchAll(RE_HEX)) {
        const before = l.slice(0, m.index);
        if (RE_HEX_REF_BEFORE.test(before.slice(-24))) continue;
        const short = m[1].length < 6;
        if (style ? !before.includes(":") && !before.includes("$") : short && !(before.endsWith("[") || (/["'`]$/.test(before) && /^["'`]/.test(l.slice(m.index + m[0].length))))) continue;
        add(n + 1, "color", m[0]);
      }
      for (const m of l.matchAll(RE_COLOR_FN)) add(n + 1, "color", m[0].replace(/\s+/g, " "));
    }
    if (style) {
      for (const piece of l.split(/[;{}]/)) {
        const d = /^\s*([A-Za-z-]+)\s*:\s*(\S.*)$/.exec(piece);
        if (!d || !RE_SIZE_PROP.test(d[1]) || /var\(|calc\(|theme\(|[$@#]/.test(d[2])) continue;
        const v = RE_SIZE_LITERAL.exec(d[2]);
        if (v && Number(v[1]) > 0 && !(v[2] === "px" && Number(v[1]) <= 1)) add(n + 1, "size", d[1].toLowerCase() + ": " + d[2].trim().slice(0, 40));
      }
    } else {
      for (const m of l.matchAll(RE_TW_SIZE)) add(n + 1, "size", m[0]);
    }
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
// A registry row's path as a project path — decided on its TEXT before any fs call (the Reuse section's rule: a network path, an
// absolute path elsewhere or a `..` out of the project names nothing) — or null when the cell holds no path.
function registryPath(root, cell) {
  const p = String(cell || "").split(/[\s,;]+/).find((w) => /[/.]/.test(w) && !/^https?:/i.test(w));
  if (!p || isNetworkPath(p)) return null;
  const abs = path.resolve(root, p);
  return abs !== root && isInsideDir(root, abs) ? toPosix(path.relative(root, abs)) : null;
}
const onDisk = (root, rel) => { try { fs.lstatSync(path.join(root, rel)); return true; } catch { return false; } };
// The registry as a report names it: its project path, whether it exists, the rows it holds.
const registryView = (root, reg) => ({ file: toPosix(path.relative(root, reg ? reg.file : path.join(specsRoot(root), "steering", DESIGN_SYSTEM_FILE))),
  exists: !!reg, components: reg ? reg.total.components : 0, tokens: reg ? reg.total.tokens : 0 });
// spec_scan {designSystem: true} / `dev-spec design-system [feature]`. Without a feature: the registry against the code →
// { ok, registry: {file, exists, components, tokens}, found: {components, tokens, sources, libraries}, missing (the code's
// components the registry doesn't list, the first DS_LIST: [{name, path}]), missingTotal, stale (the registry rows whose path
// names no file: [{name, path}]), staleTotal, newSources / newLibraries (token files / UI libraries the registry doesn't name),
// inSync, scanned: {files}, truncated }. opts.name: a feature → { ok, feature, registry, usage ({reuse, extend, new} | null:
// its design names no row), problems ([{code, name, near?, text}] — doctor's ui-design-system findings), viewFiles, raw (the
// first DS_RAW_TOP: [{file, line, kind: color | size, value, token?}]), counts: {color, size}, total, newComponents ([{name,
// path, registered}]), truncated }. Stable keys, English; the CLI renders it.
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
  const keys = new Set(reg ? reg.components.map((c) => c.key) : []);
  const missing = scan.components.filter((c) => !keys.has(c.key)).map((c) => ({ name: c.name, path: c.path }));
  const stale = [];
  for (const c of reg ? reg.components : []) {
    const rel = registryPath(root, c.path);
    if (rel && !onDisk(root, rel)) stale.push({ name: c.name, path: c.path });
  }
  const fold = FOLD_CASE ? (s) => s.toLowerCase() : (s) => s;
  const named1 = new Set((reg ? reg.sources : []).map((s) => fold(s.replace(/^(?:\.\/)+/, ""))));
  const newSources = scan.sources.filter((s) => !named1.has(fold(s)));
  const libs = new Set((reg ? reg.libraries : []).map((l) => l.toLowerCase()));
  const newLibraries = scan.libraries.filter((l) => !libs.has(l.toLowerCase()));
  return { ok: true, registry: registryView(root, reg),
    found: { components: scan.components.length, tokens: scan.tokens.length, sources: scan.sources, libraries: scan.libraries },
    missing: missing.slice(0, DS_LIST), missingTotal: missing.length, stale: stale.slice(0, DS_LIST), staleTotal: stale.length, newSources, newLibraries,
    inSync: !!reg && !missing.length && !stale.length && !newSources.length && !newLibraries.length,
    scanned: { files: scan.files }, truncated: scan.truncated };
}
// The feature's part: its usage rows against the registry, the raw values in its view files (its _Implements:_ view / style
// files, token files and tests aside), its New components and where each lives.
function featureReport(projectDir, root, f, reg, scan) {
  const lang = featureLang(projectDir, f.slug);
  const Q = i18n.msg(lang).quality;
  const tracks = detectTracks(f.dir);
  const design = readIfExists(path.join(f.dir, "design.md"));
  const usage = design == null ? null : designSystemUsage(activeDesign(design, tracks));
  const find = reg && usage && usage.rows.length ? designSystemFindings(usage, reg) : null;
  const fold = FOLD_CASE ? (s) => s.toLowerCase() : (s) => s;
  const tokenFiles = new Set([...scan.sources, ...(reg ? reg.sources : [])].map((s) => fold(s.replace(/^(?:\.\/)+/, ""))));
  const want = (rel) => isViewFile(rel) && !isTestFile(rel) && !RE_NOT_COMPONENT_FILE.test(rel);
  const found = scan.views.filter((x) => want(x.rel));
  const mine = [...featureFilesOf(root, scan.realRoot, f.dir, found, want)].sort();
  const byRel = new Map(found.map((x) => [x.rel, x.full]));
  const tokenOf = new Map();
  for (const t of reg ? reg.tokens : []) { const k = colorKey(t.value); if (k && !tokenOf.has(k)) tokenOf.set(k, t.name); }
  const raw = [], counts = { color: 0, size: 0 };
  let viewFiles = 0;
  for (const rel of mine) {
    if (tokenFiles.has(fold(rel)) || isTokenFile(rel)) continue;
    if (viewFiles >= DS_VIEW_FILES) break;
    const text = readFileHead(byRel.get(rel) || path.join(root, rel), DS_READ_CHARS);
    if (text == null) continue;
    viewFiles++;
    for (const v of rawValuesOf(text, rel)) {
      counts[v.kind]++;
      const token = v.kind === "color" ? tokenOf.get(colorKey(v.value)) : undefined;
      if (raw.length < DS_RAW_TOP) raw.push(Object.assign({ file: rel, line: v.line, kind: v.kind, value: v.value }, token ? { token } : {}));
    }
  }
  const keys = new Set(reg ? reg.components.map((c) => c.key) : []);
  const own = new Map();
  for (const rel of mine) { const c = componentOf(rel); if (c && !own.has(c.key)) own.set(c.key, rel); }
  const seenNew = new Set();
  const newComponents = [];
  for (const r of usage ? usage.rows : []) {
    if (r.kind !== "new" || seenNew.has(r.key)) continue;
    seenNew.add(r.key);
    newComponents.push({ name: r.name, path: own.get(r.key) || null, registered: keys.has(r.key) });
  }
  return { ok: true, feature: f.slug, registry: registryView(root, reg),
    usage: usage && usage.rows.length ? { reuse: usage.rows.filter((r) => r.kind === "reuse").length, extend: usage.rows.filter((r) => r.kind === "extend").length, new: newComponents.length } : null,
    problems: find ? find.problems.map((p) => Object.assign({}, p, { text: Q.dsProblem[p.code](p.name, p.near) })) : [],
    viewFiles, raw, counts, total: counts.color + counts.size, newComponents, scanned: { files: scan.files }, truncated: scan.truncated };
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
    component: scan.components.slice(0, DS_FOUND_MAX).map((c) => `| ${cell(c.name)} | ${"`" + cell(c.path) + "`"} |  |  |`),
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
  return { text: out.join("\n"), components: Math.min(scan.components.length, DS_FOUND_MAX), tokens: scan.tokens.length };
}

// --- finish ---------------------------------------------------------------------------------------------------------------------
// A name and a path safe to write into a table row: a component name as people write one, a path of ordinary characters.
const RE_SAFE_NAME = /^[\p{L}\p{N}][\p{L}\p{N} ._/@-]{0,79}$/u;
const RE_SAFE_PATH = /^[\p{L}\p{N}_@.()[\] /-]{1,300}$/u;
// Appends one row per component to the registry (under the roadmap lock — the project's own writes; re-read there, so two
// features finishing at once add each row once): into the component table the file ENDS in — its columns, the path where its
// header says, the note last — else as a new table. → the names added.
function registerComponents(projectDir, list, lang) {
  const sroot = specsRoot(projectDir);
  const file = path.join(sroot, "steering", DESIGN_SYSTEM_FILE);
  const Q = i18n.msg(lang).quality;
  const done = withRoadmapLock(projectDir, () => {
    const raw = readIfExists(file);
    const reg = raw == null ? null : designSystemRegistry(sroot);
    if (!reg) return [];
    const have = new Set(reg.components.map((c) => c.key));
    const add = [];
    for (const c of list) {
      if (!RE_SAFE_NAME.test(c.name) || have.has(c.key)) continue;
      have.add(c.key);
      add.push(c);
    }
    if (!add.length) return [];
    // the table the file ends in: its header (the line above its separator row), when its first cell names components
    const lines = raw.replace(/\s+$/, "").split(/\r?\n/);
    let top = lines.length - 1;
    while (top >= 0 && /^\s*\|/.test(lines[top])) top--;
    const head = lines.length - 1 - top >= 2 && RE_SEP_ROW.test(lines[top + 2]) ? lines[top + 1].trim().replace(/^\|/, "").replace(/\|\s*$/, "").split("|").map((x) => x.trim()) : null;
    const ends = !!head && RE_DS_COMPONENT_HEAD.test(head[0].replace(/[`*_]/g, ""));
    const cols = ends ? head.length : 4;
    const at = ends ? head.findIndex((h, i) => i > 0 && RE_DS_COL.path.test(h)) : 1; // the registry reader's own column test
    const row = (c) => {
      const cells = Array(cols).fill("");
      cells[0] = cell(c.name);
      if (cols > 1) cells[at > 0 ? at : 1] = c.path && RE_SAFE_PATH.test(c.path) ? "`" + c.path + "`" : "—";
      if (cols > 2) cells[cols - 1] = cell(Q.dsFromFeature(c.feature));
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
// first 3)}, registered (the New components this call added to the registry — only a READY written finish adds them),
// unregistered (New components not in the registry yet) }.
function designSystemFinish(projectDir, slug, opts = {}) {
  const f = existingFeature(projectDir, slug);
  if (!f.ok || !detectTracks(f.dir).includes("ui")) return null;
  const reg = designSystemRegistry(specsRoot(projectDir));
  if (!reg) return null;
  const root = path.resolve(projectDir);
  const rep = featureReport(projectDir, root, f, reg, scanCode(root));
  const pending = rep.newComponents.filter((c) => !c.registered);
  let registered = [];
  if (opts.write && opts.ready && pending.length) {
    registered = registerComponents(projectDir, pending.map((c) => ({ name: c.name, key: dsKey(c.name), path: c.path, feature: f.slug })), projectLang(projectDir));
  }
  return { raw: { total: rep.total, counts: rep.counts, top: rep.raw.slice(0, 3) }, registered, unregistered: pending.map((c) => c.name).filter((n) => !registered.includes(n)) };
}

module.exports = { designSystemReport, designSystemSeed, designSystemFinish, __link };
