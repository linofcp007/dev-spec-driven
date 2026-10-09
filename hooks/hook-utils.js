"use strict";

/**
 * dev-spec-driven — what the hooks share BEFORE the engine loads (zero-dependency: Node core only; it never requires the engine,
 * so a hook's cheap pre-check stays cheap). Not a hook itself: hooks/hooks.json runs the hook scripts, which require this file —
 * and (1.25.1) mcp/server.js, for the projectDir parser it shares with the approval hook.
 *
 *   - utf16OrUtf8 / textOf / jsonOf / readText / readJson — a file as the engine reads it (files.js decodeText): a UTF-16 BOM (FF FE / FE FF —
 *     Windows PowerShell 5.1's Out-File and `>` write one) decides, else UTF-8; the BOM itself dropped (1.24 review 6, C3: the
 *     approval, guard and stop hooks read a UTF-16 roadmap.json / .state.json as UTF-8 — the guards "off", the gate blind). The
 *     guard, stop and observe hooks check for the BOM inline and require this file only then: their hot paths stay as cheap.
 *   - editTargets — a Write / Edit target as the file system reads it, the engine's approvalEditTargets (C5; 1.25.1: its real path
 *     on every platform — a folder linked to .specs/).
 *   - parseProjectDir / fileUriToPath / unexpandedVar — ONE reading of an MCP tool's projectDir (a path or a local file:// URI), the
 *     approval hook's and the MCP server's (1.25.1, review 7).
 *   - approvalProjects — the projects an approval-shaped tool call may act on, for the approval hook's raw level read (C4).
 *   - sessionFlagFile — a tiny per-session marker in the OS temp folder (the guard hook's forced-approval note, once a session).
 *   - claimProse / claimMatch — the stop gate's claim scan as the Stop hook's pre-filter (1.24 r6 I-I4), from the build's
 *     hooks/stop-claims.generated.json.
 * mcp/tests/10-guards-review6.js checks the readings agree with the engine's.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

// A file's bytes as text: a UTF-16 BOM decides (LE / BE; an odd trailing byte dropped), anything else is UTF-8.
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
// A file's text, decoded, without its BOM. Throws as fs.readFileSync does (a missing file: ENOENT).
const readText = (file) => textOf(fs.readFileSync(file));
// A JSON file, decoded and parsed. Throws on a missing or broken file.
const readJson = (file) => jsonOf(fs.readFileSync(file));
// Do these bytes start with a UTF-16 BOM? (The hooks' hot paths check this inline and require this file only then.)
const isUtf16 = (buf) => buf.length >= 2 && ((buf[0] === 0xff && buf[1] === 0xfe) || (buf[0] === 0xfe && buf[1] === 0xff));

// A network or device path (\\host\share, //host/share, \\?\UNC\…) — never stat'ed / realpath'ed here on behalf of the agent (an SMB
// connection to the host it named). A copy of the engine's isNetworkPath (files.js): \\?\C:\… is local, WSL's \\wsl$\ and
// \\wsl.localhost\ are no network host.
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
// The share a network path lies on (`\\host\share`, lower case, `\\?\UNC\` read as `\\`), or null.
function shareOf(p) {
  if (!isNetwork(p)) return null;
  const s = String(p).replace(/\//g, "\\").replace(/^\\\\\?\\UNC\\/i, "\\\\");
  const m = /^\\\\([^\\]+)\\([^\\]+)/.exec(s);
  return m ? ("\\\\" + m[1] + "\\" + m[2]).toLowerCase() : null;
}
// A usable folder value: a non-empty string, no unexpanded ${VAR}.
const usable = (v) => (typeof v === "string" && v.trim() && !/^\$\{[^}]*\}$/.test(v.trim()) && v.length <= 4096 ? v.trim() : null);

// The engine's guardTargetPath (engine/guards.js — 1.23 review 5, L21), on win32 only: Git Bash's `/c/…` is `C:/…`, and an NTFS
// stream suffix on the last segment is dropped (`a.json::$DATA` IS a.json).
function fsTargetPath(p, win = process.platform === "win32") {
  let s = String(p);
  if (!win) return s;
  const m = /^\/([A-Za-z])(?=\/|$)/.exec(s);
  if (m) s = m[1].toUpperCase() + ":" + (s.slice(2) || "/");
  const cut = Math.max(s.lastIndexOf("/"), s.lastIndexOf("\\")) + 1;
  const from = cut === 0 && /^[A-Za-z]:/.test(s) ? 2 : 0;
  const i = s.indexOf(":", cut + from);
  return i > cut ? s.slice(0, i) : s;
}
// A Write / Edit target (absolute, or relative to cwd) → the paths the file system reads it as: [resolved] — `./`, `..` and a stream
// suffix taken out — plus its real path (the file's, else its folder's + the name): an 8.3 short name (`ROADMA~1.JSO`) and (1.25.1,
// review 7) a folder linked to .specs/ or to a feature folder (`ln -s .specs sx` → `sx/roadmap.json`). A network path is never resolved
// on the disk. The engine's approvalEditTargets. (The approval hook calls it only for a path naming .specs, a short name or one of the
// guarded file names — RE_EDIT_MAYBE.)
function editTargets(fp, cwd, win = process.platform === "win32") {
  const s = fsTargetPath(String(fp).trim(), win);
  if (isNetwork(s)) return [s];
  const c = usable(cwd);
  if (c && isNetwork(c) && !path.isAbsolute(s) && !/^[A-Za-z]:/.test(s)) return [c.replace(/[\\/]+$/, "") + "/" + s]; // under a network cwd: text only
  const base = c && !isNetwork(c) ? path.resolve(fsTargetPath(c, win)) : process.cwd();
  let abs;
  try { abs = path.resolve(base, s); } catch { return [s]; }
  const out = [abs];
  let real = null;
  try { real = fs.realpathSync.native(abs); } catch {
    try { real = path.join(fs.realpathSync.native(path.dirname(abs)), path.basename(abs)); } catch { real = null; }
  }
  if (real && real !== abs) out.push(real);
  return out;
}
// 1.25.1 (review 7, finding 5) — ONE reading of an MCP tool's projectDir, shared by the approval hook and mcp/server.js (it accepted a
// local file:// URI the hook read as a relative folder: spec_approve {projectDir: "file:///…/projA", force: true} went through at ask).
// The engine's unexpanded-variable rule (files.js unexpandedVar — mcp/tests/10-guards-review7.js checks they agree): `${…}`, a leading
// `$NAME`, a `%NAME%`.
const RE_UNEXPANDED_VAR = /\$\{|^\$[A-Za-z_]|%[A-Za-z_][A-Za-z0-9_]*%/;
const unexpandedVar = (v) => RE_UNEXPANDED_VAR.test(String(v == null ? "" : v).trim());
const RE_DOTDOT = /(^|[\\/])\.\.([\\/]|$)/;
// A leading ~ (alone, ~/ or ~\) is the home folder — PowerShell 5.1 and MCP arguments never expand it (engine/files.js RE_HOME_PREFIX).
const RE_HOME_PREFIX = /^~(?=$|[\\/])/;
// A local file:// URI → its absolute path, else null (a host other than localhost, '..', a control character; on Windows a drive path
// only — file:///C:/x, file:///c%3A/x).
function fileUriToPath(uri) {
  const m = /^file:\/\/([^/?#]*)(\/[^?#]*)$/i.exec(String(uri).trim());
  if (!m || (m[1] && m[1].toLowerCase() !== "localhost")) return null;
  let p;
  try { p = decodeURIComponent(m[2]); } catch { return null; }
  if (/[\u0000-\u001f\u007f]/.test(p)) return null;
  if (process.platform === "win32") {
    if (!/^\/[A-Za-z]:(\/|$)/.test(p)) return null;
    p = p.slice(1);
  }
  if (RE_DOTDOT.test(p) || isNetwork(p)) return null;
  return path.resolve(p);
}
// projectDir as a tool argument, read WITHOUT any fs call → { none: true } not given (absent, blank, a variable left unexpanded) · { dir }
// the absolute folder (a local file:// URI is its path; a relative one resolves from `base`) · { code } refused: project-dotdot (a '..'
// segment), project-network (a network / device path, a file:// URI naming a host) or project-uri (a file:// URI that is no local path).
// The MCP server refuses the call on a code; the approval hook can't tell which project such a call acts on — it asks (fails closed).
function parseProjectDir(v, base) {
  if (typeof v !== "string" || !v.trim() || unexpandedVar(v)) return { none: true };
  const s = v.trim();
  if (RE_DOTDOT.test(s)) return { code: "project-dotdot" };
  let p = s;
  if (/^file:/i.test(s)) {
    const host = /^file:\/\/([^/?#]*)/i.exec(s);
    if (host && host[1] && host[1].toLowerCase() !== "localhost") return { code: "project-network" };
    p = fileUriToPath(s);
    if (!p) return { code: "project-uri" };
  } else if (RE_HOME_PREFIX.test(p)) p = path.join(os.homedir(), p.slice(1)); // "~/zz": the home folder's zz (files.js expandHome)
  if (isNetwork(p)) return { code: "project-network" };
  return { dir: path.resolve(base || process.cwd(), p) };
}

// The nearest folder at or above dir holding a .specs/ folder (≤ 40 levels — the engine's SESSION_MAX_UP), else null. A network path
// is taken as it is, never walked (no stat goes up a share).
const MAX_UP = 40;
function nearestSpecs(dir) {
  if (!usable(dir)) return null;
  if (isNetwork(dir)) return dir.trim();
  let d = path.resolve(dir.trim());
  for (let i = 0; i < MAX_UP; i++) {
    try { if (fs.statSync(path.join(d, ".specs")).isDirectory()) return d; } catch { /* none here */ }
    const up = path.dirname(d);
    if (up === d) break;
    d = up;
  }
  return null;
}

