#!/usr/bin/env node
"use strict";

/**
 * dev-spec-driven — evidence gate at the end of a turn (zero-dependency). "Evidence before claims", enforced where the
 * claim is made: the agent's closing message.
 *
 * Wired from hooks/hooks.json for two events (https://code.claude.com/docs/en/hooks):
 *   - Stop: the main agent finishes its turn. When its last message (`last_assistant_message`) claims the work is done or
 *     verified while a recently active feature has ticked tasks without verification evidence, the hook answers
 *     `{"decision": "block", "reason": …}` — Claude Code keeps the turn going with that reason (localized, project
 *     language): run the task's _Verify:_ (`dev-spec done <f> <n> --run`), record the evidence, or say plainly what is not
 *     verified.
 *   - SubagentStop, matcher ^(dev-spec-driven:)?spec-(implementer|simplifier)$: the implementer never ticks tasks (the
 *     controller does, after review), so its DONE is checked against its report — the task's runnable _Verify:_ commands
 *     and an exit code must be in .specs/<feature>/.execution/task-N-report.md; the simplifier (1.22) rewrites code already
 *     verified, so its DONE needs .specs/<feature>/.execution/simplify-report.md to end with the passing runs of the
 *     project checks. (Plugin subagents ignore `hooks` in their frontmatter, so the plugin's hooks.json is where this
 *     lives.)
 * The decision is the engine's (spec.stopCheck — `dev-spec stop-check` prints the same one).
 *
 * It never sends a stop back twice in a row (`stop_hook_active`), is silent (exit 0, no output) when there is nothing to
 * say, when the project has no dev-spec .specs/ or when roadmap.json meta.stopCheck is false (spec_init {stopCheck: false} /
 * `dev-spec init --stop-check off`; 1.16: while it is unset, the user's DEV_SPEC_STOP_CHECK=off), and NEVER blocks on its own trouble: a malformed payload, an unreadable file or any
 * internal error exits 0 silently. Bounded: the message's tail, each feature's .state.json / tasks.md, one report file.
 */

const fs = require("fs");
const path = require("path");

// A JSON file as the engine reads it: UTF-8, or UTF-16 with a BOM (1.24 review 6, C3 — Windows PowerShell 5.1's Out-File: a UTF-16
// file read as UTF-8 didn't parse), decoded by hook-utils.js — required only for such a file (the hot path stays cheap). Throws on a
// missing or broken file.
function readJsonFile(file) {
  const buf = fs.readFileSync(file);
  if (buf.length >= 2 && ((buf[0] === 0xff && buf[1] === 0xfe) || (buf[0] === 0xfe && buf[1] === 0xff))) return require("./hook-utils.js").jsonOf(buf);
  const t = buf.toString("utf8");
  return JSON.parse(t.charCodeAt(0) === 0xfeff ? t.slice(1) : t);
}

let done = false;
let ran = false;
const TRANSCRIPT_TAIL = 512 * 1024; // bytes read from the end of a transcript when the payload carries no last message

// At most one JSON object, and exit only after it is flushed (Windows and Linux pipes truncate otherwise).
function finish(obj) {
  if (done) return;
  done = true;
  if (!obj) process.exit(0);
  process.stdout.write(JSON.stringify(obj), () => process.exit(0));
}

// The hooks run in EVERY project: only a .specs/ that dev-spec owns (roadmap.json, steering/, or a feature folder with its
// .state.json / classification.md) is looked at.
function isDevSpecProject(dir) {
  const root = path.join(dir, ".specs");
  try {
    if (!fs.statSync(root).isDirectory()) return false;
  } catch {
    return false;
  }
  if (fs.existsSync(path.join(root, "roadmap.json")) || fs.existsSync(path.join(root, "steering"))) return true;
  try {
    return fs.readdirSync(root, { withFileTypes: true }).some((d) => d.isDirectory() &&
      (fs.existsSync(path.join(root, d.name, ".state.json")) || fs.existsSync(path.join(root, d.name, "classification.md"))));
  } catch {
    return false;
  }
}

