#!/usr/bin/env node
"use strict";

/**
 * dev-spec-driven — harness-observed evidence (zero-dependency). "Evidence before claims", seen where the command runs.
 *
 * Wired from hooks/hooks.json for PostToolUse and PostToolUseFailure, matcher Bash|PowerShell (https://code.claude.com/docs/en/hooks) —
 * a PowerShell run is logged only with an explicit exit code (its response shape is undocumented). Both entries are `"async": true`
 * it prints nothing and decides nothing, so Claude Code never waits for it — the docs: an async hook runs in the background,
 * its decision fields have no effect, its timeout isn't enforced, and `claude -p` kills one still running at teardown (the last run
 * of a headless session may go unlogged).
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
 * pre-filter), and then it only appends one JSON line {command, exitCode, at, event, session, tool?} (tool: "PowerShell" for
 * a PowerShell run, 1.36 review 1 — none for a Bash one) to a git-ignored, size-bounded
 * log (.specs/<feature>/.execution/observed.jsonl; .specs/.execution/observed.jsonl for a project check). It prints nothing,
 * never blocks, and exits 0 on any error, a malformed / empty / oversized payload, or an irrelevant event.
 * 1.41: a project check's run carrying the payload's `duration_ms` is also timed — one line in .specs/.execution/timings.jsonl (the
 * friction budget, engine/friction.js); the observed line stays as it was.
 * 1.42 (S9-c): also wired for SubagentStop — the plugin's six agents (agents/*.md), the entry after the stop gate's, `"async": true` —
 * it reads the finished agent's OWN transcript (agent_transcript_path, a regular file only, bounded) and hands its COUNTS (assistant
 * turns, tool calls, tokens, the model) to spec.recordAgentRun: one line in the git-ignored .specs/.execution/agents.jsonl, never a
 * transcript's text (spec_metrics' project `agents`, engine/agents.js). Prints nothing, decides nothing, like the rest.
 */

const fs = require("fs");
const path = require("path");
// The hooks' runner (stdin, the safety net, the exit — nothing is ever printed: decide answers null) and the project probe
// (mcp/lib/probe.js: the one dev-spec project rule, the session's candidate projects, a file read as the engine reads it — UTF-8, or
// UTF-16 with a BOM, Windows PowerShell 5.1's Out-File), required once the call is a completed Bash / PowerShell run: every other tool
// call exits before it loads.
const { runHook, payloadOf, eventOf, probe } = require("./hook-utils.js");

const MAX_INPUT = 4 * 1024 * 1024; // a larger payload is ignored (Claude Code truncates Bash output long before this)
const MAX_COMMAND = 4000; // no _Verify:_ / project-check command is longer (the engine's OBSERVED_MAX_COMMAND, engine/evidence.js)
const MAX_FEATURES = 200; // feature folders pre-filtered, at most
const MAX_TASKS_BYTES = 2 * 1024 * 1024; // a tasks.md past this is skipped
// (1.42 S9-c) an agent transcript is read up to TRANSCRIPT_MAX bytes — the largest of 4,440 local dev-spec agent transcripts is 26.8 MB
// (p99 6.9 MB) —, past it `truncated` (what it hides: the counts are a lower bound, and the dispatch says so); TRANSCRIPT_CHUNK at a time
const TRANSCRIPT_MAX = 32 * 1024 * 1024;
const TRANSCRIPT_CHUNK = 1024 * 1024;
const USAGE_KEYS = ["input_tokens", "output_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"]; // → in, out, cacheRead, cacheWrite

// The pre-filter's reading — the engine's own (probe.js observedNorm / observedBodies, which engine/evidence.js observeRun repeats):
// the run's command bodies — split at ` && ` and `;`, a `cd` / `set … pipefail` part dropped, leading NAME=value assignments (quotes
// honoured) and a trailing 2>&1 dropped, then backticks and quotes dropped, `\` read as `/`, whitespace folded — must each appear in a
// tasks.md (or a meta.checks command) read the same way. A SUPERSET of the engine's matcher (runProvesVerify — `node --test
// tests\x.test.js`, `CI=1 npm run lint`, a reversed join used to miss it): the engine decides. Cheap: a few string passes, no parse.

