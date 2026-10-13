"use strict";

/**
 * dev-spec-driven — what the hooks share BEFORE the engine loads (zero-dependency: Node core and mcp/lib/probe.js only; it never
 * requires the engine, so a hook's cheap pre-check stays cheap). Not a hook itself: hooks/hooks.json runs the hook scripts, which
 * require this file — and mcp/server.js, for the projectDir parser it shares with the approval hook. Is a folder a dev-spec
 * project, where is it, a file as the engine reads it (UTF-8 or UTF-16), a network path and a Write / Edit target as the file
 * system reads it: mcp/lib/probe.js (ONE rule for the hooks, the status line and the engine), re-exported here under the names
 * this file always had (readJson = probe.readJsonFile) — loaded on first use: the runner alone needs none of it.
 *
 *   - runHook / finish / payloadOf / eventOf — every hook's process: the payload read from stdin and parsed, decide run once, the
 *     safety net, the one flushed exit.
 *   - probe() — mcp/lib/probe.js, required on first use (each hook's pre-filter runs before it).
 *   - editTargets / fsTargetPath — the probe's (the engine's approvalEditTargets / guardTargetPath ARE them).
 *   - parseProjectDir / fileUriToPath / unexpandedVar — ONE reading of an MCP tool's projectDir (a path or a local file:// URI), the
 *     approval hook's and the MCP server's.
 *   - approvalProjects — the projects an approval-shaped tool call may act on, for the approval hook's raw level read.
 *   - sessionFlagFile — a tiny per-session marker in the OS temp folder (the guard hook's forced-approval note, once a session).
 *   - claimProse / claimMatch — the stop gate's claim scan as the Stop hook's pre-filter, from the build's
 *     hooks/stop-claims.generated.json.
 * mcp/tests/10-guards-guard-downs.js checks the readings agree with the engine's.
 */

const os = require("os");
const path = require("path");

// ---- the hooks' runner ------------------------------------------------------------------------------------------------------
// ONE process shape for every hook. A hook is its decision — `decide(raw, opts)` → the ONE object it prints (a permission decision,
// additionalContext, a block) or null — exported for in-process callers (mcp/tests/harness.js hookIn: no process start, ~100× cheaper)
// and run here when the file is the process's main module. decide never exits and never writes stdout; it reads the process's
// environment and working folder as the engine does, so an in-process caller applies its own for the call. Each hook's pre-filter
// still runs first in its decide, before anything heavier loads.
// finish(obj?) is the process's one exit: at most one JSON object on stdout, the process exiting only once it is flushed (Windows and
// Linux pipes truncate otherwise — conventions.md → Flush stdout before exiting); a second call is a no-op. runHook(decide, opts) reads
// the payload from stdin asynchronously (fs.readFileSync(0) is unreliable on Windows pipes) and runs decide(raw, { timedOut }) ONCE —
// at stdin's end, or from the safety net (SAFETY_NET_MS, 2 s: a stdin that never ends; timedOut true — the approval hook asks on a
// partial payload naming dev-spec) — then finishes with its answer. It never crashes: an exception in decide, or a stdin error, is a
// silent exit 0 — never a block (past its pre-check the approval hook catches its own and asks). A terminal stdin runs decide("{}").
// opts.maxInput: past that many characters the rest is drained unread and decide gets "" (the observe and plan hooks ignore an
// oversized payload).
const SAFETY_NET_MS = 2000;
let finished = false;
function finish(obj) {
  if (finished) return;
  finished = true;
  if (!obj) process.exit(0);
  process.stdout.write(JSON.stringify(obj), () => process.exit(0));
}
function runHook(decide, opts = {}) {
  const max = opts.maxInput > 0 ? opts.maxInput : Infinity;
  let ran = false, input = "", tooBig = false;
  const run = (raw, timedOut) => {
    if (ran) return; // stdin's end and the safety net must not both run it
    ran = true;
    let out = null;
    try { out = decide(raw, { timedOut }); } catch { out = null; }
    finish(out);
  };
  if (process.stdin.isTTY) return run("{}", false);
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (c) => {
    if (tooBig) return;
    input += c;
    if (input.length > max) { tooBig = true; input = ""; }
  });
  process.stdin.on("end", () => run(input, false));
  process.stdin.on("error", () => finish());
  setTimeout(() => run(input, true), SAFETY_NET_MS).unref(); // the safety net
}
// The payload a decide reads: its raw text → the object it holds, or null (not JSON, or JSON that is no object — an array, a string…);
// an empty text is {}. eventOf: its event name (hook_event_name, or the camelCase hookEventName), else "".
function payloadOf(raw) {
  let p;
  try { p = JSON.parse(raw || "{}"); } catch { return null; }
  return p && typeof p === "object" && !Array.isArray(p) ? p : null;
}
const eventOf = (p) => p.hook_event_name || p.hookEventName || "";

