"use strict";

/**
 * dev-spec-driven — MCP prompts + resources (zero-dependency, pure Node core, no network).
 *
 * PROMPTS: one per plugin command (commands/*.md, read at runtime — never a hardcoded list). name = the file name
 * without .md, description = the front-matter `description`, one optional `args` argument described from the
 * front-matter `argument-hint`. getPrompt renders the command body with $ARGUMENTS replaced (and ${CLAUDE_PLUGIN_ROOT}
 * resolved to this clone), after one line for agents without the dev-spec-driven skill (follow AGENTS.md).
 *
 * RESOURCES: the project's spec artifacts under .specs/, with stable specs:// URIs — specs://roadmap, specs://catalog,
 * specs://steering/<file>, specs://feature/<slug>/<artifact>. Read-only and confined to .specs/: an allowlist of
 * artifact names, features resolved through resolveFeature/existingFeature, no '..', no absolute path, no other
 * scheme, and never a symlink out of .specs/. The list is capped (RESOURCE_CAP; the result says so).
 *
 * COMPLETIONS (1.16): completion/complete — a feature-naming prompt argument → the active features' slugs; the specs://
 * templates' {slug} / {artifact} / {file} → the names that exist. Bounded (100 values), every input validated.
 *
 * mcp/server.js maps these results onto JSON-RPC (prompts/*, resources/*, completion/complete); the CLI (`dev-spec prompts`)
 * reuses the prompt half. Every sentence returned comes from i18n.js (msg(lang).promptsResources, msg(lang).claudeCode).
 */

const fs = require("fs");
const path = require("path");
const spec = require("./spec.js");

