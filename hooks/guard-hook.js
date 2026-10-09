#!/usr/bin/env node
"use strict";

/**
 * dev-spec-driven — guard hook (opt-in, zero-dependency). Kiro's supervised mode, spec-shaped.
 *
 * Wired from hooks/hooks.json as PreToolUse (Write|Edit|NotebookEdit|Bash|PowerShell|Monitor — the shell tools since 1.25.1, review 7:
 * `sed -i src/a.ts`, `cat > src/a.ts <<EOF`, `Set-Content src\a.ts`, `cp x src/a.ts` edited code with no prompt; each file a command
 * writes — spec.shellWriteTargets, the approval guard's own reader — goes through the same check). It does NOTHING unless the
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
 * The candidate project folders (the payload's cwd, CLAUDE_PROJECT_DIR, SPEC_PROJECT_DIR) are Claude Code's / the user's — and (1.25.1,
 * review 7: a monorepo whose packages/app/.specs has the guard on, the session at the repository's root) the nearest .specs/ above the
 * edited file's folder, never for a network path.
 */

const fs = require("fs");
const path = require("path");

// 1.25.1 (review 7): the shell tools — the engine reads which files a command writes (spec.shellWriteTargets). Before it loads, a
// command must hold an output redirection or the name of a program that writes, removes, moves, copies or extracts files (the
// engine's readers — mcp/tests/10-guards-review7.js checks every one it reads matches) — read-only commands, test runs and git (the
// edit guard leaves git to the user) exit here.
const SHELLS = new Set(["Bash", "PowerShell", "Monitor"]);
const RE_SHELL_WRITE = new RegExp("[>]|(?:^|[^\\w.-])(?:tee|sed|perl|ruby|g?awk|mawk|nawk|cp|mv|install|scp|ln|dd|rm|rmdir|unlink|shred|truncate|" +
  "r?ed|ex|vi|vim|nvim|view|sponge|curl|wget|rsync|(?:bsd)?tar|unzip|7z[ar]?|zip|patch|dos2unix|unix2dos|sort|uniq|iconv|xxd|base64|" +
  "find[^|;&\\n]*-(?:delete|exec|execdir|ok|okdir|fprint0?|fprintf|fls)|" +
  "del|erase|rd|copy|move|ren|rename|robocopy|xcopy|mklink|junction|subst|fsutil|mount|set-content|add-content|out-file|clear-content|new-item|" +
  "remove-item|move-item|copy-item|rename-item|tee-object|export-csv|export-clixml|expand-archive|sc|ac|ni|ri|mi|cpi|rni|clc|epcsv)(?![\\w-])|" +
  "\\[(?:system\\.)?io\\.(?:file|directory)\\]::", "i");
// A shell command's path-like words (holding a / or \) — the nearest dev-spec .specs/ above each is a candidate project (a monorepo's
// package).
const RE_PATH_WORD = /(?:^|[\s'"=<>|;&(])[^\s'"<>|;&()]*[\\/][^\s'"<>|;&()]*/g;

// The project probe (mcp/lib/probe.js — the one dev-spec project rule, the session's candidate projects, a JSON file read as the engine
// reads it: UTF-8 or UTF-16 with a BOM). Required only past the pre-filter: a call that edits nothing loads nothing.
let P = null;
const probe = () => P || (P = require(path.join(__dirname, "..", "mcp", "lib", "probe.js")));

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
// A .specs/ dev-spec owns but without a roadmap.json (a project made before it, or the file deleted) — the probe's rule, the engine's
// (spec.guardLevel: isDevSpecDir), so neither a folder without .specs/ nor another tool's .specs/ gets the user's default.
function devSpecWithoutRoadmap(dir) {
  try {
    fs.lstatSync(path.join(dir, ".specs", "roadmap.json"));
    return false; // it exists (readable or not): its meta decides
  } catch (e) {
    if (!e || e.code !== "ENOENT") return false;
  }
  return probe().isDevSpecProject(dir);
}
// Guard on? Read raw — the engine (and its i18n tables) is only loaded for a guarded project. No roadmap.json in a dev-spec
// .specs/ → the user's default (spec.guardLevel's rule); an unreadable or broken one → off.
function guardOn(dir) {
  if (userGuardDefault() && devSpecWithoutRoadmap(dir)) return true;
  try {
    const j = probe().readJsonFile(path.join(dir, ".specs", "roadmap.json"));
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
  const tool = typeof payload.tool_name === "string" ? payload.tool_name : typeof payload.toolName === "string" ? payload.toolName : "";
  // 1.25.1 (review 7, finding 8): a shell command — only one that may write a file (an output redirection, a writer by name) goes on
  const command = SHELLS.has(tool) && typeof ti.command === "string" ? ti.command : null;
  if (command !== null && !RE_SHELL_WRITE.test(command)) return finish();
  const target = command !== null ? null : [ti.file_path, ti.notebook_path, ti.path].find((v) => typeof v === "string" && v.trim());
  if (!target && command === null) return finish();

  // The raw pre-check: is the guard on in any project this edit may belong to — the session's dev-spec projects (probe.sessionProjects:
  // the nearest at or above the session's cwd — a cd'd subfolder, a worktree —, the project dir Claude Code or the user exported) and
  // (1.25.1, finding 9 — a monorepo) the nearest one above the edited file's folder (a shell command's path-like words)? The engine
  // then picks THE project (spec.sessionProject, 1.23 review 5: a worktree's copy of .specs/ maps to the checkout the MCP server writes
  // in) and spells the edited file under it.
  const PR = probe();
  const cwd = typeof payload.cwd === "string" && payload.cwd.trim() ? payload.cwd : null;
  const anchors = PR.sessionAnchors();
  const local = (p) => typeof p === "string" && p.trim() && !PR.isNetwork(p);
  const near = (p) => { try { return local(p) ? PR.nearestDevSpec(path.dirname(path.resolve(cwd && local(cwd) ? cwd : process.cwd(), p))) : null; } catch { return null; } };
  const words = target ? [target] : (command.match(RE_PATH_WORD) || []).slice(0, 8).map((w) => w.replace(/^[\s'"=<>|;&(]+/, ""));
  const cands = [...PR.sessionProjects({ cwd, anchors }), ...words.map(near)].filter(Boolean);
  if (![...new Set(cands)].some(guardOn)) return finish();

  const spec = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const targets = target ? [target] : spec.shellWriteTargets(command, tool === "PowerShell" ? "ps" : "bash");
  let note = null;
  const s0 = spec.sessionProject({ cwd, anchors });
  for (const t of targets) {
    // the session's project and the nearest one above the file (a monorepo's package) — each guarded one decides; the first ask wins
    const abs = local(t) ? spec.sessionPath(s0 || { root: cwd || process.cwd() }, t, cwd) : null;
    const own = abs ? spec.sessionProject({ cwd: path.dirname(abs), anchors }) : null;
    const seen = new Set();
    for (const s of [s0, own]) {
      if (!s || seen.has(s.project)) continue;
      seen.add(s.project);
      const r = spec.guardCheck(s.project, spec.sessionPath(s, t, cwd), s.project);
      if (r.decision === "ask") {
        return finish({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "ask", permissionDecisionReason: r.reason } });
      }
      if (r.note && !note) note = r.note;
    }
  }
  // Allowed by a FORCED approval only: say so to the user (systemMessage never changes the permission flow) — once a session (1.24
  // review 6, C-I8: it was printed on every code edit). Keyed by the payload's session_id: a marker in the OS temp folder holding the
  // note (another set of forced features shows it again); no session_id → every time, as before.
  const r = { note };
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
