#!/usr/bin/env node
"use strict";

/**
 * dev-spec-driven — human approval guard (opt-in, zero-dependency).
 *
 * Wired from hooks/hooks.json as PreToolUse, matcher
 * ^(Bash|PowerShell|Monitor|Write|Edit|NotebookEdit|(mcp__.+__)?(spec_approve|spec_feature|spec_init|spec_add_track)|mcp__.+__…<file verb>…)$
 * (NotebookEdit and another MCP server's file tools — write / edit / move / delete / create… by the tool name's verb).
 * An approval is the human's act, but an agent can call spec_approve (force: true included) or run `dev-spec approve` itself.
 * This hook does NOTHING unless the project opted in (`.specs/roadmap.json` meta.approvalGuard "ask" | "deny" —
 * spec_init {approvalGuard} / `dev-spec init --approval-guard ask|deny`). Then an agent's approval — spec_approve under any MCP
 * server prefix, spec_feature {action: "remove", confirm: true}, `dev-spec approve …` / `dev-spec feature remove … --yes`
 * through the Bash / PowerShell / Monitor tool (read in that shell's own syntax: escapes, line continuations, $'…', $( ),
 * heredocs, PowerShell's --%), or a guard-down action — lowering this guard (spec_init {approvalGuard} / `init --approval-guard`),
 * weakening what it stands for (evidence observed → reported, clearing / dropping approval roles, removing / changing a project
 * check, the stop gate or the edit guard turned down, +tdd / +ai turned off), a shell command writing .specs/roadmap.json,
 * a .state.json or a harness-observed log (a redirection, a writer, `dev-spec merge-state`, git's in-place restores; 
 * through a glob, a brace expansion, a variable, a whole folder, an extractor, a link to .specs/, text fed to a shell), or a
 * Write / Edit / NotebookEdit (or another MCP server's file tool) of .specs/roadmap.json, of a feature's .state.json or
 * of an .execution/observed.jsonl — also through a folder linked to .specs/ (its real path) — gets:
 *   ask  → permissionDecision "ask": the user confirms or declines (the reason names the feature, phase(s), role and, loudly,
 *          --force). Claude Code shows it in auto mode too; only bypass-permissions mode may skip it (dontAsk refuses it);
 *   deny → permissionDecision "deny" (auto mode included): the reason tells the agent approvals are the
 *          human's — the user runs it in their own terminal or with Claude Code's `!` prefix, and the agent stops and asks.
 * spec.approvalGuardDecision decides (pure; the engine is loaded only once some candidate project has the guard on). A guardrail
 * against accidents and casual workarounds, not a sandbox: an inline or written script is not read.
 *
 * It NEVER blocks on its own trouble BEFORE the pre-check passes: a malformed payload or any error there exits 0 silently — past it
 * (a guarded project, a call that may be an approval) an engine failure ASKS. It FAILS CLOSED on a
 * roadmap.json that exists and doesn't parse: the strictest "approvalGuard": "ask" | "deny" its raw text names still holds
 * (appending a byte to the file must not switch the guard off; a BOM-less UTF-16 file is read through its NULs), on a missing one
 * while the .specs/ holds features (ask), on a projectDir that is no local path (a bad file:// URI — ask), and
 * on a payload that arrived only in part (the 2 s stdin safety net) naming dev-spec / .specs / dev-guardian / an approval tool: ask. It
 * is cheap: a tool call that can't be an approval (a Bash command naming neither dev-spec nor .specs, a Write / Edit of a file whose path
 * names no .specs/) exits before any file read; otherwise one raw read of roadmap.json (UTF-8 or UTF-16 — hook-utils.js) per
 * candidate project (hook-utils.js approvalProjects: the session's cwd and the nearest .specs/ above it, CLAUDE_PROJECT_DIR,
 * SPEC_PROJECT_DIR, the project the call names — MCP projectDir, CLI --project, the edited file's — and a command's cd /
 * Set-Location / pushd targets, SPEC_PROJECT_DIR= assignments and the folders holding a .specs/ / .guardian/ it names; each one with
 * the guard on judges the call with its own level and meta, the strictest answer wins; a network path only when it is the
 * session's own or on its share).
 */

const path = require("path");
// The hooks' runner (stdin, the safety net, the one flushed exit) and what the hooks share before the engine loads (hooks/hook-utils.js:
// the probe's readers, editTargets, approvalProjects, parseProjectDir — each loading the probe on first use, past the cheap pre-check).
const HU = require("./hook-utils.js");
const { runHook, probe } = HU;

