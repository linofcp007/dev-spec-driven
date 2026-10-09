"use strict";

/**
 * dev-spec-driven — what the hooks share BEFORE the engine loads (zero-dependency: Node core only; it never requires the engine,
 * so a hook's cheap pre-check stays cheap). Not a hook itself: hooks/hooks.json runs the hook scripts, which require this file.
 *
 *   - utf16OrUtf8 / textOf / jsonOf / readText / readJson — a file as the engine reads it (files.js decodeText): a UTF-16 BOM (FF FE / FE FF —
 *     Windows PowerShell 5.1's Out-File and `>` write one) decides, else UTF-8; the BOM itself dropped (1.24 review 6, C3: the
 *     approval, guard and stop hooks read a UTF-16 roadmap.json / .state.json as UTF-8 — the guards "off", the gate blind). The
 *     guard, stop and observe hooks check for the BOM inline and require this file only then: their hot paths stay as cheap.
 *   - editTargets — a Write / Edit target as the file system reads it, the engine's approvalEditTargets (C5).
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
// suffix taken out — plus, on Windows, when a segment looks like an 8.3 short name (`ROADMA~1.JSO`, `STATE~1.JSO`), its real path
// (the file's, else its parent's + the name). A network path is never resolved on the disk. The engine's approvalEditTargets.
function editTargets(fp, cwd, win = process.platform === "win32") {
  const s = fsTargetPath(String(fp).trim(), win);
  if (isNetwork(s)) return [s];
  const c = usable(cwd);
  if (c && isNetwork(c) && !path.isAbsolute(s) && !/^[A-Za-z]:/.test(s)) return [c.replace(/[\\/]+$/, "") + "/" + s]; // under a network cwd: text only
  const base = c && !isNetwork(c) ? path.resolve(fsTargetPath(c, win)) : process.cwd();
  let abs;
  try { abs = path.resolve(base, s); } catch { return [s]; }
  const out = [abs];
  if (win && /~\d/.test(abs)) {
    let real = null;
    try { real = fs.realpathSync.native(abs); } catch {
      try { real = path.join(fs.realpathSync.native(path.dirname(abs)), path.basename(abs)); } catch { real = null; }
    }
    if (real && real !== abs) out.push(real);
  }
  return out;
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
  claimProse, claimMatch };
