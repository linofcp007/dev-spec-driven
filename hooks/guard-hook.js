#!/usr/bin/env node
"use strict";

/**
 * dev-spec-driven — guard hook (opt-in, zero-dependency). Kiro's supervised mode, spec-shaped.
 *
 * Wired from hooks/hooks.json as PreToolUse (Write|Edit|MultiEdit|NotebookEdit). It does NOTHING unless the
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
    const j = JSON.parse(fs.readFileSync(path.join(dir, ".specs", "roadmap.json"), "utf8").replace(/^\uFEFF/, ""));
    if (!j || typeof j !== "object" || Array.isArray(j)) return false;
    const meta = j.meta && typeof j.meta === "object" && !Array.isArray(j.meta) ? j.meta : {};
    return meta.guard === true || meta.guard === "scope" || (meta.guard === undefined && userGuardDefault());
  } catch {
    return false; // missing (no user default), unreadable or broken → the guard stays out of the way
  }
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

  // The project: the session's cwd, else the project dir Claude Code (or the user) exported.
  const cwd = typeof payload.cwd === "string" && payload.cwd.trim() ? payload.cwd : null;
  const pdir = [cwd, process.env.CLAUDE_PROJECT_DIR, process.env.SPEC_PROJECT_DIR]
    .filter((v) => typeof v === "string" && v.trim() && !/^\$\{[^}]*\}$/.test(v.trim()))
    .map((v) => path.resolve(v))
    .find(guardOn);
  if (!pdir) return finish();

  const spec = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const r = spec.guardCheck(pdir, target, cwd || pdir);
  if (r.decision === "ask") {
    return finish({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "ask", permissionDecisionReason: r.reason } });
  }
  // Allowed by a FORCED approval only: say so to the user (systemMessage never changes the permission flow).
  if (r.note) return finish({ systemMessage: r.note });
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