const LEVELS = ["off", "ask", "deny"];
// The tools that run a shell command — Monitor too (it runs its command in the Bash tool's shell).
const SHELLS = new Set(["Bash", "PowerShell", "Monitor"]);
// the file-editing tools, on .specs/roadmap.json, a feature's .state.json or a harness-observed log only.
// NotebookEdit (its notebook_path): 1.25.1.
const EDITS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);
// (dev-spec's approval-shaped tools under any prefix — probe.js RE_APPROVAL_MCP; another MCP server's file tools by the verb in the
// tool's name — probe.js isMcpFileTool, the engine's test and hooks.json's matcher built from the same list; the guarded files by path —
// probe.js guardedFileOf, the engine's approvalGuardedFile. The probe loads only once the call may be one of them.)
// A path under .specs/ or .guardian/ — where the guarded files live (.guardian/baseline.json and .specs/guardian.cjs: dev-guardian's
// gate, 1.30 — the engine counts them only while a check runs it).
const RE_GUARDED_DIR = /(?:^|[\\/])\.(?:specs|guardian)(?:[\\/]|$)/i;
// A Write / Edit target that can't be one: its text names no .specs, no 8.3 short name (`SPECS~1`, `ROADMA~1.JSO`) and none of
// the guarded file names (a trailing dot or space too: Win32 drops it) — through a folder linked to .specs/ (`sx/roadmap.json`) only its
// real path names .specs.
const RE_EDIT_MAYBE = /\.specs|\.guardian|~\d|(?:^|[\\/])(?:roadmap\.json|\.state\.json|observed\.jsonl|guardian\.cjs|baseline\.json)[\s.]*$/i;
// The engine's approvalCandidate — ONE test, probe.js approvalMayBe on approvalPlain's text (linear: the dot-glob regex this hook
// carried rescanned `=.=.…` from every start — 120 K characters ran it past its 10 s timeout, and a timed-out hook lets the call
// through). The WHOLE command: one past the engine's read limit that names dev-spec is refused / asked as unreadable (an approval after
// the first 64 KB went through). A PowerShell -EncodedCommand value — base64 — is decoded by the engine: here any encoded-looking pwsh
// call goes on to it (a superset).
const candidate = (c) => {
  const P = probe();
  const t = P.approvalPlain(c);
  return P.approvalMayBe(t) || (/powershell|pwsh/i.test(t) && /(?:^|\s)[-/]e[a-z]*\s+[A-Za-z0-9+/]{8,}/i.test(t));
};
// An MCP file tool's input may touch a guarded file only if its text names .specs (also %-encoded), a guarded name or a short name.
const RE_MCP_MAYBE = /\.specs|%2especs|\.guardian|%2eguardian|roadmap\.json|\.state\.json|observed\.jsonl|guardian\.cjs|~\d/i;
// A roadmap.json that doesn't parse: the strictest level its raw text names (fail closed) — the engine's rawApprovalGuard.
const RE_RAW_GUARD = /"approvalGuard"\s*:\s*"\s*(ask|deny)\s*"/gi;
// a payload cut short — what it may be about (dev-spec, .specs/, an approval-shaped MCP tool, dev-guardian's gate: `dev-guardian
// baseline update`, .guardian/baseline.json — 1.30, review 9; the probe's pre-filter word, APPROVAL_CANDIDATE_TESTS, is the same).
const RE_PARTIAL = /dev-?spec|\.specs|guardian|spec_(?:approve|feature|init|add_track)/i;

const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);

// meta.approvalGuard, read raw (the engine is loaded only for a guarded project) → { level: 0 off · 1 ask · 2 deny, meta }.
// meta = the parsed roadmap.json meta (what a spec_init / `init` change is compared with), undefined when the file is broken.
// UTF-8 or UTF-16 with a BOM (Windows PowerShell 5.1's Out-File: read as UTF-8 it was "off").
function rawLevel(dir) {
  let text;
  try {
    text = HU.readText(path.join(dir, ".specs", "roadmap.json"));
  } catch (e) {
    // missing while the .specs/ holds features (a feature folder's .state.json) — deleted: fail closed at ask, as
    // the engine's approvalGuardLevel (meta unknown). Missing in a .specs/ without features, or unreadable: out of the way.
    return { level: e && e.code === "ENOENT" && roadmapGone(dir) ? 1 : 0 };
  }
  let j;
  try {
    j = JSON.parse(text);
  } catch {
    let level = 0; // broken → fail closed: the strictest level its text still names — NULs taken out (a BOM-less UTF-16 file)
    for (const m of text.replace(/\0/g, "").matchAll(RE_RAW_GUARD)) level = Math.max(level, LEVELS.indexOf(m[1].toLowerCase()));
    return { level };
  }
  const meta = isObj(j) && isObj(j.meta) ? j.meta : undefined;
  const v = meta ? meta.approvalGuard : undefined;
  return { level: Math.max(0, LEVELS.indexOf(typeof v === "string" ? v.trim().toLowerCase() : "")), meta: meta || {} };
}
// The candidate folders' levels ([{ dir, level, meta }] — rawLevel each) → the first of the strictest: { level, dir, meta }.
const levelsOf = (dirs) => dirs.map((d) => Object.assign({ dir: d }, rawLevel(d)));
function strictest(levels) {
  let level = 0, dir = null, meta;
  for (const l of levels) if (l.level > level) ({ level, dir, meta } = l);
  return { level, dir, meta };
}
const sessionEnv = () => ({ CLAUDE_PROJECT_DIR: process.env.CLAUDE_PROJECT_DIR, SPEC_PROJECT_DIR: process.env.SPEC_PROJECT_DIR });

