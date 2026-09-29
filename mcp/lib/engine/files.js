"use strict";

/**
 * dev-spec-driven engine — paths, atomic writes and the read cache.
 * Project and .specs/ paths, create-only and atomic writes, JSON reads, the per-call read cache (withReadCache: one
 * read per file per engine call — the engine's writers keep it true) and the path-containment helpers (inside the
 * project, drive roots, 8.3 names / junctions, network paths).
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const i18n = require("../i18n.js");
const { CTX } = require("./ctx.js"); // the shared per-call state (mutated in place)

// ---------------------------------------------------------------------------
// Paths & small fs helpers
// ---------------------------------------------------------------------------

function resolveProjectDir(arg) {
  const usable = (v) => v != null && String(v).trim() && !/^\$\{[^}]*\}$/.test(String(v).trim()) ? String(v).trim() : null;
  const dir = usable(arg) || usable(process.env.SPEC_PROJECT_DIR) || usable(process.env.CLAUDE_PROJECT_DIR) || process.cwd();
  return path.resolve(dir);
}

function specsRoot(projectDir) {
  // Always use `.specs/` at the project root.
  const root = path.join(projectDir, ".specs");
  // The project this engine call works in: its .specs/templates/ join the placeholder corpus (projectTemplateSets).
  if (CTX.READ_CACHE) CTX.TEMPLATE_SCOPE_ROOT = root;
  return root;
}

function ensureDir(p) {
  forgetCached(p, { dir: true });
  fs.mkdirSync(p, { recursive: true });
}

function writeIfAbsent(file, content) {
  forgetCached(file);
  ensureDir(path.dirname(file));
  try {
    fs.writeFileSync(file, content, { encoding: "utf8", flag: "wx" }); // atomic "create only" — never clobbers
    return true;
  } catch (e) {
    if (e.code === "EEXIST") return false;
    throw e;
  }
}

// Replace a file without a torn intermediate state: a concurrent reader (hook + MCP tool) sees the old
// content or the new one, never an empty/half-written file.
// The temp file NEVER outlives the call: when the rename and the plain-write fallback both fail (a read-only or
// locked target on Windows, a folder where the file should be) the error is thrown with the temp file already
// removed — the best-effort roadmap/catalog refreshes and the hook swallow it, and they used to leave one
// full-size `<file>.<pid>.<ts>.tmp` in the committed .specs/ per call. On Windows a brief lock (a scanner, an
// indexer, a preview pane) is retried a few times first.
const RENAME_RETRY_MS = [5, 15, 40];
const RENAME_RETRY_CODES = new Set(["EPERM", "EACCES", "EBUSY"]);
function writeFileAtomic(file, content) {
  forgetCached(file);
  ensureDir(path.dirname(file));
  const tmp = file + "." + process.pid + "." + Date.now() + ".tmp";
  let moved = false;
  try {
    fs.writeFileSync(tmp, content, "utf8");
    for (let attempt = 0; ; attempt++) {
      try {
        fs.renameSync(tmp, file);
        moved = true;
        break;
      } catch (e) {
        if (process.platform !== "win32" || attempt >= RENAME_RETRY_MS.length || !RENAME_RETRY_CODES.has(e.code)) break;
        sleepSync(RENAME_RETRY_MS[attempt]);
      }
    }
    if (!moved) fs.writeFileSync(file, content, "utf8"); // still locked / read-only: a plain write (may throw)
  } finally {
    if (!moved) try { fs.unlinkSync(tmp); } catch { /* never created, or already gone */ }
  }
}

// Synchronous sleep (the engine is synchronous end to end): blocks this thread only, no busy loop.
const SLEEP_CELL = new Int32Array(new SharedArrayBuffer(4));
function sleepSync(ms) {
  Atomics.wait(SLEEP_CELL, 0, 0, ms);
}

