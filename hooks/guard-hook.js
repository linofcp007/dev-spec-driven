#!/usr/bin/env node
"use strict";

/**
 * dev-spec-driven — guard hook (opt-in, zero-dependency). Kiro's supervised mode, spec-shaped.
 *
 * Wired from hooks/hooks.json as PreToolUse (Write|Edit|MultiEdit|NotebookEdit). It does NOTHING unless the
 * project turned guard mode on (`.specs/roadmap.json` meta.guard === true — spec_init {guard: true} /
 * `dev-spec init --guard on`). When on, a code edit outside `.specs/` while no feature has approved, unfinished
 * tasks gets `permissionDecision: "ask"` with a localized reason — the human confirms or declines.
 *
 * It NEVER blocks on its own trouble: a malformed payload, a broken roadmap.json or any internal error exits 0
 * silently. It is cheap: guard off costs one small file read (the engine is loaded only when the guard is on),
 * and the decision reads roadmap.json plus each feature's .state.json / tasks.md — never a repo walk.
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

// Guard on? Read raw — the engine (and its i18n tables) is only loaded for a guarded project.
function guardOn(dir) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(dir, ".specs", "roadmap.json"), "utf8").replace(/^\uFEFF/, ""));
    return !!j && typeof j === "object" && !Array.isArray(j) && !!j.meta && typeof j.meta === "object" && j.meta.guard === true;
  } catch {
    return false; // missing, unreadable or broken → the guard stays out of the way
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