// stdin never ended within the safety net's 2 s — the payload is partial (it doesn't parse). When its text names dev-spec,
// .specs/, dev-guardian or an approval tool and a project the session may be in has the guard on: ask (it used to exit 0 — allowed).
function partial(raw) {
  const text = String(raw || "");
  // (an 8.3 alias of a guarded name too, on win32 — SPECS~1, GUARDI~1: the pre-filter's own test, probe.js mayShortName)
  if (!RE_PARTIAL.test(text) && !(process.platform === "win32" && probe().mayShortName(text))) return null;
  let cwd = null;
  const m = /"cwd"\s*:\s*"((?:[^"\\]|\\.){1,4096})"/.exec(text);
  if (m) try { cwd = JSON.parse('"' + m[1] + '"'); } catch { cwd = null; }
  const s = strictest(levelsOf(HU.approvalProjects({ cwd: cwd || process.cwd(), env: sessionEnv() })));
  if (!s.level) return null;
  try {
    const spec = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
    const r = spec.approvalGuardDecision({ hook_event_name: "PreToolUse" }, LEVELS[s.level], { lang: spec.projectLang(s.dir), meta: s.meta, partial: true });
    if (r.decision !== "ask") return null;
    return { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "ask", permissionDecisionReason: r.reason } };
  } catch {
    return failClosed(s.meta);
  }
}
// a .specs/ without roadmap.json that holds features (a feature folder's .state.json) — rawLevel fails closed on it.
function roadmapGone(dir) {
  const fs = require("fs");
  const root = path.join(dir, ".specs");
  try {
    return fs.readdirSync(root, { withFileTypes: true }).some((d) => d.isDirectory() && !d.name.startsWith(".") && fs.existsSync(path.join(root, d.name, ".state.json")));
  } catch {
    return false;
  }
}
// past the pre-check — a project the call may act on has the guard on and the call may be an approval —
// the engine failed (a broken install, an exception): ASK, never a silent allow. The reason comes from the i18n tables when they load
// (the project's language as its raw meta names it), else the prompt goes without one.
function failClosed(meta) {
  let reason;
  try {
    const i18n = require(path.join(__dirname, "..", "mcp", "lib", "i18n.js"));
    const A = i18n.msg(i18n.normalizeLang(meta && typeof meta.lang === "string" ? meta.lang : "en")).approvalGuard;
    reason = A.ask(A.action({ kind: "unreadable", why: "error" }), false, meta && meta.approvalGuard); // at deny it says so (it asks, never refuses)
  } catch {
    reason = undefined;
  }
  const out = { hookEventName: "PreToolUse", permissionDecision: "ask" };
  if (typeof reason === "string") out.permissionDecisionReason = reason;
  return { hookSpecificOutput: out };
}

