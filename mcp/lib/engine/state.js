"use strict";

/**
 * dev-spec-driven engine — feature resolution, .state.json and fingerprints.
 * Language resolution (project / feature), the feature resolver every name-taking operation goes through
 * (resolveFeature / existingFeature), .state.json reads, the phases and their artifacts, content fingerprints.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const i18n = require("../i18n.js");
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let existsCached, isDirSafe, isObj, jsonRel, readIfExists, readJson, roadmapLang, safeReaddir, shapeError, specsRoot;
function __link(E) { ({ existsCached, isDirSafe, isObj, jsonRel, readIfExists, readJson, roadmapLang, safeReaddir,
  shapeError, specsRoot } = E); }

// Language resolution. The project's language is the single source of truth, persisted in
// .specs/roadmap.json meta.lang (seeded by spec_init); each feature may override it via
// .specs/<feature>/.state.json lang. spec.js resolves the lang and hands it to i18n builders.
const normalizeLang = i18n.normalizeLang;
function projectLang(projectDir) {
  return normalizeLang(roadmapLang(projectDir)); // roadmapLang reads meta.lang (hoisted below)
}
function featureLang(projectDir, name) {
  const st = readState(projectDir, name); // readState is hoisted below
  return normalizeLang(st.lang || projectLang(projectDir));
}
// Localized engine errors: the feature's language when there is one, else the project's.
function errs(projectDir, slug) {
  return i18n.msg(slug ? featureLang(projectDir, slug) : projectLang(projectDir)).err;
}

function slugify(name) {
  if (name == null) return ""; // never "undefined" — a missing name must not become a folder
  return String(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // transliterate: "Autenticação" → "autenticacao" (not "autentica-o")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, 64)
    .replace(/-+$/, "");
}

// Pre-1.11 slug (accents dropped as separators). Only used to keep finding folders created back then.
function legacySlugify(name) {
  if (name == null) return "";
  return String(name).trim().toLowerCase().replace(/['"]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+/, "").slice(0, 64).replace(/-+$/, "");
}

// Windows reserves these device names in every directory (`.specs\nul\` is unusable from most tools).
const RE_WIN_RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)$/;
const RESERVED_SLUGS = new Set(["steering", "exports", "templates", "tracks"]); // folders under .specs/ that are not features (1.14: exports/ holds spec_export's documents, templates/ the project's templates; 1.15: tracks/ the project's track packs)
// Is this folder name under `root` (.specs/ or .specs/_archive/) reserved? "steering" always; "templates" / "exports" (1.14) and
// "tracks" (1.15 — the track packs) unless that folder is a FEATURE created before them — it holds a .state.json: it stays a feature (listed,
// reachable, renameable) and is never read as templates (templateFileList), so an upgrade never turns a filled spec into
// every new feature's scaffold.
function reservedSlug(name, root) {
  const s = String(name).toLowerCase();
  if (!RESERVED_SLUGS.has(s)) return false;
  return !((s === "templates" || s === "exports" || s === "tracks") && root && existsCached(statePath(path.join(root, s))));
}

// Every name-taking operation resolves its folder HERE. An empty slug ("日本語", "...", undefined) used to
// make path.join(root, "") === .specs itself, so `spec_feature remove` wiped every spec.
function resolveFeature(projectDir, name) {
  const root = specsRoot(projectDir);
  const slug = slugify(name);
  const E = () => errs(projectDir); // only on a refusal: the project language costs a roadmap.json read
  if (!slug) return { ok: false, slug, root, error: E().noUsableName(name == null ? "" : name) };
  if (reservedSlug(slug, root)) return { ok: false, slug, root, error: E().reserved(slug) };
  // Windows device names: refuse new ones, but an existing folder of that name (created on another OS)
  // must stay reachable so it can be renamed away. Check the real listing — on Windows existsSync("con")
  // can report the device.
  if (RE_WIN_RESERVED.test(slug) && !safeReaddir(root).includes(slug)) return { ok: false, slug, root, error: E().reservedWin(slug) };
  const dir = path.join(root, slug);
  if (!existsCached(dir)) {
    const legacy = legacySlugify(name);
    if (legacy && legacy !== slug && !reservedSlug(legacy, root) && existsCached(path.join(root, legacy))) {
      return { ok: true, slug: legacy, dir: path.join(root, legacy), root };
    }
  }
  return { ok: true, slug, dir, root };
}
// resolveFeature + "must exist".
function existingFeature(projectDir, name) {
  const f = resolveFeature(projectDir, name);
  if (f.ok && !existsCached(f.dir)) {
    // An archived feature is not an active one — but "not found" alone sent the user nowhere (drift's finish-it-again line
    // for an archived feature used to end right here): name the archive and the restore.
    const E = errs(projectDir);
    const arch = locateFeatures(projectDir, name).find((x) => x.archived);
    return { ...f, ok: false, error: E.notFound(f.slug, f.root) + (arch ? " " + E.archivedHint(arch.slug) : "") };
  }
  return f;
}

// A folder name a feature command can address (current or pre-1.11 slug). `.obsidian`, `My Notes/` are not
// features: they used to list as 0% features that no command could reach or remove. A case-only difference
// ("Billing/") is addressable on a case-insensitive filesystem (Windows, macOS): 'billing' resolves to it, so
// it stays listed — but only when it IS the folder that slug reaches (never beside a real "billing/").
function isFeatureFolder(name, root) {
  if (name.startsWith(".") || name.startsWith("_") || reservedSlug(name, root)) return false;
  if (slugify(name) === name) return true;
  if (!root || slugify(name) !== name.toLowerCase()) return false;
  try {
    return fs.realpathSync.native(path.join(root, name.toLowerCase())) === fs.realpathSync.native(path.join(root, name));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// State & approval gates (.state.json)
// ---------------------------------------------------------------------------

const PHASES = ["classification", "requirements", "design", "test-plan", "eval-plan", "tests", "tasks", "execution"];

function statePath(dir) {
  return path.join(dir, ".state.json");
}

function readState(projectDir, name) {
  const f = resolveFeature(projectDir, name);
  if (!f.ok) return { approvals: {} };
  return stateFromFile(projectDir, statePath(f.dir));
}
// The same read + shape check for a state file at a known path (an archived feature's .state.json too).
function stateFromFile(projectDir, file) {
  const j = readJson(file);
  if (j.error) return { approvals: {}, invalid: i18n.msg(projectLang(projectDir)).err.invalidJson(j.errorRel, j.errorDetail) };
  // Valid JSON of the wrong shape is refused like unparseable JSON — an `approvals` ARRAY silently dropped
  // every approval on the next write. Readers get the valid parts (lang kept); mutators check `invalid`.
  const problems = [];
  if (j.exists && !isObj(j.data)) problems.push(["topLevel"]);
  const s = isObj(j.data) ? j.data : {};
  for (const [key, ok] of [["approvals", isObj], ["evidence", isObj], ["tracks", Array.isArray], ["finishChecks", isObj], ["signoffs", isObj]]) { // finishChecks: project check runs; signoffs: role sign-offs
    if (s[key] !== undefined && !ok(s[key])) { problems.push([key]); delete s[key]; }
  }
  // The change history (approvePhase / spec_impact append to these lists): a non-list would be replaced by the next append.
  for (const key of ["approvalHistory", "changes", "unticks"]) if (s[key] !== undefined && !Array.isArray(s[key])) { problems.push([key]); delete s[key]; } // unticks: 1.16 U1 (undone ticks)
  s.approvals = s.approvals || {};
  if (problems.length) s.invalid = shapeError(typeof s.lang === "string" ? s.lang : projectLang(projectDir), jsonRel(file), problems);
  return s;
}

// The artifact each approvable phase signs off, and a content fingerprint recorded at approval so a
// later edit is detected by CONTENT, not mtime (ticking a task checkbox is progress, not a spec edit).
const PHASE_FILE = { classification: "classification.md", requirements: "requirements.md", design: "design.md", "test-plan": "test-plan.md", "eval-plan": "eval-plan.md", tasks: "tasks.md" };
function artifactFingerprint(file, phase) {
  const raw = readIfExists(file);
  return raw == null ? null : textFingerprint(raw, phase);
}
// The same fingerprint from text (an approval snapshot is compared by it too).
// A leading BOM is encoding, not content (like CRLF): an editor or Windows PowerShell 5.1 re-saving an approved
// artifact as "UTF-8 with BOM" must not read as changed-since-approval (it blocked spec_finish while spec_impact
// showed nothing changed).
function textFingerprint(raw, phase) {
  return sha1Hex(fingerprintText(raw, phase));
}
function fingerprintText(raw, phase) {
  const text = String(raw).replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  return phase === "tasks" ? uncheckTasks(text) : text;
}
const sha1Hex = (text) => require("crypto").createHash("sha1").update(text).digest("hex");
// Does this text still match a fingerprint an approval recorded? An approval recorded before the BOM was ignored
// hashed the file with its BOM: that fingerprint still matches the same content (with or without the BOM now).
function fingerprintMatches(raw, phase, stored) {
  if (raw == null || typeof stored !== "string" || !stored) return false;
  const text = fingerprintText(raw, phase);
  return sha1Hex(text) === stored || sha1Hex(BOM_CHAR + text) === stored;
}
const BOM_CHAR = String.fromCharCode(0xfeff);
const artifactMatches = (file, phase, stored) => fingerprintMatches(readIfExists(file), phase, stored);
// Checkbox state is not content. The indent is read within its line ([^\S\n\r\u2028\u2029], not \s): from each line start of a
// long blank run \s* rescanned the whole run (1.17 H) — the lines above keep their text either way ($1 puts it back).
const uncheckTasks = (text) => text.replace(/^([^\S\n\r\u2028\u2029]*-\s*\[)[xX](\])/gm, "$1 $2");
// The artifact a phase's approval signs off: a bugfix has no design of its own — its design approval signs off bug.md
// (the Root Cause the gate checks). approvePhase records it as `file` on the approval, so changedSinceApproval
// compares the right file (an approval without `file` signed off PHASE_FILE's, as before).
const phaseFile = (phase, kind) => (phase === "design" && kind === "bugfix" ? "bug.md" : PHASE_FILE[phase]);

// Every feature folder, active first, then archived (.specs/_archive/<slug>/) — the same addressability rule as
// listFeatures, without its per-feature phase work (the SessionStart drift check runs on this). → [{ slug, dir, archived }]
function featureDirs(projectDir) {
  const root = specsRoot(projectDir);
  const dirsIn = (base) => {
    try {
      return fs.readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory() && isFeatureFolder(d.name, base)).map((d) => d.name).sort();
    } catch {
      return [];
    }
  };
  const archRoot = path.join(root, "_archive");
  return dirsIn(root).map((n) => ({ slug: n, dir: path.join(root, n), archived: false }))
    .concat(dirsIn(archRoot).map((n) => ({ slug: n, dir: path.join(archRoot, n), archived: true })));
}

// The existing folders a name reaches — active and/or archived (current or pre-1.11 slug). → [{ slug, dir, archived }]
function locateFeatures(projectDir, name) {
  const root = specsRoot(projectDir);
  const slugs = [...new Set([slugify(name), legacySlugify(name)])].filter((s) => s && !reservedSlug(s, root));
  const out = [];
  for (const [base, archived] of [[root, false], [path.join(root, "_archive"), true]]) {
    const s = slugs.find((x) => isFeatureFolder(x, base) && isDirSafe(path.join(base, x)));
    if (s) out.push({ slug: s, dir: path.join(base, s), archived });
  }
  return out;
}

module.exports = { normalizeLang, projectLang, featureLang, errs, slugify, legacySlugify, RE_WIN_RESERVED,
  RESERVED_SLUGS, reservedSlug, resolveFeature, existingFeature, isFeatureFolder, PHASES, statePath, readState,
  stateFromFile, PHASE_FILE, artifactFingerprint, textFingerprint, fingerprintText, sha1Hex, fingerprintMatches,
  BOM_CHAR, artifactMatches, uncheckTasks, phaseFile, featureDirs, locateFeatures, __link };