// The user's default (1.16 — the environment variable DEV_SPEC_STOP_CHECK, e.g. from Claude Code's settings.json `env`) set to
// off. The engine (spec.stopCheckEnabled) reads the same.
function userStopCheckOff() {
  for (const n of ["DEV_SPEC_STOP_CHECK"]) {
    const v = typeof process.env[n] === "string" ? process.env[n].trim() : "";
    if (v && !/^\$\{[^}]*\}$/.test(v)) return /^(?:false|off|no|0)$/i.test(v);
  }
  return false;
}
// roadmap.json meta.stopCheck === false → off; not a boolean (unset) → the user's option; missing, unreadable or broken → the
// user's option too (spec.stopCheckEnabled's rule — DEV_SPEC_STOP_CHECK=off used to be ignored while the file didn't parse).
// Read raw: the engine is loaded only when the gate may have something to say.
function gateOff(dir) {
  try {
    const j = readJsonFile(path.join(dir, ".specs", "roadmap.json"));
    const meta = !!j && typeof j === "object" && !!j.meta && typeof j.meta === "object" ? j.meta : {};
    return meta.stopCheck === false || (typeof meta.stopCheck !== "boolean" && userStopCheckOff());
  } catch {
    return userStopCheckOff(); // missing or broken roadmap.json: the user's option, else the engine decides (it never blocks on a file it can't read)
  }
}

// 1.22 review — the Stop event's cheap pre-filter, before the engine loads (it cost ~200 ms at the end of EVERY turn in a
// dev-spec project): the gate can only send a turn back when some feature recorded activity within the last
// STOP_RECENT_HOURS (spec.STOP_RECENT_HOURS — mcp/tests/10-guards-review.js checks they agree), stamped not more than
// 5 minutes in the future (the engine's stopActivity). A superset of what the engine counts: ANY string value of a feature
// folder's .state.json that parses as a date in that window (lastTickAt, lastEditAt, ticks, evidence `at` / `noteAt` /
// history, approvals…). None → silent, the engine's answer too. Bounded: ≤ STOP_PRE_MAX_FEATURES folders, ≤ 1 MB a file;
// past a bound, the engine decides.
const STOP_RECENT_HOURS = 4;
const STOP_PRE_MAX_FEATURES = 500;
function recentActivity(dir) {
  const root = path.join(dir, ".specs");
  const now = Date.now();
  const since = now - STOP_RECENT_HOURS * 3600 * 1000, horizon = now + 5 * 60 * 1000;
  let dirs;
  try { dirs = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory() && !/^[._]/.test(d.name)); } catch { return true; }
  if (dirs.length > STOP_PRE_MAX_FEATURES) return true;
  const recent = (v) => { const t = Date.parse(v); return Number.isFinite(t) && t >= since && t <= horizon; };
  const walk = (v, depth) => {
    if (typeof v === "string") return recent(v);
    if (!v || typeof v !== "object" || depth > 12) return false;
    for (const x of Array.isArray(v) ? v : Object.values(v)) if (walk(x, depth + 1)) return true;
    return false;
  };
  for (const d of dirs) {
    const file = path.join(root, d.name, ".state.json");
    let st;
    try { st = fs.statSync(file); } catch { continue; } // no state: no recorded activity
    if (st.size > 1024 * 1024) return true;
    let j;
    try { j = readJsonFile(file); } catch { continue; } // unreadable: the engine skips it too (UTF-16 with a BOM is read — 1.24 review 6, C3)
    if (walk(j, 0)) return true;
  }
  return false;
}

// The nearest folder at or above cwd that holds a dev-spec .specs/ (≤ 40 levels — a cd'd subfolder, a worktree) — a candidate for the
// raw pre-check only. A network or device path (\\host\share, \\?\…) is the user's own folder: taken as it is, never walked.
function nearestDevSpec(cwd) {
  if (!cwd) return null;
  if (/^[\\/]{2}/.test(cwd.trim())) return cwd;
  let d = path.resolve(cwd);
  for (let i = 0; i < 40; i++) {
    if (isDevSpecProject(d)) return d;
    const up = path.dirname(d);
    if (up === d) break;
    d = up;
  }
  return null;
}