// The hook's decision on one payload → the object it prints (ask / deny) or null (silent). opts.timedOut: the stdin safety net fired —
// a payload that doesn't parse is a partial one.
function decide(raw, opts = {}) {
  let payload;
  try {
    payload = JSON.parse(raw || "{}");
  } catch {
    return opts.timedOut ? partial(raw) : null;
  }
  if (!isObj(payload)) return null;
  const event = payload.hook_event_name || payload.hookEventName || "";
  if (event && event !== "PreToolUse") return null;
  const tool = typeof payload.tool_name === "string" ? payload.tool_name : typeof payload.toolName === "string" ? payload.toolName : "";
  const ti = isObj(payload.tool_input) ? payload.tool_input : isObj(payload.toolInput) ? payload.toolInput : {};
  const command = SHELLS.has(tool) && typeof ti.command === "string" ? ti.command : null;
  const fpRaw = EDITS.has(tool) ? (typeof ti.file_path === "string" ? ti.file_path : typeof ti.notebook_path === "string" ? ti.notebook_path : null) : null;
  const fp = fpRaw && RE_EDIT_MAYBE.test(fpRaw) ? fpRaw.trim() : null;
  // the shell and edit tools are known by name; any other tool here is an MCP one — dev-spec's approval-shaped tool, or another server's
  // file tool whose input names .specs or a guarded file at all (no engine load else)
  const other = command === null && !EDITS.has(tool) && !SHELLS.has(tool);
  const approvalTool = other && probe().RE_APPROVAL_MCP.test(tool);
  const mcpFile = other && !approvalTool && probe().isMcpFileTool(tool) && RE_MCP_MAYBE.test(JSON.stringify(ti));
  if (!approvalTool && !(command && candidate(command)) && !fp && !mcpFile) return null;
  const cwd = typeof payload.cwd === "string" && payload.cwd.trim() ? payload.cwd.trim() : null;
  // the edited path as the file system reads it — `./`, `..`, an NTFS stream, an 8.3 short name and a folder linked
  // to .specs/ (hook-utils editTargets, the engine's approvalEditTargets).
  const paths = fp ? [fp] : mcpFile ? probe().mcpPathArgs(ti, HU.fileUriToPath) : [];
  const touched = paths.flatMap((p) => HU.editTargets(p, cwd)).filter((t) => RE_GUARDED_DIR.test(t));
  const edited = touched.find((t) => probe().guardedFileOf(t)) || null;
  if (fp && !edited) return null;
  if (mcpFile && !touched.length) return null;

  // The projects this call may act on: the one it names (MCP projectDir, CLI --project, the edited file's, a cd target, a
  // SPEC_PROJECT_DIR= assignment), then the session's (its cwd and the nearest .specs/ above it, the exported anchors).
  // an MCP projectDir read as the MCP server reads it (hook-utils parseProjectDir — a file:// URI is its
  // path; a relative one from the server's folder: Claude Code starts it in CLAUDE_PROJECT_DIR — and from the session's, a superset).
  // A file:// URI that is no local path can't be placed: the call is asked, whatever the level. ('..' and a network path — which the
  // server refuses — go to approvalProjects as before: a '..' path is read, a network one only on the session's share.)
  let named = [];
  let unreadableProject = false;
  if (touched.length) named = [...new Set(touched.map((t) => probe().specsParentOf(t)))];
  else if (!command) {
    const bases = [process.env.CLAUDE_PROJECT_DIR, process.env.SPEC_PROJECT_DIR, cwd].filter((b) => typeof b === "string" && b.trim() && !HU.unexpandedVar(b));
    for (const b of bases.length ? bases : [process.cwd()]) {
      const pd = HU.parseProjectDir(ti.projectDir, b);
      if (pd.code === "project-uri") unreadableProject = true;
      else if (pd.code) named.push(ti.projectDir);
      else if (pd.dir) named.push(pd.dir);
    }
  }
  const levels = levelsOf(HU.approvalProjects({ cwd, env: sessionEnv(), named, command: command || "" }));
  const s = strictest(levels);
  if (unreadableProject && s.level < 1) s.level = 1;
  if (!s.level) return null;

  // Past the pre-check: an engine failure asks (failClosed), it never allows silently.
  try {
    const spec = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
    // Each candidate project with the guard on judges the call with ITS level and meta (its checks — dev-guardian's gate guards its
    // files only where a check runs it), the strictest project's first; the strictest answer wins (a later one only when stricter).
    // review 9: one meta (the strictest level's) judged every project's files — sub/.guardian/baseline.json of a nested project whose
    // check runs, from a stricter outer one without it, went through.
    const rank = (d) => Math.max(0, LEVELS.indexOf(d));
    let r = null;
    for (const j of [s, ...levels.filter((l) => l.level > 0 && l.dir !== s.dir)]) {
      const dir = j.dir || cwd || process.cwd();
      // resolveFeature (as the MCP server): the prompt and the command name the feature the engine will act on
      // in that project — its slug — never the raw argument (slugify drops text in other scripts, which must not reach the prompt).
      const resolveFeature = (n) => { const f = spec.existingFeature(dir, n); return f.ok ? f.slug : null; };
      const one = spec.approvalGuardDecision(payload, LEVELS[j.level], { lang: spec.projectLang(dir), meta: j.meta, resolveFeature,
        uriPath: HU.fileUriToPath, projectUnreadable: unreadableProject });
      if (!r || rank(one.decision) > rank(r.decision)) r = one;
      if (r.decision === "deny") break;
    }
    if (r.decision !== "ask" && r.decision !== "deny") return null;
    const out = { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: r.decision, permissionDecisionReason: r.reason } };
    if (r.userNote) out.systemMessage = r.userNote; // deny: the reason goes to the agent — the user sees the command to run
    return out;
  } catch {
    return failClosed(s.meta);
  }
}

module.exports = { decide, candidate };
// As a process (hooks/hooks.json): the payload from stdin, decide run once — from the 2 s safety net with timedOut (a partial payload
// naming dev-spec: ask); any unexpected error before the pre-check passes is a silent no-op (never a block).
if (require.main === module) runHook(decide);
