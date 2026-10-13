#!/usr/bin/env node
"use strict";

/**
 * dev-spec-driven — the plan-mode bridge (zero-dependency).
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
// The hooks' runner (stdin, the safety net, the one flushed exit) and the project probe. The hooks run in EVERY project: only a
// .specs/ that dev-spec owns is looked at — the probe (mcp/lib/probe.js: the one rule, the session's projects as every hook reads
// them, the engine's network-path rule), required once the tool is ExitPlanMode. A network path (UNC `\\host\share`,
// `//host/share`, `\\?\UNC\…`, other device paths) is never stat'ed here: it would open an SMB connection and block this hook until
// an unreachable host times out (`\\?\C:\…` and WSL's `\\wsl$\…` are local).
const { runHook, payloadOf, eventOf, probe } = require("./hook-utils.js");

const PAYLOAD_MAX = 4 * 1024 * 1024; // characters of the hook payload read (an approved plan rides in it); a longer one is ignored

// The hook's decision on one payload → its one line of additionalContext, or null (silent).
function decide(raw) {
  const payload = payloadOf(raw);
  if (!payload) return null;
  const event = eventOf(payload);
  if (event && event !== "PostToolUse") return null;
  if ((payload.tool_name || payload.toolName) !== "ExitPlanMode") return null;

  // The project: the session's first dev-spec project (probe.sessionProjects — the nearest at or above the session's cwd, then the
  // project dir Claude Code or the user exported), network folders left out.
  const P = probe();
  const local = (v) => (v && !P.isNetwork(v) ? v : null);
  const pdir = P.sessionProjects({ cwd: local(P.usable(payload.cwd)), anchors: P.sessionAnchors().filter(local) })[0];
  if (!pdir) return null;

  const spec = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const r = spec.planBridge(pdir, payload);
  if (r && typeof r.hint === "string" && r.hint) return { hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: r.hint } };
  return null;
}

module.exports = { decide };
// As a process (hooks/hooks.json): the payload from stdin (past PAYLOAD_MAX: "" — silent), decide run once; any unexpected error is a
// silent no-op (never a block).
if (require.main === module) runHook(decide, { maxInput: PAYLOAD_MAX });
