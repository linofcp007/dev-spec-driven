"use strict";

/**
 * dev-spec-driven — the project probe: is this a dev-spec project, and where is it? Zero-dependency (Node core only, never the
 * engine), so a hook's or the status line's check runs before — and most of the time instead of — the engine's ~100 ms load.
 *
 * ONE rule for every surface: the hooks' pre-checks (hooks/*.js, hooks/hook-utils.js), the CLI's engine-free walks
 * (cli/completion.js — the status line's probe and the shell completion) and the engine itself (engine/doctor.js isDevSpecDir is
 * this rule and engine/files.js nearestProject this walk, both read through the engine's view of the disk — files.js PROBE_IO, a
 * dry run's folders seen as made) — so a hook, the status line and the engine can never disagree on which
 * .specs/ is dev-spec's. (Until 1.26 there were four variants: a .specs/ holding only a classified feature was a project to the Stop
 * and observe hooks, not to the edit guard or the status line; a generated ROADMAP.md counted for two hooks only.)
 *
 * isDevSpecProject(dir) — <dir>/.specs is a folder holding at least one of
 *   - roadmap.json (spec_init writes it, and so does every engine write that makes, moves or changes a feature);
 *   - a steering/ folder (spec_init, steering_scaffold);
 *   - a ROADMAP.md that dev-spec generated (its AUTO-GENERATED marker — state.js RE_AUTOGEN — in the first 4,000 characters): a
 *     v1.8-era project has nothing else (no roadmap.json, steering/ or .state.json), and the save hook has served it since;
 *   - a feature folder — a folder whose name doesn't start with "." (the engine's own .execution/ and .removing-* tombstones are none;
 *     _archive/ holds its features one level down) — holding .state.json (1.9+) or classification.md (every spec_create).
 *   Not one: an empty or hand-made .specs/, another tool's (requirements.md / tasks.md folders without either file, no generated
 *   roadmap).
 *
 * Exports:
 *   isDevSpecProject(dir, io?)       the rule (io: the engine passes its own reads — a dry run's folders; default: the disk)
 *   nearestDevSpec(start, {maxUp, io})   the nearest folder at or above start whose .specs/ is dev-spec's (≤ maxUp = SESSION_MAX_UP
 *                                    levels)
 *   nearestSpecs(start, {maxUp, io}) the nearest folder at or above start holding any .specs/ folder
 *   nearestProject(start, {io})      the CLI's resolver walk (the engine's resolveProjectDir, through its own reads — files.js
 *                                    nearestProject): start itself with any .specs/, else the nearest dev-spec one above it
 *                                    (≤ PROJECT_MAX_UP levels)
 *   sessionAnchors(env) · sessionProjects({cwd, anchors})   the session resolution the hooks share before the engine loads
 *   usable · unexpandedVar · expandHome · isNetwork          reading a folder value as the engine does
 *   utf16OrUtf8 · textOf · jsonOf · readText · readJsonFile · isUtf16   a file as the engine reads it (files.js decodeText)
 * A network or device path (\\host\share, //host/share, \\?\UNC\…) is never walked up: no stat climbs a share, and none is made on a
 * path only the agent named (the callers pass the session's own folders). mcp/tests/10-guards-probe.js checks every caller agrees.
 */

const fs = require("fs");
const path = require("path");

const SESSION_MAX_UP = 40; // folders a hook or the status line walks up (the engine's SESSION_MAX_UP and STATUS_MAX_UP)
const PROJECT_MAX_UP = 64; // folders the CLI's resolver walks up (nearestProject — the engine's resolveProjectDir too)
const FOLD_CASE = process.platform === "win32" || process.platform === "darwin";

