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
 * First, whatever the gate says (1.24 r6 I-I1): ROADMAP.md / SPECS.md left stale by the turn's spec saves (the save hook's stamp)
 * are refreshed, once — the save hook no longer refreshes them on every Write / Edit.
 *
 * It never sends a stop back twice in a row (`stop_hook_active`), is silent (exit 0, no output) when there is nothing to
 * say, when the project has no dev-spec .specs/ or when roadmap.json meta.stopCheck is false (spec_init {stopCheck: false} /
 * `dev-spec init --stop-check off`; 1.16: while it is unset, the user's DEV_SPEC_STOP_CHECK=off), and NEVER blocks on its own trouble: a malformed payload, an unreadable file or any
 * internal error exits 0 silently. Bounded: the message's tail, each feature's .state.json / tasks.md, one report file.
 */

const fs = require("fs");
const path = require("path");

// The project probe (mcp/lib/probe.js): the one dev-spec project rule, the session's candidate projects, a JSON file read as the engine
// reads it (UTF-8, or UTF-16 with a BOM — 1.24 review 6, C3). Required once the event is a Stop / SubagentStop.
let P = null;
const probe = () => P || (P = require(path.join(__dirname, "..", "mcp", "lib", "probe.js")));

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
    const j = probe().readJsonFile(path.join(dir, ".specs", "roadmap.json"));
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
    try { j = probe().readJsonFile(file); } catch { continue; } // unreadable: the engine skips it too (UTF-16 with a BOM is read — 1.24 review 6, C3)
    if (walk(j, 0)) return true;
  }
  return false;
}

// 1.24 r6 I-I1 — the end of the turn: a ROADMAP.md / SPECS.md left stale by spec saves (the save hook's stamp, spec.ROADMAP_STALE_FILE
// in .specs/.execution/) is refreshed ONCE here, whatever the gate then says (a second stop in a row, the gate off). One stat per
// project; the engine loads only for a stamped one.
const ROADMAP_STALE = path.join(".specs", ".execution", "roadmap-stale");
function refreshStale(dirs) {
  const stale = dirs.filter((d) => { try { return fs.statSync(path.join(d, ROADMAP_STALE)).isFile(); } catch { return false; } });
  if (!stale.length) return;
  try {
    const spec = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
    for (const d of stale) try { spec.refreshStaleRoadmap(d); } catch { /* best-effort */ }
  } catch { /* engine not found: nothing refreshed */ }
}

// 1.24 r6 I-I4 — the claim pre-filter (Stop only): the gate sends a turn back only when the closing message claims the work is done
// or verified (stopCheck → stopClaims). hooks/stop-claims.generated.json (scripts/build.js) holds every language's claim patterns and
// the engine's prose regexes; while every source it names still has the size it was built from (one stat each — no version since
// 1.26: the filter is a function of those files alone, so a release that changes none of them keeps it), a message whose prose
// matches none of them — the engine's answer too: "no-claim" — ends the hook before the engine loads (~100 ms). Missing, broken,
// stale, or any error → true: the engine decides, as before.
function mayClaim(message) {
  try {
    const f = JSON.parse(fs.readFileSync(path.join(__dirname, "stop-claims.generated.json"), "utf8"));
    if (!f || !f.sources || typeof f.sources !== "object" || !Object.keys(f.sources).length || !Array.isArray(f.claims)) return true;
    for (const [rel, size] of Object.entries(f.sources)) if (fs.statSync(path.join(__dirname, "..", ...rel.split("/"))).size !== size) return true;
    const hu = require("./hook-utils.js");
    // 1.25.1: only the claim patterns of the languages whose trigger words the prose holds (f.triggers — as stopClaims runs them):
    // none → no claim, with nothing but the small trigger regexes compiled (every pattern of every language cost ~35 ms).
    if (Array.isArray(f.triggers) && f.triggers.length) {
      const prose = hu.claimProse(message, f.prose);
      const flags = String(f.word.flags).replace(/[gm]/g, "");
      const idx = new Set();
      for (const t of f.triggers) if (new RegExp(f.word.pre + t.source + f.word.post, flags).test(prose)) for (const i of t.claims) idx.add(i);
      if (!idx.size) return false;
      return hu.claimMatch(message, { ...f, claims: [...idx].sort((a, b) => a - b).map((i) => f.claims[i]) });
    }
    return hu.claimMatch(message, f);
  } catch {
    return true;
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

  // The raw pre-check: the projects this stop may be about (probe.sessionProjects — the nearest dev-spec .specs/ at or above the
  // session's cwd: a cd'd subfolder, a worktree; the project dir Claude Code or the user exported) — with the gate on. The engine then
  // picks THE project (spec.sessionProject, 1.23 review 5: a worktree's copy of .specs/ maps to the checkout the MCP server records in).
  const cwd = typeof payload.cwd === "string" && payload.cwd.trim() ? payload.cwd : null;
  const anchors = probe().sessionAnchors();
  const projects = probe().sessionProjects({ cwd, anchors });
  refreshStale(projects); // 1.24 r6 I-I1: the turn's spec saves → ROADMAP.md / SPECS.md, once
  if (payload.stop_hook_active === true) return finish(); // already sent back once: never twice in a row
  const cands = projects.filter((d) => !gateOff(d));
  if (!cands.length) return finish();

  const sub = event === "SubagentStop";
  // Stop only (a subagent's gate reads its report, not the activity): no feature active lately → nothing the gate could say.
  if (!sub && !cands.some(recentActivity)) return finish();
  let message = typeof payload.last_assistant_message === "string" ? payload.last_assistant_message : "";
  if (!message.trim()) message = lastAssistantText(sub ? payload.agent_transcript_path || payload.transcript_path : payload.transcript_path);
  if (!message.trim()) return finish();
  // Stop only (a subagent's DONE is read with its report and its status line): no claim pattern in the prose → nothing to say.
  if (!sub && !mayClaim(message)) return finish();

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
