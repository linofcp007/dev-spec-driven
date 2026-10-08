#!/usr/bin/env node
"use strict";

/**
 * dev-spec-driven — guard hook (opt-in, zero-dependency). Kiro's supervised mode, spec-shaped.
 *
 * Wired from hooks/hooks.json as PreToolUse (Write|Edit|NotebookEdit). It does NOTHING unless the
 * project turned guard mode on (`.specs/roadmap.json` meta.guard === true — spec_init {guard: true} /
 * `dev-spec init --guard on`; 1.16: while meta.guard is unset, the user's DEV_SPEC_GUARD_DEFAULT decides). When on, a
 * code edit outside `.specs/` while no feature has approved, unfinished
 * tasks gets `permissionDecision: "ask"` with a localized reason — the human confirms or declines.
 * meta.guard === "scope" (1.14 — spec_init {guard: "scope"} / `dev-spec init --guard scope`) also asks, once tasks are
 * approved, for a code file no open task names in `_Implements:_` (the file, a folder above it or a glob; test files excepted),
 * naming the task to add it to. At both levels a test file is allowed while a feature has an approved test plan and is
 * unfinished (Phase 4), and any code file while a spike is under way (its prototype) — spec.guardCheck decides.
 *
 * It NEVER blocks on its own trouble: a malformed payload, a broken roadmap.json or any internal error exits 0
 * silently. It is cheap: guard off costs one small file read (the engine is loaded only when the guard is on),
 * and the decision reads roadmap.json plus each feature's .state.json / tasks.md — never a repo walk.
 * The edited file's path is the agent's: a network one (\\host\share\…) is never stat'ed or realpath'ed — inside / outside
 * is decided on its text (spec.networkPathInside), so no SMB connection goes to a host the agent named (1.16 verify NEW-3).
 * The candidate project folders (the payload's cwd, CLAUDE_PROJECT_DIR, SPEC_PROJECT_DIR) are Claude Code's / the user's.
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
// At most one JSON object, and exit only after it is flushed (Windows pipes truncate otherwise).
function finish(obj) {
  if (done) return;
  done = true;
  if (!obj) process.exit(0);
  process.stdout.write(JSON.stringify(obj), () => process.exit(0));
}

// The user's default (1.16 — the environment variable DEV_SPEC_GUARD_DEFAULT, e.g. from Claude Code's settings.json `env`):
// on / scope turns the guard on for a project whose roadmap.json leaves meta.guard unset. The engine (spec.guardLevel) reads
// the same variable.
function userGuardDefault() {
  for (const n of ["DEV_SPEC_GUARD_DEFAULT"]) {
    const v = typeof process.env[n] === "string" ? process.env[n].trim() : "";
    if (v && !/^\$\{[^}]*\}$/.test(v)) return /^(?:on|true|yes|1|scope)$/i.test(v);
  }
  return false;
}
// A .specs/ dev-spec owns but without a roadmap.json (a project made before it): steering/ or a feature folder with its
// .state.json — the engine's rule (spec.guardLevel), so neither a folder without .specs/ nor another tool's .specs/ gets the
// user's default.
function devSpecWithoutRoadmap(dir) {
  const root = path.join(dir, ".specs");
  try {
    fs.lstatSync(path.join(root, "roadmap.json"));
    return false; // it exists (readable or not): its meta decides
  } catch (e) {
    if (!e || e.code !== "ENOENT") return false;
  }
  try {
    if (!fs.statSync(root).isDirectory()) return false;
    if (fs.existsSync(path.join(root, "steering"))) return true;
    return fs.readdirSync(root, { withFileTypes: true }).some((d) => d.isDirectory() && !d.name.startsWith(".") && fs.existsSync(path.join(root, d.name, ".state.json")));
  } catch {
    return false;
  }
}
// Guard on? Read raw — the engine (and its i18n tables) is only loaded for a guarded project. No roadmap.json in a dev-spec
// .specs/ → the user's default (spec.guardLevel's rule); an unreadable or broken one → off.
function guardOn(dir) {
  if (userGuardDefault() && devSpecWithoutRoadmap(dir)) return true;
  try {
    const j = readJsonFile(path.join(dir, ".specs", "roadmap.json"));
    if (!j || typeof j !== "object" || Array.isArray(j)) return false;
    const meta = j.meta && typeof j.meta === "object" && !Array.isArray(j.meta) ? j.meta : {};
    return meta.guard === true || meta.guard === "scope" || (meta.guard === undefined && userGuardDefault());
  } catch {
    return false; // missing (no user default), unreadable or broken → the guard stays out of the way
  }
}

// The nearest folder at or above cwd holding a .specs/ folder (≤ 40 levels) — a candidate for the raw pre-check only (a superset:
// the engine decides). A network or device path (\\host\share, \\?\…) is the user's own folder: taken as it is, never walked.
function nearestSpecs(cwd) {
  if (!cwd) return null;
  if (/^[\\/]{2}/.test(cwd.trim())) return cwd;
  let d = path.resolve(cwd);
  for (let i = 0; i < 40; i++) {
    try { if (fs.statSync(path.join(d, ".specs")).isDirectory()) return d; } catch { /* none here */ }
    const up = path.dirname(d);
    if (up === d) break;
    d = up;
  }
  return null;
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
  if (event && event !== "PreToolUse") return finish();
  const ti = payload.tool_input || payload.toolInput || {};
  const target = [ti.file_path, ti.notebook_path, ti.path].find((v) => typeof v === "string" && v.trim());
  if (!target) return finish();

  // The raw pre-check: is the guard on in any project this edit may belong to — the nearest .specs/ at or above the session's cwd
  // (a cd'd subfolder, a worktree), the project dir Claude Code (or the user) exported? The engine then picks THE project
  // (spec.sessionProject, 1.23 review 5: a worktree's copy of .specs/ maps to the checkout the MCP server writes in) and spells
  // the edited file under it (spec.sessionPath).
  const cwd = typeof payload.cwd === "string" && payload.cwd.trim() ? payload.cwd : null;
  const anchors = [process.env.CLAUDE_PROJECT_DIR, process.env.SPEC_PROJECT_DIR]
    .filter((v) => typeof v === "string" && v.trim() && !/^\$\{[^}]*\}$/.test(v.trim()));
  if (![nearestSpecs(cwd) || cwd, ...anchors].filter(Boolean).map((v) => path.resolve(v)).some(guardOn)) return finish();

  const spec = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const s = spec.sessionProject({ cwd, anchors });
  if (!s) return finish();
  const r = spec.guardCheck(s.project, spec.sessionPath(s, target, cwd), s.project);
  if (r.decision === "ask") {
    return finish({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "ask", permissionDecisionReason: r.reason } });
  }
  // Allowed by a FORCED approval only: say so to the user (systemMessage never changes the permission flow) — once a session (1.24
  // review 6, C-I8: it was printed on every code edit). Keyed by the payload's session_id: a marker in the OS temp folder holding the
  // note (another set of forced features shows it again); no session_id → every time, as before.
  if (r.note) {
    const sid = typeof payload.session_id === "string" && payload.session_id.trim() ? payload.session_id : null;
    if (sid) {
      const flag = require("./hook-utils.js").sessionFlagFile("forced-note", sid);
      let seen = null;
      try { seen = fs.readFileSync(flag, "utf8"); } catch { seen = null; }
      if (seen === r.note) return finish();
      try { fs.writeFileSync(flag, r.note); } catch { /* not writable: shown again next time */ }
    }
    return finish({ systemMessage: r.note });
  }
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
