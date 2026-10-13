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
 *   resolveProjectDir(arg, {env, io})   THE resolver: --project / projectDir > SPEC_PROJECT_DIR > CLAUDE_PROJECT_DIR > nearestProject >
 *                                    the working folder (files.js resolveProjectDir, the CLI's context and completion read it)
 *   sessionAnchors(env) · sessionProjects({cwd, anchors})   the session resolution the hooks share before the engine loads
 *   usable · unexpandedVar · expandHome · isNetwork          reading a folder value as the engine does (isNetwork IS files.js
 *                                    isNetworkPath)
 *   fsTargetPath · editTargets       a Write / Edit target as the file system reads it (guards.js guardTargetPath /
 *                                    approvalEditTargets ARE them; hooks/hook-utils.js re-exports them)
 *   shortNameOf · mayShortName · shortNamesRead · shortDirAt · winPathTrim · realPrefix · realPathLoose · longPath   Windows' own
 *                                    readings of a path (1.30.1): an 8.3 alias of a guarded name, Win32's trailing dots and spaces, the
 *                                    real path of the deepest existing folder (files.js realPathLoose IS this one)
 *   utf16OrUtf8 · textOf · jsonOf · readText · readJsonFile · isUtf16   a file as the engine reads it (files.js decodeText)
 *   the guards' shared readings (one copy for the hooks, before the engine loads, and the engine):
 *     trimSlashEnd · approvalPlain · approvalMayBe (APPROVAL_CANDIDATE_TESTS) · RE_APPROVAL_VERB   the approval guard's pre-filter
 *     guardedFileOf · specsParentOf    the files the approval guard stands on, by path; the project a .specs/ path belongs to
 *     MCP_FILE_VERBS · isMcpFileTool · approvalHookMatcher · mcpPathArgs   another MCP server's file tools (hooks.json's matcher)
 *     observedNorm · observedBodies    the observe hook's pre-filter (evidence.js's observed runs)
 *   the CLI's flags before the engine loads (1.30): CLI_SWITCHES (the boolean switches — the CLI's BOOL_FLAGS and the approval guard's
 *     lexer) · closestName (the did-you-mean; the engine's IS it)
 * A network or device path (\\host\share, //host/share, \\?\UNC\…) is never walked up: no stat climbs a share, and none is made on a
 * path only the agent named (the callers pass the session's own folders). mcp/tests/10-guards-probe.js checks every caller agrees.
 */

const fs = require("fs");
const path = require("path");

const SESSION_MAX_UP = 40; // folders a hook or the status line walks up (the engine's SESSION_MAX_UP and STATUS_MAX_UP)
const PROJECT_MAX_UP = 64; // folders the CLI's resolver walks up (nearestProject — the engine's resolveProjectDir too)
const WIN = process.platform === "win32";
const FOLD_CASE = WIN || process.platform === "darwin";

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
// A network or device path — the ONE test (files.js isNetworkPath is this function): UNC `\\host\share`, `//host/share`,
// `\\?\UNC\host\share`, `\\.\UNC\…` open an SMB/WebDAV connection to whatever host they name (on Windows the redirector sends the
// user's NTLM credentials) and, a hook or the engine being synchronous, block until an unreachable host times out (a status line
// hung 7 minutes on a payload cwd `\\192.0.2.1\share`). Local: the extended/device forms of a drive path (`\\?\C:\…`, `\\.\C:\…`)
// and WSL's own hosts (`\\wsl$\…`, `\\wsl.localhost\…`). Other device paths (`\\.\pipe\…`, `\\?\Volume{…}\…`) are no project
// folder either. (A drive letter mapped to a share can't be told apart without I/O.)
function isNetwork(p) {
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

// ---- a Write / Edit target as the file system reads it ----------------------------------------------------------------------
// The edit guard's and the approval guard's reading (engine/guards.js guardTargetPath / approvalEditTargets ARE these; the approval
// hook's pre-check reads them through hooks/hook-utils.js before the engine loads).
// A target as the Windows file system reads it (win: process.platform === "win32" by default; elsewhere ':' is a file name
// character and /c/ a folder): an NTFS stream suffix on the last segment is dropped — `a.ts::$DATA` IS a.ts, `a.ts:x` /
// `a.ts:x:$DATA` a stream of it (an edit of it all the same) — and Git Bash's `/c/…` is `C:/…` (`//host` untouched). Both were read
// as no code / outside the project and allowed with the guard on.
function fsTargetPath(p, win = process.platform === "win32") {
  let s = String(p);
  if (!win) return s;
  const m = /^\/([A-Za-z])(?=\/|$)/.exec(s);
  if (m) s = m[1].toUpperCase() + ":" + (s.slice(2) || "/");
  const cut = Math.max(s.lastIndexOf("/"), s.lastIndexOf("\\")) + 1; // the last segment
  const from = cut === 0 && /^[A-Za-z]:/.test(s) ? 2 : 0; // a drive-relative "C:a.ts" keeps its drive
  const i = s.indexOf(":", cut + from);
  return i > cut ? s.slice(0, i) : s;
}
// A Write / Edit target (absolute, or relative to the payload's cwd) → the paths the file system reads it as: [resolved] (`./`, `..`
// and a stream suffix taken out — `.specs/./roadmap.json`, `.specs/alpha/../roadmap.json`, `roadmap.json::$DATA` were matched as text
// and allowed) plus, on every platform, its real path (longPath — the deepest existing folder's, ≤ EDIT_MAX_UP levels up, + the rest): an
// 8.3 short name (`ROADMA~1.JSO`, `STATE~1.JSO`, `SPECS~1/newfeat/.state.json` — a folder Write makes) and a folder linked to .specs/ or
// to a feature folder (`ln -s .specs sx` → `sx/roadmap.json` IS .specs/roadmap.json); on win32 also Win32's reading of a trailing dot /
// space (winPathTrim — Node keeps `roadmap.json.`, another MCP server's file tool in Python or .NET writes roadmap.json: fail closed).
// Never a disk call on a network path: a relative path under a network cwd, and a network path, are read as text (the 8.3 rule).
const EDIT_MAX_UP = 16;
function editTargets(fp, cwd, win = process.platform === "win32") {
  const s = fsTargetPath(String(fp).trim(), win);
  const c = usable(cwd);
  const text = isNetwork(s) ? s : c && isNetwork(c) && !path.isAbsolute(s) && !/^[A-Za-z]:/.test(s) ? trimSlashEnd(c) + "/" + s : null;
  const out = [];
  const add = (t) => { if (t && !out.includes(t)) out.push(t); };
  if (text !== null) { // a network path, or relative to a network cwd: text only
    add(text);
    if (win) { const t = winPathTrim(text); add(t); add(shortNamesRead(t)); }
    return out;
  }
  const base = c && !isNetwork(c) ? path.resolve(fsTargetPath(c, win)) : process.cwd();
  let abs;
  try { abs = path.resolve(base, s); } catch { return [s]; }
  add(abs);
  for (const t of win ? [abs, winPathTrim(abs)] : [abs]) { add(t); add(longPath(t, win, EDIT_MAX_UP)); }
  return out;
}

// ---- Windows' own readings of a path: 8.3 short names, trailing dots and spaces (1.30.1) ----------------------------------------
// NTFS gives every name that is not 8.3 already a short alias — `.specs` SPECS~1, `roadmap.json` ROADMA~1.JSO, `.guardian` GUARDI~1,
// `baseline.json` BASELI~1.JSO — and every program opens a file by either name (cmd.exe, PowerShell, Git Bash, Node's own calls). The
// guards read a shell command's paths as TEXT, so `cp evil SPECS~1/guardian.cjs`, `echo x > GUARDI~1/BASELI~1.JSO` wrote what they stand
// on unseen (review 9 3b, a known limit until 1.30.1). And Win32 — cmd.exe, PowerShell, any native program, not Node or Git Bash — drops
// a segment's trailing dot and the last segment's trailing dots and spaces: `Set-Content .specs\roadmap.json. x` writes roadmap.json.
// Linux and macOS have neither: `SPECS~1` and `roadmap.json.` are other names there (every caller passes `win`).
// The names the guards stand on — a guarded file, a folder holding them, dev-guardian's CLI — each with its 8.3 parts: the name
// without its leading dots and inner dots, upper case, and the extension's first 3 characters.
const SHORT_NAME_LONGS = [".specs", ".guardian", ".execution", "roadmap.json", ".state.json", "observed.jsonl", "guardian.cjs", "baseline.json",
  "dev-guardian.mjs"];
const SHORT_PARTS = SHORT_NAME_LONGS.map((long) => {
  const s = long.replace(/^\.+/, "").toUpperCase();
  const dot = s.lastIndexOf(".");
  return { long, base: (dot < 0 ? s : s.slice(0, dot)).replace(/\./g, ""), ext: dot < 0 ? "" : s.slice(dot + 1, dot + 4) };
});
// One path segment → the guarded name it may be the 8.3 alias of, else null. The rule, fail closed (an alias of a missing file may be
// made for it): `<base>~<N>[.<ext>]` with base 1–6 characters that start the long name's (`SPECS~1`, `GUARDI~2`, `SPEC~10`) — or, past
// four collisions, its first two and 4 hex digits (`SP1A2B~1`) — and ext the long name's first 3 (none for none), case-blind.
const RE_SHORT_SEG = /^([^~.\\/]{1,6})~(\d{1,6})(?:\.([^.~\\/]{1,3}))?$/;
function shortNameOf(seg) {
  const m = RE_SHORT_SEG.exec(String(seg));
  if (!m) return null;
  const b = m[1].toUpperCase(), ext = (m[3] || "").toUpperCase();
  for (const L of SHORT_PARTS) {
    if (L.ext !== ext) continue;
    if (L.base.startsWith(b) || (b.length === 6 && b.slice(0, 2) === L.base.slice(0, 2) && /^[0-9A-F]{4}$/.test(b.slice(2)))) return L.long;
  }
  return null;
}
// May a text hold such an alias — a word starting with a short base (or the hash form) and `~<digit>`? The pre-filters' test (a superset
// of shortNameOf on each segment: the extension is not read), one pass: each alternative is a few fixed characters.
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
const RE_SHORT_MAYBE = new RegExp("(?<![A-Za-z0-9])(?:" + [...new Set(SHORT_PARTS.flatMap((L) => {
  const b = L.base.slice(0, 6);
  let chain = "";
  for (let i = b.length - 1; i >= 1; i--) chain = "(?:" + escapeRe(b[i]) + chain + ")?";
  return [escapeRe(b[0]) + chain, escapeRe(L.base.slice(0, 2)) + "[0-9A-Fa-f]{4}"];
}))].join("|") + ")~\\d", "i");
const mayShortName = (text) => RE_SHORT_MAYBE.test(String(text));
// A path with each segment that is such an alias read as its long name (text only — the 8.3 rule), separators kept.
function shortNamesRead(p) {
  const s = String(p);
  if (!mayShortName(s)) return s;
  let out = "", start = 0;
  for (let i = 0; i <= s.length; i++) {
    if (i < s.length && !isSlashCode(s.charCodeAt(i))) continue;
    const seg = s.slice(start, i);
    out += (shortNameOf(seg) || seg) + (i < s.length ? s[i] : "");
    start = i + 1;
  }
  return out;
}
// A path as Win32 reads it (Microsoft's path normalization — cmd.exe, PowerShell, a native program; Node's file calls go around it
// through `\\?\`): a segment ending in ONE period loses it (`.specs.\x` IS .specs\x; `a..` stays), the last segment loses its trailing
// periods and spaces (`roadmap.json. .` IS roadmap.json); `.` / `..` stay. And NTFS reads a folder segment's stream designation as the
// folder itself — `.specs::$INDEX_ALLOCATION\roadmap.json` IS .specs\roadmap.json (cmd.exe, .NET, Node alike; checked on Windows 11):
// a segment's `:<stream>` suffix is dropped (a drive's `C:` stays; the last segment's is fsTargetPath's). One pass (each segment's tail
// walked once from its end).
function winPathTrim(p) {
  const s = String(p);
  let out = "", start = 0;
  for (let i = 0; i <= s.length; i++) {
    if (i < s.length && !isSlashCode(s.charCodeAt(i))) continue;
    let seg = s.slice(start, i);
    const colon = i < s.length && !/^[A-Za-z]:$/.test(seg) ? seg.indexOf(":", start === 0 && /^[A-Za-z]:/.test(seg) ? 2 : 0) : -1;
    if (colon > 0) seg = seg.slice(0, colon);
    if (seg !== "." && seg !== "..") {
      if (i === s.length) {
        let e = seg.length;
        while (e > 0 && (seg.charCodeAt(e - 1) === 46 || seg.charCodeAt(e - 1) === 32)) e--;
        if (e > 0) seg = seg.slice(0, e);
      } else if (seg.length > 1 && seg.charCodeAt(seg.length - 1) === 46 && seg.charCodeAt(seg.length - 2) !== 46) seg = seg.slice(0, -1);
    }
    out += seg + (i < s.length ? s[i] : "");
    start = i + 1;
  }
  return out;
}
// The real path of an absolute local path even when it doesn't exist (yet): fs.realpathSync.native — 8.3 short names, junctions and
// symlinks resolved — of its deepest existing ancestor, at most maxUp levels up (default 256), → { real, rest: [the segments below it] },
// or null (nothing resolved within maxUp; an answer other than "not there" — EACCES, ELOOP: no answer). files.js realPathLoose IS
// realPathLoose here.
function realPrefix(p, maxUp = 256) {
  let cur = path.resolve(p);
  const rest = [];
  for (let i = 0; i <= maxUp; i++) {
    try {
      return { real: fs.realpathSync.native(cur), rest };
    } catch (e) {
      if (!e || (e.code !== "ENOENT" && e.code !== "ENOTDIR")) return null;
    }
    const up = path.dirname(cur);
    if (up === cur) return null;
    rest.unshift(path.basename(cur));
    cur = up;
  }
  return null;
}
const realPathLoose = (p, maxUp) => { const r = realPrefix(p, maxUp); return r ? path.join(r.real, ...r.rest) : null; };
// An absolute path as the file system reads it, beyond its text: the real path of its deepest existing ancestor (realPrefix, ≤ maxUp
// levels) and the segments below it — on win32 each 8.3 alias among them read by the rule (shortNameOf: a missing SPECS~1 may be made for
// .specs — fail closed); nothing resolved: the text by that rule (win32), else null. Never a disk call on a network path.
function longPath(abs, win = process.platform === "win32", maxUp) {
  const r = isNetwork(abs) ? null : realPrefix(abs, maxUp);
  if (!r) return win ? shortNamesRead(abs) : null;
  return r.rest.length ? path.join(r.real, ...r.rest.map((x) => (win && shortNameOf(x)) || x)) : r.real;
}
// The first segment of a path that is an 8.3 alias of .specs or .guardian → its index in the text, else -1 (specsParentOf, the approval
// hook's candidate projects).
function shortDirAt(p) {
  const s = String(p);
  if (!mayShortName(s)) return -1;
  for (let i = 0, start = 0; i <= s.length; i++) {
    if (i < s.length && !isSlashCode(s.charCodeAt(i))) continue;
    const long = shortNameOf(s.slice(start, i));
    if (long === ".specs" || long === ".guardian") return start;
    start = i + 1;
  }
  return -1;
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
// The project folder every surface works in — THE resolver (files.js resolveProjectDir is it through the engine's reads; the CLI's
// context and its completion read it without the engine, 1.30.1): the explicit argument (--project, a tool's projectDir) >
// SPEC_PROJECT_DIR > CLAUDE_PROJECT_DIR > the nearest folder at or above the working one holding a dev-spec .specs/ (nearestProject) >
// the working folder. A value that is empty or holds an unexpanded variable falls through; a leading ~ is the home folder.
// opts: { env (default process.env), io (nearestProject's) }.
function resolveProjectDir(arg, opts = {}) {
  const env = opts.env || process.env;
  const use = (v) => (v != null && String(v).trim() && !unexpandedVar(v) ? String(v).trim() : null);
  const dir = use(arg) || use(env.SPEC_PROJECT_DIR) || use(env.CLAUDE_PROJECT_DIR);
  if (dir) return path.resolve(expandHome(dir));
  const cwd = path.resolve(process.cwd());
  return nearestProject(cwd, { io: opts.io }) || cwd;
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

// ---- the guards' shared readings ----------------------------------------------------------------------------------------------
// ONE copy each for the hooks (before the engine loads) and the engine (guards.js, evidence.js) — renamed copies drifted where no
// test could see them (review 8, ds-maint finding 4). Every scan here is LINEAR in its input: a hook that runs past its timeout lets
// the tool call through (code.claude.com/docs/en/hooks), so a pattern that rescans a run from each of its starts is a way past the
// guard — /(?:^|[=,(])\.[^\s/]*[*?]/ on `=.=.=.…`: 120 K characters cost the approval hook 16.7 s against its 10 s timeout (review 8,
// ds-security finding 3). The rule for a pattern a hook runs on payload text: no run class that holds its own start delimiter, no
// `[\\/]+$`-style tail, no nested quantifier — scan the delimiter-free runs once, or walk the text by hand. mcp/tests/
// 10-guards-hooks-cost.js times each reader on growing hostile inputs (the ratio, never milliseconds).

const isSlashCode = (c) => c === 47 || c === 92;
// A text without its trailing slashes / backslashes — one pass from the end.
function trimSlashEnd(s) {
  const t = String(s);
  let e = t.length;
  while (e > 0 && isSlashCode(t.charCodeAt(e - 1))) e--;
  return t.slice(0, e);
}

// The approval guard's pre-filter — the approval hook's before the engine loads, and the engine's approvalCandidate (guards.js:
// plus a PowerShell -EncodedCommand's decoded script): may this shell command run the CLI or touch a file the guard stands on? Read on
// its plain text (approvalPlain — quotes, escapes, line continuations and string joints taken out: `dev\-spec`, `d'e'v-spec`,
// `"cli/dev" + "-spec.js"`). APPROVAL_CANDIDATE_TESTS, any one: it names dev-spec, .specs or a guarded file by name; or it holds a
// glob / brace character together with an approval word (the glob may name the CLI), a dot-led word holding one (`.s*/road*.json`,
// `x=.spec?/…`) or a writer / remover (PowerShell's `Remove-Item * -Recurse` reaches .specs/). A guard-down another module reads in a
// command it names adds its test here (the list is the hook point): the hook's pre-filter and the engine's stay one.
const RE_APPROVAL_NAMES = /dev-?spec|\.specs|roadmap\.json|\.state\.json|observed\.jsonl/i;
// The words that make a CLI call an approval or a guard-down (approve, feature remove, init's guard-down flags).
const RE_APPROVAL_VERB = /(?:^|[^\w-])(?:approve|remove|--approval-guard|--stop-check|--evidence|--guard|--guardian|--roles|--check)(?![\w-])/i;
const RE_APPROVAL_WRITE_WORD = /(?:^|[\s;&|(])(?:rm|rmdir|rd|del|erase|remove-item|ri|mv|move|move-item|mi|cp|copy|copy-item|cpi|set-content|sc|add-content|ac|clear-content|clc|out-file|new-item|ni|tee|robocopy|xcopy|rsync)(?=[\s;&|)]|$)/i;
const RE_GLOB_CHAR = /[*?[{]/;
const approvalPlain = (text) => String(text).replace(/(["'])\s*\+\s*\1/g, "").replace(/[\\`^]\r?\n|['"\\`^]/g, "");
// A dot-led word — a `.` after the start, a blank, a quote, a slash, `=`, `,`, `(` or a separator — holding a glob / brace character
// after its dot. Each match takes a whole delimiter-free run at once (the next search starts past it), so no run is read twice; the
// first qualifying dot of a run sees every glob character a later one would.
const RE_DOT_RUN = /(?:^|[\s/\\'"=,(;&|])\.[^\s/\\'";&|]*/g;
function dotGlob(t) {
  const re = new RegExp(RE_DOT_RUN.source, "g");
  for (let m; (m = re.exec(t));) if (RE_GLOB_CHAR.test(m[0])) return true;
  return false;
}
const APPROVAL_CANDIDATE_TESTS = [
  (t) => RE_APPROVAL_NAMES.test(t),
  (t) => RE_GLOB_CHAR.test(t) && (RE_APPROVAL_VERB.test(t) || dotGlob(t) || RE_APPROVAL_WRITE_WORD.test(t)),
  // dev-guardian's gate (1.30, engine/guardian.js): its launcher (.specs/guardian.cjs), its baseline, dev-guardian's `baseline update`
  (t) => /guardian/i.test(t),
  // (1.30.1, win32) an 8.3 alias of a guarded name — SPECS~1, GUARDI~1, BASELI~1.JSO, DEV-GU~1.MJS (mayShortName)
  (t) => WIN && mayShortName(t),
];
// plain: approvalPlain(command) → may it be an approval / a guard-down?
const approvalMayBe = (plain) => APPROVAL_CANDIDATE_TESTS.some((test) => test(plain));

// The files the approval guard stands on, by their path (any separators, case-blind) → { setting, feature? } | null:
// .specs/roadmap.json ("roadmap": the guard and the project's gates), a .state.json anywhere below .specs/ ("state": a feature's
// approvals, evidence, history — feature: its folder) and a harness-observed run log .specs/[…/].execution/observed.jsonl
// ("observed" — feature null for the project's own .specs/.execution/); and dev-guardian's gate (1.30, engine/guardian.js — the engine
// counts these only while a check runs the gate: guardianGuardFilter): its launcher .specs/guardian.cjs ("guardian-launcher") and its
// baseline .guardian/baseline.json ("guardian-baseline"). Read on the path's segments, one pass (the regexes this replaces rescanned
// `.specs/.specs/…` from each `.specs`). The engine's approvalGuardedFile reads its normalized path text here, the approval hook the
// edited path as the file system reads it.
function guardedFileOf(p) {
  const segs = String(p).split(/[\\/]+/);
  const n = segs.length;
  if (n < 2) return null;
  const low = (i) => segs[i].toLowerCase();
  const last = low(n - 1);
  const specsBefore = (k) => { for (let i = 0; i < k; i++) if (low(i) === ".specs") return true; return false; };
  if (last === "roadmap.json") return low(n - 2) === ".specs" ? { setting: "roadmap" } : null;
  if (last === "observed.jsonl" && n >= 3 && low(n - 2) === ".execution" && specsBefore(n - 2)) {
    const f = segs[n - 3];
    return { setting: "observed", feature: f && f.toLowerCase() !== ".specs" ? f : null };
  }
  if (last === ".state.json" && n >= 3 && specsBefore(n - 2)) return { setting: "state", feature: segs[n - 2] || null };
  if (last === "guardian.cjs" && low(n - 2) === ".specs") return { setting: "guardian-launcher" };
  if (last === "baseline.json" && low(n - 2) === ".guardian") return { setting: "guardian-baseline" };
  return null;
}
// The folder holding a path's .specs/ (or dev-guardian's .guardian/) — the text before the first `.specs` / `.guardian` followed by a
// separator or the end, its separators taken off ("" → "."): the project an edit of a guarded file acts on. With none, on win32, the
// first segment that is an 8.3 alias of one (`sub/SPECS~1/guardian.cjs` acts on sub/ — shortDirAt).
function specsParentOf(p, win = process.platform === "win32") {
  const t = String(p);
  const m = /\.(?:specs|guardian)(?=[\\/]|$)/i.exec(t);
  const at = m ? m.index : win ? shortDirAt(t) : -1;
  return at >= 0 ? trimSlashEnd(t.slice(0, at)) || "." : t;
}

// Another MCP server's file tools — filesystem's write_file / edit_file / move_file, Desktop Commander's write_file / edit_block, … —
// by the verb in the tool's name, never by the server; dev-spec's own tools (spec_*, steering_scaffold, ears_validate, trace_check) are
// never one. MCP_FILE_VERBS is the ONE list: the engine's and the approval hook's test (isMcpFileTool) and hooks/hooks.json's matcher
// (approvalHookMatcher — a matcher is a regex without flags, so each verb is spelled case-blind there, [Ww][Rr]…: `mcp__x__FILE_WRITE`
// never reached the hook) are built from it. mcp/tests/10-guards.js checks hooks.json holds approvalHookMatcher().
const MCP_FILE_VERBS = ["write", "edit", "create", "move", "rename", "delete", "remove", "copy", "append", "patch", "replace", "save", "put",
  "upload", "mkdir", "touch", "truncate", "unlink", "insert"];
const RE_MCP_FILE_TOOL = new RegExp("^mcp__.+__[\\w-]*?(?:" + MCP_FILE_VERBS.join("|") + ")", "i");
const DEVSPEC_TOOL_HEADS = ["spec_", "steering_scaffold", "ears_validate", "trace_check"];
const RE_DEVSPEC_MCP_TOOL = /__(?:spec_[a-z_]+|steering_scaffold|ears_validate|trace_check)$/;
const isMcpFileTool = (tool) => RE_MCP_FILE_TOOL.test(tool) && !RE_DEVSPEC_MCP_TOOL.test(tool);
// The approval-shaped dev-spec tools, under any MCP server prefix (Claude Code: mcp__plugin_dev-spec-driven_spec-driven__spec_approve;
// a project server: mcp__spec-driven__spec_approve; any name a user registered the server under) or bare — m[1] the tool.
const APPROVAL_TOOLS = ["spec_approve", "spec_feature", "spec_init", "spec_add_track"];
const RE_APPROVAL_MCP = new RegExp("^(?:mcp__.+__)?(" + APPROVAL_TOOLS.join("|") + ")$");
// hooks/hooks.json's matcher for the approval hook: the shell and edit tools, dev-spec's approval-shaped tools under any prefix, and
// another server's file tools by their verb.
function approvalHookMatcher() {
  const blind = (w) => w.replace(/[a-z]/g, (c) => "[" + c.toUpperCase() + c + "]");
  return "^(Bash|PowerShell|Monitor|Write|Edit|NotebookEdit|(mcp__.+__)?(" + APPROVAL_TOOLS.join("|") + ")|mcp__.+__(?!" + DEVSPEC_TOOL_HEADS.join("|") +
    ")[\\w-]*?(" + MCP_FILE_VERBS.map(blind).join("|") + ")[\\w-]*)$";
}
// An MCP file tool's path-named keys.
const RE_MCP_PATH_KEY = /path|file|source|src|dest|target|from|^to$|dir|folder|name|uri|location/i;
// An MCP file tool's arguments → the strings that may be paths: the values (strings, or arrays / objects of them, 3 levels deep) of
// keys named like one (path, file, source, destination, target, from, to, dir…), one line each, at most 32; a file:// URI read as its
// path (uriPath — hooks/hook-utils.js fileUriToPath, the hook's and the MCP server's one reading; none: as written).
function mcpPathArgs(ti, uriPath) {
  const out = [];
  const walk = (v, keyed, depth) => {
    if (out.length >= 32 || depth > 3) return;
    if (typeof v === "string") {
      if (!keyed || !v.trim() || v.length > 4096 || /[\r\n]/.test(v)) return;
      const s = v.trim();
      const u = /^file:\/\//i.test(s) && typeof uriPath === "function" ? uriPath(s) : null;
      out.push(u || s);
    } else if (Array.isArray(v)) v.forEach((x) => walk(x, keyed, depth + 1));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, keyed || RE_MCP_PATH_KEY.test(k), depth + 1);
  };
  walk(ti, false, 0);
  return out;
}

// The observe hook's pre-filter, before a tasks.md is parsed (here — the hook runs it before the engine loads — and in the engine's
// observeRun, engine/evidence.js): the run's command bodies as no matcher reading tells apart — split at ` && ` and `;`, a `cd` /
// `set … pipefail` part dropped, leading NAME=value assignments (quotes honoured) and a trailing 2>&1 dropped, then backticks and
// quotes dropped, `\` read as `/`, whitespace folded (observedNorm) — must each appear in the normalized text. A SUPERSET of
// runProvesVerify (every transformation keeps a body a substring of its _Verify:_'s normalized text): a run the matcher accepts
// always passes it. → the bodies ([] — a run of cds / pipefail only — matches nothing).
// (also pipes unspaced, a `./` at a word's start dropped, npm's aliases of `npm test` read as it, `&&` split however spaced, and a
// part that is cmd.exe's / PowerShell's change of folder — chdir, pushd, popd, Set-Location, sl, Push-Location, Pop-Location —
// dropped like `cd`: the matcher's review-5 readings, so the filter stays a superset of it). The whitespace is folded BEFORE the
// split (`\s*&&\s*` never meets a run of blanks).
const observedNorm = (s) => String(s == null ? "" : s).replace(/[`"']/g, "").split(String.fromCharCode(92)).join("/").replace(/\s+/g, " ").trim()
  .replace(/ ?(\|+) ?/g, "$1").replace(/(^|[ ;&|(=])\.\//g, "$1").replace(/\bnpm (?:run(?:-script)? test|t|tst)(?=$|[ ;&|])/g, "npm test");
const RE_OBSERVED_ENV = /^(?:[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|[^\s"'`;&|]*)\s+)+/;
function observedBodies(cmd) {
  const out = [];
  for (let part of String(cmd == null ? "" : cmd).replace(/\s+/g, " ").split(/\s*&&\s*|;/)) {
    part = part.trim();
    if (!part || /^(?:cd|chdir|pushd|popd|sl|set-location|push-location|pop-location)(?:\s|$)/i.test(part) || /^set\s.*pipefail\s*$/.test(part)) continue;
    const b = observedNorm(part.replace(RE_OBSERVED_ENV, "").replace(/\s+2>&1$/, ""));
    if (b) out.push(b);
  }
  return out;
}

// ---- the CLI's flags, read before the engine loads (1.30, review 8 — ds-maint 13) ---------------------------------------------------
// The CLI's boolean switches — ONE list: the CLI's BOOL_FLAGS (cli/commands.js; its value flags are VALUE_FLAG_SPECS there) and the
// approval guard's shell lexer (guards.js cliApprovalAction — `dev-spec approve …` parsed: any other `--flag` takes the next word as
// its value) read it, and so does the facade (spec.CLI_SWITCHES). It lived in engine/guards.js: a mistyped `--flag` loaded the whole
// engine (~0.17 s) to be refused. A new switch goes HERE (in a CLI-only list the lexer would read the next word as its value);
// cli/tests/02-surfaces-parity.js holds an operation argument's `type` (switch / bool) to it.
const CLI_SWITCHES = new Set(["json", "run", "remove", "write", "md", "html", "batch", "include-brief", "include-body", "code", "force",
  "reopen", "yes", "brownfield", "parallel", "clear", "apply", "discovery", "expect-fail", "help", "matrix", "csv", "waves",
  "print-config"]); // (print-config: 1.16 C1 — statusline --print-config)
CLI_SWITCHES.add("revoke"); // approve <feature> <phase> --revoke (the approval hook reads it as a switch too)
CLI_SWITCHES.add("gherkin"); // export [f] --gherkin (= spec_export {format: "gherkin"})
CLI_SWITCHES.add("install").add("uninstall"); // merge-state --install / --uninstall (the git merge driver's setup)
CLI_SWITCHES.add("explain"); // classify "<text>" --explain (= spec_classify {explain: true})
CLI_SWITCHES.add("adr"); // export [f] --adr (= spec_export {format: "adr"})
CLI_SWITCHES.add("dry-run"); // import … --dry-run (= spec_import {dryRun: true} — nothing written, the same result + a preview)
CLI_SWITCHES.add("tests"); // dupes [feature] --tests (= spec_scan {duplicates: true, tests: true} — test files too)

// Did-you-mean — the one edit distance behind every suggestion: a track (tracks.js suggestTrack), a tool argument (the MCP server's
// unknown-argument refusal), a CLI flag (cli/main.js — before the engine loads), an eval-harness flag. The engine's closestName IS this
// one (core.js). Words are short (names, keys), so the O(a·b) table is cheap.
// The optimal-string-alignment distance: insert, delete, substitute — and a transposition ('sasa', 'revokde') — cost 1.
function osaDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[a.length][b.length];
}
// The candidate nearest to `word` — compared case-insensitively — within `limit(candidate, word)` edits (default: max(1,
// ⌊candidate length / 3⌋), the CLI's rule for a mistyped flag; the first of equals wins), else null. A suggestion only:
// never accepted as input.
function closestName(word, candidates, limit) {
  const w = String(word == null ? "" : word).toLowerCase();
  const max = typeof limit === "function" ? limit : (c) => Math.max(1, Math.floor(c.length / 3));
  let best = null;
  for (const c of candidates || []) {
    if (typeof c !== "string") continue;
    const n = osaDistance(w, c.toLowerCase());
    if (n <= max(c, w) && (!best || n < best.n)) best = { c, n };
  }
  return best ? best.c : null;
}

module.exports = {
  SESSION_MAX_UP, PROJECT_MAX_UP, RE_AUTOGEN, RE_UNEXPANDED_VAR, unexpandedVar, usable, RE_HOME_PREFIX, expandHome, isNetwork,
  fsTargetPath, editTargets, utf16OrUtf8, textOf, jsonOf, readText, readJsonFile, isUtf16,
  SHORT_NAME_LONGS, shortNameOf, mayShortName, shortNamesRead, shortDirAt, winPathTrim, realPrefix, realPathLoose, longPath,
  isDevSpecProject, nearestDevSpec, nearestSpecs, nearestProject, resolveProjectDir, sessionAnchors, sessionProjects,
  trimSlashEnd, approvalPlain, approvalMayBe, APPROVAL_CANDIDATE_TESTS, RE_APPROVAL_VERB, dotGlob, guardedFileOf, specsParentOf,
  MCP_FILE_VERBS, isMcpFileTool, APPROVAL_TOOLS, RE_APPROVAL_MCP, approvalHookMatcher, mcpPathArgs, observedNorm, observedBodies,
  CLI_SWITCHES, closestName,
};
