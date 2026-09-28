#!/usr/bin/env node
"use strict";

/**
 * dev-spec-driven — the plan-mode bridge (zero-dependency, 1.16).
 *
 * Wired from hooks/hooks.json as PostToolUse, matcher ExitPlanMode (https://code.claude.com/docs/en/hooks): when the user
 * approves a plan in Claude Code's plan mode, a dev-spec project gets ONE line of context for the agent — the approved plan can
 * become a spec with /spec-import (spec_import {tool: "plan", text: <the plan's markdown>}, or {path} when the plan file sits
 * inside the project; CLI `dev-spec import plan -`). The decision and the localized line are the engine's (spec.planBridge).
 *
 * It is silent (exit 0, no output) for any other tool or event, outside a dev-spec project (another tool's .specs/ included)
 * and on a malformed payload, and it NEVER blocks: any error exits 0 silently. Cheap: a few stats to recognise the project
 * (never of a network path — a UNC cwd is skipped before any fs call),
 * the engine loaded only then; stdin bounded (PAYLOAD_MAX — a longer payload is ignored); nothing is written.
 */

const fs = require("fs");
const path = require("path");

const PAYLOAD_MAX = 4 * 1024 * 1024; // characters of the hook payload read (an approved plan rides in it)
let done = false;
let ran = false;

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

// A network path (UNC `\\host\share`, `//host/share`, `\\?\UNC\…`, `\\.\UNC\…`, other device paths) is never stat'ed: it would
// open an SMB connection to whatever host the payload names and block this hook until an unreachable host times out. Local:
// `\\?\C:\…` / `\\.\C:\…` and WSL's `\\wsl$\…` / `\\wsl.localhost\…`. The engine's rule (spec.isNetworkPath), inlined so the
// engine is only loaded inside a dev-spec project.
function isNetworkPath(p) {
  const s = String(p).trim();
  if (!/^[\\/]{2}/.test(s)) return false;
  let rest = s.slice(2);
  if (/^[?.][\\/]/.test(rest)) {
    rest = rest.slice(2);
    if (/^[A-Za-z]:(?:[\\/]|$)/.test(rest)) return false;
    if (!/^UNC[\\/]/i.test(rest)) return true;
    rest = rest.slice(4);
  }
  const host = rest.split(/[\\/]/)[0].toLowerCase();
  return host !== "wsl$" && host !== "wsl.localhost";
}

function main(raw) {
  if (ran) return; // stdin 'end' and the safety-net timer must not both run it
  ran = true;
  if (raw.length > PAYLOAD_MAX) return finish();
  let payload;
  try {
    payload = JSON.parse(raw || "{}");
  } catch {
    return finish();
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return finish();
  const event = payload.hook_event_name || payload.hookEventName || "";
  if (event && event !== "PostToolUse") return finish();
  if ((payload.tool_name || payload.toolName) !== "ExitPlanMode") return finish();

  // The project: the session's cwd, else the project dir Claude Code (or the user) exported.
  const cwd = typeof payload.cwd === "string" && payload.cwd.trim() ? payload.cwd : null;
  const pdir = [cwd, process.env.CLAUDE_PROJECT_DIR, process.env.SPEC_PROJECT_DIR]
    .filter((v) => typeof v === "string" && v.trim() && !/^\$\{[^}]*\}$/.test(v.trim()) && !isNetworkPath(v))
    .map((v) => path.resolve(v))
    .find(isDevSpecProject);
  if (!pdir) return finish();

  const spec = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const r = spec.planBridge(pdir, payload);
  if (r && typeof r.hint === "string" && r.hint) return finish({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: r.hint } });
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
  process.stdin.on("data", (c) => { if (input.length <= PAYLOAD_MAX) input += c; });
  process.stdin.on("end", () => safeMain(input));
  process.stdin.on("error", () => finish());
  setTimeout(() => safeMain(input), 2000).unref(); // safety net
}
