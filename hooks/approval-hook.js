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
 * (a guarded project, a call that may be an approval) an engine failure ASKS. As a process (1.41.1) it decides in a worker under a
 * deadline, and no answer by it asks (runAsProcess, below) — except a worker held in one native call that never returns, which keeps
 * the process alive past Claude Code's timeout (a known limit: claude-code-integration.md). It FAILS CLOSED on a
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
  const file = path.join(dir, ".specs", "roadmap.json");
  // (1.41.1) a roadmap.json that is a LINK reads as gone — the engine's read gate never reads through it (approvalRoadmapGone): fail
  // closed at ask while the .specs/ holds features, as for a deleted one (its target's meta is never read). So does anything else that
  // is no regular file (review 2, R2H-F1): a FIFO, a device, a socket, a folder — never opened by its lstat, and opened without
  // waiting and judged by its fd after (probe.js readRegularText: a swap after the lstat): a FIFO's read never returns.
  const st = lstatOf(file);
  if (st && !st.isFile()) return { level: roadmapGone(dir) ? 1 : 0 };
  let text;
  try {
    text = probe().readRegularText(file);
  } catch (e) {
    // missing while the .specs/ holds features (a feature folder's .state.json) — deleted: fail closed at ask, as
    // the engine's approvalGuardLevel (meta unknown). Missing in a .specs/ without features, or unreadable: out of the way.
    return { level: e && e.code === "ENOENT" && roadmapGone(dir) ? 1 : 0 };
  }
  if (text === null) return { level: roadmapGone(dir) ? 1 : 0 };
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

// A partial payload's text names what partial() reads: dev-spec, .specs/, dev-guardian, an approval tool (an 8.3 alias of a guarded name
// too, on win32 — SPECS~1, GUARDI~1: the pre-filter's own test, probe.js mayShortName).
const partialNames = (text) => RE_PARTIAL.test(text) || (process.platform === "win32" && probe().mayShortName(text));
// stdin never ended within the safety net's 2 s — the payload is partial (it doesn't parse) — or (1.41.1) it was past the hook's read
// limit (MAX_INPUT: its head alone was kept). When its text names dev-spec, .specs/, dev-guardian or an approval tool and a project the
// session may be in has the guard on: ask (it used to exit 0 — allowed). opts.onLevel: decide's.
function partial(raw, opts = {}) {
  const text = String(raw || "");
  if (!partialNames(text)) return null;
  let cwd = null;
  const m = /"cwd"\s*:\s*"((?:[^"\\]|\\.){1,4096})"/.exec(text);
  if (m) try { cwd = JSON.parse('"' + m[1] + '"'); } catch { cwd = null; }
  const s = strictest(levelsOf(HU.approvalProjects({ cwd: cwd || process.cwd(), env: sessionEnv() })));
  if (typeof opts.onLevel === "function") opts.onLevel(s);
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
// a .specs/ without roadmap.json that holds features (a feature folder's .state.json) — rawLevel fails closed on it. A folder that
// is a link (its Dirent: no folder) or a .state.json that is one holds no feature — the engine's read gate reads them as absent (1.41.1).
function roadmapGone(dir) {
  const fs = require("fs");
  const root = path.join(dir, ".specs");
  try {
    return fs.readdirSync(root, { withFileTypes: true }).some((d) => {
      if (!d.isDirectory() || d.name.startsWith(".")) return false;
      const st = lstatOf(path.join(root, d.name, ".state.json"));
      return !!st && !st.isSymbolicLink();
    });
  } catch {
    return false;
  }
}
// lstat, never followed → the Stats or null.
function lstatOf(p) {
  try { return require("fs").lstatSync(p); } catch { return null; }
}
// past the pre-check — a project the call may act on has the guard on and the call may be an approval —
// the engine failed (a broken install, an exception): ASK, never a silent allow. The reason comes from the i18n tables when they load
// (the project's language as its raw meta names it), else the prompt goes without one. why (1.41.1): "error", or "timeout" — no
// decision by the deadline (seconds: the deadline, shown).
function failClosed(meta, why = "error", seconds) {
  let reason;
  try {
    const i18n = require(path.join(__dirname, "..", "mcp", "lib", "i18n.js"));
    const A = i18n.msg(i18n.normalizeLang(meta && typeof meta.lang === "string" ? meta.lang : "en")).approvalGuard;
    reason = A.ask(A.action({ kind: "unreadable", why, seconds }), false, meta && meta.approvalGuard); // at deny it says so (it asks, never refuses)
  } catch {
    reason = undefined;
  }
  const out = { hookEventName: "PreToolUse", permissionDecision: "ask" };
  if (typeof reason === "string") out.permissionDecisionReason = reason;
  return { hookSpecificOutput: out };
}

