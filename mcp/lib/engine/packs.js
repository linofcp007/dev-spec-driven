"use strict";

/**
 * dev-spec-driven engine — project-defined track packs (.specs/tracks/<name>/, 1.15).
 * Load and validate a pack (cached per call and across calls), the pack registry the track accessors read (tracks.js), the
 * missing and legacy packs (ghost markers, reserved names / markers), render a pack's blocks (design sections, criteria, task
 * block, test rows, checklist items, steering stub), its placeholder corpus; spec_tracks. Guide: references/project-tracks.md.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const i18n = require("../i18n.js");
const { CTX } = require("./ctx.js"); // the shared per-call state (mutated in place)
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let acIndex, allTracks, commentLines, earsValidate, existsCached, extractAcIds, extractTestIds, headingIndex,
  isInsideDir, isObj, MARKER_TRACKS, normalizeLang, parseTasks, planIdText, projectLang, PROTO_KEYS, RE_CUSTOM_STEERING,
  RE_HEADING_LEAD, RE_TEMPLATE_VAR, RE_WIN_RESERVED, readCacheKey, readDirCached, readIfExists, readJson,
  requirementAcIds, signalOverrides, specsRoot, statePath, stripFencedCode, stripHtmlComments, taskDescription, templateBracketKeys,
  templateLangChain, testIndex, TRACK_ALIASES, TRACK_MARKER, TRACK_SECTIONS, TRACK_STEERING, trackAcIds, trackMarker,
  trackTaskHeading, VALID_TRACKS, writeIfAbsent;
function __link(E) { ({ acIndex, allTracks, commentLines, earsValidate, existsCached, extractAcIds, extractTestIds,
  headingIndex, isInsideDir, isObj, MARKER_TRACKS, normalizeLang, parseTasks, planIdText, projectLang, PROTO_KEYS,
  RE_CUSTOM_STEERING, RE_HEADING_LEAD, RE_TEMPLATE_VAR, RE_WIN_RESERVED, readCacheKey, readDirCached, readIfExists,
  readJson, requirementAcIds, signalOverrides, specsRoot, statePath, stripFencedCode, stripHtmlComments, taskDescription,
  templateBracketKeys, templateLangChain, testIndex, TRACK_ALIASES, TRACK_MARKER, TRACK_SECTIONS, TRACK_STEERING,
  trackAcIds, trackMarker, trackTaskHeading, VALID_TRACKS, writeIfAbsent } = E); }

// ---------------------------------------------------------------------------
// Project-defined tracks (1.15) — track packs in .specs/tracks/<name>/
// ---------------------------------------------------------------------------
// Six tracks are built in; a project adds its own domain rigor (+a11y, +mobile, +dbmigration…) as a folder:
// .specs/tracks/<name>/track.json (JSON — `//` and `/* */` comments allowed) + optional markdown fragments: requirements.md
// (criteria), tasks.md (task lines), test-plan.md (rows), checklist.md (items), steering.md (the steering stub); a <lang>/
// subfolder's fragment wins over the pack root's (pt-BR → pt → root, as the project templates). A VALID pack is a MARKER track
// like [SaaS] / [SEC]: every registry reader goes through allTracks / optionalTracks / markerTracks / trackMarker /
// trackSectionTable / trackSteeringFiles / trackSignalTable, which add the packs of the project the current engine call works in
// (TEMPLATE_SCOPE_ROOT, set by specsRoot()) to the built-in tables — loaded lazily, memoized per call (PACK_MEMO), dropped when the
// engine writes under .specs/tracks/ (forgetCached). A pack is DATA only: nothing in it runs, its keywords reach the classifier
// through keywordRe (escaped: a literal, linear), its name and marker are validated to a closed alphabet before any regex sees
// them, and only allowlisted file names are read from its own folder (lstat + realpath: a link out of .specs/ is ignored). A bad
// pack is reported (spec_tracks check, doctor's track-pack-missing) and IGNORED as a whole — never half-applied.
const TRACK_PACKS_DIR = "tracks";
const PACK_JSON = "track.json";
const PACK_FRAGMENTS = Object.freeze(["requirements.md", "tasks.md", "test-plan.md", "checklist.md", "steering.md"]);
const PACK_LIMITS = Object.freeze({ packs: 20, jsonBytes: 32 * 1024, fragmentBytes: 32 * 1024, sections: 20, syn: 20, keywords: 50,
  keywordLen: 60, textLen: 80, descriptionLen: 300, guidanceLen: 600, items: 20 });
const RE_PACK_NAME = /^[a-z][a-z0-9]{1,19}$/;
const RE_PACK_MARKER = /^[A-Z][A-Z0-9]{1,11}$/;
// Bracket words the engine already reads — the built-in markers, the story / parallel tags ([US1] [P1] [shared]), the generic
// slots ([TODO] [TBD] [FIXME]…) and ID prefixes — are never a pack marker.
const RE_PACK_MARKER_RESERVED = /^(?:SAAS|AI|SEC|PRIVACY|DIST|API|UI|OBS|DATA|TDD|CORE|SHARED|US\d*|P\d|TODO|TBD|TBC|FIXME|NEEDS|NOTE|WIP|AC\d*|SC\d*|EC\d*|NFR\d*|T\d+)$/;
// A classifier keyword: letters / digits with inner spaces, hyphens, apostrophes and dots, 2–60 characters (a bounded class — linear).
const RE_PACK_KEYWORD = /^[\p{L}\p{N}][\p{L}\p{N}' .’-]{0,58}[\p{L}\p{N}]$/u;
const PACK_KEYS = new Set(["name", "marker", "title", "description", "signals", "sections", "steering", "$schema"]);
const PACK_SECTION_KEYS = new Set(["name", "syn", "loose", "guidance"]);
const PACK_TIERS = ["strong", "weak", "context"];
// Names a pack can't take: the built-in tracks, the words people type for them (suggestTrack's aliases), the tool's own words,
// Windows device names (the name IS a folder) and Object.prototype keys.
const PACK_RESERVED_WORDS = new Set(["none", "all", "any", "track", "tracks", "pack", "packs", "list", "init", "check"]);
function packReservedName(n) {
  return VALID_TRACKS.includes(n) || Object.prototype.hasOwnProperty.call(TRACK_ALIASES, n) || PACK_RESERVED_WORDS.has(n) || RE_WIN_RESERVED.test(n) || PROTO_KEYS.has(n);
}
const RE_PACK_ITEM = /^ ?(?:[-*+]|\d{1,3}[.)])[ \t]+(?=\S)/; // a top-level list item's lead (linear: one anchored start)
const RE_TABLE_SEPARATOR = /^\|[\s:|-]+\|?$/;

// A one-line display text (a title, a section name or synonym): 2–max characters, no control character, no bracket, angle bracket
// or backtick — it lands in a markdown heading, where a [bracket] would read as a slot and "<!--" would open a comment.
function packTextOk(s, max) {
  if (typeof s !== "string") return false;
  const t = s.trim();
  return t.length >= 2 && t.length <= max && !/[\u0000-\u001f\u007f[\]<>`]/.test(t);
}
// A section's guidance (the line under its > **TODO**): one line, no comment delimiters, never a heading or a fence.
function packGuidanceOk(s) {
  if (typeof s !== "string") return false;
  const t = s.trim();
  return t.length >= 1 && t.length <= PACK_LIMITS.guidanceLen && !/[\u0000-\u001f\u007f]/.test(t) && !/<!--|-->/.test(t) && !/^(?:#|```|~~~)/.test(t);
}
// JSON with `//` line and `/* */` block comments (the commented example `init` writes) → the JSON text with every comment blanked
// (line breaks kept, so JSON.parse positions still point at the right line), or null for a block comment that never closes. One
// linear pass; a "//" inside a string is text.
function stripJsonComments(text) {
  let out = "", i = 0, from = 0, inStr = false;
  const n = text.length;
  while (i < n) {
    const c = text.charCodeAt(i);
    if (inStr) {
      if (c === 92) i += 2; // a backslash escapes the next character
      else { if (c === 34) inStr = false; i++; }
      continue;
    }
    if (c === 34) { inStr = true; i++; continue; }
    if (c === 47 && text.charCodeAt(i + 1) === 47) {
      out += text.slice(from, i);
      const j = text.indexOf("\n", i);
      i = from = j === -1 ? n : j;
      continue;
    }
    if (c === 47 && text.charCodeAt(i + 1) === 42) {
      out += text.slice(from, i);
      const end = text.indexOf("*/", i + 2);
      if (end === -1) return null;
      out += text.slice(i, end + 2).replace(/[^\n]/g, " ");
      i = from = end + 2;
      continue;
    }
    i++;
  }
  return out + text.slice(from);
}
// A pack folder's entries as the loader reads them — the pack root and each <lang>/ folder — WITHOUT their content: { items, sig }.
// items: { frel, abs, name, lang, state: "file" (+ size) | "linked" (a link, or a folder where a file belongs) | "unknown" }. Every
// allowlisted file is lstat'ed: a regular file, never a link. Its folder chain is already checked (.specs/tracks/ is no link, the pack
// folder's real path is inside .specs/, a <lang>/ folder is no link), so a regular file's real path stays inside too — no per-file
// realpath (F4 review R9: it was the loader's biggest cost). sig: every entry with size / mtime / ctime / inode — the key of the
// cross-call pack cache (PACK_CACHE): an edit changes it and is picked up by the next call.
function packScan(dir, rel) {
  const items = [], sig = [];
  const visit = (absDir, relDir, langKey) => {
    for (const e of readDirCached(absDir) || []) {
      if (e.name.startsWith(".")) continue;
      const frel = relDir + e.name, abs = path.join(absDir, e.name);
      if (langKey === "" && i18n.LANGS.includes(e.name)) {
        if (e.isSymbolicLink() || !e.isDirectory()) { items.push({ frel, name: e.name, lang: langKey, state: "linked" }); sig.push(frel + "|L"); continue; }
        sig.push(frel + "/");
        visit(abs, frel + "/", e.name);
        continue;
      }
      if (!((langKey === "" && e.name === PACK_JSON) || PACK_FRAGMENTS.includes(e.name))) {
        items.push({ frel: frel + (e.isDirectory() ? "/" : ""), name: e.name, lang: langKey, state: "unknown" });
        sig.push(frel + "|U");
        continue;
      }
      let st = null;
      try { st = fs.lstatSync(abs); } catch { /* vanished meanwhile */ }
      if (!st) continue;
      if (st.isSymbolicLink() || !st.isFile()) { items.push({ frel, name: e.name, lang: langKey, state: "linked" }); sig.push(frel + "|L"); continue; }
      items.push({ frel, abs, name: e.name, lang: langKey, state: "file", size: st.size });
      sig.push(frel + "|" + st.size + "|" + st.mtimeMs + "|" + st.ctimeMs + "|" + st.ino);
    }
  };
  visit(dir, rel, "");
  return { items, sig: sig.join("\n") };
}
// One scanned file's text — at most `max` bytes (the size comes from lstat, before any read), BOM-stripped with LF line ends.
// → { text } | { missing } | { tooBig }.
function readPackItem(it, max) {
  if (it.size > max) return { tooBig: true };
  const raw = readIfExists(it.abs);
  if (raw == null) return { missing: true };
  const t = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  return { text: t.replace(/\r\n?/g, "\n") };
}
// The top-level list items of a fragment (`- x`, `* x`, `1. x`, `- [ ] x` — at most one space before the bullet) with their
// continuation lines (indented two spaces or more: `  - _Requirements: {{ac1}}_`) — HTML comments and fenced code set aside.
// → [{ text, sub: [line…], line }] (sub lines left-trimmed).
function packListItems(text) {
  const lines = stripFencedCode(stripHtmlComments(text)).split("\n");
  const items = [];
  let cur = null;
  lines.forEach((l, i) => {
    if (!l.trim()) return; // a blank line: an indented continuation may still follow
    if (cur && /^\s{2}/.test(l)) { cur.sub.push(l.trim()); return; }
    const m = l.match(RE_PACK_ITEM);
    if (m) { cur = { text: l.slice(m[0].length).trim(), sub: [], line: i + 1 }; items.push(cur); return; }
    cur = null;
  });
  return items;
}
// The data rows of a test-plan fragment's tables (each table's header and separator rows set aside) — six cells each, as the
// built-in plan (Test ID | Layer | Kind | Description | Covers | File; the Test ID cell is renumbered). → { rows: [{ cells, line }], bad: [line…] }.
function packTableRows(text) {
  const lines = stripFencedCode(stripHtmlComments(text)).split("\n");
  const rows = [], bad = [];
  let inTable = false;
  lines.forEach((l, i) => {
    const t = l.trim();
    if (!t.startsWith("|")) { inTable = false; return; }
    if (!inTable) {
      inTable = true;
      if (RE_TABLE_SEPARATOR.test((lines[i + 1] || "").trim())) return; // the header row
    }
    if (RE_TABLE_SEPARATOR.test(t)) return;
    const cells = t.slice(1, t.endsWith("|") && t.length > 1 ? -1 : undefined).split("|").map((c) => c.trim());
    if (cells.length !== 6) bad.push(i + 1);
    else rows.push({ cells, line: i + 1 });
  });
  return { rows, bad };
}
// The {{variables}} a fragment may use: {{ac1}}… (the pack's n-th criterion as the feature numbers it), {{acs}} (all of them),
// {{t1}}… / {{tests}} (their planned tests), {{title}}, {{marker}}, and the feature's {{name}} / {{slug}}.
const RE_PACK_VAR = /^(?:ac\d{1,3}|acs|t\d{1,3}|tests|title|marker|name|slug)$/;
// A section's guidance takes the feature / pack values only (it has no criteria of its own).
const RE_PACK_GUIDANCE_VAR = /^(?:title|marker|name|slug)$/;
// A section name / synonym as headingMatches compares it: lower-case, its heading lead stripped (RE_HEADING_LEAD — numbering, an
// emoji, a dash, "Section N"; names hold no bracket, so no marker).
function packSectionKey(lower) {
  let t = lower;
  for (let prev = null; prev !== t;) { prev = t; t = t.replace(RE_HEADING_LEAD, ""); }
  return t.trim();
}
// The core design's own headings (every language, + the tdd block's) as section keys — a pack section named like one only counts
// under its marker (sections are marker-bound); check says so (section-core-name). Static i18n text: built once per process.
let CORE_DESIGN_KEYS = null;
function coreDesignHeadingKeys() {
  if (CORE_DESIGN_KEYS) return CORE_DESIGN_KEYS;
  const set = new Set();
  for (const l of i18n.BASE_LANGS) { // (pt-BR's headings derive from pt's — not rendered a fourth time: toPtBr is costly)
    for (const line of i18n.design({ name: "x", tracks: ["core", "tdd"], label: "core +tdd" }, l).split("\n")) {
      const m = line.match(/^#{2,6}\s+(.*)$/);
      if (m) set.add(packSectionKey(m[1].replace(/[*_`]/g, "").replace(/\s+/g, " ").trim().toLowerCase()));
    }
  }
  return (CORE_DESIGN_KEYS = set);
}
function packVarRefs(text) {
  const out = [];
  for (const m of String(text).matchAll(RE_TEMPLATE_VAR)) out.push(m[1].toLowerCase());
  return out;
}
// One fragment's text → its parsed form, or null (reported through err / warn).
function parsePackFragment(file, text, frel, err, warn) {
  const cap = (list) => { if (list.length > PACK_LIMITS.items) { err(frel, "too-many", { field: file, max: PACK_LIMITS.items }); return null; } return list; };
  for (const v of packVarRefs(text)) if (!RE_PACK_VAR.test(v)) warn(frel, "unknown-variable", { v });
  if (file === "steering.md") {
    if (!text.trim()) { warn(frel, "fragment-empty", { file }); return null; }
    return { text };
  }
  if (file === "test-plan.md") {
    const t = packTableRows(text);
    t.bad.forEach((line) => err(frel, "fragment-row", { file }, line));
    if (t.bad.length || !cap(t.rows)) return null;
    if (!t.rows.length) { warn(frel, "fragment-empty", { file }); return null; }
    return { rows: t.rows, text };
  }
  const items = packListItems(text).map((it) => {
    let t = it.text;
    if (file === "requirements.md") t = t.replace(/^(?:\*\*)?(?:US-\d+\.)?AC-\d+(?:\*\*)?[ \t]*(?:[—–:-][ \t]*)?/, "");
    else t = t.replace(/^\[[ xX]\][ \t]+/, "").replace(/^\d{1,4}[.)][ \t]+/, "");
    return { text: t.trim(), sub: it.sub, line: it.line };
  }).filter((it) => it.text);
  if (!cap(items)) return null;
  if (!items.length) { warn(frel, "fragment-empty", { file }); return null; }
  return { items, text };
}
// A localized value — { en, pt?, es?, "pt-BR"? } or a plain string (its English) — checked with ok(); null when invalid.
function packLocalized(v, field, ok, rule, jrel, err, warn) {
  const val = typeof v === "string" ? { en: v } : v;
  if (!isObj(val) || typeof val.en !== "string") { err(jrel, v == null ? "field-missing" : "field-invalid", { field, rule }); return null; }
  const out = {};
  for (const k of Object.keys(val)) {
    if (!i18n.LANGS.includes(k)) { warn(jrel, "unknown-key", { key: field + "." + k }); continue; }
    if (!ok(val[k])) { err(jrel, "field-invalid", { field: field + (typeof v === "string" ? "" : "." + k), rule }); return null; }
    out[k] = val[k].trim();
  }
  return out;
}

// One pack folder → { entry, pack?, problems } — pack only when it is valid. A folder whose scan (packScan's sig) is unchanged since
// an earlier call is served from PACK_CACHE (F4 review R9: 20 packs × 4 languages cost ~100 ms per call); its real path is checked
// every time.
const PACK_CACHE = new Map(); // readCacheKey(pack dir) → { sig, entry, pack, problems } — across calls, bounded
function loadPack(dir, folder, rel, realSpecs) {
  let realDir = null;
  try { realDir = fs.realpathSync.native(dir); } catch { /* vanished */ }
  if (!realDir || !isInsideDir(realSpecs, realDir)) {
    return { entry: { name: folder, folder: rel, valid: false, marker: null, title: null, errors: 1 }, problems: [{ file: rel, severity: "error", code: "linked-folder", args: {}, pack: folder }] };
  }
  const scan = packScan(dir, rel);
  const ck = readCacheKey(dir);
  const hit = PACK_CACHE.get(ck);
  if (hit && hit.sig === scan.sig) return { entry: { ...hit.entry }, pack: hit.pack, problems: hit.problems };
  const problems = [];
  const r = loadPackScan(scan, folder, rel, (file, severity, code, args, line) =>
    problems.push({ file, severity, code, args: args || {}, ...(line ? { line } : {}), pack: folder }));
  if (r.pack) r.pack.sig = scan.sig;
  if (PACK_CACHE.size >= 64) PACK_CACHE.clear();
  PACK_CACHE.set(ck, { sig: scan.sig, entry: { ...r.entry }, pack: r.pack || null, problems });
  return { entry: r.entry, pack: r.pack, problems };
}
// The validation of one scanned pack (every problem goes through problem()).
function loadPackScan(scan, folder, rel, problem) {
  let errors = 0;
  const err = (file, code, args, line) => { errors++; problem(file, "error", code, args, line); };
  const warn = (file, code, args, line) => problem(file, "warn", code, args, line);
  const entry = { name: folder, folder: rel, valid: false, marker: null, title: null, errors: 0 };
  const done = () => { entry.errors = errors; return { entry }; };
  const jrel = rel + PACK_JSON;
  if (!RE_PACK_NAME.test(folder)) err(rel, "name-invalid", { name: folder });
  else if (packReservedName(folder)) err(rel, "name-reserved", { name: folder });
  const jItem = scan.items.find((x) => x.lang === "" && x.name === PACK_JSON);
  if (!jItem) { err(jrel, "json-missing", {}); return done(); }
  if (jItem.state === "linked") { err(jrel, "fragment-linked", { file: PACK_JSON }); return done(); }
  const jf = readPackItem(jItem, PACK_LIMITS.jsonBytes);
  if (jf.missing) { err(jrel, "json-missing", {}); return done(); }
  if (jf.tooBig) { err(jrel, "too-big", { file: PACK_JSON, max: PACK_LIMITS.jsonBytes }); return done(); }
  const stripped = stripJsonComments(jf.text);
  let j = null;
  // The reason is a code the project's language renders (review 5: V8's JSON.parse text is English), and a syntax error names its
  // line — stripJsonComments keeps the line breaks, so the parser's position maps to the file's line.
  if (stripped == null) { err(jrel, "json-invalid", { why: "comment" }); return done(); }
  try {
    j = JSON.parse(stripped);
  } catch (e) {
    const m = String(e && e.message);
    const pos = /position (\d+)/.exec(m), ln = /line (\d+)/.exec(m);
    const line = pos ? stripped.slice(0, Number(pos[1])).split("\n").length : ln ? Number(ln[1]) : null;
    err(jrel, "json-invalid", { why: "syntax", line }, line || undefined);
    return done();
  }
  if (!isObj(j)) { err(jrel, "json-invalid", { why: "object" }); return done(); }
  for (const k of Object.keys(j)) if (!PACK_KEYS.has(k)) warn(jrel, "unknown-key", { key: k });

  if (typeof j.name !== "string") err(jrel, "field-missing", { field: "name", rule: "name" });
  else if (j.name !== folder) err(jrel, "name-mismatch", { name: j.name.slice(0, 80), folder });

  let token = null;
  if (typeof j.marker !== "string") err(jrel, "field-missing", { field: "marker", rule: "marker" });
  else {
    const t = j.marker.trim();
    const bare = t.length > 2 && t.startsWith("[") && t.endsWith("]") ? t.slice(1, -1) : t;
    if (!RE_PACK_MARKER.test(bare)) err(jrel, "marker-invalid", { marker: j.marker.slice(0, 40) });
    else if (RE_PACK_MARKER_RESERVED.test(bare)) err(jrel, "marker-reserved", { marker: bare });
    else token = bare;
  }

  // A rule is a code (+ its limit) — trackPacks.rule renders it in the project's language (review 5)
  const textRule = { id: "text", max: PACK_LIMITS.textLen };
  const title = packLocalized(j.title, "title", (s) => packTextOk(s, PACK_LIMITS.textLen), textRule, jrel, err, warn);
  let description = null;
  if (j.description != null) {
    if (typeof j.description !== "string" || j.description.length > PACK_LIMITS.descriptionLen || /[\u0000-\u001f\u007f]/.test(j.description)) {
      err(jrel, "field-invalid", { field: "description", rule: { id: "line", max: PACK_LIMITS.descriptionLen } });
    } else description = j.description.trim();
  }

  const signals = { strong: [], weak: [], context: [] };
  if (j.signals != null) {
    if (!isObj(j.signals)) err(jrel, "field-invalid", { field: "signals", rule: "signals" });
    else {
      for (const k of Object.keys(j.signals)) {
        if (!PACK_TIERS.includes(k)) { warn(jrel, "unknown-key", { key: "signals." + k }); continue; }
        const list = j.signals[k];
        if (!Array.isArray(list)) { err(jrel, "field-invalid", { field: "signals." + k, rule: "keywords" }); continue; }
        if (list.length > PACK_LIMITS.keywords) { err(jrel, "too-many", { field: "signals." + k, max: PACK_LIMITS.keywords }); continue; }
        for (const kw of list) {
          const t = typeof kw === "string" && kw.length <= 4 * PACK_LIMITS.keywordLen ? kw.trim().replace(/\s+/g, " ") : null;
          if (t == null || t.length > PACK_LIMITS.keywordLen || !RE_PACK_KEYWORD.test(t)) {
            err(jrel, "signal-invalid", { tier: k, keyword: String(kw).slice(0, 80) });
            continue;
          }
          if (!signals[k].includes(t)) signals[k].push(t);
        }
      }
    }
  }

  const sections = [];
  if (!Array.isArray(j.sections) || !j.sections.length) err(jrel, j.sections == null ? "field-missing" : "field-invalid", { field: "sections", rule: "sections" });
  else if (j.sections.length > PACK_LIMITS.sections) err(jrel, "too-many", { field: "sections", max: PACK_LIMITS.sections });
  else {
    j.sections.forEach((s, i) => {
      const f = "sections[" + i + "]";
      if (!isObj(s)) { err(jrel, "field-invalid", { field: f, rule: "section" }); return; }
      for (const k of Object.keys(s)) if (!PACK_SECTION_KEYS.has(k)) warn(jrel, "unknown-key", { key: f + "." + k });
      // (a section name keys the localized-name lookups: never an Object.prototype key such as "constructor")
      const names = packLocalized(s.name, f + ".name", (x) => packTextOk(x, PACK_LIMITS.textLen) && !PROTO_KEYS.has(x.trim().toLowerCase()), textRule, jrel, err, warn);
      // A name / synonym is matched as headingMatches reads a heading: after its lead (numbering "2 " / "1.2 ", "Section 3",
      // an emoji, a dash) — the same strip here, or "2 Offline Modes" could never match its own heading (F4 review R4). Nothing
      // left after the lead → invalid; a lead stripped → a warning (it is ignored when matching).
      let leadWarned = false;
      const key = (x, field) => {
        const raw = x.trim().replace(/\s+/g, " ").toLowerCase();
        const k = packSectionKey(raw);
        if (k.length < 2) { err(jrel, "field-invalid", { field, rule: "lead" }); return null; }
        if (k !== raw && !leadWarned) { leadWarned = true; warn(jrel, "section-name-lead", { name: x.trim(), key: k }); }
        return k;
      };
      const list = (k) => {
        const v = s[k];
        if (v == null) return [];
        if (!Array.isArray(v)) { err(jrel, "field-invalid", { field: f + "." + k, rule: "texts" }); return null; }
        if (v.length > PACK_LIMITS.syn) { err(jrel, "too-many", { field: f + "." + k, max: PACK_LIMITS.syn }); return null; }
        const out = [];
        for (const x of v) {
          if (!packTextOk(x, PACK_LIMITS.textLen)) { err(jrel, "field-invalid", { field: f + "." + k, rule: textRule }); return null; }
          const kx = key(x, f + "." + k);
          if (kx == null) return null;
          out.push(kx);
        }
        return out;
      };
      const syn = list("syn"), loose = list("loose");
      const guidance = s.guidance == null ? null : packLocalized(s.guidance, f + ".guidance", packGuidanceOk, { id: "guidance", max: PACK_LIMITS.guidanceLen }, jrel, err, warn);
      if (!names || !syn || !loose || (s.guidance != null && !guidance)) return;
      if (guidance) for (const g of Object.values(guidance)) for (const v of packVarRefs(g)) if (!RE_PACK_GUIDANCE_VAR.test(v)) warn(jrel, "unknown-variable", { v });
      const nameKeys = [];
      for (const [l, x] of Object.entries(names)) {
        const kx = key(x, f + ".name" + (typeof s.name === "string" ? "" : "." + l));
        if (kx == null) return;
        if (!nameKeys.includes(kx)) nameKeys.push(kx);
      }
      const clash = sections.find((o) => nameKeys.some((x) => o.nameKeys.includes(x)));
      if (clash) { err(jrel, "section-duplicate", { name: names.en }); return; }
      // Every pack synonym is MARKER-BOUND (F4 review R7): it names the section only on a heading carrying the pack's marker, or on an
      // unmarked heading nested under one — never the core design's own "## Architecture" / "## Testing Strategy". (`loose` is kept
      // for symmetry with the built-in tables; for a pack every synonym already behaves as one.)
      const all = [...new Set([...nameKeys, ...syn, ...loose])];
      const core = all.filter((x) => coreDesignHeadingKeys().has(x));
      if (core.length) warn(jrel, "section-core-name", { name: names.en, heading: core[0] });
      sections.push({ name: names.en, names, nameKeys, syn: all, loose: all, guidance });
    });
  }

  let steering = null;
  if (j.steering != null) {
    const s = j.steering;
    const stem = typeof s === "string" ? s.slice(0, -3) : "";
    if (typeof s !== "string" || !RE_CUSTOM_STEERING.test(s) || RE_WIN_RESERVED.test(stem) || PROTO_KEYS.has(stem)) err(jrel, "steering-invalid", { file: String(s).slice(0, 80) });
    else {
      steering = s;
      if (i18n.steeringKnownFiles().includes(s)) warn(jrel, "steering-shared", { file: s });
    }
  }

  // The fragments: the pack root, then each <lang>/ folder (packScan's items); anything else is listed (ignored).
  const fragments = {};
  for (const it of scan.items) {
    if (it.lang === "" && it.name === PACK_JSON) continue;
    if (it.state === "unknown") { warn(it.frel, "unknown-file", {}); continue; }
    if (it.state === "linked") { err(it.frel, "fragment-linked", { file: it.name }); continue; }
    const r = readPackItem(it, PACK_LIMITS.fragmentBytes);
    if (r.tooBig) { err(it.frel, "too-big", { file: it.name, max: PACK_LIMITS.fragmentBytes }); continue; }
    if (r.missing) continue;
    const parsed = parsePackFragment(it.name, r.text, it.frel, err, warn);
    if (parsed) (fragments[it.name] = fragments[it.name] || {})[it.lang] = { ...parsed, rel: it.frel };
  }
  // {{acN}} / {{tN}} must name a criterion / a planned test the pack scaffolds — per language context (a <lang>/ folder, else the root).
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const contexts = ["", ...i18n.LANGS.filter((l) => PACK_FRAGMENTS.some((fl) => fragments[fl] && has(fragments[fl], l)))];
  const effective = (fl, ctx) => {
    const by = fragments[fl];
    if (!by) return null;
    for (const l of ctx ? [ctx, i18n.baseLang(ctx), ""] : [""]) if (has(by, l)) return by[l];
    return null;
  };
  for (const ctx of contexts) {
    const req = effective("requirements.md", ctx);
    const nAc = req ? req.items.length : 1;
    const plan = effective("test-plan.md", ctx);
    const nT = plan ? plan.rows.length : nAc;
    for (const fl of ["tasks.md", "test-plan.md", "checklist.md"]) {
      const fr = effective(fl, ctx);
      if (!fr) continue;
      for (const v of new Set(packVarRefs(fr.text))) {
        const m = v.match(/^(ac|t)(\d{1,3})$/);
        if (!m) continue;
        const max = m[1] === "ac" ? nAc : fl === "tasks.md" ? nT : 0;
        // Named with the language context and where the count comes from (F4 review R10): a root tasks.md checked for the pt/
        // features reads pt/requirements.md's criteria.
        const from = m[1] === "ac" ? (req ? req.rel : "") : fl === "tasks.md" ? (plan ? plan.rel : req ? req.rel : "") : "";
        if (+m[2] < 1 || +m[2] > max) err(fr.rel, "fragment-ref", { file: fl, ref: "{{" + v + "}}", n: max, ctx, from, kind: m[1] });
      }
    }
  }

  entry.errors = errors;
  if (errors || !token || !title) return { entry };
  entry.valid = true;
  entry.marker = "[" + token + "]";
  entry.title = title.en;
  return { entry, pack: { name: folder, token, marker: "[" + token + "]", title, description, signals, sections, steering, rel, fragments } };
}

// Every pack folder of a project's .specs/ → the registry { packs (valid, in name order), names, byName, byToken, problems, entries,
// legacy }. A .specs/tracks/ holding a .state.json is a FEATURE created before 1.15 (legacy: no packs, as templates/).
function loadTrackPacks(root) {
  const reg = { packs: [], names: [], byName: new Map(), byToken: new Map(), problems: [], entries: [], legacy: false, corpus: null, dir: path.join(root, TRACK_PACKS_DIR) };
  const tdir = reg.dir;
  if (!existsCached(tdir)) return reg;
  const rel0 = ".specs/" + TRACK_PACKS_DIR + "/";
  const problem = (file, severity, code, args, line, pack) => reg.problems.push({ file, severity, code, args: args || {}, ...(line ? { line } : {}), ...(pack ? { pack } : {}) });
  let st;
  try { st = fs.lstatSync(tdir); } catch { return reg; }
  if (st.isSymbolicLink() || !st.isDirectory()) { problem(rel0, "error", "linked-folder", {}); return reg; }
  if (existsCached(statePath(tdir))) { reg.legacy = true; return reg; }
  let realSpecs;
  try { realSpecs = fs.realpathSync.native(root); } catch { return reg; }
  let count = 0;
  for (const e of readDirCached(tdir) || []) {
    if (e.name.startsWith(".")) continue;
    const rel = rel0 + e.name + "/";
    if (e.isSymbolicLink()) { problem(rel, "error", "linked-folder", {}, null, e.name); reg.entries.push({ name: e.name, folder: rel, valid: false, marker: null, title: null, errors: 1 }); continue; }
    if (!e.isDirectory()) { problem(rel0 + e.name, "warn", "unknown-file", {}); continue; }
    if (++count > PACK_LIMITS.packs) { problem(rel, "error", "too-many-packs", { max: PACK_LIMITS.packs }, null, e.name); reg.entries.push({ name: e.name, folder: rel, valid: false, marker: null, title: null, errors: 1 }); continue; }
    const r = loadPack(path.join(tdir, e.name), e.name, rel, realSpecs);
    reg.problems.push(...r.problems);
    if (r.pack) {
      const other = reg.byToken.get(r.pack.token);
      if (other) { // markers are unique: the first pack (by name) keeps it
        problem(rel + PACK_JSON, "error", "marker-duplicate", { marker: r.pack.marker, other: other.name }, null, e.name);
        r.entry.valid = false;
        r.entry.errors++;
      } else {
        reg.packs.push(r.pack);
        reg.names.push(r.pack.name);
        reg.byName.set(r.pack.name, r.pack);
        reg.byToken.set(r.pack.token, r.pack);
      }
    }
    reg.entries.push(r.entry);
  }
  return reg;
}

let PACK_LOADING = false;
const NO_PACKS = Object.freeze({ packs: [], names: [], byName: new Map(), byToken: new Map(), problems: [], entries: [], legacy: false, corpus: null, dir: null });
// The track packs of the project the current engine call works in (TEMPLATE_SCOPE_ROOT) — none outside a call's scope or while
// the packs themselves load (a reader of the registries never sees a half-built one).
function packRegistry() {
  const root = CTX.TEMPLATE_SCOPE_ROOT;
  if (!root || PACK_LOADING) return NO_PACKS;
  if (CTX.PACK_MEMO && CTX.PACK_MEMO.root === root) return CTX.PACK_MEMO.reg;
  PACK_LOADING = true;
  let reg;
  try { reg = loadTrackPacks(root); } catch { reg = NO_PACKS; } finally { PACK_LOADING = false; }
  if (CTX.READ_CACHE) CTX.PACK_MEMO = { root, dirKey: readCacheKey(path.join(root, TRACK_PACKS_DIR)), reg };
  return reg;
}
const packTracks = () => packRegistry().names;
const packOf = (tr) => packRegistry().byName.get(tr) || null;
const isPackTrack = (tr) => typeof tr === "string" && packRegistry().byName.has(tr);
// `[A11Y]` — exactly, markers are case-sensitive tokens — is a pack's stable marker, never a template slot (a lower-case
// `[role]` stays the template's slot even beside a ROLE pack). Never while the process-wide built-in corpus is built.
function isPackMarkerBracket(inner) {
  if (CTX.BUILTIN_CORPUS_BUILD) return false;
  const reg = packRegistry();
  return reg.packs.length > 0 && reg.byToken.has(String(inner).trim());
}
// The markers a feature's active track packs carry → { packMarkers: { name: "[TOKEN]" } } for its .state.json (none: {}) — so the
// feature's pack sections stay recognizable (and inactive) if the pack later disappears.
function packMarkersFor(tracks) {
  const m = {};
  for (const t of tracks || []) if (isPackTrack(t)) m[t] = trackMarker(t);
  return Object.keys(m).length ? { packMarkers: m } : {};
}
// The track packs a feature once used that the project lacks now (this engine call): [[name, marker]] — their sections, criteria
// and task blocks are INACTIVE like a removed track's (inactiveMarkerLines / inactiveTaskLines). Filled by detectTracks from each
// feature's .state.json packMarkers — EVERY recorded pack that is no valid pack now, whether the feature still lists it or turned
// it off before the pack went (F4 review R1: an off-then-deleted pack's sections came back to life); a marker that is a valid
// pack's or reserved is never one. Dropped with the read-cache scope.
function noteGhostPacks(st) {
  if (!CTX.READ_CACHE || !isObj(st) || !isObj(st.packMarkers)) return;
  const valid = allTracks();
  for (const n of Object.keys(st.packMarkers)) {
    const m = st.packMarkers[n];
    // (a pre-1.17 pack named like a built-in track — 'dist' — is a missing pack too: legacyPackName, 1.17 D review)
    if (typeof m !== "string" || !RE_PACK_NAME.test(n) || (valid.includes(n) && !legacyPackName(st, n))) continue;
    const token = m.length > 2 && m.startsWith("[") && m.endsWith("]") ? m.slice(1, -1) : "";
    if (!RE_PACK_MARKER.test(token) || RE_PACK_MARKER_RESERVED.test(token) || packRegistry().byToken.has(token)) continue;
    if (!CTX.GHOST_MARKERS) CTX.GHOST_MARKERS = new Map();
    CTX.GHOST_MARKERS.set(n, m);
  }
}
const ghostMarkers = () => (CTX.GHOST_MARKERS ? [...CTX.GHOST_MARKERS] : []);
// A saved (non-built-in) track name that is a track pack's: a valid pack now, or one recorded in the state's packMarkers (a pack the
// feature used) — never a reserved word (F4 review R6: a hand-typed "gdpr" / "security" / a typo is no pack; the list then falls
// back to the files as in 1.14) — except a pre-1.17 pack of a name reserved since (legacyPackName, 1.17 D review).
function savedPackName(st, n) {
  if (legacyPackName(st, n)) return true;
  if (VALID_TRACKS.includes(n) || !RE_PACK_NAME.test(n) || packReservedName(n)) return false;
  return isPackTrack(n) || (isObj(st) && isObj(st.packMarkers) && Object.prototype.hasOwnProperty.call(st.packMarkers, n));
}
// A track pack from before 1.17 whose name is reserved now (1.17 D review): 1.15 / 1.16 accepted a pack named 'dist', 'kafka',
// 'consistency', 'microservices', 'distributed'… — 1.17 reserves them (the built-in +dist track and its TRACK_ALIASES), so the
// pack is invalid ('name-reserved'). A feature that used it recorded the name in .state.json packMarkers (only a VALID pack is
// ever recorded there): it stays that feature's MISSING pack — inactive, listed by doctor's track-pack-missing with the reason
// and the way out (rename the pack folder, add it again) — never silently dropped (the list read "core" and no warning), and a
// pack named 'dist' is never read as the built-in +dist track (whose five [DIST] sections the pack's design doesn't have).
// Adding the built-in track by name adopts it (applyTracks drops the record); add_track <name> --remove drops the pack.
function legacyPackName(st, n) {
  return typeof n === "string" && RE_PACK_NAME.test(n) && packReservedName(n) && isObj(st) && isObj(st.packMarkers) &&
    Object.prototype.hasOwnProperty.call(st.packMarkers, n);
}
// A track pack whose MARKER is a built-in track's now (1.19 T review): 1.15–1.18 accepted a pack of any name with the marker [UI],
// [API] or [OBS] (before 1.17, [DIST]) — 'webui' with [UI], 'contracts' with [API]. The marker is reserved since, so the pack is
// invalid ('marker-reserved') and the feature's missing pack; its '## [UI] …' headings would pass for the built-in track's. → the
// built-in track whose marker the feature's .state.json packMarkers records for pack n (n no valid pack now), else null. Adding
// that track adopts it (applyTracks: the built-in sections are appended although a heading carries the marker, the pack's record
// goes); doctor's track-pack-missing and spec_upgrade say so.
function legacyPackMarkerTrack(st, n) {
  if (typeof n !== "string" || !isObj(st) || !isObj(st.packMarkers) || !Object.prototype.hasOwnProperty.call(st.packMarkers, n)) return null;
  const m = st.packMarkers[n];
  if (typeof m !== "string" || VALID_TRACKS.includes(n) || isPackTrack(n)) return null;
  for (const tr of MARKER_TRACKS) if (TRACK_MARKER[tr] === m) return tr;
  return null;
}
// The dev-spec release that reserved a pack name a feature still records (1.19 T): the +api / +ui / +obs names and their aliases
// became reserved in 1.19, +dist's in 1.17 — the doctor / upgrade messages say "a track pack from before <that release>".
const TRACK_RESERVED_SINCE = { dist: "1.17", api: "1.19", ui: "1.19", obs: "1.19", data: "1.21" };
function packReservedSince(n) {
  const tr = Object.prototype.hasOwnProperty.call(TRACK_ALIASES, n) ? TRACK_ALIASES[n] : n;
  return Object.prototype.hasOwnProperty.call(TRACK_RESERVED_SINCE, tr) ? TRACK_RESERVED_SINCE[tr] : "1.17";
}
// A feature's saved tracks naming a pack the project no longer has (deleted, now invalid, or — 1.17 — its name reserved since):
// inactive, kept in .state.json.
function missingPackTracks(dir) {
  const st = readJson(statePath(dir)).data;
  const saved = isObj(st) && Array.isArray(st.tracks) ? st.tracks : [];
  const valid = allTracks();
  return [...new Set(saved.filter((x) => typeof x === "string").map((x) => x.toLowerCase())
    .filter((x) => legacyPackName(st, x) || (!valid.includes(x) && savedPackName(st, x))))];
}

// --- rendering a pack's blocks (the design sections, criteria, task block, test rows, checklist items, steering stub) ---
function packLocal(v, lang) {
  if (!v) return "";
  if (typeof v === "string") return v;
  const l = normalizeLang(lang), b = i18n.baseLang(l);
  return (Object.prototype.hasOwnProperty.call(v, l) && v[l]) || (Object.prototype.hasOwnProperty.call(v, b) && v[b]) || v.en || "";
}
const packTitle = (pack, lang) => packLocal(pack.title, lang);
// The fragment `file` for a feature in `lang`: its <lang>/ folder's, its family's (pt-BR → pt), else the pack root's — or null.
function packFragment(pack, file, lang) {
  const by = pack.fragments[file];
  if (!by) return null;
  for (const l of [...templateLangChain(lang), ""]) if (Object.prototype.hasOwnProperty.call(by, l)) return by[l];
  return null;
}
// The values a fragment's {{variables}} take (see RE_PACK_VAR). ctx: { acs, tids, title, marker, acSlot, name?, slug? }.
// → { text, drop } — drop: a {{tN}} / {{tests}} with no planned test (the caller leaves that line out).
function packSubst(text, ctx) {
  let drop = false;
  const out = String(text).replace(RE_TEMPLATE_VAR, (m, k) => {
    const key = k.toLowerCase();
    let x;
    if ((x = key.match(/^ac(\d{1,3})$/))) return ctx.acs[+x[1] - 1] || ctx.acSlot;
    if (key === "acs") return ctx.acs.length ? ctx.acs.join(", ") : ctx.acSlot;
    if ((x = key.match(/^t(\d{1,3})$/))) { const t = ctx.tids[+x[1] - 1]; if (!t) drop = true; return t || m; }
    if (key === "tests") { if (!ctx.tids.length) drop = true; return ctx.tids.join(", "); }
    if (key === "title") return ctx.title;
    if (key === "marker") return ctx.marker;
    if ((key === "name" || key === "slug") && ctx[key] != null) return ctx[key];
    return m;
  });
  return { text: out, drop };
}
function packCtx(pack, lang, acs, tids, vars) {
  return { acs, tids, title: packTitle(pack, lang), marker: pack.marker, acSlot: i18n.msg(lang).tracks.acPlaceholder(pack.name), ...(vars || {}) };
}
// {{title}} / {{marker}} (and {{name}} / {{slug}} when `vals` has them) filled in; every other {{variable}} left as written.
function packSubstBasic(text, vals) {
  return String(text).replace(RE_TEMPLATE_VAR, (m, k) => {
    const key = k.toLowerCase();
    return (key === "title" || key === "marker" || key === "name" || key === "slug") && vals[key] != null ? vals[key] : m;
  });
}
// The mandatory design sections: `## [MARKER] <name>` + the > **TODO** sentinel + the section's guidance (as the built-in blocks) —
// the guidance's {{title}} / {{marker}} / {{name}} / {{slug}} filled in (vars: the feature's { name, slug }).
function packDesignBlock(pack, lang, vars) {
  const P = i18n.msg(lang).trackPacks;
  const vals = { title: packTitle(pack, lang), marker: pack.marker, ...(vars || {}) };
  return pack.sections.map((s) => {
    const g = s.guidance ? packSubstBasic(packLocal(s.guidance, lang), vals) : "";
    return "\n## " + pack.marker + " " + packLocal(s.names, lang) + "\n" + P.todoLine + "\n" + (g ? g + "\n" : "");
  }).join("");
}
// The criteria block — `#### [MARKER] <title> — Acceptance Criteria (EARS)`, numbered after the highest US-1 AC `existing` defines.
function packRequirementsBlock(pack, lang, existing, vars) {
  const P = i18n.msg(lang).trackPacks;
  const have = [...requirementAcIds(existing || "")].filter((id) => /^US-1\.AC-\d+$/.test(id)).map((id) => parseInt(id.slice(8), 10));
  let n = have.reduce((a, b) => Math.max(a, b), 0);
  const f = packFragment(pack, "requirements.md", lang);
  const items = f ? f.items : [{ text: P.defaultCriterion(packTitle(pack, lang)), sub: [] }];
  const ctx = packCtx(pack, lang, [], [], vars);
  const lines = ["#### " + pack.marker + " " + packTitle(pack, lang) + " — " + P.acHeading];
  for (const it of items) {
    n++;
    lines.push(n + ". **US-1.AC-" + n + "** — " + packSubst(it.text, ctx).text);
    it.sub.forEach((s) => lines.push("   " + packSubst(s, ctx).text));
  }
  return lines.join("\n");
}
// requirements.md + a pack's criteria block, placed right after the US-1 criteria (before the next story / section heading) —
// appended at the end when the text has no US-1 criterion. The heading is a REAL one: never inside an HTML comment (F4 review R3 —
// a template's `<!-- Add more stories like this: ### US-2 … -->` swallowed the block) nor fenced code.
function insertPackRequirements(text, block) {
  const lines = text.split("\n");
  const us1 = [...acIndex(text).values()].filter((e) => /^US-1\.AC-/.test(e.id)).map((e) => e.line);
  if (us1.length) {
    const last = us1.reduce((a, b) => Math.max(a, b), 0) - 1;
    const cl = commentLines(lines);
    const at = headingIndex(lines).find((h) => h > last && !cl[h].hidden && cl[h].vis.startsWith("#") && lines[h].match(/^(#{1,6})/)[1].length <= 3);
    if (at != null) {
      let k = at;
      while (k > 0 && !lines[k - 1].trim()) k--;
      return [...lines.slice(0, k), "", block, "", ...lines.slice(at)].join("\n");
    }
  }
  return text.trimEnd() + "\n\n" + block + "\n";
}
// The planned tests of a pack's criteria: test-plan rows citing one of `acs`, in plan order → [{ tid, acs: Set }].
function packPlanRows(planText, acs) {
  const want = new Set(acs);
  const out = [];
  for (const [tid, r] of testIndex(planText || "")) {
    const cov = [...extractAcIds(r.row)].filter((a) => want.has(a));
    if (cov.length) out.push({ tid, acs: new Set(cov) });
  }
  return out;
}
// The task block — `## Story US-1 — [MARKER] <title>`, numbered after the last task — or null when tasks.md already has it (a
// heading carrying the marker). Each task cites the pack's criteria as requirements.md defines them (trackAcIds; none yet → the
// track's criterion slot) and, on a +tdd plan with the pack's rows, makes their tests green.
function packTaskBlock(pack, tasksText, reqText, planText, lang, vars) {
  if (trackTaskHeading(pack.name, tasksText)) return null;
  const P = i18n.msg(lang).trackPacks;
  const start = parseTasks(tasksText).reduce((a, t) => Math.max(a, t.number), 0) + 1;
  const acs = [...trackAcIds(reqText || "", pack.name)];
  const rows = packPlanRows(planText, acs);
  const ctx = packCtx(pack, lang, acs, rows.map((r) => r.tid), vars);
  const f = packFragment(pack, "tasks.md", lang);
  const items = f ? f.items : [{ text: P.defaultTask(pack.marker, packTitle(pack, lang)), sub: [] }];
  const out = ["", "## " + P.taskHeading(pack.marker, packTitle(pack, lang))];
  let n = start - 1;
  for (const it of items) {
    n++;
    const text = packSubst(it.text, ctx).text;
    const sub = it.sub.map((s) => packSubst(s, ctx)).filter((s) => !s.drop).map((s) => s.text);
    if (!sub.some((s) => /_Requirements:/.test(s))) sub.unshift("- _Requirements: " + (acs.length ? acs.join(", ") : ctx.acSlot) + "_");
    if (!f && rows.length && !sub.some((s) => /_Makes green:/.test(s))) { // the default task (a fragment's tasks say it with {{tests}})
      const cited = extractAcIds(sub.join(" "));
      const green = rows.filter((r) => [...r.acs].some((a) => cited.has(a))).map((r) => r.tid);
      if (green.length) sub.push("- _Makes green: " + green.join(", ") + "_");
    }
    out.push("- [ ] " + n + ". " + (/^\[(?:US\d+|shared)\]/i.test(text) ? text : "[US1] " + text), ...sub.map((s) => "  " + s));
  }
  return out.join("\n") + "\n";
}
// The test rows block — `## [MARKER] <Traceability Matrix>` + the built-in plan's header + one row per fragment row (else one per
// criterion), T-IDs after the plan's own — or null (no pack criterion in requirements.md, or the plan already cites them).
function packTestRowsBlock(pack, lang, planText, reqText, vars) {
  const acs = [...trackAcIds(reqText || "", pack.name)];
  if (!acs.length) return null;
  const plan = planIdText(planText || "");
  const cited = extractAcIds(plan);
  if (acs.some((id) => cited.has(id))) return null;
  let n = [...extractTestIds(plan)].map((id) => parseInt(id.slice(2), 10)).reduce((a, b) => Math.max(a, b), 0);
  const P = i18n.msg(lang).trackPacks;
  const ctx = packCtx(pack, lang, acs, [], vars);
  const f = packFragment(pack, "test-plan.md", lang);
  const rows = f ? f.rows.map((r) => {
    const c = r.cells.map((x) => packSubst(x, ctx).text);
    if (!extractAcIds(c[4]).size) c[4] = acs.join(", ");
    return c;
  }) : acs.map((ac) => ["", P.rowLayer, "example", P.rowDesc, ac, "`tests/integration/...`"]);
  const lines = i18n.testPlan("x", lang, ["core", "tdd"]).split("\n");
  const first = lines.findIndex((l) => /^\|\s*T-\d+\s*\|/.test(l));
  if (first < 2) return null;
  const heading = (lines.slice(0, first).reverse().find((l) => /^##\s/.test(l)) || "").replace(/^##\s+/, "");
  const body = rows.map((c) => "| T-" + String(++n).padStart(2, "0") + " | " + c.slice(1).join(" | ") + " |");
  return "\n## " + pack.marker + " " + heading + "\n\n" + lines[first - 2] + "\n" + lines[first - 1] + "\n" + body.join("\n") + "\n";
}
// The checklist items (`- [ ] MARKER: …`) — null when the checklist already holds one of them.
// reqText: the feature's requirements.md — a checklist item's {{acN}} names the pack's criteria as it numbers them.
function packChecklistBlock(pack, lang, text, vars, reqText) {
  const lead = pack.token + ":";
  const RE_BOX = /^\s*[-*]\s+\[[ xX]\]\s+/;
  if (String(text || "").split("\n").some((l) => RE_BOX.test(l) && l.replace(RE_BOX, "").startsWith(lead))) return null;
  const P = i18n.msg(lang).trackPacks;
  const ctx = packCtx(pack, lang, [...trackAcIds(reqText || "", pack.name)], [], vars);
  const f = packFragment(pack, "checklist.md", lang);
  const items = f ? f.items.map((it) => packSubst(it.text, ctx).text) : [P.checklistItem(pack.sections.length)];
  return items.map((t) => "- [ ] " + (t.startsWith(lead) ? t : lead + " " + t)).join("\n");
}
// The steering stub a pack brings (its steering.md, else a generic one titled after the track).
function packSteeringStub(pack, lang) {
  const f = packFragment(pack, "steering.md", lang);
  return f ? (f.text.endsWith("\n") ? f.text : f.text + "\n") : i18n.msg(lang).trackPacks.steeringStub(packTitle(pack, lang), pack.name);
}
// A steering file's stub: the built-in one, else the one of the pack that brings that file, else null.
function trackSteeringStub(file, lang) {
  const b = i18n.steeringStub(file, lang);
  if (b) return b;
  const p = packRegistry().packs.find((x) => x.steering === file);
  return p ? packSteeringStub(p, lang) : null;
}

// The pack blocks as template corpus (placeholder detection): every text a valid pack scaffolds, in every language — its brackets,
// code-span slots and task lines are template text until a feature edits them. Read straight from the pack's sources (the section
// guidance, the fragments' items / rows, the i18n defaults) — never by rendering whole blocks (F4 review R9) — with {{title}} /
// {{marker}} filled in and the FEATURE's values ({{name}} {{slug}} {{acN}} {{acs}} {{tN}} {{tests}}) kept as variables: a key holding
// one is a LINEAR wildcard (packWildcard → wildcardMatch, the project templates' rule), so `[the {{name}} screens]` still reads as
// a slot once it became `[the Login screens]` (F4 review R2). Built on first use per call and cached across calls by the packs' scan
// signatures (PACK_CORPUS_CACHE — any edit to a pack changes the key).
const RE_PACK_WILD_VAR = /\{\{\s*(?:ac\d{1,3}|acs|t\d{1,3}|tests|name|slug)\s*\}\}/i;
const RE_PACK_WILD_VAR_G = new RegExp(RE_PACK_WILD_VAR.source, "gi");
const PACK_CORPUS_CACHE = new Map(); // corpus key → sets, across calls (bounded)
function packCorpusSets() {
  const reg = packRegistry();
  if (!reg.packs.length) return null;
  if (reg.corpus) return reg.corpus;
  const ck = reg.packs.map((p) => p.name + "|" + p.token + "|" + (p.sig || "")).join("\n");
  const cached = PACK_CORPUS_CACHE.get(ck);
  if (cached) return (reg.corpus = cached);
  const sets = { brackets: { set: new Set(), wild: [] }, code: new Set(), tasks: { set: new Set(), wild: [] } };
  reg.corpus = sets; // visible to the scan below (a code-span slot lookup) while it is filled
  const seen = new Set();
  // A key holding a feature variable → a wildcard (at least 3 literal characters, as templateWildcard: a slot that is nothing but
  // a variable would match every bracket), else an exact key.
  const put = (entry, key) => {
    if (!RE_PACK_WILD_VAR.test(key)) { entry.set.add(key); return; }
    const segs = key.split(RE_PACK_WILD_VAR_G);
    if (segs.join("").replace(/\s+/g, "").length >= 3) entry.wild.push(segs);
  };
  for (const p of reg.packs) {
    for (const l of i18n.LANGS) {
      const P = i18n.msg(l).trackPacks;
      const vals = { title: packTitle(p, l), marker: p.marker };
      const texts = [], taskTexts = [];
      for (const s of p.sections) if (s.guidance) texts.push(packLocal(s.guidance, l));
      const fr = packFragment(p, "requirements.md", l);
      if (fr) fr.items.forEach((it) => texts.push(it.text, ...it.sub)); else texts.push(P.defaultCriterion(vals.title));
      const ft = packFragment(p, "tasks.md", l);
      if (ft) ft.items.forEach((it) => { texts.push(it.text, ...it.sub); taskTexts.push(it.text); });
      else { const d = P.defaultTask(p.marker, vals.title); texts.push(d); taskTexts.push(d); }
      const fp = packFragment(p, "test-plan.md", l);
      if (fp) fp.rows.forEach((r) => texts.push("| " + r.cells.slice(1).join(" | ") + " |")); else texts.push(P.rowDesc);
      const fc = packFragment(p, "checklist.md", l);
      if (fc) fc.items.forEach((it) => texts.push(it.text)); else texts.push(P.checklistItem(p.sections.length));
      texts.push(packSteeringStub(p, l), i18n.msg(l).tracks.acPlaceholder(p.name));
      for (const t of texts) {
        const k = templateBracketKeys(packSubstBasic(t, vals), seen);
        k.brackets.forEach((x) => put(sets.brackets, x));
        k.code.forEach((x) => sets.code.add(x));
      }
      for (const t of taskTexts) put(sets.tasks, taskDescription(packSubstBasic(t, vals)));
    }
  }
  if (PACK_CORPUS_CACHE.size >= 16) PACK_CORPUS_CACHE.clear();
  PACK_CORPUS_CACHE.set(ck, sets);
  return sets;
}

// --- spec_tracks {action: list | init | check, name?, lang?} — `dev-spec tracks [list|init <name>|check]` ---
function localizePackProblem(p, K) {
  const M = K.problems[p.code];
  const out = { file: p.file, severity: p.severity, code: p.code, message: typeof M === "function" ? M(p.args || {}) : M || p.code };
  if (p.line) out.line = p.line;
  if (p.pack) out.pack = p.pack;
  return out;
}
function trackPacks(projectDir, action, opts = {}) {
  // 1.21 F2 — the project's classifier signal overrides (.specs/classifier.json): an action of this tool, not a tool of its own
  if (action != null && String(action).trim().toLowerCase() === "signals") return signalOverrides(projectDir, opts.op, opts);
  const pl = projectLang(projectDir);
  let lang = null;
  if (opts.lang != null && String(opts.lang).trim()) {
    lang = i18n.canonicalLang(String(opts.lang));
    if (!lang) {
      const A = i18n.msg(pl).args;
      return { ok: false, error: A.invalid(A.item("lang", A.oneOf(i18n.LANGS.join(", ")), JSON.stringify(String(opts.lang)))) };
    }
  }
  const lng = lang || pl;
  const K = i18n.msg(lng).trackPacks;
  const act = action == null || !String(action).trim() ? "list" : String(action).trim().toLowerCase();
  if (!["list", "init", "check"].includes(act)) return { ok: false, error: K.badAction(String(action)) };
  const root = specsRoot(projectDir);
  const tdir = path.join(root, TRACK_PACKS_DIR);
  // .specs/tracks/ of a feature created before 1.15 stays that feature: nothing is read from it, nothing written into it.
  if (existsCached(statePath(tdir))) return { ok: false, legacyFeature: true, error: K.legacyFeature };
  if (act === "init") return initTrackPack(projectDir, opts.name, lang, lng);
  const reg = packRegistry();
  const name = opts.name != null && String(opts.name).trim() ? String(opts.name).trim().toLowerCase() : null;
  if (name && !reg.entries.some((e) => e.name === name) && !VALID_TRACKS.includes(name)) return { ok: false, error: K.unknownPack(name, reg.entries.map((e) => e.name).join(", ") || "—") };
  if (act === "check") return checkTrackPacks(reg, name, lng);
  return listTrackPacks(reg, name, lng);
}
function listTrackPacks(reg, name, lng) {
  const K = i18n.msg(lng).trackPacks;
  const builtIn = VALID_TRACKS.filter((t) => !name || t === name).map((t) => ({ name: t, builtIn: true, marker: TRACK_MARKER[t] || null,
    sections: (TRACK_SECTIONS[t] || []).map((s) => s.name), steering: (TRACK_STEERING[t] || []).slice() }));
  const packs = reg.entries.filter((e) => !name || e.name === name).map((e) => {
    const p = e.valid ? reg.byName.get(e.name) : null;
    const errs = reg.problems.filter((x) => x.pack === e.name && x.severity === "error").length;
    const warns = reg.problems.filter((x) => x.pack === e.name && x.severity === "warn").length;
    return p ? { name: p.name, folder: e.folder, valid: true, marker: p.marker, title: packTitle(p, lng), description: p.description,
      sections: p.sections.map((s) => packLocal(s.names, lng)), signals: { strong: p.signals.strong.length, weak: p.signals.weak.length, context: p.signals.context.length },
      steering: p.steering, fragments: Object.keys(p.fragments).sort(), errors: 0, warnings: warns }
      : { name: e.name, folder: e.folder, valid: false, errors: errs, warnings: warns };
  });
  const lines = [K.listHead(VALID_TRACKS.length, packs.length, packs.filter((p) => p.valid).length)];
  const width = Math.max(8, ...builtIn.map((b) => b.name.length), ...packs.map((p) => p.name.length));
  builtIn.forEach((b) => lines.push("  · " + b.name.padEnd(width) + "  " + (b.marker ? b.marker + "  " + K.sectionCount(b.sections.length) : K.builtIn)));
  packs.forEach((p) => lines.push(p.valid
    ? "  ✎ " + p.name.padEnd(width) + "  " + p.marker + "  " + p.title + " — " + K.sectionCount(p.sections.length) + " · " + K.signalCount(p.signals.strong + p.signals.weak + p.signals.context) + (p.steering ? " · steering/" + p.steering : "")
    : "  ✗ " + p.name.padEnd(width) + "  " + K.invalid(p.errors)));
  if (!reg.entries.length) lines.push(K.noPacks);
  return { ok: true, action: "list", dir: reg.dir || null, lang: lng, builtIn, packs, lines };
}
function checkTrackPacks(reg, name, lng) {
  const K = i18n.msg(lng).trackPacks;
  const problems = reg.problems.filter((p) => !name || p.pack === name).map((p) => localizePackProblem(p, K));
  // Beyond the loader's rules: the criteria each valid pack scaffolds, read by EARS as a feature's requirements would be.
  for (const p of reg.packs.filter((x) => !name || x.name === name)) {
    for (const [l, f] of Object.entries(p.fragments["requirements.md"] || {})) {
      const L = l || lng;
      const ctx = packCtx(p, L, [], []);
      for (const it of f.items) {
        const text = "#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — " + packSubst(it.text, ctx).text + it.sub.map((s) => "\n   " + packSubst(s, ctx).text).join("");
        const e = earsValidate(text, L);
        if (!e.ok) continue;
        for (const i of e.issues) {
          if (i.code !== "no-modal" && i.code !== "vague") continue;
          problems.push({ file: f.rel, severity: "warn", code: "ears-" + i.code, message: i.msg, line: it.line, pack: p.name });
        }
      }
    }
  }
  const errors = problems.filter((x) => x.severity === "error").length;
  const warnings = problems.length - errors;
  const checked = reg.entries.filter((e) => !name || e.name === name).map((e) => ({ name: e.name, folder: e.folder, valid: e.valid && reg.byName.has(e.name) }));
  const lines = [];
  if (!checked.length && !problems.length) lines.push(K.checkNone);
  else {
    lines.push(K.checkHead(checked.length, checked.filter((c) => c.valid).length, errors, warnings));
    problems.forEach((x) => lines.push("  " + (x.severity === "error" ? "✗ " : "▲ ") + x.file + (x.line ? ":" + x.line : "") + " — " + x.message));
  }
  return { ok: true, action: "check", lang: lng, checked, problems, errors, warnings, verdict: errors ? "fail" : warnings ? "warn" : "pass", lines };
}
function initTrackPack(projectDir, name, lang, lng) {
  const K = i18n.msg(lng).trackPacks;
  const n = typeof name === "string" ? name.trim().toLowerCase() : "";
  if (!n) return { ok: false, error: K.nameRequired };
  if (!RE_PACK_NAME.test(n)) return { ok: false, error: K.problems["name-invalid"]({ name: n }) };
  if (packReservedName(n)) return { ok: false, error: K.problems["name-reserved"]({ name: n }) };
  const tdir = path.join(specsRoot(projectDir), TRACK_PACKS_DIR);
  const dir = path.join(tdir, n);
  // A marker no other pack uses: the name in capitals (at most 12), "TRACK"-suffixed when that is a reserved word.
  const taken = new Set(packRegistry().packs.filter((p) => p.name !== n).map((p) => p.token));
  let token = n.toUpperCase().slice(0, 12);
  if (RE_PACK_MARKER_RESERVED.test(token)) token = (token + "TRACK").slice(0, 12);
  for (let i = 2; taken.has(token) && i < 100; i++) token = n.toUpperCase().slice(0, 12 - String(i).length) + i;
  const title = n.charAt(0).toUpperCase() + n.slice(1);
  const a = { name: n, token, title, lang: lng };
  const files = { "track.json": K.initJson(a), "requirements.md": K.initRequirements(a), "tasks.md": K.initTasks(a), "test-plan.md": K.initTestPlan(a),
    "checklist.md": K.initChecklist(a), "steering.md": K.initSteering(a) };
  // Writes stay inside the project: a .specs/ or tracks/ folder that is a link to a folder elsewhere is refused.
  const inside = (abs) => {
    let real;
    try { real = fs.realpathSync.native(projectDir); } catch { return true; }
    let d = path.dirname(abs);
    while (!fs.existsSync(d) && path.dirname(d) !== d) d = path.dirname(d);
    try { return isInsideDir(real, fs.realpathSync.native(d)); } catch { return false; }
  };
  const created = [], kept = [];
  for (const [file, text] of Object.entries(files)) {
    const rel = ".specs/" + TRACK_PACKS_DIR + "/" + n + "/" + file;
    const abs = path.join(dir, file);
    if (!inside(abs)) return { ok: false, error: K.writeOutside(rel), created, kept };
    try {
      if (writeIfAbsent(abs, text)) created.push(rel);
      else kept.push(rel);
    } catch (e) {
      return { ok: false, error: K.writeFailed(rel, e.code || e.message), created, kept };
    }
  }
  const lines = created.length ? [K.initDone(n, created.length), ...created.map((c) => "  + " + c)] : [K.initNothing(n)];
  if (created.length && kept.length) lines.push(K.initKept(kept.join(", ")));
  if (created.length) lines.push(K.initNext(n));
  return { ok: true, action: "init", name: n, marker: "[" + token + "]", dir, lang: lng, created, kept, lines };
}

module.exports = { TRACK_PACKS_DIR, PACK_JSON, PACK_FRAGMENTS, PACK_LIMITS, RE_PACK_NAME, RE_PACK_MARKER,
  RE_PACK_MARKER_RESERVED, RE_PACK_KEYWORD, PACK_KEYS, PACK_SECTION_KEYS, PACK_TIERS, PACK_RESERVED_WORDS,
  packReservedName, RE_PACK_ITEM, RE_TABLE_SEPARATOR, packTextOk, packGuidanceOk, stripJsonComments, packScan,
  readPackItem, packListItems, packTableRows, RE_PACK_VAR, RE_PACK_GUIDANCE_VAR, packSectionKey, coreDesignHeadingKeys,
  packVarRefs, parsePackFragment, packLocalized, PACK_CACHE, loadPack, loadPackScan, loadTrackPacks, NO_PACKS,
  packRegistry, packTracks, packOf, isPackTrack, isPackMarkerBracket, packMarkersFor, noteGhostPacks, ghostMarkers,
  savedPackName, legacyPackName, legacyPackMarkerTrack, TRACK_RESERVED_SINCE, packReservedSince, missingPackTracks,
  packLocal, packTitle, packFragment, packSubst, packCtx, packSubstBasic, packDesignBlock, packRequirementsBlock,
  insertPackRequirements, packPlanRows, packTaskBlock, packTestRowsBlock, packChecklistBlock, packSteeringStub,
  trackSteeringStub, RE_PACK_WILD_VAR, RE_PACK_WILD_VAR_G, PACK_CORPUS_CACHE, packCorpusSets, localizePackProblem,
  trackPacks, listTrackPacks, checkTrackPacks, initTrackPack, __link };
