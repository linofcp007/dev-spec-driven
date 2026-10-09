#!/usr/bin/env node
"use strict";

/**
 * dev-spec-driven — harness-observed evidence (zero-dependency). "Evidence before claims", seen where the command runs.
 *
 * Wired from hooks/hooks.json for PostToolUse and PostToolUseFailure, matcher Bash|PowerShell (https://code.claude.com/docs/en/hooks) —
 * a PowerShell run is logged only with an explicit exit code (its response shape is undocumented).
 * spec_complete_task / spec_finish {evidence} record the {command, exitCode} an agent REPORTS; in Claude Code the harness
 * sees every Bash run, so this hook logs the runs that matter — a task's runnable _Verify:_ command (or the " && " join of a
 * task's commands) or a project check (roadmap.json meta.checks) — and the engine then stamps each reported run
 * `observed: true | false` (spec.observedRun). roadmap.json meta.evidence "observed" (opt-in) makes that stamp the rule.
 *
 * Both payload shapes are read defensively (the docs differ on how a non-zero exit arrives):
 *   - PostToolUse: tool_response.exit_code (or exitCode / code; a response text starting "Exit code N"); none → 0 (the event
 *     fires after a tool call succeeds). An interrupted or backgrounded run is no run.
 *   - PostToolUseFailure: the same fields, else the exit code named in `error` ("… exit code 1"), else 1 — never 0.
 * A command `cd <project root> && <cmd>` counts as <cmd> (the Bash tool often prefixes the folder it runs in) — the root of any
 * project the run belongs to (a worktree's too), stripped by the engine's stripCdPrefix, the function observedRun applies.
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
const MAX_COMMAND = 4000; // no _Verify:_ / project-check command is longer (the engine's OBSERVED_MAX_COMMAND, engine/evidence.js)
const MAX_FEATURES = 200; // feature folders pre-filtered, at most
const MAX_TASKS_BYTES = 2 * 1024 * 1024; // a tasks.md past this is skipped

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
// Nothing is ever printed: exit as soon as the work is done (there is no stdout to flush).
function finish() {
  if (done) return;
  done = true;
  process.exit(0);
}

// The pre-filter's reading — a copy of the engine's observedNorm / observedBodies (engine/evidence.js; mcp/tests/09-evidence.js
// checks the two agree): the run's command bodies — split at ` && ` and `;`, a `cd` / `set … pipefail` part dropped, leading
// NAME=value assignments (quotes honoured) and a trailing 2>&1 dropped, then backticks and quotes dropped, `\` read as `/`,
// whitespace folded — must each appear in a tasks.md (or a meta.checks command) read the same way. A SUPERSET of the engine's
// matcher (runProvesVerify — review 3: `node --test tests\x.test.js`, `CI=1 npm run lint`, a reversed join used to miss it): the
// engine decides. Cheap: a few string passes, no parse. (Review 5: pipes unspaced, a word's leading `./` dropped, npm's aliases of
// `npm test`, `&&` however spaced, and chdir / pushd / popd / Set-Location / sl / Push-Location / Pop-Location parts too.)
const norm = (s) => String(s == null ? "" : s).replace(/[`"']/g, "").split(String.fromCharCode(92)).join("/").replace(/\s+/g, " ").trim()
  .replace(/ ?(\|+) ?/g, "$1").replace(/(^|[ ;&|(=])\.\//g, "$1").replace(/\bnpm (?:run(?:-script)? test|t|tst)(?=$|[ ;&|])/g, "npm test");
const RE_ENV = /^(?:[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|[^\s"'`;&|]*)\s+)+/;
function bodies(cmd) {
  const out = [];
  for (let part of String(cmd == null ? "" : cmd).replace(/\s+/g, " ").split(/\s*&&\s*|;/)) {
    part = part.trim();
    if (!part || /^(?:cd|chdir|pushd|popd|sl|set-location|push-location|pop-location)(?:\s|$)/i.test(part) || /^set\s.*pipefail\s*$/.test(part)) continue;
    const b = norm(part.replace(RE_ENV, "").replace(/\s+2>&1$/, ""));
    if (b) out.push(b);
  }
  return out;
}

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

// The projects a run belongs to: the nearest folder holding .specs/ at or above the session's cwd AND the project dir Claude
// Code (or the user) exported — every distinct one that is dev-spec's. A subagent working in a git worktree of the project
// (parallel execution, waves) runs in the worktree's copy, whose git-ignored log is never merged back: the run is logged in
// the main project too (feature review R4).
// ≤ MAX_UP levels (1.24 r6 I2: it was 12 — a run 13+ folders below a nested project was never logged): the engine's
// SESSION_MAX_UP, as the guard / stop hooks and hook-utils.js nearestSpecs walk (inline here: the hot path of every Bash call
// requires nothing — mcp/tests/10-guards-review6.js checks every bound is SESSION_MAX_UP).
const MAX_UP = 40;
function projectDirsOf(payload) {
  const cands = [];
  if (typeof payload.cwd === "string" && payload.cwd.trim()) {
    let d = path.resolve(payload.cwd);
    for (let i = 0; i < MAX_UP; i++) {
      if (fs.existsSync(path.join(d, ".specs"))) { cands.push(d); break; }
      const up = path.dirname(d);
      if (up === d) break;
      d = up;
    }
  }
  for (const v of [process.env.CLAUDE_PROJECT_DIR, process.env.SPEC_PROJECT_DIR]) {
    if (typeof v === "string" && v.trim() && !/^\$\{[^}]*\}$/.test(v.trim())) cands.push(path.resolve(v));
  }
  const key = (d) => (process.platform === "win32" || process.platform === "darwin" ? d.toLowerCase() : d);
  const seen = new Set();
  return cands.filter((d) => !seen.has(key(d)) && seen.add(key(d)) && isDevSpecProject(d));
}

function toCode(v) {
  if (typeof v === "number" && Number.isSafeInteger(v)) return v;
  if (typeof v === "string" && /^\s*-?\d{1,9}\s*$/.test(v)) return parseInt(v, 10);
  return null;
}
// → the run's exit code, or null when this was no completed run (interrupted, or sent to the background) or its code is unknown.
// strict (the PowerShell tool, whose response shape is not documented): only an explicit exit code counts — never a default.
function exitCodeOf(payload, failure, strict) {
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
  if (strict && !failure) return null; // unknown: logging 0 would turn a failed run into an observed pass
  // A non-zero exit the Bash tool read as no error (grep's "No matches found"): the code itself is unknown — no run logged.
  if (typeof r.returnCodeInterpretation === "string" && r.returnCodeInterpretation.trim()) return null;
  if (!failure) return r.is_error === true || r.isError === true ? 1 : 0;
  const err = typeof payload.error === "string" ? payload.error : typeof r.error === "string" ? r.error : "";
  const m = /exit(?:ed)?(?:\s+with)?\s+(?:code|status)\s*(?::\s*)?(-?\d{1,9})\b/i.exec(err.slice(0, 4000)); // \s*(?::\s*)?: 1.17 H
  return nonZero(m ? parseInt(m[1], 10) : 1);
}

// A `cd <dir>` part is dropped WHATEVER the folder — the Bash tool often runs a command from the project root that way. Only a
// filter (a superset): the engine decides, with the ONE stripping function the reported run's lookup uses too
// (spec.stripCdPrefix — the folder must be one of the run's projects: this one, or the one holding the cwd, a worktree's), and
// then its matcher, what is logged (1.22 review — the hook stripped, the lookup didn't; a worktree's run reached only its own log).

// A tasks.md written as UTF-16 (a BOM: FF FE / FE FF — Windows PowerShell 5.1) is read as the engine reads it (files.js
// decodeText, 1.22 review) without loading the engine for this pre-filter: hook-utils.js textOf (shared since 1.24 review 6), required
// only for such a file; anything else is UTF-8.
const textOfBuf = (buf) => (buf.length >= 2 && ((buf[0] === 0xff && buf[1] === 0xfe) || (buf[0] === 0xfe && buf[1] === 0xff)) ? require("./hook-utils.js").textOf(buf) : buf.toString("utf8"));
// The plain-text pre-filter: are the command's bodies written in a feature's tasks.md or in a meta.checks command at all? Only
// then is the engine loaded (it parses the tasks for real and skips archived features).
function mentioned(pdir, parts) {
  const root = path.join(pdir, ".specs");
  const has = (text) => { const t = norm(text); return parts.every((x) => t.includes(x)); };
  try {
    const rm = readJsonFile(path.join(root, "roadmap.json"));
    const checks = rm && rm.meta && typeof rm.meta === "object" ? rm.meta.checks : null;
    if (checks && typeof checks === "object" && Object.values(checks).some((c) => typeof c === "string" && has(c))) return true;
  } catch { /* no or broken roadmap.json: no project checks */ }
  let dirs = [];
  try {
    dirs = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory() && !/^[._]/.test(d.name)).slice(0, MAX_FEATURES);
  } catch {
    return false;
  }
  for (const d of dirs) {
    // tasks.md — or, only when there is none, a change's change.md, which holds its tasks (1.21 F5). 1.22 review: one open per
    // feature (its size read from the open file) — a stat, a read and a change.md probe per feature cost +133 ms a Bash call
    // at 150 features.
    const raw = readTasksText(path.join(root, d.name, "tasks.md"));
    const got = raw === null ? readTasksText(path.join(root, d.name, "change.md")) : raw;
    if (typeof got !== "string") continue;
    // (the " && " join of a task's commands — how done --run reports them — is never written whole: every part is, review R6)
    if (has(got)) return true;
  }
  return false;
}
// A tasks file's text → the text, null when there is no such file, false when it can't be read or passes MAX_TASKS_BYTES.
function readTasksText(file) {
  let fd;
  try { fd = fs.openSync(file, "r"); } catch (e) { return e && e.code === "ENOENT" ? null : false; }
  try {
    const size = fs.fstatSync(fd).size;
    if (size > MAX_TASKS_BYTES) return false;
    const buf = Buffer.alloc(size);
    const n = fs.readSync(fd, buf, 0, size, 0);
    return textOfBuf(n === size ? buf : buf.subarray(0, n)); // a UTF-16 (BOM) file too — Windows PowerShell 5.1 writes them
  } catch {
    return false;
  } finally {
    try { fs.closeSync(fd); } catch { /* closed */ }
  }
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
  // The Bash tool, and on Windows the PowerShell tool (strict: its exit code must be explicit — review R5).
  if (payload.tool_name !== "Bash" && payload.tool_name !== "PowerShell") return finish();
  const strict = payload.tool_name === "PowerShell";
  const event = typeof payload.hook_event_name === "string" ? payload.hook_event_name : "";
  if (event && event !== "PostToolUse" && event !== "PostToolUseFailure") return finish();
  const failure = event === "PostToolUseFailure" || (!event && typeof payload.error === "string");
  const input = payload.tool_input;
  const command = input && typeof input === "object" && typeof input.command === "string" ? input.command.trim() : "";
  if (!command || command.length > MAX_COMMAND) return finish();
  const exitCode = exitCodeOf(payload, failure, strict);
  if (exitCode == null) return finish();

  let spec = null;
  const dirs = projectDirsOf(payload);
  const parts = bodies(command);
  const hits = parts.length ? dirs.filter((d) => mentioned(d, parts)) : []; // the pre-filter, once per project
  // 1.23 review 5 (M8): once some project passed the pre-filter, the session's project too (spec.sessionProject — a worktree's
  // copy mapped to the checkout the MCP server records in), when it isn't one of them already (no CLAUDE_PROJECT_DIR exported).
  if (hits.length) {
    spec = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
    const s = spec.sessionProject({ cwd: payload.cwd, anchors: [process.env.CLAUDE_PROJECT_DIR, process.env.SPEC_PROJECT_DIR] });
    const key = (d) => (process.platform === "win32" || process.platform === "darwin" ? path.resolve(d).toLowerCase() : path.resolve(d));
    if (s && !dirs.some((d) => key(d) === key(s.project)) && mentioned(s.project, parts)) { dirs.push(s.project); hits.push(s.project); }
  }
  for (const pdir of hits) {
    const cwd = typeof payload.cwd === "string" && payload.cwd.trim() ? payload.cwd : pdir;
    spec = spec || require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
    // The engine strips a `cd <dir> &&` whose folder is this project or another one the run belongs to (dirs: a worktree's and
    // the main project), from the run's cwd — any other folder keeps the whole command, which then matches nothing.
    spec.observeRun(pdir, {
      command,
      cwd,
      roots: dirs,
      exitCode,
      event: event || (failure ? "PostToolUseFailure" : "PostToolUse"),
      session: typeof payload.session_id === "string" ? payload.session_id : undefined,
    });
  }
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
