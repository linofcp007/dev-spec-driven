#!/usr/bin/env node
"use strict";

/**
 * dev-spec-driven — harness-observed evidence (zero-dependency). "Evidence before claims", seen where the command runs.
 *
 * Wired from hooks/hooks.json for PostToolUse and PostToolUseFailure, matcher Bash (https://code.claude.com/docs/en/hooks).
 * spec_complete_task / spec_finish {evidence} record the {command, exitCode} an agent REPORTS; in Claude Code the harness
 * sees every Bash run, so this hook logs the runs that matter — a task's runnable _Verify:_ command (or the " && " join of a
 * task's commands) or a project check (roadmap.json meta.checks) — and the engine then stamps each reported run
 * `observed: true | false` (spec.observedRun). roadmap.json meta.evidence "observed" (opt-in) makes that stamp the rule.
 *
 * Both payload shapes are read defensively (the docs differ on how a non-zero exit arrives):
 *   - PostToolUse: tool_response.exit_code (or exitCode / code; a response text starting "Exit code N"); none → 0 (the event
 *     fires after a tool call succeeds). An interrupted or backgrounded run is no run.
 *   - PostToolUseFailure: the same fields, else the exit code named in `error` ("… exit code 1"), else 1 — never 0.
 * A command `cd <project root> && <cmd>` counts as <cmd> (the Bash tool often prefixes the folder it runs in).
 *
 * Cheap and silent, like every dev-spec hook: it exits at once unless the tool is Bash and the project has a .specs/ dev-spec
 * owns; the engine is loaded only when the command's text appears in a feature's tasks.md or in meta.checks (a plain text
 * pre-filter), and then it only appends one JSON line {command, exitCode, at, event, session} to a git-ignored, size-bounded
 * log (.specs/<feature>/.execution/observed.jsonl; .specs/.execution/observed.jsonl for a project check). It prints nothing,
 * never blocks, and exits 0 on any error, a malformed / empty / oversized payload, or an irrelevant event.
 */

const fs = require("fs");
const path = require("path");

const MAX_INPUT = 4 * 1024 * 1024; // a larger payload is ignored (Claude Code truncates Bash output long before this)
const MAX_COMMAND = 4000; // no _Verify:_ / project-check command is longer (spec.js OBSERVED_MAX_COMMAND)
const MAX_FEATURES = 200; // feature folders pre-filtered, at most
const MAX_TASKS_BYTES = 2 * 1024 * 1024; // a tasks.md past this is skipped
const BOM = String.fromCharCode(0xfeff);

let done = false;
let ran = false;
// Nothing is ever printed: exit as soon as the work is done (there is no stdout to flush).
function finish() {
  if (done) return;
  done = true;
  process.exit(0);
}