// Older Claude Code versions send no last_assistant_message: the last assistant text of the transcript (JSONL), read from
// its tail only.
function lastAssistantText(file) {
  if (typeof file !== "string" || !file.trim()) return "";
  let fd;
  try {
    fd = fs.openSync(file, "r");
    const size = fs.fstatSync(fd).size;
    const len = Math.min(size, TRANSCRIPT_TAIL);
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, size - len);
    const lines = buf.toString("utf8").split(/\r?\n/);
    for (let i = lines.length - 1; i >= 0; i--) {
      const l = lines[i].trim();
      if (!l.startsWith("{")) continue;
      let e;
      try { e = JSON.parse(l); } catch { continue; }
      const msg = e && (e.message || e);
      if (!msg || (e.type !== "assistant" && msg.role !== "assistant")) continue;
      const c = msg.content;
      const text = typeof c === "string" ? c : Array.isArray(c) ? c.filter((p) => p && p.type === "text" && typeof p.text === "string").map((p) => p.text).join("\n") : "";
      if (text.trim()) return text;
    }
  } catch {
    /* unreadable: nothing to check */
  } finally {
    if (fd !== undefined) try { fs.closeSync(fd); } catch { /* closed */ }
  }
  return "";
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
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return finish();
  const event = payload.hook_event_name || payload.hookEventName || "";
  if (event !== "Stop" && event !== "SubagentStop") return finish();
  if (payload.stop_hook_active === true) return finish(); // already sent back once: never twice in a row

  // The raw pre-check: the projects this stop may be about — the nearest dev-spec .specs/ at or above the session's cwd (a cd'd
  // subfolder, a worktree), the project dir Claude Code (or the user) exported — with the gate on. The engine then picks THE
  // project (spec.sessionProject, 1.23 review 5: a worktree's copy of .specs/ maps to the checkout the MCP server records in).
  const cwd = typeof payload.cwd === "string" && payload.cwd.trim() ? payload.cwd : null;
  const anchors = [process.env.CLAUDE_PROJECT_DIR, process.env.SPEC_PROJECT_DIR]
    .filter((v) => typeof v === "string" && v.trim() && !/^\$\{[^}]*\}$/.test(v.trim()));
  const cands = [...new Set([nearestDevSpec(cwd), ...anchors].filter(Boolean).map((v) => path.resolve(v)))].filter((d) => isDevSpecProject(d) && !gateOff(d));
  if (!cands.length) return finish();

  const sub = event === "SubagentStop";
  // Stop only (a subagent's gate reads its report, not the activity): no feature active lately → nothing the gate could say.
  if (!sub && !cands.some(recentActivity)) return finish();
  let message = typeof payload.last_assistant_message === "string" ? payload.last_assistant_message : "";
  if (!message.trim()) message = lastAssistantText(sub ? payload.agent_transcript_path || payload.transcript_path : payload.transcript_path);
  if (!message.trim()) return finish();

  const spec = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const s = spec.sessionProject({ cwd, anchors });
  const pdir = s ? s.project : cands[0];
  if (gateOff(pdir)) return finish();
  // hooks.json registers SubagentStop for the spec-implementer and the spec-simplifier: a payload without agent_type (older
  // versions) is read as the implementer — a simplifier's reply names no task report, so that check lets it through.
  const agent = !sub ? "" : typeof payload.agent_type === "string" && payload.agent_type.trim() ? payload.agent_type : "spec-implementer";
  const r = spec.stopCheck(pdir, { message, agent });
  if (r && r.block === true && typeof r.reason === "string" && r.reason) return finish({ decision: "block", reason: r.reason });
  return finish();
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
