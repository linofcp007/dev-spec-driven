#!/usr/bin/env node
"use strict";

/**
 * dev-spec-driven — human approval guard (opt-in, zero-dependency; 1.14 F2).
 *
 * Wired from hooks/hooks.json as PreToolUse, matcher
 * ^(Bash|PowerShell|Monitor|Write|Edit|(mcp__.+__)?(spec_approve|spec_feature|spec_init|spec_add_track))$.
 * An approval is the human's act, but an agent can call spec_approve (force: true included) or run `dev-spec approve` itself.
 * This hook does NOTHING unless the project opted in (`.specs/roadmap.json` meta.approvalGuard "ask" | "deny" —
 * spec_init {approvalGuard} / `dev-spec init --approval-guard ask|deny`). Then an agent's approval — spec_approve under any MCP
 * server prefix, spec_feature {action: "remove", confirm: true}, `dev-spec approve …` / `dev-spec feature remove … --yes`
 * through the Bash / PowerShell / Monitor tool (read in that shell's own syntax: escapes, line continuations, $'…', $( ),
 * heredocs, PowerShell's --%), or a guard-down action — lowering this guard (spec_init {approvalGuard} / `init --approval-guard`),
 * weakening what it stands for (evidence observed → reported, clearing / dropping approval roles, removing / changing a project
 * check, the stop gate or the edit guard turned down, +tdd / +ai turned off — 1.24), a shell command writing .specs/roadmap.json,
 * a .state.json or a harness-observed log (a redirection, a writer, `dev-spec merge-state`, git's in-place restores — 1.24), or a
 * Write / Edit of .specs/roadmap.json, of a feature's .state.json or (1.24) of an .execution/observed.jsonl — gets:
 *   ask  → permissionDecision "ask": the user confirms or declines (the reason names the feature, phase(s), role and, loudly,
 *          --force). Claude Code shows it in auto mode too; only bypass-permissions mode may skip it (dontAsk refuses it);
 *   deny → permissionDecision "deny" (it holds in every permission mode): the reason tells the agent approvals are the
 *          human's — the user runs it in their own terminal or with Claude Code's `!` prefix, and the agent stops and asks.
 * spec.approvalGuardDecision decides (pure; the engine is loaded only once some candidate project has the guard on).
 *
 * It NEVER blocks on its own trouble: a malformed payload or any internal error exits 0 silently — but it FAILS CLOSED on a
 * roadmap.json that exists and doesn't parse: the strictest "approvalGuard": "ask" | "deny" its raw text names still holds
 * (appending a byte to the file must not switch the guard off; a BOM-less UTF-16 file is read through its NULs), and (1.24) on a
 * payload that arrived only in part (the 2 s stdin safety net) naming dev-spec / .specs / an approval tool: ask. It is cheap: a
 * tool call that can't be an approval (a Bash command naming neither dev-spec nor .specs, a Write / Edit of a file whose path
 * names no .specs/) exits before any file read; otherwise one raw read of roadmap.json (UTF-8 or UTF-16 — hook-utils.js) per
 * candidate project (hook-utils.js approvalProjects, 1.24: the session's cwd and the nearest .specs/ above it, CLAUDE_PROJECT_DIR,
 * SPEC_PROJECT_DIR, the project the call names — MCP projectDir, CLI --project, the edited file's — and a command's cd /
 * Set-Location / pushd targets and SPEC_PROJECT_DIR= assignments; the strictest level wins; a network path only when it is the
 * session's own or on its share).
 */

const path = require("path");

