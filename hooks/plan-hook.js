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

// The hooks run in EVERY project: only a .specs/ that dev-spec owns is looked at — the project probe (mcp/lib/probe.js: the one
// rule, the session's projects as every hook reads them, the engine's network-path rule), required once the tool is ExitPlanMode.
// A network path (UNC `\\host\share`, `//host/share`, `\\?\UNC\…`, other device paths) is never stat'ed here: it would open an SMB
// connection and block this hook until an unreachable host times out (`\\?\C:\…` and WSL's `\\wsl$\…` are local).
const probe = () => require(path.join(__dirname, "..", "mcp", "lib", "probe.js"));

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

  // The project: the session's first dev-spec project (probe.sessionProjects — the nearest at or above the session's cwd, then the
  // project dir Claude Code or the user exported), network folders left out.
  const P = probe();
  const local = (v) => (v && !P.isNetwork(v) ? v : null);
  const pdir = P.sessionProjects({ cwd: local(P.usable(payload.cwd)), anchors: P.sessionAnchors().filter(local) })[0];
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