// The projects a run belongs to: the session's dev-spec projects (probe.sessionProjects — the nearest dev-spec .specs/ at or above
// the session's cwd, ≤ SESSION_MAX_UP levels (this walk stopped at 12), AND the project dir Claude Code or the user
// exported), every distinct one. A subagent working in a git worktree of the project (parallel execution, waves) runs in the
// worktree's copy, whose git-ignored log is never merged back: the run is logged in the main project too (feature review R4).
const projectDirsOf = (payload) => probe().sessionProjects({ cwd: payload.cwd });

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
// then its matcher, what is logged (the hook stripped, the lookup didn't; a worktree's run reached only its own log).

// a scaffold's untouched `_Verify: [command that proves it, e.g. npm test -- path/to/file.test.js]_` names
// `npm test` — every `npm test` loaded the engine (~100 ms: 152 vs 59 ms a Bash call) to log nothing. A WHOLE bracketed _Verify:_
// value (backticks around it allowed) is a placeholder the engine never runs (tasks.js scanTaskMarkers: `^\[.*\]$` after the
// backtick units are dropped) — taken out of the tasks text before the match. Only a whole value on its line: `[ -f a ] && npm test`
// stays, so the filter is still a superset.
const RE_VERIFY_PLACEHOLDER = /_Verify:[ \t]*`*[ \t]*\[[^\n]*?\][ \t]*`*[ \t]*_/gi;
// The plain-text pre-filter: are the command's bodies written in a feature's tasks.md or in a meta.checks command at all? Only
// then is the engine loaded (it parses the tasks for real and skips archived features).
function mentioned(pdir, parts) {
  const root = path.join(pdir, ".specs");
  const has = (text) => { const t = probe().observedNorm(text); return parts.every((x) => t.includes(x)); };
  try {
    const rm = probe().readRegularJson(path.join(root, "roadmap.json")); // no regular file (a link, a FIFO, a folder — 1.42): none
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
    // tasks.md — or, only when there is none, a change's change.md, which holds its tasks. One lstat and one open per
    // feature (its size read from the open file) — a stat, a read and a change.md probe per feature cost +133 ms a Bash call
    // at 150 features; the lstat (1.42: a regular file only) is the one more call.
    const raw = readTasksText(path.join(root, d.name, "tasks.md"));
    const got = raw === null ? readTasksText(path.join(root, d.name, "change.md")) : raw;
    if (typeof got !== "string") continue;
    // (the " && " join of a task's commands — how done --run reports them — is never written whole: every part is)
    if (has(got.replace(RE_VERIFY_PLACEHOLDER, " "))) return true;
  }
  return false;
}
// A tasks file's text → the text, null when there is no such file, false when it can't be read or passes MAX_TASKS_BYTES. (1.42
// B142-13) One that is no REGULAR file — a link, a FIFO, a folder — is none (null: on to change.md, as the engine's change alias
// reads it), never opened: a FIFO tasks.md kept every Bash call's hook in one open waiting for a writer, and an async hook is never
// killed. Opened by probe.js openRegular (the fd's own fstat: a swap after the lstat reads as none too).
function readTasksText(file) {
  let st;
  try { st = fs.lstatSync(file); } catch (e) { return e && e.code === "ENOENT" ? null : false; }
  if (!st.isFile()) return null;
  let fd;
  try { fd = probe().openRegular(file); } catch { return false; }
  if (fd === null) return null;
  try {
    const size = fs.fstatSync(fd).size;
    if (size > MAX_TASKS_BYTES) return false;
    const buf = Buffer.alloc(size);
    const n = fs.readSync(fd, buf, 0, size, 0);
    return probe().textOf(n === size ? buf : buf.subarray(0, n)); // a UTF-16 (BOM) file too, as the engine reads it (files.js decodeText) — Windows PowerShell 5.1 writes them
  } catch {
    return false;
  } finally {
    try { fs.closeSync(fd); } catch { /* closed */ }
  }
}