// The same key the engine compares (spec.js flatCommand): backticks dropped, whitespace runs flattened.
const flat = (s) => String(s == null ? "" : s).replace(/`/g, "").replace(/\s+/g, " ").trim();

// The hooks run in EVERY project: only a .specs/ that dev-spec owns (roadmap.json, steering/, a generated ROADMAP.md, or a
// feature folder with its .state.json / classification.md).
function isDevSpecProject(dir) {
  const root = path.join(dir, ".specs");
  try {
    if (!fs.statSync(root).isDirectory()) return false;
  } catch {
    return false;
  }
  if (fs.existsSync(path.join(root, "roadmap.json")) || fs.existsSync(path.join(root, "steering"))) return true;
  try {
    const rm = fs.readFileSync(path.join(root, "ROADMAP.md"), "utf8");
    if (/AUTO-GE(?:NERATED|RADO|NERADO) (?:by|por) dev-spec/.test(rm.slice(0, 4000))) return true;
  } catch { /* no roadmap */ }
  try {
    return fs.readdirSync(root, { withFileTypes: true }).some((d) => d.isDirectory() &&
      (fs.existsSync(path.join(root, d.name, ".state.json")) || fs.existsSync(path.join(root, d.name, "classification.md"))));
  } catch {
    return false;
  }
}

// The project: the nearest folder holding .specs/ at or above the session's cwd, else the project dir Claude Code (or the
// user) exported — the first that is dev-spec's.
function projectDirOf(payload) {
  const cands = [];
  if (typeof payload.cwd === "string" && payload.cwd.trim()) {
    let d = path.resolve(payload.cwd);
    for (let i = 0; i < 12; i++) {
      if (fs.existsSync(path.join(d, ".specs"))) { cands.push(d); break; }
      const up = path.dirname(d);
      if (up === d) break;
      d = up;
    }
  }
  for (const v of [process.env.CLAUDE_PROJECT_DIR, process.env.SPEC_PROJECT_DIR]) {
    if (typeof v === "string" && v.trim() && !/^\$\{[^}]*\}$/.test(v.trim())) cands.push(path.resolve(v));
  }
  return cands.find(isDevSpecProject) || null;
}

function toCode(v) {
  if (typeof v === "number" && Number.isSafeInteger(v)) return v;
  if (typeof v === "string" && /^\s*-?\d{1,9}\s*$/.test(v)) return parseInt(v, 10);
  return null;
}
// → the run's exit code, or null when this was no completed run (interrupted, or sent to the background) or its code is unknown.
function exitCodeOf(payload, failure) {
  const input = payload.tool_input && typeof payload.tool_input === "object" ? payload.tool_input : {};
  const resp = payload.tool_response;
  const r = resp && typeof resp === "object" && !Array.isArray(resp) ? resp : {};
  if (payload.is_interrupt === true || r.interrupted === true) return null;
  if (input.run_in_background === true || r.backgroundTaskId != null || r.backgroundedByUser === true) return null;
  const nonZero = (c) => (failure && c === 0 ? 1 : c); // a failure is never a pass
  for (const v of [r.exit_code, r.exitCode, r.code, r.returnCode, payload.exit_code, payload.exitCode]) {
    const c = toCode(v);
    if (c != null) return nonZero(c);
  }
  const text = typeof resp === "string" ? resp : typeof r.text === "string" ? r.text : typeof r.output === "string" ? r.output : "";
  const lead = /^\s*Exit code:?\s*(-?\d{1,9})\b/i.exec(text.slice(0, 200));
  if (lead) return nonZero(parseInt(lead[1], 10));
  // A non-zero exit the Bash tool read as no error (grep's "No matches found"): the code itself is unknown — no run logged.
  if (typeof r.returnCodeInterpretation === "string" && r.returnCodeInterpretation.trim()) return null;
  if (!failure) return r.is_error === true || r.isError === true ? 1 : 0;
  const err = typeof payload.error === "string" ? payload.error : typeof r.error === "string" ? r.error : "";
  const m = /exit(?:ed)?(?:\s+with)?\s+(?:code|status)\s*:?\s*(-?\d{1,9})\b/i.exec(err.slice(0, 4000));
  return nonZero(m ? parseInt(m[1], 10) : 1);
}

// `cd <project root> && <cmd>` (or `;`) → <cmd>: the Bash tool often runs a command from the project root that way. Any
// other folder is another run (kept whole, so it matches nothing).
function stripCdPrefix(cmd, pdir, cwd) {
  const m = /^cd\s+(?:"([^"]*)"|'([^']*)'|([^\s;&|]+))\s*(?:&&|;)\s*([\s\S]+)$/.exec(cmd);
  if (!m) return cmd;
  let target = m[1] != null ? m[1] : m[2] != null ? m[2] : m[3];
  // Git Bash / MSYS paths on Windows: /c/Users/… → C:/Users/…
  if (process.platform === "win32") target = target.replace(/^\/([a-zA-Z])(?=\/|$)/, (_, d) => d + ":");
  const norm = (p) => {
    const r = path.resolve(p).replace(/[\\/]+$/, "");
    return process.platform === "win32" || process.platform === "darwin" ? r.toLowerCase() : r;
  };
  return norm(path.resolve(cwd || pdir, target)) === norm(pdir) ? m[4].trim() : cmd;
}

// The plain-text pre-filter: is the command written in a feature's tasks.md or in meta.checks at all? Only then is the
// engine loaded (it parses the tasks for real and skips archived features).
function mentioned(pdir, key) {
  const root = path.join(pdir, ".specs");
  try {
    let raw = fs.readFileSync(path.join(root, "roadmap.json"), "utf8");
    if (raw.startsWith(BOM)) raw = raw.slice(1);
    const rm = JSON.parse(raw);
    const checks = rm && rm.meta && typeof rm.meta === "object" ? rm.meta.checks : null;
    if (checks && typeof checks === "object" && Object.values(checks).some((c) => typeof c === "string" && flat(c) === key)) return true;
  } catch { /* no or broken roadmap.json: no project checks */ }
  let dirs = [];
  try {
    dirs = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory() && !/^[._]/.test(d.name)).slice(0, MAX_FEATURES);
  } catch {
    return false;
  }
  for (const d of dirs) {
    const file = path.join(root, d.name, "tasks.md");
    try {
      if (fs.statSync(file).size > MAX_TASKS_BYTES) continue;
      if (flat(fs.readFileSync(file, "utf8")).includes(key)) return true;
    } catch { /* no tasks.md */ }
  }
  return false;
}

function main(raw) {
  if (ran) return; // stdin 'end' and the safety-net timer must not both run it
  ran = true;
  if (!raw || raw.length > MAX_INPUT) return finish();
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return finish();
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return finish();
  if (payload.tool_name !== "Bash") return finish();
  const event = typeof payload.hook_event_name === "string" ? payload.hook_event_name : "";
  if (event && event !== "PostToolUse" && event !== "PostToolUseFailure") return finish();
  const failure = event === "PostToolUseFailure" || (!event && typeof payload.error === "string");
  const input = payload.tool_input;
  const command = input && typeof input === "object" && typeof input.command === "string" ? input.command.trim() : "";
  if (!command || command.length > MAX_COMMAND) return finish();
  const exitCode = exitCodeOf(payload, failure);
  if (exitCode == null) return finish();

  const pdir = projectDirOf(payload);
  if (!pdir) return finish();
  const cwd = typeof payload.cwd === "string" && payload.cwd.trim() ? payload.cwd : pdir;
  const key = flat(stripCdPrefix(command, pdir, cwd));
  if (!key || !mentioned(pdir, key)) return finish();

  const spec = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  spec.observeRun(pdir, {
    command: key,
    exitCode,
    event: event || (failure ? "PostToolUseFailure" : "PostToolUse"),
    session: typeof payload.session_id === "string" ? payload.session_id : undefined,
  });
  return finish();
}

// Never crash, whatever the payload: any unexpected error is a silent no-op.
function safeMain(raw) {
  try {
    main(raw);
  } catch {
    finish();
  }
}

// Read the hook payload from stdin asynchronously (fs.readFileSync(0) is unreliable on Windows pipes). Past MAX_INPUT the
// rest is drained unread and the payload ignored.
let input = "";
let tooBig = false;
if (process.stdin.isTTY) {
  safeMain("");
} else {
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (c) => {
    if (tooBig) return;
    input += c;
    if (input.length > MAX_INPUT) { tooBig = true; input = ""; }
  });
  process.stdin.on("end", () => safeMain(input));
  process.stdin.on("error", () => finish());
  setTimeout(() => safeMain(tooBig ? "" : input), 2000).unref(); // safety net
}
