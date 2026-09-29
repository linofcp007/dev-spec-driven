"use strict";

/**
 * dev-spec-driven engine — scoped steering and steering amendments.
 * Kiro-compatible steering front matter (inclusion modes), the brief's steering, custom steering names, and the
 * 1.16 Q1 steering amendments (what a steering edit after an approval touches).
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const path = require("path");
const i18n = require("../i18n.js");
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let activeTasks, artifactState, day, detectTracks, existingFeature, featureDirs, featureLang, fingerprintMatches,
  headRest, implementsRel, isInsideDir, isObj, isRecord, optionalTracks, placeholderReport, projectLang, quotedValue,
  RE_WIN_RESERVED, readIfExists, safeReaddir, scanTaskLines, specsRoot, stateFromFile, statePath, steeringGlobMatch,
  stripHashComment, taskBlocks, taskMarkers, textFingerprint, toPosix, trackSteeringFiles;
function __link(E) { ({ activeTasks, artifactState, day, detectTracks, existingFeature, featureDirs, featureLang,
  fingerprintMatches, headRest, implementsRel, isInsideDir, isObj, isRecord, optionalTracks, placeholderReport,
  projectLang, quotedValue, RE_WIN_RESERVED, readIfExists, safeReaddir, scanTaskLines, specsRoot, stateFromFile,
  statePath, steeringGlobMatch, stripHashComment, taskBlocks, taskMarkers, textFingerprint, toPosix, trackSteeringFiles } = E); }

// ---------------------------------------------------------------------------
// Scoped steering (Kiro inclusion modes) · guard mode · the design.md save check
// ---------------------------------------------------------------------------

// A custom steering file name: one lowercase .md file straight under .specs/steering/ — no separators, no Windows
// device name (`nul.md` is unusable there), no Object.prototype key (every lookup on these names stays own-key).
const RE_CUSTOM_STEERING = /^[a-z0-9][a-z0-9-]{0,62}\.md$/;
const PROTO_KEYS = new Set(Object.getOwnPropertyNames(Object.prototype).map((k) => k.toLowerCase()));
function customSteeringError(fileName, lng) {
  const fm = i18n.msg(lng);
  const unknown = () => fm.err.unknownSteering(fileName, i18n.steeringKnownFiles().join(", ")) + " " + fm.scopedSteering.customHint;
  if (typeof fileName !== "string" || !RE_CUSTOM_STEERING.test(fileName)) return unknown();
  const stem = fileName.slice(0, -3);
  if (RE_WIN_RESERVED.test(stem) || PROTO_KEYS.has(stem)) return fm.scopedSteering.reservedName(fileName);
  return null;
}
// "api-conventions.md" → "Api Conventions" (the stub's title; the file name is the user's, not localized).
function customSteeringStub(fileName, lng) {
  const title = fileName.slice(0, -3).split("-").filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
  return i18n.msg(lng).scopedSteering.customStub(title, "src/api/**");
}

// Front matter of a steering file (Kiro-compatible keys):
//   ---
//   inclusion: always | fileMatch | manual
//   fileMatchPattern: "src/api/**"        (or a list: ["a/**", "b/**"], or YAML "- a/**" lines)
//   ---
// CRLF, a BOM, quotes and `#` comment lines are tolerated. → { frontMatter, inclusion, patterns, body } — body is
// the text AFTER the front matter (the whole text when there is none). No front matter → inclusion null (the caller
// decides: the brief's default files count as `always`). Front matter without `inclusion` → `always` (Kiro's
// default); an unknown mode (Kiro's `auto` included) → `manual`: never injected silently, listed as available.
function steeringFrontMatter(text) {
  const raw = String(text == null ? "" : text).replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/);
  const none = { frontMatter: false, inclusion: null, patterns: [], body: raw };
  if (!/^---[ \t]*$/.test(lines[0] || "")) return none;
  let end = -1;
  for (let i = 1; i < lines.length && i < 100; i++) if (/^(?:---|\.\.\.)[ \t]*$/.test(lines[i])) { end = i; break; }
  if (end === -1) return none;
  // Only YAML-looking lines (key: value, "- item", comments, blanks, and — once a key was seen — indented
  // continuation lines: a `description: |` block scalar, a nested map) with a key first: a document that merely
  // opens with a '---' rule and has another one further down is prose, not front matter.
  const inner = lines.slice(1, end);
  const isKey = (l) => /^\s*[A-Za-z_][\w-]*\s*:/.test(l);
  const blank = (l) => /^\s*(?:#.*)?$/.test(l);
  const firstKey = inner.findIndex((l) => !blank(l));
  if (firstKey === -1 || !isKey(inner[firstKey]) || !inner.every((l) => blank(l) || isKey(l) || /^\s*-\s+\S/.test(l) || /^\s+\S/.test(l))) return none;
  // Keys live at the first key's indentation; deeper lines are continuations (a block scalar's `inclusion: x`
  // text must not set the mode). List items under an empty fileMatchPattern stay items at any indentation.
  const keyIndent = inner[firstKey].match(/^\s*/)[0].length;
  // 'x' / "x" → x; a trailing " # comment" is dropped (inside quotes a '#' is kept).
  const unquote = (v) => {
    const s = String(v).trim();
    const q = quotedValue(s);
    return (q != null ? q : stripHashComment(s)).trim();
  };
  // "[a, 'b', "{c,d}/**"]" → items; commas inside quotes or {braces} don't split.
  const values = (v) => {
    const s = String(v).trim().replace(/^(\[.*\])\s+#.*$/, "$1");
    if (!(s.startsWith("[") && s.endsWith("]"))) return [unquote(s)].filter(Boolean);
    const out = [];
    let cur = "", q = null, depth = 0;
    for (const c of s.slice(1, -1)) {
      if (q) { if (c === q) q = null; cur += c; continue; }
      if (c === '"' || c === "'") q = c;
      else if (c === "{") depth++;
      else if (c === "}" && depth) depth--;
      else if (c === "," && !depth) { out.push(cur); cur = ""; continue; }
      cur += c;
    }
    out.push(cur);
    return out.map(unquote).filter(Boolean);
  };
  let inclusion = null;
  const patterns = [];
  let inList = false; // under "fileMatchPattern:" with an empty value → YAML "- item" lines follow
  for (const line of lines.slice(1, end)) {
    if (/^\s*(?:#|$)/.test(line)) continue;
    const item = inList && headRest(line, /^\s*-/, true); // /^\s*-\s+(.*)$/ (headRest: 1.17 H)
    if (item) { patterns.push(...values(item[1])); continue; }
    inList = false;
    if (line.match(/^\s*/)[0].length > keyIndent) continue; // a continuation line, not a key
    const kv = headRest(line, /^\s*([A-Za-z_][\w-]*)\s*:/, false); // /^\s*([A-Za-z_][\w-]*)\s*:\s*(.*)$/
    if (!kv) continue;
    const key = kv[1].toLowerCase();
    if (key === "inclusion") {
      const v = unquote(kv[2]).toLowerCase();
      inclusion = v === "always" ? "always" : v === "filematch" ? "fileMatch" : "manual";
    } else if (key === "filematchpattern" || key === "filematchpatterns") {
      if (kv[2].trim()) patterns.push(...values(kv[2]));
      else inList = true;
    }
  }
  return { frontMatter: true, inclusion: inclusion || "always", patterns: [...new Set(patterns)], body: lines.slice(end + 1).join("\n").replace(/^\s*\n/, "") };
}

const BRIEF_STEERING_BUDGET = 3000; // chars of scoped (fileMatch) steering quoted into one brief
// The steering a task brief carries. Default files (constitution/tech/structure + the active tracks' files) count
// as `always` while they have no front matter — the pre-1.13 behaviour; with front matter every file follows its
// own mode: `always` → listed, `fileMatch` → listed when a pattern matches one of the task's _Implements:_ paths
// (and its body quoted, front matter stripped, when it holds real content and fits the budget), `manual` (or a
// fileMatch without a pattern) → listed as available on request. Other files without front matter stay out.
function briefSteering(root, tracks, implementsList) {
  const dir = path.join(root, "steering");
  const defaults = ["constitution.md", "tech.md", "structure.md"]
    .concat(...optionalTracks().filter((t) => tracks.includes(t)).map((t) => trackSteeringFiles(t)));
  const names = safeReaddir(dir).filter((n) => /\.md$/i.test(n)).sort();
  const ordered = defaults.filter((n) => names.includes(n)).concat(names.filter((n) => !defaults.includes(n)));
  // _Implements:_ paths as trace_check / coverage read them (backticks and anchors dropped; an absolute path inside
  // the project → its project-relative path, outside → nothing); a folder also matches "dir/**".
  const pdir = path.dirname(path.resolve(root));
  const targets = (implementsList || []).map((r) => {
    const p = implementsRel(r);
    if (!path.isAbsolute(p)) return p;
    const abs = path.resolve(p);
    return abs !== pdir && isInsideDir(pdir, abs) ? toPosix(path.relative(pdir, abs)) : "";
  }).filter(Boolean);
  const included = [];
  const manual = [];
  let budget = BRIEF_STEERING_BUDGET;
  for (const name of ordered) {
    const text = readIfExists(path.join(dir, name));
    if (text == null) continue; // a directory named *.md, an unreadable file
    const fm = steeringFrontMatter(text);
    const inclusion = fm.frontMatter ? fm.inclusion : defaults.includes(name) ? "always" : null;
    if (inclusion === "always") included.push({ name, inclusion });
    else if (inclusion === "fileMatch" && fm.patterns.length) {
      const matched = targets.filter((t) => fm.patterns.some((p) => steeringGlobMatch(p, t) || steeringGlobMatch(p, t + "/")));
      if (!matched.length) continue;
      // Template guidance quoted into a brief would read as a binding rule: HTML comments (the stub's guidance)
      // never reach the brief, and only real content is quoted. Read as a markdown reader does (scanTaskLines'
      // `vis`) — a plain regex strip also ate a "<!-- -->" inside fenced code or an `inline code span`, so a
      // rule about comments was quoted saying something else.
      // (?<![ \t]): a blank run is read from its start only — from each of its units it was quadratic (1.17 H).
      const body = scanTaskLines(fm.body).map((l) => l.vis).join("\n").replace(/(?<![ \t])(?:[ \t]*\n){3,}/g, "\n\n").trim();
      const quote = body && artifactState({ text: body }) === "filled" && body.length <= budget;
      if (quote) budget -= body.length;
      included.push({ name, inclusion, patterns: fm.patterns, matched, body: quote ? body : null });
    } else if (inclusion === "manual" || inclusion === "fileMatch") manual.push(name);
  }
  return { dir, included, manual };
}

// Steering files still holding template placeholders (their body — front matter set aside — is a template: a
// bracketed placeholder or `> **TODO**` left, headings only, or a known stub verbatim in any language).
function steeringPlaceholders(root) {
  const dir = path.join(root, "steering");
  const out = [];
  for (const name of safeReaddir(dir).filter((n) => /\.md$/i.test(n)).sort()) {
    const text = readIfExists(path.join(dir, name));
    if (text == null) continue;
    const body = steeringFrontMatter(text).body;
    const templates = i18n.LANGS.map((l) => i18n.steeringStub(name, l)).filter(Boolean);
    if (artifactState({ text: body }, { template: templates }) === "placeholder") out.push({ file: name, placeholders: placeholderReport(body).length });
  }
  return out;
}

// --- Q1: steering amendments ---
// A requirements / design approval records `steering` {file: fingerprint} (on approvals[phase] and its history record): the
// steering files that governed it — constitution.md, the active tracks' steering files (a track pack's too), every file whose
// front matter says `inclusion: always`, and every `fileMatch` file with its patterns (`steeringMatch` {file: [patterns]}) — such
// a file counts only while an _Implements:_ path of the feature's CURRENT active tasks matches it (1.16 Q review: requirements
// and design are approved before tasks.md names any file). Only those few files are hashed (fingerprintText: BOM / CRLF are encoding), never the tree. A recorded file
// that changed or was removed since → doctor warns steering-changed-since-approval, next_action adds a re-review hint (never a
// block), spec_impact {phase: "steering"} lists every active feature concerned. Re-approving the phase records the current
// steering. An approval made before 1.16 (no `steering`) is never flagged — spec_impact lists it as `untracked`.
const STEERING_GOVERNED = ["requirements", "design"];
// A recorded steering name: one .md file straight under .specs/steering/ (a hand-edited state never reads elsewhere).
const safeSteeringName = (n) => typeof n === "string" && /^[^\\/:*?"<>|\u0000-\u001f]{1,120}\.md$/i.test(n) && !n.startsWith(".") && !n.includes("..");
// → [{ file, patterns? }]. EVERY fileMatch file is recorded, with its patterns (1.16 Q review: requirements / design are approved
// while tasks.md is still the template — no _Implements:_ yet — so matching at approval time recorded none of them);
// steeringChanges counts one only while the feature's CURRENT _Implements:_ paths match its patterns.
const STEERING_MAX_PATTERNS = 20;
function governingSteering(root, dir, tracks) {
  const sdir = path.join(root, "steering");
  const names = safeReaddir(sdir).filter(safeSteeringName).sort();
  if (!names.length) return [];
  const always = new Set(["constitution.md", ...optionalTracks().filter((t) => tracks.includes(t)).flatMap((t) => trackSteeringFiles(t))]);
  const out = [];
  for (const n of names) {
    const text = readIfExists(path.join(sdir, n));
    if (text == null) continue; // a folder named *.md, an unreadable file
    if (always.has(n)) { out.push({ file: n }); continue; }
    const fm = steeringFrontMatter(text);
    if (!fm.frontMatter) continue; // no front matter: not in the governing set (the brief's rule for non-default files)
    if (fm.inclusion === "always") out.push({ file: n });
    else if (fm.inclusion === "fileMatch" && fm.patterns.length) out.push({ file: n, patterns: fm.patterns.slice(0, STEERING_MAX_PATTERNS) });
  }
  return out;
}
// Does one of these _Implements:_ paths match one of these fileMatch patterns?
const steeringTargetsMatch = (targets, patterns) => targets.some((t) => patterns.some((p) => typeof p === "string" && (steeringGlobMatch(p, t) || steeringGlobMatch(p, t + "/"))));
// The project-relative _Implements:_ paths of a feature's active tasks (template slots and absolute paths left out).
function featureImplementsTargets(dir, tracks) {
  const out = new Set();
  for (const b of taskBlocks(activeTasks(readIfExists(path.join(dir, "tasks.md")) || "", tracks) || "")) {
    for (const r of taskMarkers(b).implements) {
      const p = implementsRel(r);
      if (p && !path.isAbsolute(p) && !/^\[.*\]$/.test(p)) out.add(p);
    }
  }
  return [...out];
}
// → { <file>: fingerprint } of the governing steering files ({} when there is none — still a 1.16 approval). opts.match: also
// → { steering, steeringMatch: { <fileMatch file>: [patterns] } } (what approvePhase records).
function steeringFingerprints(root, dir, tracks, opts = {}) {
  const out = {}, match = {};
  for (const g of governingSteering(root, dir, tracks)) {
    const raw = readIfExists(path.join(root, "steering", g.file));
    if (raw == null) continue;
    out[g.file] = textFingerprint(raw, "steering");
    if (g.patterns) match[g.file] = g.patterns;
  }
  return opts.match ? { steering: out, steeringMatch: match } : out;
}
// The recorded steering of the requirements / design approvals that no longer matches → [{ phase, approvedAt, files: [{ file,
// change: "modified" | "removed" }] }] (stable codes). Approvals without `steering` (before 1.16) are skipped. A file the
// approval recorded as fileMatch (`steeringMatch`) counts only while the feature's CURRENT _Implements:_ paths (dir, tracks)
// match its recorded patterns or, when it is still a fileMatch file, its current ones; an approval recorded before that
// (no `steeringMatch`) counts every file it recorded.
function steeringChanges(root, approvals, dir, tracks) {
  const out = [];
  if (!isObj(approvals)) return out;
  let targets = null; // the feature's _Implements:_ paths — read once, only for a fileMatch file that changed
  for (const p of STEERING_GOVERNED) {
    const a = approvals[p];
    if (!isRecord(a) || !isObj(a.steering)) continue;
    const match = isObj(a.steeringMatch) ? a.steeringMatch : {};
    const files = [];
    for (const [file, fp] of Object.entries(a.steering)) {
      if (!safeSteeringName(file) || typeof fp !== "string") continue;
      const raw = readIfExists(path.join(root, "steering", file));
      const change = raw == null ? "removed" : !fingerprintMatches(raw, "steering", fp) ? "modified" : null;
      if (!change) continue;
      const now = raw == null || !Array.isArray(match[file]) ? null : steeringFrontMatter(raw);
      if (Array.isArray(match[file]) && dir && !(now && now.inclusion === "always")) { // turned `always`: it governs every feature now
        if (targets === null) targets = featureImplementsTargets(dir, tracks || ["core"]);
        const patterns = match[file].concat(now && now.inclusion === "fileMatch" ? now.patterns : []);
        if (!steeringTargetsMatch(targets, patterns)) continue; // a fileMatch file this feature's files don't match: not its steering
      }
      files.push({ file, change });
    }
    if (files.length) out.push({ phase: p, approvedAt: typeof a.at === "string" ? a.at : null, files });
  }
  return out;
}
// "requirements (approved 2026-09-01): constitution.md (changed); design (…): …" — doctor's and the CLI's wording.
function steeringChangeText(changes, lng) {
  const Q = i18n.msg(lng).quality;
  return changes.map((c) => Q.steeringItem(c.phase, day(c.approvedAt) || "?", c.files.map((x) => `${x.file} (${Q.steeringChange[x.change] || x.change})`).join(", "))).join("; ");
}
// spec_impact {phase: "steering", name?} / `dev-spec impact [feature] --phase steering`: the active features (or the one named)
// whose requirements / design approval was made under an older version of a steering file that changed since. Read-only:
// nothing is reopened (reopen is refused). → { phase, lang, scope: project | feature, feature?, changed, files, features:
// [{ feature, approvals: [{ phase, approvedAt, files }] }], untracked: [{ feature, phases }] (approved before 1.16), unreadable? }
function steeringImpact(projectDir, name, opts = {}) {
  const named = name != null && String(name).trim() !== "";
  let feats, lng, slug = null;
  if (named) {
    const f = existingFeature(projectDir, name);
    if (!f.ok) return { ok: false, error: f.error };
    feats = [{ slug: f.slug, dir: f.dir }];
    slug = f.slug;
    lng = featureLang(projectDir, f.slug);
  } else {
    feats = featureDirs(projectDir).filter((s) => !s.archived);
    lng = projectLang(projectDir);
  }
  const Q = i18n.msg(lng).quality;
  if (opts.reopen === true) return { ok: false, error: Q.impactNoReopen };
  const root = specsRoot(projectDir);
  const features = [], untracked = [], unreadable = [];
  const files = new Set();
  for (const s of feats) {
    const st = stateFromFile(projectDir, statePath(s.dir));
    if (st.invalid) { unreadable.push(s.slug); continue; }
    const approvals = isObj(st.approvals) ? st.approvals : {};
    const legacy = STEERING_GOVERNED.filter((p) => isRecord(approvals[p]) && !isObj(approvals[p].steering));
    if (legacy.length) untracked.push({ feature: s.slug, phases: legacy });
    const changes = steeringChanges(root, approvals, s.dir, detectTracks(s.dir));
    if (!changes.length) continue;
    features.push({ feature: s.slug, approvals: changes });
    for (const c of changes) for (const x of c.files) files.add(x.file);
  }
  const res = { ok: true, phase: "steering", lang: lng, scope: named ? "feature" : "project" };
  if (slug) res.feature = slug;
  Object.assign(res, { changed: features.length > 0, files: [...files].sort(), features, untracked });
  if (unreadable.length) res.unreadable = unreadable;
  if (features.length) res.hint = Q.impactReReview(features[0].feature, features[0].approvals[0].phase);
  return res;
}
function steeringImpactLines(r) {
  const Q = i18n.msg(r.lang).quality;
  const out = [Q.impactHead(r.features.length, r.scope === "feature" ? r.feature : null)];
  for (const f of r.features) out.push(`  ${f.feature} — ${steeringChangeText(f.approvals, r.lang)}`);
  if (r.untracked.length) out.push("  " + Q.impactUntracked(r.untracked.map((u) => `${u.feature} (${u.phases.join(", ")})`).join(", ")));
  if (r.unreadable && r.unreadable.length) out.push("  " + Q.impactUnreadable(r.unreadable.join(", ")));
  if (r.hint) out.push("  → " + r.hint);
  return out;
}

module.exports = { RE_CUSTOM_STEERING, PROTO_KEYS, customSteeringError, customSteeringStub, steeringFrontMatter,
  BRIEF_STEERING_BUDGET, briefSteering, steeringPlaceholders, STEERING_GOVERNED, safeSteeringName,
  STEERING_MAX_PATTERNS, governingSteering, steeringTargetsMatch, featureImplementsTargets, steeringFingerprints,
  steeringChanges, steeringChangeText, steeringImpact, steeringImpactLines, __link };