// The project probe: the rule, the walks, the readers, isNetwork, a target path — Node core only, like this file. Required on first
// use (a hook's runner and pre-filter need none of it).
let PROBE = null;
const probe = () => PROBE || (PROBE = require(path.join(__dirname, "..", "mcp", "lib", "probe.js")));
const isNetwork = (p) => probe().isNetwork(p);
const usable = (v) => probe().usable(v);
const expandHome = (p) => probe().expandHome(p);
const unexpandedVar = (v) => probe().unexpandedVar(v);

// The share a network path lies on (`\\host\share`, lower case, `\\?\UNC\` read as `\\`), or null.
function shareOf(p) {
  if (!isNetwork(p)) return null;
  const s = String(p).replace(/\//g, "\\").replace(/^\\\\\?\\UNC\\/i, "\\\\");
  const m = /^\\\\([^\\]+)\\([^\\]+)/.exec(s);
  return m ? ("\\\\" + m[1] + "\\" + m[2]).toLowerCase() : null;
}

// ONE reading of an MCP tool's projectDir, shared by the approval hook and mcp/server.js (it accepted a
// local file:// URI the hook read as a relative folder: spec_approve {projectDir: "file:///…/projA", force: true} went through at ask).
// The engine's unexpanded-variable rule is the probe's (files.js unexpandedVar — mcp/tests/10-guards-shell-writes.js checks they agree):
// `${…}`, a leading `$NAME`, a `%NAME%`.
const RE_DOTDOT = /(^|[\\/])\.\.([\\/]|$)/;
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
  } else p = expandHome(p); // "~/zz": the home folder's zz (files.js expandHome)
  if (isNetwork(p)) return { code: "project-network" };
  return { dir: path.resolve(base || process.cwd(), p) };
}

// The folders a `cd` / `chdir` / `pushd` / `Set-Location` / `sl` / `Push-Location` in a command moves to, and the SPEC_PROJECT_DIR /
// CLAUDE_PROJECT_DIR it assigns (`X=…`, `export X=…`, `set X=…`, `$env:X = …`) — read as text (a superset: nothing is evaluated).
const RE_CD = /(?:^|[\s;&|(){}])(?:cd|chdir|pushd|sl|set-location|push-location)(?:[ \t]+(?:\/d|-(?:literalpath|path|lp):?))?[ \t]+(?:"([^"]*)"|'([^']*)'|([^\s;&|)'"]+))/gi;
const RE_ENV_SET = /(?:^|[\s;&|(){}])(?:\$env:)?(?:SPEC_PROJECT_DIR|CLAUDE_PROJECT_DIR)[ \t]*=[ \t]*(?:"([^"]*)"|'([^']*)'|([^\s;&|)'"]+))/gi;
const RE_PROJECT_FLAG = /--project(?:=|\s+)(?:"([^"]*)"|'([^']*)'|([^\s;&|)]+))/g;