// The pre-check — what the payload's text alone says, nothing read from disk: null (it can't be an approval — silent) or the call's parts
// { ti, command, fp, mcpFile }. decide's first step, and the main thread's whole share of the hook as a process (needsDecision).
function preCheck(payload) {
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
  return { ti, command, fp, mcpFile };
}
// The hook's decision on one payload → the object it prints (ask / deny) or null (silent). opts.timedOut: the stdin safety net fired —
// a payload that doesn't parse is a partial one. opts.onLevel(s) (the process's worker, 1.41.1): called once the candidate projects'
// strictest level is known — s = { level, dir, meta } (level 0: no project the call may act on has the guard on).
function decide(raw, opts = {}) {
  let payload;
  try {
    payload = JSON.parse(raw || "{}");
  } catch {
    return opts.timedOut ? partial(raw, opts) : null;
  }
  const pre = preCheck(payload);
  if (!pre) return null;
  const { ti, command, fp, mcpFile } = pre;
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
  if (typeof opts.onLevel === "function") opts.onLevel(s);
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

// ---- as a process (hooks/hooks.json): a decision by the deadline (1.41.1, review 1 of the glob fix) --------------------------------
// A PreToolUse hook past Claude Code's timeout lets the call through (code.claude.com/docs/en/hooks), so a reader that takes long — a
// super-linear shape, a huge payload, a slow disk — was a way past the guard (R1, S1-F1 / F2 / F3). The main thread arms the deadline at
// the process's start (DEADLINE_MS from it, process.uptime), reads stdin (≤ MAX_PAYLOAD characters) and runs the pre-check alone
// (needsDecision: a call that can't be an approval exits here, silent — no worker, nothing read from disk; a payload past MAX_INPUT is
// never parsed on the main thread: it goes to the worker whole). EVERYTHING else — the candidate projects, their roadmap.json, the
// engine, the decision — runs in a worker_threads worker with a heap limit (WORKER_LIMITS), this same file. No answer by the deadline,
// a worker error, its exit without an answer, an out-of-memory, a worker that could not start: ASK (failClosed: why "timeout" /
// "error", in the project's language once the worker named it — the worker tells the candidate projects' strictest level before it
// loads the engine; silent when it told level 0: no project the call may act on has the guard on). A payload past MAX_PAYLOAD — more
// than the hook holds — asks whatever the level (why "partial"). hooks.json's timeout (10 s) minus DEADLINE_MS is the margin for the
// process's start and the answer's write (measured: claude-code-integration.md → Human approval guard). What the deadline does NOT
// cover — the process ends only when its worker does (Node joins its workers at exit): a worker inside one native call that never
// returns. The readers before the engine open no file that is not a regular one (probe.js openRegular: a FIFO, a device), and the
// engine's read gate reads none below .specs/ (files.js) — what is left is the known limit (claude-code-integration.md → Known limits):
// such a file the agent made by an inline script where neither of them looks, `.specs` linked to `\\.\pipe\`, a dead network share.
// DEV_SPEC_TEST_APPROVAL_DEADLINE_MS lowers the deadline (tests only: the hermetic chains keep DEV_SPEC_TEST_*; it never raises it).
const DEADLINE_MS = 6000;
const MAX_INPUT = 16 * 1024 * 1024; // past this many characters the main thread parses nothing: the worker gets the payload whole
const MAX_PAYLOAD = 64 * 1024 * 1024; // past this many, the hook does not hold the payload (runHook drains the rest): ask
const WORKER_LIMITS = { maxOldGenerationSizeMb: 512, maxYoungGenerationSizeMb: 64, stackSizeMb: 8 };
function deadlineMs(env = process.env) {
  const v = Number(env.DEV_SPEC_TEST_APPROVAL_DEADLINE_MS);
  return env.DEV_SPEC_TEST_APPROVAL_DEADLINE_MS !== undefined && env.DEV_SPEC_TEST_APPROVAL_DEADLINE_MS !== "" && Number.isFinite(v) && v >= 0 ? Math.min(v, DEADLINE_MS) : DEADLINE_MS;
}
// The main thread's share of decide: may the payload need a decision? Its pre-check passes; a payload past MAX_INPUT (never parsed here:
// the worker decides on it whole); or a payload that doesn't parse, cut short by the safety net, that names what partial() reads.
// false: silent, no worker.
function needsDecision(raw, opts = {}) {
  const text = String(raw || "");
  if (text.length > MAX_INPUT) return true;
  let payload;
  try {
    payload = JSON.parse(text || "{}");
  } catch {
    return !!opts.timedOut && partialNames(text);
  }
  return preCheck(payload) !== null;
}
function runAsProcess() {
  const { Worker } = require("worker_threads");
  const deadline = deadlineMs();
  let late = false, settle = null, known = null; // known: the worker's strictest level once it read the projects ({ level, meta })
  // the answer without the worker's: silent once it said no project has the guard on (level 0), else ask — in the project's language
  // once the worker named it
  const failed = (why) => (known && known.level === 0 ? null : failClosed(known && known.meta, why, Math.ceil(deadline / 1000)));
  setTimeout(() => { late = true; if (settle) settle(failed("timeout")); }, Math.max(0, deadline - process.uptime() * 1000));
  runHook((raw, opts) => {
    if (opts.tooBig) return failClosed(undefined, "partial"); // past MAX_PAYLOAD: not held, so not read — ask, whatever the level
    const timedOut = !!opts.timedOut;
    if (!needsDecision(raw, { timedOut })) return null;
    if (late) return failed("timeout");
    return new Promise((resolve) => {
      settle = (out) => { settle = null; resolve(out); };
      let w;
      try {
        w = new Worker(__filename, { workerData: { approvalHook: true, raw, timedOut }, resourceLimits: WORKER_LIMITS, stdout: true });
      } catch {
        return settle(failed("error"));
      }
      w.on("message", (m) => {
        if (isObj(m) && isObj(m.known)) known = m.known;
        else if (isObj(m) && "out" in m && settle) settle(m.out);
      });
      w.on("error", () => { if (settle) settle(failed("error")); });
      w.on("exit", () => { if (settle) settle(failed("error")); });
    });
  }, { maxInput: MAX_PAYLOAD });
}
// The worker: decide on the payload the main thread handed it (whole — parsed here when it was past MAX_INPUT), the strictest level
// told as soon as it is known.
function runAsWorker() {
  const { parentPort, workerData } = require("worker_threads");
  const onLevel = (s) => parentPort.postMessage({ known: { level: s.level, meta: { lang: s.meta && typeof s.meta.lang === "string" ? s.meta.lang : undefined, approvalGuard: LEVELS[s.level] } } });
  parentPort.postMessage({ out: decide(workerData.raw, { timedOut: workerData.timedOut, onLevel }) });
}

module.exports = { decide, candidate, needsDecision, deadlineMs, DEADLINE_MS, MAX_INPUT, MAX_PAYLOAD, WORKER_LIMITS };
// As a process: the main thread (runAsProcess), or the worker it starts (the same file, its workerData marked — whatever require.main
// says there).
{
  const wt = require("worker_threads");
  if (!wt.isMainThread && isObj(wt.workerData) && wt.workerData.approvalHook === true) runAsWorker();
  else if (wt.isMainThread && require.main === module) runAsProcess();
}