// JSON state (.specs/roadmap.json, .specs/<feature>/.state.json). A file that EXISTS but doesn't parse
// is never treated as empty — the next write would silently erase deps/backlog/approvals/lang. A
// leading BOM (Windows editors) is tolerated.
function readJson(file) {
  const raw = readIfExists(file);
  if (raw == null) return { exists: false, data: null, error: null };
  try {
    return { exists: true, data: JSON.parse(raw.replace(/^\uFEFF/, "")), error: null };
  } catch (e) {
    const rel = jsonRel(file);
    return { exists: true, data: null, error: `${rel} is not valid JSON (${e.message}) — fix it by hand; refusing to overwrite it.`, errorRel: rel, errorDetail: e.message };
  }
}

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
// ".specs/roadmap.json" / "<feature>/.state.json" — the same relative name readJson() reports.
function jsonRel(file) {
  return path.relative(path.dirname(path.dirname(file)), file).split(path.sep).join("/"); // same on every OS
}
// Localized "valid JSON, wrong shape" error from [code, key?] problems (codes = i18n jsonShape keys).
function shapeError(lang, rel, problems) {
  const S = i18n.msg(lang).jsonShape;
  return S.invalid(rel, problems.map(([code, key]) => (typeof S[code] === "function" ? S[code](key) : S[code])).join("; "));
}

