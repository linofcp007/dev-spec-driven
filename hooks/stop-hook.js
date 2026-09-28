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
 *   - SubagentStop, matcher ^(dev-spec-driven:)?spec-implementer$: the implementer never ticks tasks (the controller does,
 *     after review), so its DONE is checked against its report — the task's runnable _Verify:_ commands and an exit code
 *     must be in .specs/<feature>/.execution/task-N-report.md. (Plugin subagents ignore `hooks` in their frontmatter, so
 *     the plugin's hooks.json is where this lives.)
 * The decision is the engine's (spec.stopCheck — `dev-spec stop-check` prints the same one).
 *
 * It never sends a stop back twice in a row (`stop_hook_active`), is silent (exit 0, no output) when there is nothing to
 * say, when the project has no dev-spec .specs/ or when roadmap.json meta.stopCheck is false (spec_init {stopCheck: false} /
 * `dev-spec init --stop-check off`; 1.16: while it is unset, the user's plugin option stop_check off), and NEVER blocks on its own trouble: a malformed payload, an unreadable file or any
 * internal error exits 0 silently. Bounded: the message's tail, each feature's .state.json / tasks.md, one report file.
 */

const fs = require("fs");
const path = require("path");

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

// The user's STOP_CHECK plugin option (1.16 — plugin.json userConfig stop_check, exported by Claude Code as
// CLAUDE_PLUGIN_OPTION_STOP_CHECK; DEV_SPEC_STOP_CHECK wins) set to off. The engine (spec.stopCheckEnabled) reads the same.
function userStopCheckOff() {
  for (const n of ["DEV_SPEC_STOP_CHECK", "CLAUDE_PLUGIN_OPTION_STOP_CHECK"]) {
    const v = typeof process.env[n] === "string" ? process.env[n].trim() : "";
    if (v && !/^\$\{[^}]*\}$/.test(v)) return /^(?:false|off|no|0)$/i.test(v);
  }
  return false;
}
// roadmap.json meta.stopCheck === false → off; not a boolean (unset) → the user's option. Read raw: the engine is loaded only
// when the gate may have something to say.
function gateOff(dir) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(dir, ".specs", "roadmap.json"), "utf8").replace(/^\uFEFF/, ""));
    const meta = !!j && typeof j === "object" && !!j.meta && typeof j.meta === "object" ? j.meta : {};
    return meta.stopCheck === false || (typeof meta.stopCheck !== "boolean" && userStopCheckOff());
  } catch {
    return false; // missing or broken roadmap.json: the engine decides (it never blocks on a file it can't read)
  }
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

  // The project: the session's cwd, else the project dir Claude Code (or the user) exported.
  const cwd = typeof payload.cwd === "string" && payload.cwd.trim() ? payload.cwd : null;
  const pdir = [cwd, process.env.CLAUDE_PROJECT_DIR, process.env.SPEC_PROJECT_DIR]
    .filter((v) => typeof v === "string" && v.trim() && !/^\$\{[^}]*\}$/.test(v.trim()))
    .map((v) => path.resolve(v))
    .find(isDevSpecProject);
  if (!pdir || gateOff(pdir)) return finish();

  const sub = event === "SubagentStop";
  let message = typeof payload.last_assistant_message === "string" ? payload.last_assistant_message : "";
  if (!message.trim()) message = lastAssistantText(sub ? payload.agent_transcript_path || payload.transcript_path : payload.transcript_path);
  if (!message.trim()) return finish();

  const spec = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  // hooks.json registers SubagentStop for the spec-implementer only: a payload without agent_type (older versions) is that agent.
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
