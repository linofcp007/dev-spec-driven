"use strict";

/**
 * dev-spec-driven engine — spec_import kiro-steering · cursor-rules (1.25).
 * Another tool's steering becomes dev-spec steering: Kiro's `.kiro/steering/*.md` (its front matter IS dev-spec's — kept) and
 * Cursor's project rules (`.cursor/rules/*.mdc`, the legacy `.cursorrules`) with their front matter mapped onto it. Each file →
 * `.specs/steering/<name>.md`, create-only: an existing steering file is never overwritten (skipped, reported).
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const i18n = require("../../i18n.js");
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let artifactState, customSteeringError, existsRaw, flatText, frontMatterScalar, frontMatterValues, headRest, IMPORT_MAX_BYTES,
  IMPORT_TOOLS, importSourceAt, isSteeringStub, linkedSpecsFolder, parseTracks, readIfExists, slugify, specsRoot, steeringFrontMatter,
  stripHtmlComments, toPosix, writeIfAbsent;
function __link(E) { ({ artifactState, customSteeringError, existsRaw, flatText, frontMatterScalar, frontMatterValues, headRest,
  IMPORT_MAX_BYTES, IMPORT_TOOLS, importSourceAt, isSteeringStub, linkedSpecsFolder, parseTracks, readIfExists, slugify, specsRoot,
  steeringFrontMatter, stripHtmlComments, toPosix, writeIfAbsent } = E); }

// The steering sources spec_import takes (its `tool` enum) and, without a path, where each looks in the project (those that exist).
const STEERING_IMPORT_TOOLS = ["kiro-steering", "cursor-rules"];
const STEERING_IMPORT_DEFAULTS = { "kiro-steering": [".kiro/steering"], "cursor-rules": [".cursor/rules", ".cursorrules"] };
// The files one import writes (the rest: one warning with their count) and the characters they hold together (a file that would
// pass it is skipped, too-large — like every import, the source is read whole or not at all).
const STEERING_IMPORT_MAX_FILES = 100;
const STEERING_IMPORT_MAX_CHARS = 2 * 1024 * 1024;
// A folder's steering files: Kiro's are markdown; Cursor's rules are .mdc (newer Cursor reads .md there too).
const STEERING_SOURCE_EXT = { "kiro-steering": [".md"], "cursor-rules": [".mdc", ".md"] };

// A rule file's front matter, read leniently — Cursor writes `globs: *.ts, src/**` (no valid YAML), Kiro `fileMatchPattern: [...]`:
// the top-level `key: value` lines, the `- item` lines under a key with no value, and a block scalar (`description: |` / `>`)
// folded to one line. Detected as steeringFrontMatter detects it (a `---` first line, its closing `---` / `...` within 100 lines).
// → { frontMatter, keys: Map(lower-cased key → string | string[]), body (the text after it, its leading blank lines dropped) }.
function ruleFrontMatter(text) {
  const lines = String(text).split("\n");
  const none = { frontMatter: false, keys: new Map(), body: String(text) };
  if (!/^---[ \t]*$/.test(lines[0] || "")) return none;
  let end = -1;
  for (let i = 1; i < lines.length && i < 100; i++) if (/^(?:---|\.\.\.)[ \t]*$/.test(lines[i])) { end = i; break; }
  if (end === -1) return none;
  const keys = new Map();
  let key = null, block = null; // the key whose value is still open: a list (block null) or a block scalar (block = its lines)
  for (const line of lines.slice(1, end)) {
    if (/^\s*(?:#|$)/.test(line)) { if (block) block.push(""); continue; }
    const indented = /^\s/.test(line);
    if (key && block && indented) { block.push(line.trim()); continue; }
    const item = key && !block && headRest(line, /^\s*-/, true); // /^\s*-\s+(.*)$/
    if (item) { keys.set(key, (Array.isArray(keys.get(key)) ? keys.get(key) : []).concat(frontMatterValues(item[1]))); continue; }
    if (block) keys.set(key, flatText(block.join(" ")));
    key = null; block = null;
    if (indented) continue; // a nested map's line: not a key of ours
    const kv = headRest(line, /^([A-Za-z_][\w-]*)\s*:/, false); // /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/
    if (!kv) continue;
    const k = kv[1].toLowerCase();
    const v = kv[2].trim();
    if (!v) { key = k; keys.set(k, []); }
    else if (/^[|>][+-]?\d*$/.test(v)) { key = k; block = []; }
    else keys.set(k, /^\[.*\]$/.test(v) ? frontMatterValues(v) : frontMatterScalar(v));
  }
  if (block) keys.set(key, flatText(block.join(" ")));
  return { frontMatter: true, keys, body: lines.slice(end + 1).join("\n").replace(/^(?:[ \t]*\n)+/, "") };
}

// A Cursor rule's globs → fileMatchPattern items: a list, or one string of comma-separated globs (a comma inside {braces} doesn't
// split). A glob naming no folder (`*.tsx`) matches at any depth in Cursor — `**/*.tsx` here (steeringGlobMatch's `*` stays in one
// folder); a leading `./` or `/` is dropped.
function cursorGlobs(v) {
  const raw = Array.isArray(v) ? v.flatMap((x) => frontMatterValues("[" + x + "]")) : v ? frontMatterValues("[" + v + "]") : [];
  return [...new Set(raw.map((g) => g.trim().replace(/^(?:\.\/|\/)+/, "")).filter(Boolean).map((g) => (g.includes("/") ? g : "**/" + g)))];
}
// A front-matter value written back: double quotes (a backslash and a quote escaped — YAML readers unescape them; dev-spec reads
// only inclusion / fileMatchPattern, never this way).
const yamlQuoted = (s) => '"' + String(s).split("\\").join("\\\\").split('"').join('\\"') + '"';
// A glob written back, as steeringFrontMatter reads it back (quotedValue unescapes nothing): in the quotes it does not hold —
// null when it holds both kinds.
const globQuoted = (g) => (!g.includes('"') ? '"' + g + '"' : !g.includes("'") ? "'" + g + "'" : null);

// The file name a source becomes: its stem as a steering name (a-z, 0-9, '-'; accents folded) — null when nothing usable is left
// or it is a name steering refuses (a Windows device name, a prototype key).
function steeringTargetName(stem, lng) {
  const s = slugify(stem).slice(0, 63).replace(/-+$/, "");
  const name = s ? s + ".md" : null;
  return name && !customSteeringError(name, lng) ? name : null;
}

// spec_import {tool: "kiro-steering" | "cursor-rules", path?} → { ok, kind: "steering", tool, toolName, sources, dir, lang,
// imported: [{ file, from, inclusion, patterns? }], skipped: [{ file, from, reason, template? }], warnings }. `path`: a folder or
// one file inside the project (importSourceAt's rule); none → the tool's conventional places that exist. `name` / `tracks` belong
// to a feature import — refused. Never overwrites: an existing .specs/steering/<name>.md is skipped (reason "exists"; template:
// true when it is still spec_init's stub), as is a name two sources of this import share ("duplicate"), a file with no usable
// name ("name"), dev-spec's own Cursor rule ("own"), no content ("empty"), too large ("too-large"), pointing outside the project
// ("outside") or not a readable file ("unreadable"). Each skip is also a localized warning.
function importSteering(projectDir, t, source, opts, lang0) {
  const W = i18n.msg(lang0).importSpec;
  const L = i18n.msg(lang0).importSteering;
  const pt = parseTracks(opts.tracks);
  const named = opts.name != null && String(opts.name).trim();
  if (named || pt.given) return { ok: false, error: L.featureArgs([named ? "name" : null, pt.given ? "tracks" : null].filter(Boolean).join(", "), IMPORT_TOOLS[t]) };
  const given = source != null && String(source).trim();
  const places = given ? [String(source).trim()] : STEERING_IMPORT_DEFAULTS[t].filter((p) => fs.existsSync(path.join(path.resolve(projectDir), p)));
  if (!places.length) return { ok: false, error: L.nothing(IMPORT_TOOLS[t], STEERING_IMPORT_DEFAULTS[t].join(", ")) };
  const steeringDir = path.join(specsRoot(projectDir), "steering");
  const linked = linkedSpecsFolder(projectDir, [path.join(steeringDir, "steering.md")]); // never through a linked steering/ (as steering_scaffold)
  if (linked) return { ok: false, linked: true, error: i18n.msg(lang0).err.specsLinked(linked) };
  // Every source first (a refusal writes nothing): its files, in name order — a folder's of the tool's kinds; a file named as itself.
  const candidates = [];
  const warnings = [];
  const sources = [];
  const reads = [];
  for (const place of places) {
    const at = importSourceAt(projectDir, t, place, W, lang0);
    if (at.refused) return at.refused;
    reads.push(at);
    const rel = toPosix(path.relative(at.realRoot, at.realSrc)) || ".";
    sources.push(rel);
    if (at.isFileSrc) { candidates.push({ at, file: at.realSrc, from: rel }); continue; }
    let entries = [];
    try { entries = fs.readdirSync(at.realSrc, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)); } catch { /* unreadable: nothing */ }
    const others = [];
    for (const e of entries) {
      const relE = rel === "." ? e.name : rel + "/" + e.name;
      if (e.isDirectory()) { others.push(relE + "/"); continue; }
      if (STEERING_SOURCE_EXT[t].includes(path.extname(e.name).toLowerCase())) candidates.push({ at, file: path.join(at.realSrc, e.name), from: relE });
      else others.push(relE);
    }
    if (others.length) warnings.push(L.wOthers(others.join(", ")));
  }
  if (!candidates.length) return { ok: false, error: L.nothing(IMPORT_TOOLS[t], sources.join(", ")) };
  const imported = [];
  const skipped = [];
  const taken = new Set(); // the names this import gave a file
  const date = new Date().toISOString().slice(0, 10);
  let total = 0;
  const skip = (c, file, reason, detail, template) => {
    skipped.push({ file, from: c.from, reason, ...(template ? { template: true } : {}) });
    warnings.push(L.skipped(c.from, template ? L.reasons.template(file) : L.reasons[reason](file, detail)));
  };
  for (const c of candidates.slice(0, STEERING_IMPORT_MAX_FILES)) {
    const base = path.basename(c.file);
    const legacy = t === "cursor-rules" && base.toLowerCase() === ".cursorrules";
    const file = steeringTargetName(legacy ? "cursorrules" : base.replace(/\.[^.]*$/, ""), lang0);
    if (!file) { skip(c, null, "name"); continue; }
    // dev-spec's own Cursor rule (`dev-spec rules cursor` writes .cursor/rules/dev-spec-driven.mdc): the workflow, not the project's steering
    if (t === "cursor-rules" && /^dev-spec-driven\.mdc?$/i.test(base)) { skip(c, file, "own"); continue; }
    if (taken.has(file)) { skip(c, file, "duplicate"); continue; }
    const big0 = c.at.tooLarge.size, warn0 = c.at.readWarnings.length;
    const raw = c.at.read(c.file);
    if (c.at.tooLarge.size > big0) { skip(c, file, "too-large", IMPORT_MAX_BYTES); continue; }
    if (raw == null) { skip(c, file, c.at.readWarnings.length > warn0 ? "outside" : "unreadable"); continue; }
    const conv = steeringText(t, raw.replace(/\r\n?/g, "\n"), legacy, L, c.from, date, (w) => warnings.push(w));
    if (!conv) { skip(c, file, "empty"); continue; }
    if (total + conv.length > STEERING_IMPORT_MAX_CHARS) { skip(c, file, "too-large", STEERING_IMPORT_MAX_CHARS); continue; }
    const target = path.join(steeringDir, file);
    if (existsRaw(target) || !writeIfAbsent(target, conv)) { // create-only: never over a file — not even spec_init's untouched stub,
      // which the skip names (template: true) so the user can delete it and import again (Kiro's product / tech / structure.md are
      // the very names init scaffolds)
      const held = readIfExists(target);
      const stub = held != null && (isSteeringStub(file, steeringFrontMatter(held).body) || artifactState({ text: steeringFrontMatter(held).body }) === "placeholder");
      skip(c, file, "exists", null, stub);
      continue;
    }
    taken.add(file);
    total += conv.length;
    const fm = steeringFrontMatter(conv); // how dev-spec reads it back — the brief, the governance
    imported.push({ file, from: c.from, inclusion: fm.inclusion, ...(fm.patterns.length ? { patterns: fm.patterns } : {}) });
  }
  if (candidates.length > STEERING_IMPORT_MAX_FILES) warnings.push(L.wLimit(candidates.length - STEERING_IMPORT_MAX_FILES, STEERING_IMPORT_MAX_FILES));
  return { ok: true, kind: "steering", tool: t, toolName: IMPORT_TOOLS[t], sources, dir: steeringDir, lang: lang0, imported, skipped, warnings };
}

// One source file's text → the steering file's (null: nothing in it). The provenance note is an HTML comment first in the body:
// the brief never quotes a comment, and the front matter must stay the file's first line.
function steeringText(t, text, legacy, L, from, date, warn) {
  const note = L.note(IMPORT_TOOLS[t], from.split("-->").join("--&gt;"), date);
  const filled = (body) => !!stripHtmlComments(body).trim();
  if (t === "kiro-steering") {
    // Kiro's front matter IS dev-spec's: kept as written — whether the file has one is decided as dev-spec reads it
    // (steeringFrontMatter). None → Kiro's default mode, always (dev-spec would leave such a file out of every brief but
    // constitution / tech / structure). A mode dev-spec doesn't have (Kiro's `auto`) reads as manual — said.
    const sf = steeringFrontMatter(text);
    if (!filled(sf.body)) return null;
    if (!sf.frontMatter) return "---\ninclusion: always\n---\n\n" + note + "\n\n" + text.trim() + "\n";
    const mode = ruleFrontMatter(text).keys.get("inclusion");
    if (typeof mode === "string" && !/^(?:always|filematch|manual)$/i.test(mode)) warn(L.wMode(from, mode));
    const head = text.split("\n");
    const end = head.findIndex((l, i) => i > 0 && /^(?:---|\.\.\.)[ \t]*$/.test(l)); // steeringFrontMatter's closing line
    return head.slice(0, end + 1).join("\n") + "\n\n" + note + "\n\n" + sf.body.trimEnd() + "\n"; // trimEnd: /\s+$/ is quadratic
  }
  // Cursor: alwaysApply: true → always; globs → fileMatch on them; else (a description only, or nothing) → manual — Cursor's
  // "agent requested" / "manual" rules, listed in a brief as available. The description is kept in the front matter. The legacy
  // .cursorrules is plain text, always applied.
  const fmr = legacy ? { frontMatter: false, keys: new Map(), body: text } : ruleFrontMatter(text);
  const body = fmr.body.trimEnd();
  if (!filled(body)) return null;
  const k = fmr.keys;
  const always = String(k.get("alwaysapply") == null ? "" : k.get("alwaysapply")).toLowerCase() === "true";
  const globs = cursorGlobs(k.get("globs"));
  const quoted = globs.map(globQuoted);
  if (quoted.some((q) => q == null)) warn(L.wGlobs(from, globs.filter((g, i) => quoted[i] == null).join(", ")));
  const pats = quoted.filter(Boolean);
  const desc = typeof k.get("description") === "string" ? flatText(k.get("description")) : "";
  const lines = ["---", "inclusion: " + (legacy || always ? "always" : pats.length ? "fileMatch" : "manual")];
  if (!legacy && !always && pats.length) lines.push("fileMatchPattern: " + (pats.length === 1 ? pats[0] : "[" + pats.join(", ") + "]"));
  if (desc) lines.push("description: " + yamlQuoted(desc));
  lines.push("---");
  return lines.join("\n") + "\n\n" + note + "\n\n" + body + "\n";
}

module.exports = { STEERING_IMPORT_TOOLS, STEERING_IMPORT_DEFAULTS, STEERING_IMPORT_MAX_FILES, STEERING_IMPORT_MAX_CHARS,
  STEERING_SOURCE_EXT, ruleFrontMatter, cursorGlobs, yamlQuoted, globQuoted, steeringTargetName, importSteering, steeringText,
  __link };