// One read per file per computation: the roadmap refresh (run by every mutator and the hook) and the checks (doctor,
// next_action, trace, the catalog) read each feature's artifacts and .state.json from many helpers — the same file up to
// six times, and on Windows a read costs ~1 ms (the scanner opens every file). withReadCache(fn) serves repeats from
// memory while fn runs, and only then: the cache lives for ONE call (never across MCP calls — nothing can go stale
// between them). Inside it every engine write keeps it true: writeFileAtomic / writeIfAbsent / ensureDir drop the entry
// of what they write (and the "exists" answers of its folders), and a raw write — a moved or removed folder, an in-place
// edit — clears the whole cache (invalidateReadCache). Nested scopes share the outer one. Keys are resolved paths,
// case-folded where the file system folds case, so two spellings of one file can't hold two different texts.
// The same scope memoizes the folder listings walkProject reads and the files each _Implements:_ glob matches
// (globFiles): trace_check runs several times in one call (finish → trace + doctor → trace; next_action; approve's
// checks) and a `**` glob walks the whole tree. A written file drops every listing above it and every glob whose walk
// could see it (forgetCached); a created folder alone adds no file, so it leaves the globs alone.
function withReadCache(fn) {
  if (CTX.READ_CACHE) return fn();
  CTX.READ_CACHE = new Map();
  CTX.GLOB_CACHE = new Map();
  CTX.XAC_MEMO = null;
  CTX.TEMPLATE_SCOPE_ROOT = null; // the call's project (specsRoot) and its parsed templates live as long as the scope
  CTX.TEMPLATE_MEMO = null;
  CTX.PACK_MEMO = null; // … and its track packs (1.15)
  CTX.GHOST_MARKERS = null;
  try {
    return fn();
  } finally {
    CTX.READ_CACHE = null;
    CTX.GLOB_CACHE = null;
    CTX.XAC_MEMO = null;
    CTX.TEMPLATE_SCOPE_ROOT = null;
    CTX.TEMPLATE_MEMO = null;
    CTX.PACK_MEMO = null;
    CTX.GHOST_MARKERS = null;
  }
}
const readCacheKey = (p) => { const r = path.resolve(String(p)); return FOLD_CASE ? r.toLowerCase() : r; };
const EXISTS_KEY = "\u0000exists:";
const DIR_KEY = "\u0000dir:";
// A spec file whose CONTENT is copied out — decisions.md (appended and rewritten), the export's documents, the release notes —
// must be a regular file whose real path stays inside the project's .specs/: a committed symlink out (decisions.md ->
// ~/.ssh/id_rsa) is never followed (the specs:// resources refuse it the same way). Absent → true (nothing to follow).
// Within a read-cache scope the verdict is memoized per file and the root's real path per root (1.16 Q review: the cross-feature
// criteria and supersededByIndex read every requirements.md in one call — two real-path walks per file were a third of it).
const CONTAINED_KEY = "\u0000contained:";
function specsFileContained(projectDir, file) {
  const k = CTX.READ_CACHE ? CONTAINED_KEY + readCacheKey(file) : null;
  if (k !== null && CTX.READ_CACHE.has(k)) return CTX.READ_CACHE.get(k);
  const v = specsFileContainedNow(projectDir, file);
  if (k !== null) CTX.READ_CACHE.set(k, v);
  return v;
}
function specsFileContainedNow(projectDir, file) {
  let st;
  try { st = fs.lstatSync(file); } catch { return true; }
  if (st.isSymbolicLink() || !st.isFile()) return false;
  try {
    const root = specsRoot(projectDir);
    const rk = CTX.READ_CACHE ? CONTAINED_KEY + "root:" + readCacheKey(root) : null;
    let realRoot = rk !== null ? CTX.READ_CACHE.get(rk) : undefined;
    if (realRoot === undefined) { realRoot = fs.realpathSync.native(root); if (rk !== null) CTX.READ_CACHE.set(rk, realRoot); }
    const real = fs.realpathSync.native(file);
    return real !== realRoot && withinRoot(realRoot, real);
  } catch {
    return false;
  }
}
// readIfExists for such a file: null when it is not contained (skipped, as if absent).
function readContained(projectDir, file) {
  return specsFileContained(projectDir, file) ? readIfExists(file) : null;
}
function readIfExists(file) {
  const k = CTX.READ_CACHE ? readCacheKey(file) : null;
  if (k !== null && CTX.READ_CACHE.has(k)) return CTX.READ_CACHE.get(k);
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    text = null;
  }
  if (k !== null) CTX.READ_CACHE.set(k, text);
  return text;
}
// fs.existsSync, served from the same scope (the per-feature file probes of listFeatures / detectPhase / detectTracks).
function existsCached(p) {
  if (!CTX.READ_CACHE) return fs.existsSync(p);
  const k = EXISTS_KEY + readCacheKey(p);
  if (CTX.READ_CACHE.has(k)) return CTX.READ_CACHE.get(k);
  const v = fs.existsSync(p);
  CTX.READ_CACHE.set(k, v);
  return v;
}
// fs.readdirSync(d, { withFileTypes: true }) sorted by name, served from the same scope (walkProject); null = unreadable.
function readDirCached(d) {
  const k = CTX.READ_CACHE ? DIR_KEY + readCacheKey(d) : null;
  if (k !== null && CTX.READ_CACHE.has(k)) return CTX.READ_CACHE.get(k);
  let entries = null;
  try {
    entries = fs.readdirSync(d, { withFileTypes: true });
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  } catch {
    entries = null;
  }
  if (k !== null) CTX.READ_CACHE.set(k, entries);
  return entries;
}
// `file` is about to be written (or created, with its folders): its text, the "exists" answers and listings of it and of
// every folder above it are dropped — and every cached glob whose walk could reach it. opts.dir: `file` is a folder being
// created (ensureDir) — an empty folder changes no glob's matches.
function forgetCached(file, opts = {}) {
  if (!CTX.READ_CACHE) return;
  let k = readCacheKey(file);
  CTX.READ_CACHE.delete(k);
  CTX.READ_CACHE.delete(CONTAINED_KEY + k);
  CTX.XAC_MEMO = null; // 1.16 Q2: any write may change a criterion, a state or a template — the cross-feature table is rebuilt
  // A write under .specs/templates/ (templates init) changes the project's template corpus.
  if (CTX.TEMPLATE_MEMO && (k === CTX.TEMPLATE_MEMO.tdirKey || k.startsWith(CTX.TEMPLATE_MEMO.tdirKey + path.sep))) CTX.TEMPLATE_MEMO = null;
  // … and a write under .specs/tracks/ (tracks init) changes the project's track packs (1.15).
  if (CTX.PACK_MEMO && (k === CTX.PACK_MEMO.dirKey || k.startsWith(CTX.PACK_MEMO.dirKey + path.sep))) CTX.PACK_MEMO = null;
  for (;;) {
    CTX.READ_CACHE.delete(EXISTS_KEY + k);
    CTX.READ_CACHE.delete(DIR_KEY + k);
    const up = path.dirname(k);
    if (up === k) break;
    k = up;
  }
  if (!opts.dir && CTX.GLOB_CACHE && CTX.GLOB_CACHE.size) {
    const abs = readCacheKey(file);
    for (const [gk, e] of CTX.GLOB_CACHE) if (e.base !== null && globWalkReaches(e, abs)) CTX.GLOB_CACHE.delete(gk);
  }
}
// Could the walk of a cached glob (from e.base, entering e.allowDir's folders) reach the file `abs` (both readCacheKey
// forms)? Only a hidden folder on the way (.specs, where the engine writes) proves it can't — anything else is "yes",
// so a cached result is dropped rather than risked.
function globWalkReaches(e, abs) {
  const rel = path.relative(e.base, abs);
  if (rel === ".." || rel.startsWith(".." + path.sep) || path.isAbsolute(rel)) return false;
  return rel.split(path.sep).slice(0, -1).every((n) => !n.startsWith(".") || (e.allowDir && e.allowDir(n)));
}
// A write the per-file bookkeeping can't follow (a folder moved or removed, a file edited in place): forget everything.
function invalidateReadCache() {
  if (CTX.READ_CACHE) CTX.READ_CACHE.clear();
  if (CTX.GLOB_CACHE) CTX.GLOB_CACHE.clear();
  CTX.TEMPLATE_MEMO = null;
  CTX.PACK_MEMO = null;
  CTX.XAC_MEMO = null;
}

