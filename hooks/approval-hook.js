#!/usr/bin/env node
"use strict";

/**
 * dev-spec-driven — human approval guard (opt-in, zero-dependency; 1.14 F2).
 *
 * Wired from hooks/hooks.json as PreToolUse, matcher
 * ^(Bash|PowerShell|Monitor|Write|Edit|(mcp__.+__)?(spec_approve|spec_feature|spec_init))$.
 * An approval is the human's act, but an agent can call spec_approve (force: true included) or run `dev-spec approve` itself.
 * This hook does NOTHING unless the project opted in (`.specs/roadmap.json` meta.approvalGuard "ask" | "deny" —
 * spec_init {approvalGuard} / `dev-spec init --approval-guard ask|deny`). Then an agent's approval — spec_approve under any MCP
 * server prefix, spec_feature {action: "remove", confirm: true}, `dev-spec approve …` / `dev-spec feature remove … --yes`
 * through the Bash / PowerShell / Monitor tool (read in that shell's own syntax: escapes, line continuations, $'…', $( ),
 * heredocs), or a guard-down action — lowering this guard (spec_init {approvalGuard} / `init --approval-guard`), weakening what it
 * stands for (evidence observed → reported, clearing / dropping approval roles, removing / changing a project check, the stop gate
 * or the edit guard turned down), a shell command writing .specs/roadmap.json, or (1.23) a Write / Edit of .specs/roadmap.json or
 * of a feature's .state.json — gets:
 *   ask  → permissionDecision "ask": the user confirms or declines (the reason names the feature, phase(s), role and, loudly,
 *          --force). Claude Code shows it in auto mode too; only bypass-permissions mode may skip it (dontAsk refuses it);
 *   deny → permissionDecision "deny" (it holds in every permission mode): the reason tells the agent approvals are the
 *          human's — the user runs it in their own terminal or with Claude Code's `!` prefix, and the agent stops and asks.
 * spec.approvalGuardDecision decides (pure; the engine is loaded only once some candidate project has the guard on).
 *
 * It NEVER blocks on its own trouble: a malformed payload or any internal error exits 0 silently — but it FAILS CLOSED on a
 * roadmap.json that exists and doesn't parse: the strictest "approvalGuard": "ask" | "deny" its raw text names still holds
 * (appending a byte to the file must not switch the guard off). It is cheap: a tool call that can't be an approval (a Bash
 * command naming neither dev-spec nor .specs, a Write / Edit of any other file) exits before any file read; otherwise one
 * raw read of roadmap.json per candidate project (the session cwd, CLAUDE_PROJECT_DIR, SPEC_PROJECT_DIR and the project the
 * call names — MCP projectDir / CLI --project / the edited file's; the strictest level wins, never a network path).
 */

const fs = require("fs");
const path = require("path");

const LEVELS = ["off", "ask", "deny"];
const RE_MCP = /^(?:mcp__.+__)?(?:spec_approve|spec_feature|spec_init)$/;
// The tools that run a shell command — Monitor too (1.23 review 5: it runs its command in the Bash tool's shell).
const SHELLS = new Set(["Bash", "PowerShell", "Monitor"]);
// 1.23 review 5: the file-editing tools, on .specs/roadmap.json or a feature's .state.json only (a hand edit of the approvals).
const EDITS = new Set(["Write", "Edit", "MultiEdit"]);
const RE_GUARDED_FILE = /(?:^|[\\/])\.specs[\\/]+(?:roadmap\.json|(?:[^\\/]+[\\/]+)+\.state\.json)$/i;
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
// A usable local directory: a non-empty string, no unexpanded ${VAR}, never a network path (\\host\share, //host/share,
// \\?\UNC\… — reading it would open an SMB connection to whatever host a tool call named); \\?\C:\… is local.
function usableDir(v, base) {
  if (typeof v !== "string" || !v.trim() || /^\$\{[^}]*\}$/.test(v.trim())) return null;
  const s = v.trim();
  if (/^[\\/]{2}/.test(s) && !/^[\\/]{2}[?.][\\/][A-Za-z]:/.test(s)) return null;
  try {
    return path.resolve(base || process.cwd(), s);
  } catch {
    return null;
  }
}