// (1.42 S9-c) One plugin agent's transcript (Claude Code's JSONL: one line per event) → its counts, or null when it is no regular file
// — a link, a FIFO, a device, a folder: an lstat, then probe.js openRegular (O_NONBLOCK, the fd's own fstat: a swap after the lstat
// reads as none too), so this async hook, which Claude Code never kills, never waits on a FIFO — or can't be read. Bounded: at most
// opts.max bytes (TRANSCRIPT_MAX), read opts.chunk at a time (TRANSCRIPT_CHUNK) and split on the newline byte, a line carried whole
// across a chunk's end; past the bound `truncated` (the line it cut is dropped). Only the assistant lines count, and no text is kept:
//   - turns: the distinct message ids — Claude Code writes one line per content block, each repeating its message's usage;
//   - tokens: per id the per-field MAX of its lines' usage — a streamed message's output_tokens GROWS line by line (226 of 2,194 real
//     dev-spec transcripts), so never its first line and never a sum (2.0–2.2× the deduped) —, summed over the ids;
//   - tools: the tool_use blocks, per LINE (one block a line — an id may hold several calls);
//   - model: the last line's message.model.
// A line Claude Code wrote itself (`isApiErrorMessage`: an API error it reports — model `<synthetic>`, zero usage, one text block; 392
// of 1,149,180 assistant lines in 8,676 local subagent transcripts, each so marked) is no turn of the agent's, its model never the
// agent's. → { turns, tools, tokens: {in, out, cacheRead, cacheWrite}, model (null: none), truncated, read (the bytes read) } | null.
function agentRunOf(file, opts = {}) {
  const max = Number.isSafeInteger(opts.max) && opts.max > 0 ? opts.max : TRANSCRIPT_MAX;
  const chunk = Number.isSafeInteger(opts.chunk) && opts.chunk > 0 ? opts.chunk : TRANSCRIPT_CHUNK;
  try { if (!fs.lstatSync(file).isFile()) return null; } catch { return null; }
  let fd;
  try { fd = probe().openRegular(file); } catch { return null; }
  if (fd === null) return null;
  const ids = new Map(); // message id → its usage, per field the max so far
  let tools = 0, model = null, read = 0, truncated = false;
  const take = (line) => {
    let e;
    try { e = JSON.parse(line); } catch { return; }
    if (!e || e.type !== "assistant" || e.isApiErrorMessage === true) return;
    const m = e.message;
    if (!m || typeof m !== "object" || typeof m.id !== "string" || !m.id) return;
    const u = m.usage && typeof m.usage === "object" ? m.usage : {};
    const got = USAGE_KEYS.map((k) => (Number.isSafeInteger(u[k]) && u[k] >= 0 ? u[k] : 0));
    const had = ids.get(m.id);
    ids.set(m.id, had ? had.map((v, i) => Math.max(v, got[i])) : got);
    if (Array.isArray(m.content)) for (const b of m.content) if (b && b.type === "tool_use") tools++;
    if (typeof m.model === "string" && m.model) model = m.model;
  };
  try {
    const size = fs.fstatSync(fd).size;
    const end = Math.min(size, max);
    truncated = size > max;
    const buf = Buffer.alloc(Math.max(1, Math.min(chunk, end)));
    let part = []; // the pieces of the line not ended yet (copies: buf is reused)
    while (read < end) {
      const n = fs.readSync(fd, buf, 0, Math.min(buf.length, end - read), read);
      if (n <= 0) break;
      read += n;
      const piece = buf.subarray(0, n);
      let at = 0;
      for (let nl = piece.indexOf(10); nl !== -1; nl = piece.indexOf(10, at)) {
        const tail = piece.subarray(at, nl);
        take((part.length ? Buffer.concat([...part, tail]) : tail).toString("utf8"));
        part = [];
        at = nl + 1;
      }
      if (at < n) part.push(Buffer.from(piece.subarray(at)));
    }
    if (!truncated && part.length) take(Buffer.concat(part).toString("utf8")); // the last line, with no newline after it
  } catch {
    return null;
  } finally {
    try { fs.closeSync(fd); } catch { /* closed */ }
  }
  const sum = (i) => { let s = 0; for (const v of ids.values()) s += v[i]; return s; };
  return { turns: ids.size, tools, tokens: { in: sum(0), out: sum(1), cacheRead: sum(2), cacheWrite: sum(3) }, model, truncated, read };
}