function safeReaddir(p) {
  try {
    return fs.readdirSync(p);
  } catch {
    return [];
  }
}

// Is `p` the root itself or inside it? path.relative, not `root + sep`: a drive root (C:\, or Q:\ from subst) already
// ends in a separator, and another drive comes back absolute.
function withinRoot(root, p) {
  const rel = path.relative(root, p);
  return rel === "" || (rel !== ".." && !rel.startsWith(".." + path.sep) && !path.isAbsolute(rel));
}

const isDirSafe = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
// Windows and macOS file systems are case-insensitive: `_Implements: SRC/App.js_` names src/app.js there.
const FOLD_CASE = process.platform === "win32" || process.platform === "darwin";
const toPosix = (p) => String(p).split(path.sep).join("/");

function isInsideDir(root, p) {
  const f = FOLD_CASE ? (s) => s.toLowerCase() : (s) => s;
  const r = f(root.endsWith(path.sep) ? root : root + path.sep);
  return f(p) === f(root) || f(p).startsWith(r);
}

// The real path of p even when it doesn't exist yet: the real path (fs.realpathSync.native — 8.3 short names, junctions
// and symlinks resolved) of its nearest EXISTING ancestor, plus the segments below it. null when nothing resolves.
function realPathLoose(p) {
  let cur = path.resolve(p);
  const rest = [];
  for (let i = 0; i < 256; i++) {
    try {
      return path.join(fs.realpathSync.native(cur), ...rest);
    } catch (e) {
      if (!e || (e.code !== "ENOENT" && e.code !== "ENOTDIR")) return null; // EACCES, ELOOP…: no answer
    }
    const up = path.dirname(cur);
    if (up === cur) return null;
    rest.unshift(path.basename(cur));
    cur = up;
  }
  return null;
}
// A network path in its plain UNC spelling (`\\?\UNC\host\share\…` and `\\.\UNC\…` → `\\host\share\…`), for a text comparison.
function plainUnc(p) {
  const s = String(p);
  const m = /^[\\/]{2}[?.][\\/]UNC[\\/]/i.exec(s);
  return m ? "\\\\" + s.slice(m[0].length) : s;
}
// Is network path p inside network folder root — decided on the TEXT alone, never a stat or realpath (1.16 verify NEW-3)?
// Both are read as Windows paths (a UNC path is one): `\\?\UNC\` = `\\`, / = \, `..` resolved, case folded (SMB host and share
// names are case-insensitive). A local root or p → false. → the relative path ("" for root itself) | null.
function networkPathInside(root, p) {
  if (typeof root !== "string" || typeof p !== "string" || !isNetworkPath(root) || !isNetworkPath(p)) return null;
  const W = path.win32;
  const r = W.resolve(plainUnc(root)), q = W.resolve(plainUnc(p));
  if (!isNetworkPath(r) || !isNetworkPath(q)) return null;
  const rl = r.toLowerCase().replace(/\\+$/, ""), ql = q.toLowerCase();
  return ql === rl || ql.startsWith(rl + "\\") ? W.relative(r, q) : null;
}
// p spelled under root when it lies inside root — as text, or through an alias of either (an 8.3 short name
// `C:\Users\ADMINI~1\…`, a junction, a symlink); null when it is outside. The text comparison answers first; the real
// paths are read only when it says "outside" (the guard hook calls this on every edit). Never throws.
// A NETWORK path on either side (isNetworkPath — an agent's Write to `\\host\share\a.js`, an absolute `_Implements:_`) is decided
// on the text alone (1.16 verify NEW-3): a realpath / stat of it opens an SMB connection to the host it names before the permission
// prompt — hanging on an unreachable host, and on Windows sending the user's NTLM credentials. Inside only under the same
// `\\host\share\…` prefix as root (a project living on a share stays guarded), the `\\?\UNC\` spelling read as the plain one.
function insideDirAlias(root, p) {
  if (isInsideDir(root, p)) return p;
  if (isNetworkPath(root) || isNetworkPath(p)) {
    const rel = networkPathInside(root, p);
    return rel == null ? null : rel ? path.join(root, rel) : root;
  }
  try {
    const rr = realPathLoose(root), rp = realPathLoose(p);
    if (rr && rp && isInsideDir(rr, rp)) return path.join(root, path.relative(rr, rp));
  } catch { /* the text answer stands */ }
  return null;
}
// A network path — UNC `\\host\share`, `//host/share`, `\\?\UNC\host\share`, `\\.\UNC\…` — opens an SMB/WebDAV connection to
// whatever host it names (on Windows the redirector sends the user's NTLM credentials) and, the engine being synchronous, blocks
// until an unreachable host times out (a status line hung 7 minutes on a payload cwd `\\192.0.2.1\share`). The MCP server
// refuses such a projectDir before any fs call; the status line and hooks/plan-hook.js skip such a candidate folder. Local:
// the extended/device forms of a drive path (`\\?\C:\…`, `\\.\C:\…`) and WSL's own hosts (`\\wsl$\…`, `\\wsl.localhost\…`).
// Other device paths (`\\.\pipe\…`, `\\?\Volume{…}\…`) are no project folder either. (A drive letter mapped to a share can't be
// told apart without I/O.)
function isNetworkPath(p) {
  const s = String(p).trim();
  if (!/^[\\/]{2}/.test(s)) return false;
  let rest = s.slice(2);
  if (/^[?.][\\/]/.test(rest)) {
    rest = rest.slice(2);
    if (/^[A-Za-z]:(?:[\\/]|$)/.test(rest)) return false; // \\?\C:\… — a local drive
    if (!/^UNC[\\/]/i.test(rest)) return true; // \\.\pipe\…, \\?\Volume{…}, \\?\GLOBALROOT\… — not a project folder
    rest = rest.slice(4);
  }
  const host = rest.split(/[\\/]/)[0].toLowerCase();
  return host !== "wsl$" && host !== "wsl.localhost";
}

module.exports = { resolveProjectDir, specsRoot, ensureDir, writeIfAbsent, RENAME_RETRY_MS, RENAME_RETRY_CODES,
  writeFileAtomic, SLEEP_CELL, sleepSync, readJson, isObj, jsonRel, shapeError, withReadCache, readCacheKey, EXISTS_KEY,
  DIR_KEY, CONTAINED_KEY, specsFileContained, specsFileContainedNow, readContained, readIfExists, existsCached,
  readDirCached, forgetCached, globWalkReaches, invalidateReadCache, safeReaddir, withinRoot, isDirSafe, FOLD_CASE,
  toPosix, isInsideDir, realPathLoose, plainUnc, networkPathInside, insideDirAlias, isNetworkPath };