const LEVELS = ["off", "ask", "deny"];
const RE_MCP = /^(?:mcp__.+__)?(?:spec_approve|spec_feature|spec_init|spec_add_track)$/;
// The tools that run a shell command — Monitor too (1.23 review 5: it runs its command in the Bash tool's shell).
const SHELLS = new Set(["Bash", "PowerShell", "Monitor"]);
// 1.23 review 5: the file-editing tools, on .specs/roadmap.json, a feature's .state.json or (1.24) a harness-observed log only.
const EDITS = new Set(["Write", "Edit", "MultiEdit"]);
const RE_GUARDED_FILE = /(?:^|[\\/])\.specs[\\/]+(?:roadmap\.json|(?:[^\\/]+[\\/]+)+\.state\.json|(?:[^\\/]+[\\/]+)*\.execution[\\/]+observed\.jsonl)$/i;
// A Write / Edit target that can't be one: its text names no .specs and no 8.3 short name (`SPECS~1`, `ROADMA~1.JSO`).
const RE_EDIT_MAYBE = /\.specs|~\d/i;
// The engine's approvalCandidate: a command can run the CLI or write .specs/roadmap.json only if it names dev-spec or .specs
// (string joints, quotes, escapes and line continuations taken out — `dev\-spec`, `d'e'v-spec`, `"cli/dev" + "-spec.js"`), or holds
// a glob together with an approval word (the glob may name the CLI). The WHOLE command: one past the engine's read limit that
// names dev-spec is refused / asked as unreadable (1.23 review 5 — an approval after the first 64 KB went through).
const RE_CANDIDATE = /dev-?spec|\.specs/i;
const RE_VERB = /(?:^|[^\w-])(?:approve|remove|--approval-guard|--stop-check|--evidence|--guard|--roles|--check)(?![\w-])/i;
// (a PowerShell -EncodedCommand value — base64 — is decoded by the engine: here any encoded-looking pwsh call goes on to it)
const candidate = (c) => {
  const t = c.replace(/(["'])\s*\+\s*\1/g, "").replace(/[\\`^]\r?\n|['"\\`^]/g, "");
  return RE_CANDIDATE.test(t) || (/[*?[]/.test(t) && RE_VERB.test(t)) || (/powershell|pwsh/i.test(t) && /(?:^|\s)[-/]e[a-z]*\s+[A-Za-z0-9+/]{8,}/i.test(t));
};
// A roadmap.json that doesn't parse: the strictest level its raw text names (fail closed) — the engine's rawApprovalGuard.
const RE_RAW_GUARD = /"approvalGuard"\s*:\s*"\s*(ask|deny)\s*"/gi;
// 1.24 (C-I10): a payload cut short — what it may be about (dev-spec, .specs/, an approval-shaped MCP tool).
const RE_PARTIAL = /dev-?spec|\.specs|spec_(?:approve|feature|init|add_track)/i;

let done = false;
let ran = false;
// At most one JSON object, and exit only after it is flushed (Windows pipes truncate otherwise).
function finish(obj) {
  if (done) return;
  done = true;
  if (!obj) process.exit(0);
  process.stdout.write(JSON.stringify(obj), () => process.exit(0));
}

const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
let HU = null; // hooks/hook-utils.js — required only past the cheap pre-check
const hu = () => HU || (HU = require(path.join(__dirname, "hook-utils.js")));

// meta.approvalGuard, read raw (the engine is loaded only for a guarded project) → { level: 0 off · 1 ask · 2 deny, meta }.
// meta = the parsed roadmap.json meta (what a spec_init / `init` change is compared with), undefined when the file is broken.
// UTF-8 or UTF-16 with a BOM (1.24 review 6, C3 — Windows PowerShell 5.1's Out-File: read as UTF-8 it was "off").
function rawLevel(dir) {
  let text;
  try {
    text = hu().readText(path.join(dir, ".specs", "roadmap.json"));
  } catch {
    return { level: 0 }; // missing or unreadable → the guard stays out of the way
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
// The strictest level among the candidate folders → { level, dir, meta }.
function strictest(dirs) {
  let level = 0, dir = null, meta;
  for (const d of dirs) {
    const l = rawLevel(d);
    if (l.level > level) { level = l.level; dir = d; meta = l.meta; }
  }
  return { level, dir, meta };
}
const sessionEnv = () => ({ CLAUDE_PROJECT_DIR: process.env.CLAUDE_PROJECT_DIR, SPEC_PROJECT_DIR: process.env.SPEC_PROJECT_DIR });

// 1.24 (C-I10): stdin never ended within the safety net's 2 s — the payload is partial (it doesn't parse). When its text names dev-spec,
// .specs/ or an approval tool and a project the session may be in has the guard on: ask (it used to exit 0 — allowed).
function partial(raw) {
  const text = String(raw || "");
  if (!RE_PARTIAL.test(text)) return finish();
  let cwd = null;
  const m = /"cwd"\s*:\s*"((?:[^"\\]|\\.){1,4096})"/.exec(text);
  if (m) try { cwd = JSON.parse('"' + m[1] + '"'); } catch { cwd = null; }
  const dirs = hu().approvalProjects({ cwd: cwd || process.cwd(), env: sessionEnv() });
  const s = strictest(dirs);
  if (!s.level) return finish();
  const spec = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const r = spec.approvalGuardDecision({ hook_event_name: "PreToolUse" }, LEVELS[s.level], { lang: spec.projectLang(s.dir), meta: s.meta, partial: true });
  if (r.decision !== "ask") return finish();
  return finish({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "ask", permissionDecisionReason: r.reason } });
}

function main(raw, timedOut) {
  if (ran) return; // stdin 'end' and the safety-net timer must not both run it
  ran = true;
  let payload;
  try {
    payload = JSON.parse(raw || "{}");
  } catch {
    return timedOut ? partial(raw) : finish();
  }
  if (!isObj(payload)) return finish();
  const event = payload.hook_event_name || payload.hookEventName || "";
  if (event && event !== "PreToolUse") return finish();
  const tool = typeof payload.tool_name === "string" ? payload.tool_name : typeof payload.toolName === "string" ? payload.toolName : "";
  const ti = isObj(payload.tool_input) ? payload.tool_input : isObj(payload.toolInput) ? payload.toolInput : {};
  const command = SHELLS.has(tool) && typeof ti.command === "string" ? ti.command : null;
  const fp = EDITS.has(tool) && typeof ti.file_path === "string" && RE_EDIT_MAYBE.test(ti.file_path) ? ti.file_path.trim() : null;
  if (!RE_MCP.test(tool) && !(command && candidate(command)) && !fp) return finish();
  const cwd = typeof payload.cwd === "string" && payload.cwd.trim() ? payload.cwd.trim() : null;
  // 1.24 (C5): the edited path as the file system reads it — `./`, `..`, an NTFS stream, an 8.3 short name (hook-utils editTargets,
  // the engine's approvalEditTargets).
  const edited = fp ? hu().editTargets(fp, cwd).find((t) => RE_GUARDED_FILE.test(t)) || null : null;
  if (fp && !edited && !RE_MCP.test(tool) && !command) return finish();

  // The projects this call may act on: the one it names (MCP projectDir, CLI --project, the edited file's, a cd target, a
  // SPEC_PROJECT_DIR= assignment), then the session's (its cwd and the nearest .specs/ above it, the exported anchors).
  const named = edited ? [edited.replace(/[\\/]*\.specs[\\/][\s\S]*$/i, "") || "."] : !command ? [ti.projectDir] : [];
  const s = strictest(hu().approvalProjects({ cwd, env: sessionEnv(), named, command: command || "" }));
  if (!s.level) return finish();

  const spec = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const dir = s.dir;
  // resolveFeature (1.23 review 5, L26 — as the MCP server): the prompt and the command name the feature the engine will act on
  // in that project — its slug — never the raw argument (slugify drops text in other scripts, which must not reach the prompt).
  const resolveFeature = (n) => { const f = spec.existingFeature(dir, n); return f.ok ? f.slug : null; };
  const r = spec.approvalGuardDecision(payload, LEVELS[s.level], { lang: spec.projectLang(dir), meta: s.meta, resolveFeature });
  if (r.decision !== "ask" && r.decision !== "deny") return finish();
  const out = { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: r.decision, permissionDecisionReason: r.reason } };
  if (r.userNote) out.systemMessage = r.userNote; // deny: the reason goes to the agent — the user sees the command to run
  return finish(out);
}

// Never crash, whatever the payload: any unexpected error is a silent no-op (never a block).
function safeMain(raw, timedOut) {
  try {
    main(raw, timedOut);
  } catch {
    finish();
  }
}

// Read the hook payload from stdin asynchronously (fs.readFileSync(0) is unreliable on Windows pipes).
let input = "";
if (process.stdin.isTTY) {
  safeMain("{}");
} else {
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (c) => (input += c));
  process.stdin.on("end", () => safeMain(input));
  process.stdin.on("error", () => finish());
  setTimeout(() => safeMain(input, true), 2000).unref(); // safety net (a partial payload naming dev-spec: ask — 1.24)
}