// A variable left unexpanded — any "${", a leading $NAME, a %NAME% (files.js unexpandedVar): such a value names no folder.
const RE_UNEXPANDED_VAR = /\$\{|^\$[A-Za-z_]|%[A-Za-z_][A-Za-z0-9_]*%/;
const unexpandedVar = (v) => RE_UNEXPANDED_VAR.test(String(v == null ? "" : v).trim());
// A usable folder value from Claude Code or the user (a payload cwd, CLAUDE_PROJECT_DIR, SPEC_PROJECT_DIR): a non-empty string, not a
// whole unexpanded ${VAR}, at most 4096 characters → trimmed, else null (the engine's sessionUsable).
const usable = (v) => (typeof v === "string" && v.trim() && !/^\$\{[^}]*\}$/.test(v.trim()) && v.length <= 4096 ? v.trim() : null);
// A leading ~ (alone, ~/ or ~ and a backslash) is the home folder (files.js expandHome): PowerShell 5.1 hands a native command its ~
// as typed, and an MCP argument or a JSON config is never expanded. ~user stays as written.
const RE_HOME_PREFIX = /^~(?=$|[\\/])/;
function expandHome(p) {
  const s = String(p == null ? "" : p);
  return RE_HOME_PREFIX.test(s) ? path.join(require("os").homedir(), s.slice(1)) : s;
}
// A network or device path (files.js isNetworkPath): \\host\share, //host/share, \\?\UNC\…, \\.\pipe\…; \\?\C:\… is a local drive,
// WSL's \\wsl$\ and \\wsl.localhost\ name no network host.
function isNetwork(p) {
  const s = String(p).trim();
  if (!/^[\\/]{2}/.test(s)) return false;
  let rest = s.slice(2);
  if (/^[?.][\\/]/.test(rest)) {
    rest = rest.slice(2);
    if (/^[A-Za-z]:(?:[\\/]|$)/.test(rest)) return false;
    if (!/^UNC[\\/]/i.test(rest)) return true;
    rest = rest.slice(4);
  }
  const host = rest.split(/[\\/]/)[0].toLowerCase();
  return host !== "wsl$" && host !== "wsl.localhost";
}

// ---- a file as the engine reads it -----------------------------------------------------------------------------------------
// Bytes → text: a UTF-16 BOM decides (LE / BE; an odd trailing byte dropped), anything else is UTF-8 (Windows PowerShell 5.1's
// Out-File and `>` write UTF-16).
function utf16OrUtf8(buf) {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return buf.toString("utf16le", 0, buf.length - (buf.length % 2));
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) return Buffer.from(buf.subarray(0, buf.length - (buf.length % 2))).swap16().toString("utf16le");
  return buf.toString("utf8");
}
// Bytes → their text without a BOM; → the JSON they hold (throws when it doesn't parse).
function textOf(buf) {
  const t = utf16OrUtf8(buf);
  return t.charCodeAt(0) === 0xfeff ? t.slice(1) : t;
}
const jsonOf = (buf) => JSON.parse(textOf(buf));
// A file's text, decoded, without its BOM; a JSON file, decoded and parsed. Both throw as fs.readFileSync does (a missing file:
// ENOENT) — and the second on a file that doesn't parse.
const readText = (file) => textOf(fs.readFileSync(file));
const readJsonFile = (file) => jsonOf(fs.readFileSync(file));
const isUtf16 = (buf) => buf.length >= 2 && ((buf[0] === 0xff && buf[1] === 0xfe) || (buf[0] === 0xfe && buf[1] === 0xff));

// ---- the rule ---------------------------------------------------------------------------------------------------------------
// The marker every file dev-spec generates carries (state.js RE_AUTOGEN — mcp/tests/10-guards-probe.js checks they are the same).
const RE_AUTOGEN = /AUTO-GE(?:NERATED|RADO|NERADO) (?:by|por) dev-spec/;
const HEAD_CHARS = 4000;
const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
// A file's first HEAD_CHARS characters (one bounded read, decoded as the engine decodes — files.js readFileHead), else "".
function head(file) {
  let fd = null;
  try {
    fd = fs.openSync(file, "r");
    const buf = Buffer.alloc(HEAD_CHARS * 4);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    return textOf(buf.subarray(0, n)).slice(0, HEAD_CHARS);
  } catch {
    return "";
  } finally {
    if (fd !== null) try { fs.closeSync(fd); } catch { /* closed */ }
  }
}
// The disk as the rule reads it. folders(p): the names of p's entries that may be folders (a file holds no .state.json) — one
// readdir, no stat per file; head(p): a file's first characters. The engine passes its own reads (a dry run's folders seen as made).
const DISK = {
  isDir,
  exists: (p) => fs.existsSync(p),
  head,
  folders: (p) => { try { return fs.readdirSync(p, { withFileTypes: true }).filter((d) => d.isDirectory() || d.isSymbolicLink()).map((d) => d.name); } catch { return []; } },
};
// Is <dir>/.specs/ dev-spec's? The rule (the header above): roadmap.json, a steering/ folder, a generated ROADMAP.md, or a feature
// folder (no "." prefix) holding .state.json or classification.md. Cheapest first: a folder without .specs/ costs one stat; a
// project, two; only a .specs/ with neither roadmap.json nor steering/ reads more.
function isDevSpecProject(dir, io = DISK) {
  if (typeof dir !== "string" || !dir) return false;
  const root = path.join(dir, ".specs");
  if (!io.isDir(root)) return false;
  if (io.exists(path.join(root, "roadmap.json")) || io.isDir(path.join(root, "steering"))) return true;
  if (RE_AUTOGEN.test(io.head(path.join(root, "ROADMAP.md")) || "")) return true;
  return io.folders(root).some((n) => !n.startsWith(".") && (io.exists(path.join(root, n, ".state.json")) || io.exists(path.join(root, n, "classification.md"))));
}