// The projects an approval-shaped tool call may act on, the session's own first-class: → [folders] (≤ max, distinct), for a raw read
// of each one's .specs/roadmap.json (the strictest level wins). opts: { cwd (the payload's), env ({CLAUDE_PROJECT_DIR,
// SPEC_PROJECT_DIR}), named ([folders the call names: MCP projectDir, the edited file's project]), command (a shell command: its
// --project values, SPEC_PROJECT_DIR= assignments — the folders themselves — and cd targets — where the CLI acts from each: the probe's
// nearestProject, the CLI's own resolver walk), max }.
// The session's folders (the payload cwd — walked up like the CLI —, CLAUDE_PROJECT_DIR, SPEC_PROJECT_DIR) are Claude Code's / the
// user's: read even on a network share. A network path the AGENT names is refused unless it lies on a share the session is on.
function approvalProjects(opts = {}) {
  const P = probe();
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
    const h = expandHome(t);
    if (isNetwork(h)) return shares.has(shareOf(h)) ? h : null;
    if (base && isNetwork(base)) { // relative to a network folder of the session's: on its share
      if (path.isAbsolute(h) || /^[A-Za-z]:/.test(h)) return path.resolve(h);
      return probe().trimSlashEnd(base) + "\\" + h.replace(/\//g, "\\");
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
        if (d) add(P.nearestProject(d) || d);
      }
      const next = named(t, base);
      if (next) base = next;
    }
  }
  add(cwd && (P.nearestProject(cwd) || cwd));
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

// the stop gate's claim scan as the Stop hook's pre-filter, BEFORE the engine loads. f: hooks/stop-claims.generated.json
// (scripts/build.js: the engine's own claim patterns, word wrapper and prose regexes — guards.js stopClaimFilter). claimProse is the
// engine's stopProse run with those regexes (the message's tail without fenced code, HTML comments — core.js replaceHtmlCommentSpans'
// scan —, inline code and quoted lines); claimMatch: does any claim pattern, word-bounded as stopPatterns compiles it, match that prose?
// A superset of stopClaims' `claim` — negations and questions stay the engine's to judge. mcp/tests/10-guards-guard-downs.js checks the
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
// what the pre-filter's regexes scan, as the engine's stopScan: a prose holding a character past U+00FF → its exact one-byte
// projection, each pattern source rewritten for it (mcp/lib/latin1-scan.js — the regexes' two-byte code cost ~30 ms more here);
// else the prose as a one-byte copy (a wide character inside a code fence left it two-byte). → { text, source(src) → the source to
// compile }. f: the generated filter (its wrapper, claims and triggers make the table).
function claimScan(prose, f) {
  const same = (s) => s;
  if (!/[^\x00-\xff]/.test(prose)) return { text: Buffer.from(prose, "latin1").toString("latin1"), source: same };
  const L1 = require(path.join(__dirname, "..", "mcp", "lib", "latin1-scan.js"));
  const table = L1.latin1Table([f.word.pre + f.word.post, ...f.claims, ...(Array.isArray(f.triggers) ? f.triggers : []).map((t) => t.source)]);
  const pr = table && L1.latin1Text(prose, table);
  return pr ? { text: pr.text, source: (s) => L1.latin1Pattern(s, table) } : { text: prose, source: same };
}
// ONE alternation of every pattern, each inside the word wrapper's group: a match exists at some position for some pattern exactly
// when the alternation matches there (backtracking tries every alternative) — and it compiles once (34 patterns apart: ~19 ms).
// scan: claimScan's (the caller made it for the trigger test already), else made here from the message.
function claimMatch(message, f, scan) {
  if (!f.claims.length) return false;
  const sc = scan || claimScan(claimProse(message, f.prose), f);
  return new RegExp(sc.source(f.word.pre + "(?:" + f.claims.join(")|(?:") + ")" + f.word.post), String(f.word.flags).replace("g", "")).test(sc.text);
}

module.exports = { runHook, finish, payloadOf, eventOf, probe, isNetwork, shareOf, approvalProjects, sessionFlagFile, claimProse, claimScan, claimMatch, unexpandedVar,
  RE_DOTDOT, fileUriToPath, parseProjectDir };
// the probe's names, read through on first use — readJson is its readJsonFile
for (const [name, key] of [["utf16OrUtf8"], ["textOf"], ["jsonOf"], ["readText"], ["readJson", "readJsonFile"], ["isUtf16"], ["fsTargetPath"],
  ["editTargets"], ["nearestSpecs"], ["RE_UNEXPANDED_VAR"]]) {
  Object.defineProperty(module.exports, name, { enumerable: true, get: () => probe()[key || name] });
}