// (1.42 S9-c) SubagentStop: one finished dispatch of a plugin agent → its counts in the session project's .specs/.execution/agents.jsonl
// (spec.recordAgentRun — the engine judges the role and every count's shape, and writes through the write gate; a role it doesn't
// know records nothing). hooks.json's matcher sends only the plugin's six agents here (a property test holds it equal to agents/*.md).
// Read: the agent's OWN transcript, `agent_transcript_path` — never `transcript_path`, the PARENT session's, which would credit the
// whole session to one agent; a payload without it or without `agent_type` (an older Claude Code) records nothing. The project: the
// session's (probe.sessionProjects — none: the engine never loads —, then spec.sessionProject: a worktree's copy maps to the checkout
// the MCP server records in) — ONE record per dispatch. The id: the transcript's file name without .jsonl (`agent-<hex>`), the one id
// source — a dispatch the stop gate sent back stops again and its later record wins (agentCosts). No assistant turn read (no file, an
// empty one): nothing recorded. → null (it prints nothing).
function recordAgent(payload) {
  const agent = payload.agent_type, file = payload.agent_transcript_path;
  if (typeof agent !== "string" || !agent.trim() || typeof file !== "string" || !file.trim()) return null;
  const dirs = projectDirsOf(payload);
  if (!dirs.length) return null;
  const run = agentRunOf(file);
  if (!run || !run.turns) return null;
  const spec = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const s = spec.sessionProject({ cwd: payload.cwd, anchors: [process.env.CLAUDE_PROJECT_DIR, process.env.SPEC_PROJECT_DIR] });
  spec.recordAgentRun(s ? s.project : dirs[0], { agent, id: path.basename(file).replace(/\.jsonl$/, ""), model: run.model,
    turns: run.turns, tools: run.tools, tokens: run.tokens, truncated: run.truncated });
  return null;
}

// The hook's work on one payload: the run logged where it belongs (spec.observeRun) — or, on SubagentStop, the agent's counts
// recorded (recordAgent) — it prints nothing, so → null.
function decide(raw) {
  if (!raw) return null; // an oversized payload (past MAX_INPUT) arrives as ""
  const payload = payloadOf(raw);
  if (!payload) return null;
  if (eventOf(payload) === "SubagentStop") return recordAgent(payload);
  // The Bash tool, and on Windows the PowerShell tool (strict: its exit code must be explicit).
  if (payload.tool_name !== "Bash" && payload.tool_name !== "PowerShell") return null;
  const strict = payload.tool_name === "PowerShell";
  const event = typeof payload.hook_event_name === "string" ? payload.hook_event_name : "";
  if (event && event !== "PostToolUse" && event !== "PostToolUseFailure") return null;
  const failure = event === "PostToolUseFailure" || (!event && typeof payload.error === "string");
  const input = payload.tool_input;
  const command = input && typeof input === "object" && typeof input.command === "string" ? input.command.trim() : "";
  if (!command || command.length > MAX_COMMAND) return null;
  const exitCode = exitCodeOf(payload, failure, strict);
  if (exitCode == null) return null;

  let spec = null;
  const dirs = projectDirsOf(payload);
  const parts = probe().observedBodies(command);
  const hits = parts.length ? dirs.filter((d) => mentioned(d, parts)) : []; // the pre-filter, once per project
  // once some project passed the pre-filter, the session's project too (spec.sessionProject — a worktree's
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
      // a PowerShell run is marked (`tool`): its passes are logged only with an explicit exit code, so a logged failure may hide a
      // later pass — the fast check's note says so (1.36 review 1 FC-6). A Bash run's line is unchanged.
      tool: strict ? payload.tool_name : undefined,
      // 1.41 the friction budget: Claude Code's own measure of the run (both events' optional `duration_ms` — the tool's execution
      // time, without permission prompts and hooks) → a timings line when the run is a project check's (.specs/.execution/
      // timings.jsonl, engine/friction.js); never on the observed line. Absent (an older Claude Code): nothing is timed.
      ms: typeof payload.duration_ms === "number" ? payload.duration_ms : undefined,
    });
  }
  return null;
}

// As a process (hooks/hooks.json): the payload from stdin (past MAX_INPUT the rest is drained unread and the payload ignored), decide
// run once; any unexpected error is a silent no-op. agentRunOf / TRANSCRIPT_MAX: the SubagentStop reader and its bound, for the tests.
module.exports = { decide, agentRunOf, TRANSCRIPT_MAX };
if (require.main === module) runHook(decide, { maxInput: MAX_INPUT });