// meta.approvalGuard, read raw (the engine is loaded only for a guarded project) → { level: 0 off · 1 ask · 2 deny, meta }.
// meta = the parsed roadmap.json meta (what a spec_init / `init` change is compared with), undefined when the file is broken.
function rawLevel(dir) {
  let text;
  try {
    text = fs.readFileSync(path.join(dir, ".specs", "roadmap.json"), "utf8");
  } catch {
    return { level: 0 }; // missing or unreadable → the guard stays out of the way
  }
  let j;
  try {
    j = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  } catch {
    let level = 0; // broken → fail closed: the strictest level its text still names
    for (const m of text.matchAll(RE_RAW_GUARD)) level = Math.max(level, LEVELS.indexOf(m[1].toLowerCase()));
    return { level };
  }
  const meta = isObj(j) && isObj(j.meta) ? j.meta : undefined;
  const v = meta ? meta.approvalGuard : undefined;
  return { level: Math.max(0, LEVELS.indexOf(typeof v === "string" ? v.trim().toLowerCase() : "")), meta: meta || {} };
}

function main(raw) {
  if (ran) return; // stdin 'end' and the safety-net timer must not both run it
  ran = true;
  let payload;
  try {
    payload = JSON.parse(raw || "{}");
  } catch {
    return finish();
  }
  if (!isObj(payload)) return finish();
  const event = payload.hook_event_name || payload.hookEventName || "";
  if (event && event !== "PreToolUse") return finish();
  const tool = typeof payload.tool_name === "string" ? payload.tool_name : typeof payload.toolName === "string" ? payload.toolName : "";
  const ti = isObj(payload.tool_input) ? payload.tool_input : isObj(payload.toolInput) ? payload.toolInput : {};
  const command = SHELLS.has(tool) && typeof ti.command === "string" ? ti.command : null;
  const edited = EDITS.has(tool) && typeof ti.file_path === "string" && RE_GUARDED_FILE.test(ti.file_path.trim()) ? ti.file_path.trim() : null;
  if (!RE_MCP.test(tool) && !(command && candidate(command)) && !edited) return finish();

  // The projects this call may act on: the one it names first (MCP projectDir, CLI --project, the edited file's), then the session's.
  const cwd = usableDir(payload.cwd);
  const named = [];
  if (edited) named.push(edited.replace(/[\\/]*\.specs[\\/][\s\S]*$/i, "") || ".");
  else if (!command) named.push(ti.projectDir);
  else for (const m of command.slice(0, 64 * 1024).matchAll(/--project(?:=|\s+)(?:"([^"]*)"|'([^']*)'|([^\s;&|)]+))/g)) named.push(m[1] || m[2] || m[3]);
  const dirs = [...new Set([...named.map((d) => usableDir(d, cwd || undefined)), cwd, usableDir(process.env.CLAUDE_PROJECT_DIR), usableDir(process.env.SPEC_PROJECT_DIR)].filter(Boolean))];
  let level = 0, dir = null, meta;
  for (const d of dirs.slice(0, 8)) {
    const l = rawLevel(d);
    if (l.level > level) { level = l.level; dir = d; meta = l.meta; }
  }
  if (!level) return finish();

  const spec = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const r = spec.approvalGuardDecision(payload, LEVELS[level], { lang: spec.projectLang(dir), meta });
  if (r.decision !== "ask" && r.decision !== "deny") return finish();
  const out = { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: r.decision, permissionDecisionReason: r.reason } };
  if (r.userNote) out.systemMessage = r.userNote; // deny: the reason goes to the agent — the user sees the command to run
  return finish(out);
}

// Never crash, whatever the payload: any unexpected error is a silent no-op (never a block).
function safeMain(raw) {
  try {
    main(raw);
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
  setTimeout(() => safeMain(input), 2000).unref(); // safety net
}