const PLUGIN_ROOT = path.resolve(__dirname, "..", "..");
const COMMANDS_DIR = path.join(PLUGIN_ROOT, "commands");
const toPosix = (p) => String(p).split(path.sep).join("/");
const RE_BOM = new RegExp("^" + String.fromCharCode(0xfeff)); // a leading BOM (Windows editors) — built, never a literal U+FEFF
const T = (lang) => spec.msg(lang).promptsResources;
// A user-supplied value quoted in a message: one line, bounded.
function clip(v) {
  const s = String(v).replace(/[\u0000-\u001f\u007f]+/g, " ");
  return s.length > 160 ? s.slice(0, 157) + "…" : s;
}
function isFileSafe(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Front matter (commands/*.md) and prompts
// ---------------------------------------------------------------------------

// A `---` front-matter block of `key: value` lines. CRLF and a leading BOM are tolerated; "double-quoted" values are
// read as JSON strings, 'single-quoted' ones with '' as an escaped quote; a `|` / `>` block scalar takes the indented
// lines after it. Anything else in the block is ignored. → { data (null-prototype), body (LF line endings), frontMatter }
function parseFrontMatter(text) {
  const raw = String(text == null ? "" : text).replace(RE_BOM, "");
  const lines = raw.split(/\r?\n/);
  const data = Object.create(null);
  if (!/^---[ \t]*$/.test(lines[0] || "")) return { data, body: lines.join("\n"), frontMatter: false };
  let end = -1;
  for (let i = 1; i < lines.length && i < 200; i++) if (/^---[ \t]*$/.test(lines[i])) { end = i; break; }
  if (end === -1) return { data, body: lines.join("\n"), frontMatter: false };
  for (let i = 1; i < end; i++) {
    // /^([A-Za-z0-9_-]+)[ \t]*:[ \t]*(.*?)[ \t]*$/ with the value read by a scan: the lazy value before [ \t]*$ rescanned a
    // long blank run at each step (1.17 H). Its blanks at either end go; a line terminator in it: no value, as with `.`.
    const m = /^([A-Za-z0-9_-]+)[ \t]*:/.exec(lines[i]);
    const rest = m ? lines[i].slice(m[0].length) : "";
    if (!m || /[\n\r\u2028\u2029]/.test(rest)) continue;
    let a = 0, b = rest.length;
    while (a < b && (rest[a] === " " || rest[a] === "\t")) a++;
    while (b > a && (rest[b - 1] === " " || rest[b - 1] === "\t")) b--;
    let v = rest.slice(a, b);
    if (/^[|>][+-]?$/.test(v)) {
      const block = [];
      while (i + 1 < end && (/^[ \t]/.test(lines[i + 1]) || !lines[i + 1].trim())) block.push(lines[++i].trim());
      v = v[0] === "|" ? block.join("\n").trim() : block.filter(Boolean).join(" ");
    } else if (/^".*"$/.test(v)) {
      try { v = JSON.parse(v); } catch { v = v.slice(1, -1); }
    } else if (/^'.*'$/.test(v)) v = v.slice(1, -1).replace(/''/g, "'");
    data[m[1]] = String(v);
  }
  return { data, body: lines.slice(end + 1).join("\n"), frontMatter: true };
}

// The command files a prompt can name: `<name>.md` straight in commands/ (no path ever built from a caller's input).
const RE_COMMAND_FILE = /^[A-Za-z0-9][A-Za-z0-9_-]*\.md$/;
function commandFiles(dir) {
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }
  // Sorted by prompt name (code units, locale-independent): 'spec' before 'spec-bugfix' — by file name '-' < '.' put it last.
  const stem = (n) => n.slice(0, -3);
  return names.filter((n) => RE_COMMAND_FILE.test(n) && isFileSafe(path.join(dir, n))).sort((a, b) => (stem(a) < stem(b) ? -1 : stem(a) > stem(b) ? 1 : 0));
}
function readCommand(dir, file) {
  let text;
  try {
    text = fs.readFileSync(path.join(dir, file), "utf8");
  } catch {
    return null;
  }
  const fm = parseFrontMatter(text);
  return { name: file.slice(0, -3), description: fm.data.description || "", argumentHint: fm.data["argument-hint"] || "", body: fm.body };
}

// prompts/list: [{ name, description, argumentHint, arguments: [{ name: "args", description, required: false }] }]
// (the server sends name/description/arguments; argumentHint is for the CLI's listing). opts: { lang, commandsDir }.
function listPrompts(opts = {}) {
  const dir = opts.commandsDir || COMMANDS_DIR;
  const L = T(opts.lang);
  return commandFiles(dir).map((f) => readCommand(dir, f)).filter(Boolean).map((c) => ({
    name: c.name,
    description: c.description,
    argumentHint: c.argumentHint,
    arguments: [{ name: "args", description: L.argDesc(c.argumentHint), required: false }],
  }));
}

// prompts/get `arguments`: an object whose values are strings (MCP) — absent / null = none. → { ok, args } (args: the
// `args` value or "").
function promptArgs(value, lang) {
  if (value == null) return { ok: true, args: "" };
  const bad = { ok: false, reason: "invalid", error: T(lang).err.badPromptArgs };
  if (typeof value !== "object" || Array.isArray(value)) return bad;
  if (Object.keys(value).some((k) => value[k] != null && typeof value[k] !== "string")) return bad;
  return { ok: true, args: typeof value.args === "string" ? value.args : "" };
}

// prompts/get: the command body as ONE user message — $ARGUMENTS replaced by `args` (empty when absent),
// ${CLAUDE_PLUGIN_ROOT} by this clone's root (other clients have no such variable), after one line pointing an agent
// without the dev-spec-driven skill at AGENTS.md (and at the skill's references/ folder, which the bodies cite by a
// relative path). → { ok, name, description, messages } | { ok: false, reason, error }.
function getPrompt(name, args, opts = {}) {
  const L = T(opts.lang);
  if (typeof name !== "string" || !name.trim()) return { ok: false, reason: "invalid", error: L.err.noPromptName };
  if (args != null && typeof args !== "string") return { ok: false, reason: "invalid", error: L.err.badPromptArgs };
  const dir = opts.commandsDir || COMMANDS_DIR;
  const files = commandFiles(dir);
  const file = files.find((f) => f.slice(0, -3) === name); // exact name from the listing — never a path join
  const c = file ? readCommand(dir, file) : null;
  if (!c) return { ok: false, reason: "unknown", error: L.err.unknownPrompt(clip(name), files.map((f) => f.slice(0, -3)).join(", ")) };
  const root = toPosix(PLUGIN_ROOT);
  // split/join, not String.replace: a `$&` or `$1` in the arguments is text, not a replacement pattern — and the
  // arguments are inserted last, so a "$ARGUMENTS" or "${CLAUDE_PLUGIN_ROOT}" they contain stays as typed.
  const body = c.body.replace(/^(?:[ \t]*\n)+/, "").trimEnd() // trimEnd: /\s+$/ rescanned a blank run from each unit (1.17 H)
    .split("${CLAUDE_PLUGIN_ROOT}").join(root)
    .split("$ARGUMENTS").join(args == null ? "" : args);
  const text = L.preamble(root + "/AGENTS.md", root + "/skills/dev-spec-driven/references/") + "\n\n" + body + "\n";
  return { ok: true, name: c.name, description: c.description, messages: [{ role: "user", content: { type: "text", text } }] };
}

// ---------------------------------------------------------------------------
// Resources (.specs/ artifacts, specs:// URIs)
// ---------------------------------------------------------------------------

const MIME = "text/markdown";
// The artifacts a feature resource can name (every other file of a feature folder is out of reach).
const RESOURCE_ARTIFACTS = ["classification.md", "requirements.md", "design.md", "test-plan.md", "eval-plan.md", "load-test.md", "tasks.md",
  "bug.md", "quickstart.md", "checklist.md", "integration-plan.md", "retro.md",
  "spike.md", "decisions.md", "change.md"]; // 1.14 C2: a spike's spike.md, a feature's decision log · 1.21 F5: a change's one file
const RESOURCE_CAP = 500; // resources/list returns at most this many (the rest stay readable through the templates)
// A steering file: one .md name straight under .specs/steering/ — no separators, no '..', no Windows device name.
const RE_STEERING_FILE = /^[A-Za-z0-9](?:[A-Za-z0-9_-]|\.(?!\.))*\.md$/;
const RE_WIN_DEVICE = /^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i;
const steeringNameOk = (f) => typeof f === "string" && f.length <= 128 && RE_STEERING_FILE.test(f) && !RE_WIN_DEVICE.test(f);

// "Is this a regular file inside .specs/?" — the leaf is never a symlink (lstat) and its real path stays inside the
// real .specs/ (a symlinked feature folder pointing elsewhere is out). null when there is no .specs/ folder.
function specsGuard(root) {
  let realRoot;
  try {
    if (!fs.statSync(root).isDirectory()) return null;
    realRoot = fs.realpathSync.native(root);
  } catch {
    return null;
  }
  return (file) => {
    try {
      if (!fs.lstatSync(file).isFile()) return false;
      const real = fs.realpathSync.native(file);
      return real !== realRoot && spec.withinRoot(realRoot, real);
    } catch {
      return false;
    }
  };
}
function readText(file) {
  try {
    return fs.readFileSync(file, "utf8").replace(RE_BOM, "");
  } catch {
    return null;
  }
}
function listDir(dir, withTypes) {
  try {
    return fs.readdirSync(dir, withTypes ? { withFileTypes: true } : undefined);
  } catch {
    return [];
  }
}
// Active feature folders (listFeatures' addressability rule; _archive, dot folders and steering/ are not features),
// sorted — with the slug a specs:// URI uses (the folder name, lower-cased for a case-only variant).
function featureFolders(root) {
  return listDir(root, true).filter((d) => d.isDirectory() && spec.isFeatureFolder(d.name, root))
    .map((d) => ({ folder: d.name, slug: spec.slugify(d.name) })).sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
}
function steeringFiles(root, inSpecs) {
  const dir = path.join(root, "steering");
  return listDir(dir).filter((f) => steeringNameOk(f) && inSpecs(path.join(dir, f))).sort();
}

// resources/list → { resources: [{ uri, name, description, mimeType }], total, cap, truncated, note? } — ROADMAP.md
// (else a roadmap rendered from roadmap.json), SPECS.md, the steering files, then each active feature's artifacts.
function listResources(projectDir, opts = {}) {
  const pdir = projectDir || spec.resolveProjectDir();
  const L = T(spec.projectLang(pdir)).res;
  const cap = Number.isSafeInteger(opts.cap) && opts.cap > 0 ? opts.cap : RESOURCE_CAP;
  const root = spec.specsRoot(pdir);
  const inSpecs = specsGuard(root);
  const resources = [];
  let total = 0;
  const add = (uri, name, description) => {
    total++;
    if (resources.length < cap) resources.push({ uri, name, description, mimeType: MIME });
  };
  if (inSpecs) {
    if (inSpecs(path.join(root, "ROADMAP.md"))) add("specs://roadmap", "ROADMAP.md", L.roadmap);
    else if (inSpecs(path.join(root, "roadmap.json"))) add("specs://roadmap", "ROADMAP.md", L.roadmapFromJson);
    if (inSpecs(path.join(root, "SPECS.md"))) add("specs://catalog", "SPECS.md", L.catalog);
    for (const f of steeringFiles(root, inSpecs)) add("specs://steering/" + f, "steering/" + f, L.steering(f));
    // One typed listing per feature folder instead of a probe per artifact: the folder is a real directory (never a
    // symlink — featureFolders) and a Dirent isFile() is a regular file, never a symlink — so what is listed is exactly
    // what readResource's guard lets through, at one readdir per feature.
    for (const { folder, slug } of featureFolders(root)) {
      const files = new Set(listDir(path.join(root, folder), true).filter((d) => d.isFile()).map((d) => d.name));
      for (const a of RESOURCE_ARTIFACTS) {
        if (files.has(a)) add(`specs://feature/${slug}/${a}`, `${slug}/${a}`, L.artifact(slug, L.labels[a], a));
      }
    }
  }
  const res = { resources, total, cap, truncated: total > resources.length };
  if (res.truncated) res.note = L.truncated(cap, total);
  return res;
}

// resources/templates/list
function resourceTemplates(projectDir) {
  const L = T(spec.projectLang(projectDir || spec.resolveProjectDir())).res;
  return [
    { uriTemplate: "specs://feature/{slug}/{artifact}", name: "feature-artifact", description: L.tplFeature(RESOURCE_ARTIFACTS.join(", ")), mimeType: MIME },
    { uriTemplate: "specs://steering/{file}", name: "steering-file", description: L.tplSteering, mimeType: MIME },
  ];
}

// specs://roadmap · specs://catalog · specs://steering/<file> · specs://feature/<slug>/<artifact> → { ok, kind, … }.
// Parsed by hand, segment by segment: a URL parser would resolve 'feature/../x' to 'x' instead of refusing it. Each
// segment is percent-decoded, then refused when empty, '.' / '..', or holding a separator, a ':' (a drive), or a control
// character — so '%2e%2e' and '%2F' can't sneak one in. No query or fragment.
function parseResourceUri(uri) {
  const m = /^specs:\/\/([^?#]*)$/i.exec(String(uri));
  if (!m) return { ok: false };
  const segs = [];
  for (const s of m[1].split("/")) {
    let d;
    try {
      d = decodeURIComponent(s);
    } catch {
      return { ok: false };
    }
    if (!d || d === "." || d === ".." || /[\\/:\u0000-\u001f\u007f]/.test(d)) return { ok: false };
    segs.push(d);
  }
  const head = segs[0].toLowerCase();
  if (segs.length === 1 && (head === "roadmap" || head === "catalog")) return { ok: true, kind: head };
  if (segs.length === 2 && head === "steering") return { ok: true, kind: "steering", file: segs[1] };
  if (segs.length === 3 && head === "feature") return { ok: true, kind: "feature", feature: segs[1], artifact: segs[2] };
  return { ok: false };
}

// resources/read → { ok: true, contents: [{ uri, mimeType, text }] } | { ok: false, reason: "invalid" | "not-found", error }
// (the server answers -32602 for an invalid URI, -32002 for a resource that isn't there).
function readResource(projectDir, uri) {
  const pdir = projectDir || spec.resolveProjectDir();
  const E = T(spec.projectLang(pdir)).err;
  if (typeof uri !== "string" || !uri) return { ok: false, reason: "invalid", error: E.noUri };
  const shown = clip(uri);
  const invalid = (error) => ({ ok: false, reason: "invalid", error });
  const missing = (detail) => ({ ok: false, reason: "not-found", error: E.notFound(shown, detail) });
  const p = parseResourceUri(uri);
  if (!p.ok) return invalid(E.badUri(shown));
  const root = spec.specsRoot(pdir);
  const inSpecs = specsGuard(root);
  const found = (text) => (text == null ? missing() : { ok: true, contents: [{ uri, mimeType: MIME, text }] });
  const file = (f) => (inSpecs && inSpecs(f) ? found(readText(f)) : missing());
  switch (p.kind) {
    case "roadmap": {
      const md = path.join(root, "ROADMAP.md");
      if (inSpecs && inSpecs(md)) return found(readText(md));
      if (!inSpecs || !inSpecs(path.join(root, "roadmap.json"))) return missing();
      const meta = spec.readRoadmap(pdir).meta || {}; // rendered in memory, never written (spec_roadmap {write} does that)
      return found(spec.renderRoadmapMd(pdir, meta.roadmapLang || meta.lang));
    }
    case "catalog":
      return file(path.join(root, "SPECS.md"));
    case "steering": {
      if (!steeringNameOk(p.file)) return invalid(E.badSteering(clip(p.file)));
      const dir = path.join(root, "steering");
      // The exact name from the listing: on a case-insensitive disk 'TECH.md' must not alias tech.md under another URI.
      return listDir(dir).includes(p.file) ? file(path.join(dir, p.file)) : missing();
    }
    case "feature": {
      if (!RESOURCE_ARTIFACTS.includes(p.artifact)) return invalid(E.unknownArtifact(clip(p.artifact), RESOURCE_ARTIFACTS.join(", ")));
      const r = spec.resolveFeature(pdir, p.feature); // no usable slug, 'steering', a Windows device name → invalid
      if (!r.ok) return invalid(r.error);
      const f = spec.existingFeature(pdir, p.feature); // not there (an archived one says so) → not found
      if (!f.ok) return missing(f.error);
      if (!spec.isFeatureFolder(path.basename(f.dir), root)) return missing();
      return file(path.join(f.dir, p.artifact));
    }
    default:
      return invalid(E.badUri(shown));
  }
}

// ---------------------------------------------------------------------------
// Completions (completion/complete, 1.16 C3)
// ---------------------------------------------------------------------------

const COMPLETION_MAX = 100; // values per answer (MCP: at most 100); `total` / `hasMore` say what was left out
const COMPLETION_VALUE_MAX = 200; // characters of the typed value matched (a longer one matches nothing)
// The variables of each resource template (resourceTemplates) — the only ref/resource URIs completed.
const TEMPLATE_VARS = { "specs://feature/{slug}/{artifact}": ["slug", "artifact"], "specs://steering/{file}": ["file"] };
// A prompt whose argument starts with a feature's name ("[feature name]", "[feature] …", "[feature name | …]") — never a new
// feature's idea or description.
const RE_FEATURE_ARG = /^\s*\[feature(?:\s+name)?(?=[\]\s|])(?!\s+(?:idea|description)\b)/i;
// Ranked matches: the values starting with what was typed, then those containing it (case-insensitive), capped.
function completionMatches(list, typed) {
  const v = String(typed).toLowerCase();
  if (v.length > COMPLETION_VALUE_MAX) return { values: [], total: 0, hasMore: false };
  const pre = [], sub = [];
  for (const x of [...new Set(list)]) {
    const l = x.toLowerCase();
    if (l.startsWith(v)) pre.push(x);
    else if (v && l.includes(v)) sub.push(x);
  }
  const all = pre.concat(sub);
  return { values: all.slice(0, COMPLETION_MAX), total: all.length, hasMore: all.length > COMPLETION_MAX };
}
// completion/complete → { ok: true, completion: { values, total, hasMore } } | { ok: false, error } (the server answers -32602).
//   ref/prompt   — a prompt (commands/*.md) whose argument names a feature: its `args` value completes to the active features'
//                  slugs while it is one word (a second word is not a feature: no values); any other prompt: no values;
//   ref/resource — the templates: {slug} → the active features, {artifact} → the allowlisted artifacts of context.arguments.slug
//                  (those it has; every allowlisted name without a usable slug), {file} → the steering files.
// Every input is validated; an unknown prompt, template or argument name is an error. opts: { lang, prompts (false: the
// server serves no prompts), commandsDir }.
function complete(projectDir, params, opts = {}) {
  const pdir = projectDir || spec.resolveProjectDir();
  const lang = opts.lang || spec.projectLang(pdir);
  const E = T(lang).err;
  const C = spec.msg(lang).claudeCode.completion;
  const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  const p = isObj(params) ? params : {};
  const ref = isObj(p.ref) ? p.ref : null;
  const arg = isObj(p.argument) ? p.argument : null;
  if (!ref || typeof ref.type !== "string" || !arg || typeof arg.name !== "string" || (arg.value != null && typeof arg.value !== "string")) {
    return { ok: false, error: C.badRequest };
  }
  const value = typeof arg.value === "string" ? arg.value : "";
  const ctx = isObj(p.context) && isObj(p.context.arguments) ? p.context.arguments : {};
  const ok = (list) => ({ ok: true, completion: completionMatches(list, value) });
  const root = spec.specsRoot(pdir);
  const slugs = () => featureFolders(root).map((f) => f.slug);
  if (ref.type === "ref/prompt") {
    if (opts.prompts === false) return { ok: false, error: C.promptsOff };
    const prompts = listPrompts({ lang, commandsDir: opts.commandsDir });
    const pr = typeof ref.name === "string" ? prompts.find((x) => x.name === ref.name) : null;
    if (!pr) return { ok: false, error: E.unknownPrompt(clip(ref.name == null ? "" : ref.name), prompts.map((x) => x.name).join(", ")) };
    if (arg.name !== "args") return { ok: false, error: C.unknownArgument(clip(arg.name), "args") };
    return ok(RE_FEATURE_ARG.test(pr.argumentHint) && !/\s/.test(value) ? slugs() : []);
  }
  if (ref.type === "ref/resource") {
    const vars = typeof ref.uri === "string" && Object.prototype.hasOwnProperty.call(TEMPLATE_VARS, ref.uri) ? TEMPLATE_VARS[ref.uri] : null;
    if (!vars) return { ok: false, error: C.unknownTemplate(clip(ref.uri == null ? "" : ref.uri), Object.keys(TEMPLATE_VARS).join(", ")) };
    if (!vars.includes(arg.name)) return { ok: false, error: C.unknownArgument(clip(arg.name), vars.join(", ")) };
    if (arg.name === "slug") return ok(slugs());
    if (arg.name === "file") { const inSpecs = specsGuard(root); return ok(inSpecs ? steeringFiles(root, inSpecs) : []); }
    // {artifact}: the ones the named feature has (a listing of its folder), else every allowlisted name.
    const f = typeof ctx.slug === "string" ? featureFolders(root).find((x) => x.slug === ctx.slug) : null;
    if (!f) return ok(RESOURCE_ARTIFACTS);
    const files = new Set(listDir(path.join(root, f.folder), true).filter((d) => d.isFile()).map((d) => d.name));
    return ok(RESOURCE_ARTIFACTS.filter((a) => files.has(a)));
  }
  return { ok: false, error: C.badRequest };
}

module.exports = {
  PLUGIN_ROOT,
  COMMANDS_DIR,
  RESOURCE_ARTIFACTS,
  RESOURCE_CAP,
  COMPLETION_MAX,
  parseFrontMatter,
  listPrompts,
  promptArgs,
  getPrompt,
  listResources,
  resourceTemplates,
  parseResourceUri,
  readResource,
  complete,
};