// The folders a `cd` / `chdir` / `pushd` / `Set-Location` / `sl` / `Push-Location` in a command moves to, and the SPEC_PROJECT_DIR /
// CLAUDE_PROJECT_DIR it assigns (`X=…`, `export X=…`, `set X=…`, `$env:X = …`) — read as text (a superset: nothing is evaluated).
const RE_CD = /(?:^|[\s;&|(){}])(?:cd|chdir|pushd|sl|set-location|push-location)(?:[ \t]+(?:\/d|-(?:literalpath|path|lp):?))?[ \t]+(?:"([^"]*)"|'([^']*)'|([^\s;&|)'"]+))/gi;
const RE_ENV_SET = /(?:^|[\s;&|(){}])(?:\$env:)?(?:SPEC_PROJECT_DIR|CLAUDE_PROJECT_DIR)[ \t]*=[ \t]*(?:"([^"]*)"|'([^']*)'|([^\s;&|)'"]+))/gi;
const RE_PROJECT_FLAG = /--project(?:=|\s+)(?:"([^"]*)"|'([^']*)'|([^\s;&|)]+))/g;
const home = (t) => (/^~(?=$|[\\/])/.test(t) ? os.homedir() + t.slice(1) : t);

// The projects an approval-shaped tool call may act on, the session's own first-class: → [folders] (≤ max, distinct), for a raw read
// of each one's .specs/roadmap.json (the strictest level wins). opts: { cwd (the payload's), env ({CLAUDE_PROJECT_DIR,
// SPEC_PROJECT_DIR}), named ([folders the call names: MCP projectDir, the edited file's project]), command (a shell command: its
// --project values, SPEC_PROJECT_DIR= assignments — the folders themselves — and cd targets — the nearest .specs/ at or above
// each, as the CLI walks up from its cwd), max }.
// The session's folders (the payload cwd — walked up like the CLI —, CLAUDE_PROJECT_DIR, SPEC_PROJECT_DIR) are Claude Code's / the
// user's: read even on a network share. A network path the AGENT names is refused unless it lies on a share the session is on.
function approvalProjects(opts = {}) {
  const env = opts.env || {};
  const cwd = usable(opts.cwd);
  const anchors = [env.CLAUDE_PROJECT_DIR, env.SPEC_PROJECT_DIR].map(usable).filter(Boolean);
  const session = [cwd, ...anchors].filter(Boolean);
  const shares = new Set(session.map(shareOf).filter(Boolean));
  const localBase = cwd && !isNetwork(cwd) ? path.resolve(cwd) : null;
  // a folder the agent named → its path, or null (unusable; a network path off the session's shares)
  const named = (v, base) => {
    const t = usable(v);
    if (!t) return null;
    const h = home(t);
    if (isNetwork(h)) return shares.has(shareOf(h)) ? h : null;
    if (base && isNetwork(base)) { // relative to a network folder of the session's: on its share
      if (path.isAbsolute(h) || /^[A-Za-z]:/.test(h)) return path.resolve(h);
      return base.replace(/[\\/]+$/, "") + "\\" + h.replace(/\//g, "\\");
    }
    try { return path.resolve(base || localBase || process.cwd(), h); } catch { return null; }
  };
  const out = [];
  const add = (d) => { if (d) out.push(d); };
  for (const d of Array.isArray(opts.named) ? opts.named : []) add(named(d, cwd));
  const command = typeof opts.command === "string" ? opts.command.slice(0, 64 * 1024) : "";
  if (command) {
    for (const m of command.matchAll(RE_PROJECT_FLAG)) add(named(m[1] || m[2] || m[3], cwd));
    for (const m of command.matchAll(RE_ENV_SET)) add(named(m[1] || m[2] || m[3], cwd));
    let base = cwd; // cd's chain: `cd a && cd b` ends in a/b (each also read from cwd)
    let n = 0;
    for (const m of command.matchAll(RE_CD)) {
      if (++n > 16) break;
      const t = m[1] || m[2] || m[3];
      if (!t || t === "-") continue;
      for (const b of new Set([base, cwd])) {
        const d = named(t, b);
        if (d) add(isNetwork(d) ? d : nearestSpecs(d) || d);
      }
      const next = named(t, base);
      if (next) base = next;
    }
  }
  add(cwd && (nearestSpecs(cwd) || cwd));
  for (const a of anchors) add(isNetwork(a) ? a : path.resolve(a));
  const key = (d) => (process.platform === "win32" || process.platform === "darwin" ? String(d).toLowerCase() : String(d));
  const seen = new Set();
  return out.filter((d) => !seen.has(key(d)) && seen.add(key(d))).slice(0, opts.max || 12);
}

// A per-session marker file in the OS temp folder: dev-spec-<kind>-<sha1(session id), 16 hex>.flag (the session id is Claude Code's;
// hashed, so no path is ever built from it).
function sessionFlagFile(kind, sessionId) {
  const h = require("crypto").createHash("sha1").update(String(sessionId)).digest("hex").slice(0, 16);
  return path.join(os.tmpdir(), "dev-spec-" + String(kind).replace(/[^a-z0-9-]/gi, "") + "-" + h + ".flag");
}

// 1.24 r6 I-I4 — the stop gate's claim scan as the Stop hook's pre-filter, BEFORE the engine loads. f: hooks/stop-claims.generated.json
// (scripts/build.js: the engine's own claim patterns, word wrapper and prose regexes — guards.js stopClaimFilter). claimProse is the
// engine's stopProse run with those regexes (the message's tail without fenced code, HTML comments — core.js replaceHtmlCommentSpans'
// scan —, inline code and quoted lines); claimMatch: does any claim pattern, word-bounded as stopPatterns compiles it, match that prose?
// A superset of stopClaims' `claim` — negations and questions stay the engine's to judge. mcp/tests/10-guards-review6.js checks the
// prose is the engine's on every input it tries, and that no message the engine reads as a claim is filtered out.
function claimProse(message, p) {
  const s = String(message == null ? "" : message).replace(/\r\n?/g, "\n");
  const unfenced = s.slice(-p.max).replace(new RegExp(p.fence.source, p.fence.flags), "$1");
  let out = "", at = 0;
  for (let i = unfenced.indexOf("<!--"); i !== -1;) {
    const j = unfenced.indexOf("-->", i + 4);
    if (j === -1) break;
    out += unfenced.slice(at, i) + " ";
    at = j + 3;
    i = unfenced.indexOf("<!--", at);
  }
  const quote = new RegExp(p.quote.source, p.quote.flags);
  return (at ? out + unfenced.slice(at) : unfenced).replace(new RegExp(p.code.source, p.code.flags), " ")
    .split("\n").filter((l) => !quote.test(l)).join("\n");
}
// ONE alternation of every pattern, each inside the word wrapper's group: a match exists at some position for some pattern exactly
// when the alternation matches there (backtracking tries every alternative) — and it compiles once (34 patterns apart: ~19 ms).
function claimMatch(message, f) {
  if (!f.claims.length) return false;
  const text = claimProse(message, f.prose);
  return new RegExp(f.word.pre + "(?:" + f.claims.join(")|(?:") + ")" + f.word.post, String(f.word.flags).replace("g", "")).test(text);
}

module.exports = { utf16OrUtf8, textOf, jsonOf, readText, readJson, isUtf16, isNetwork, shareOf, fsTargetPath, editTargets, nearestSpecs, approvalProjects, sessionFlagFile,
  claimProse, claimMatch, RE_UNEXPANDED_VAR, unexpandedVar, RE_DOTDOT, fileUriToPath, parseProjectDir };