// ---- where it is ------------------------------------------------------------------------------------------------------------
// The nearest folder at or above `start` (≤ opts.maxUp levels, default SESSION_MAX_UP) whose .specs/ is dev-spec's, else null. An
// unusable start → null; a network path → itself when it is one (never walked up the share). opts.io: the disk as the rule reads it
// (isDevSpecProject's io — default: the disk).
function nearestDevSpec(start, opts = {}) {
  const s = usable(start);
  if (!s) return null;
  const io = opts.io || DISK;
  if (isNetwork(s)) return isDevSpecProject(s, io) ? path.resolve(s) : null;
  let d = path.resolve(s);
  for (let i = 0, max = opts.maxUp || SESSION_MAX_UP; i < max; i++) {
    if (isDevSpecProject(d, io)) return d;
    const up = path.dirname(d);
    if (up === d) break;
    d = up;
  }
  return null;
}
// The nearest folder at or above `start` (≤ opts.maxUp levels, default SESSION_MAX_UP) holding a .specs/ folder at all — dev-spec's
// or not —, else null. A network path is itself, as it is — never stat'ed here, nor walked (its reader decides). opts.io: as
// nearestDevSpec's.
function nearestSpecs(start, opts = {}) {
  const s = usable(start);
  if (!s) return null;
  if (isNetwork(s)) return s;
  const io = opts.io || DISK;
  let d = path.resolve(s);
  for (let i = 0, max = opts.maxUp || SESSION_MAX_UP; i < max; i++) {
    if (io.isDir(path.join(d, ".specs"))) return d;
    const up = path.dirname(d);
    if (up === d) break;
    d = up;
  }
  return null;
}
// The CLI's resolver walk (files.js nearestProject — where `dev-spec <cmd>` acts with no --project / SPEC_PROJECT_DIR /
// CLAUDE_PROJECT_DIR): `start` itself when it holds any .specs/ folder (one made by hand before init), else the nearest folder above
// it whose .specs/ is dev-spec's (≤ PROJECT_MAX_UP levels in all), else null. A network path → null (never walked). opts.io: as
// nearestDevSpec's (the engine passes its own reads).
function nearestProject(start, opts = {}) {
  const s = usable(start);
  if (!s || isNetwork(s)) return null;
  return nearestSpecs(s, { maxUp: 1, io: opts.io }) || nearestDevSpec(s, { maxUp: PROJECT_MAX_UP, io: opts.io });
}

// ---- the session -------------------------------------------------------------------------------------------------------------
// The session's anchors, each usable one in this order: CLAUDE_PROJECT_DIR (where Claude Code started — the plugin's MCP server works
// there) and SPEC_PROJECT_DIR.
const sessionAnchors = (env = process.env) => [env.CLAUDE_PROJECT_DIR, env.SPEC_PROJECT_DIR].map(usable).filter(Boolean);
const folderKey = (d) => (FOLD_CASE ? d.toLowerCase() : d);
// The dev-spec projects a hook event may be about — the raw pre-check every hook runs before the engine loads: the nearest one at or
// above the payload's cwd (≤ opts.maxUp levels — a cd'd subfolder, a worktree's copy; a network cwd only itself), then each anchor that
// is one; distinct (case folded where the file system folds it). opts: { cwd, anchors (default: sessionAnchors()), maxUp }. [] means
// spec.sessionProject finds nothing either (it walks at most as far, and maps a worktree to its checkout only from a folder found
// here); otherwise the engine picks THE project among them or that mapping.
function sessionProjects(opts = {}) {
  const anchors = Array.isArray(opts.anchors) ? opts.anchors.map(usable).filter(Boolean) : sessionAnchors();
  const found = [nearestDevSpec(opts.cwd, { maxUp: opts.maxUp })];
  for (const a of anchors) { const d = path.resolve(a); if (isDevSpecProject(d)) found.push(d); }
  const seen = new Set();
  return found.filter((d) => d && !seen.has(folderKey(d)) && seen.add(folderKey(d)));
}

module.exports = {
  SESSION_MAX_UP, PROJECT_MAX_UP, RE_AUTOGEN, RE_UNEXPANDED_VAR, unexpandedVar, usable, RE_HOME_PREFIX, expandHome, isNetwork,
  utf16OrUtf8, textOf, jsonOf, readText, readJsonFile, isUtf16,
  isDevSpecProject, nearestDevSpec, nearestSpecs, nearestProject, sessionAnchors, sessionProjects,
};
