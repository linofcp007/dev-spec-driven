#!/usr/bin/env node
"use strict";

/**
 * dev-spec-driven — guard hook (opt-in, zero-dependency). Kiro's supervised mode, spec-shaped.
 *
 * Wired from hooks/hooks.json as PreToolUse (Write|Edit|NotebookEdit|Bash|PowerShell|Monitor — the shell tools since 1.25.1:
 * `sed -i src/a.ts`, `cat > src/a.ts <<EOF`, `Set-Content src\a.ts`, `cp x src/a.ts` edited code with no prompt; each file a command
 * writes — spec.shellWriteTargets, the approval guard's own reader — goes through the same check). It does NOTHING unless the
 * project turned guard mode on (`.specs/roadmap.json` meta.guard === true — spec_init {guard: true} /
 * `dev-spec init --guard on`; while meta.guard is unset, the user's DEV_SPEC_GUARD_DEFAULT decides). When on, a
 * code edit outside `.specs/` while no feature has approved, unfinished
 * tasks gets `permissionDecision: "ask"` with a localized reason — the human confirms or declines.
 * meta.guard === "scope" (spec_init {guard: "scope"} / `dev-spec init --guard scope`) also asks, once tasks are
 * approved, for a code file no open task names in `_Implements:_` (the file, a folder above it or a glob; test files excepted),
 * naming the task to add it to. At both levels a test file is allowed while a feature has an approved test plan and is
 * unfinished (Phase 4), and any code file while a spike is under way (its prototype) — spec.guardCheck decides.
 *
 * It NEVER blocks on its own trouble: a malformed payload, a broken roadmap.json or any internal error exits 0
 * silently. It is cheap: guard off costs one small file read (the engine is loaded only when the guard is on),
 * and the decision reads roadmap.json plus each feature's .state.json / tasks.md — never a repo walk.
 * The edited file's path is the agent's: a network one (\\host\share\…) is never stat'ed or realpath'ed — inside / outside
 * is decided on its text (spec.networkPathInside), so no SMB connection goes to a host the agent named.
 * The candidate project folders (the payload's cwd, CLAUDE_PROJECT_DIR, SPEC_PROJECT_DIR) are Claude Code's / the user's — and (
 * a monorepo whose packages/app/.specs has the guard on, the session at the repository's root) the nearest .specs/ above the
 * edited file's folder, never for a network path.
 */

const fs = require("fs");
const path = require("path");
// The hooks' runner (stdin, the safety net, the one flushed exit) and the project probe (mcp/lib/probe.js — the one dev-spec project
// rule, the session's candidate projects, a JSON file read as the engine reads it: UTF-8 or UTF-16 with a BOM), required on first use
// — past the pre-filter: a call that edits nothing loads nothing more.
const { runHook, payloadOf, eventOf, probe, sessionFlagFile } = require("./hook-utils.js");

// the shell tools — the engine reads which files a command writes (spec.shellWriteTargets). Before it loads, a
// command must hold an output redirection or the name of a program that writes, removes, moves, copies or extracts files (the
// engine's readers — mcp/tests/10-guards-shell-writes.js checks every one it reads matches) — read-only commands, test runs and git (the
// edit guard leaves git to the user) exit here.
const SHELLS = new Set(["Bash", "PowerShell", "Monitor"]);
// Every scan here is linear in the command (a hook past its timeout lets the call through — probe.js, the guards' shared readings):
// the writers by name are fixed words, and `find … -delete / -exec` is read per simple command — the first `find` of each, then its
// action after it (the regex this replaced, find[^|;&\n]*-(?:delete|…), rescanned the rest of a command from every `find`).
const RE_SHELL_WRITE = new RegExp("[>]|(?:^|[^\\w.-])(?:tee|sed|perl|ruby|g?awk|mawk|nawk|cp|mv|install|scp|ln|dd|rm|rmdir|unlink|shred|truncate|" +
  "r?ed|ex|vi|vim|nvim|view|sponge|curl|wget|rsync|(?:bsd)?tar|unzip|7z[ar]?|zip|patch|dos2unix|unix2dos|sort|uniq|iconv|xxd|base64|" +
  "del|erase|rd|copy|move|ren|rename|robocopy|xcopy|mklink|junction|subst|fsutil|mount|set-content|add-content|out-file|clear-content|new-item|" +
  "remove-item|move-item|copy-item|rename-item|tee-object|export-csv|export-clixml|expand-archive|sc|ac|ni|ri|mi|cpi|rni|clc|epcsv)(?![\\w-])|" +
  "\\[(?:system\\.)?io\\.(?:file|directory)\\]::", "i");
const RE_FIND_WORD = /(?:^|[^\w.-])find/i;
const RE_FIND_WRITE = /-(?:delete|exec|execdir|ok|okdir|fprint0?|fprintf|fls)(?![\w-])/i;
// May this command write a file — an output redirection, a writer named, or find with a writing action?
function mayWrite(command) {
  const c = String(command);
  if (RE_SHELL_WRITE.test(c)) return true;
  for (const seg of c.split(/[|;&\n]/)) {
    const m = RE_FIND_WORD.exec(seg);
    if (m && RE_FIND_WRITE.test(seg.slice(m.index + m[0].length))) return true;
  }
  return false;
}
// A shell command's path-like words (holding a / or \; a leading `=` taken off), at most `max`, from its first 64 K characters — the
// nearest dev-spec .specs/ above each is a candidate project (a monorepo's package). The delimiter-free runs, each read once.
const RE_WORD_RUN = /[^\s'"<>|;&()]+/g;
function pathWords(command, max = 8) {
  const out = [];
  const re = new RegExp(RE_WORD_RUN.source, "g");
  const c = String(command).slice(0, 64 * 1024);
  for (let m; out.length < max && (m = re.exec(c));) if (/[\\/]/.test(m[0])) out.push(m[0].replace(/^=+/, ""));
  return out;
}

// The user's default (the environment variable DEV_SPEC_GUARD_DEFAULT, e.g. from Claude Code's settings.json `env`):
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

// The hook's decision on one payload → the object it prints (ask, or the forced-approval note) or null (silent).
function decide(raw) {
  const payload = payloadOf(raw);
  if (!payload) return null;
  const event = eventOf(payload);
  if (event && event !== "PreToolUse") return null;
  const ti = payload.tool_input || payload.toolInput || {};
  const tool = typeof payload.tool_name === "string" ? payload.tool_name : typeof payload.toolName === "string" ? payload.toolName : "";
  // a shell command — only one that may write a file (an output redirection, a writer by name) goes on
  const command = SHELLS.has(tool) && typeof ti.command === "string" ? ti.command : null;
  if (command !== null && !mayWrite(command)) return null;
  const target = command !== null ? null : [ti.file_path, ti.notebook_path, ti.path].find((v) => typeof v === "string" && v.trim());
  if (!target && command === null) return null;

  // The raw pre-check: is the guard on in any project this edit may belong to — the session's dev-spec projects (probe.sessionProjects:
  // the nearest at or above the session's cwd — a cd'd subfolder, a worktree —, the project dir Claude Code or the user exported) and
  // (a monorepo) the nearest one above the edited file's folder (a shell command's path-like words)? The engine
  // then picks THE project (spec.sessionProject: a worktree's copy of .specs/ maps to the checkout the MCP server writes
  // in) and spells the edited file under it.
  const PR = probe();
  const cwd = typeof payload.cwd === "string" && payload.cwd.trim() ? payload.cwd : null;
  const anchors = PR.sessionAnchors();
  const local = (p) => typeof p === "string" && p.trim() && !PR.isNetwork(p);
  const near = (p) => { try { return local(p) ? PR.nearestDevSpec(path.dirname(path.resolve(cwd && local(cwd) ? cwd : process.cwd(), p))) : null; } catch { return null; } };
  const words = target ? [target] : pathWords(command);
  const cands = [...PR.sessionProjects({ cwd, anchors }), ...words.map(near)].filter(Boolean);
  if (![...new Set(cands)].some(guardOn)) return null;

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
        return { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "ask", permissionDecisionReason: r.reason } };
      }
      if (r.note && !note) note = r.note;
    }
  }
  // Allowed by a FORCED approval only: say so to the user (systemMessage never changes the permission flow) — once a session (it
  // was printed on every code edit). Keyed by the payload's session_id: a marker in the OS temp folder holding the
  // note (another set of forced features shows it again); no session_id → every time, as before.
  const r = { note };
  if (r.note) {
    const sid = typeof payload.session_id === "string" && payload.session_id.trim() ? payload.session_id : null;
    if (sid) {
      const flag = sessionFlagFile("forced-note", sid);
      let seen = null;
      try { seen = fs.readFileSync(flag, "utf8"); } catch { seen = null; }
      if (seen === r.note) return null;
      try { fs.writeFileSync(flag, r.note); } catch { /* not writable: shown again next time */ }
    }
    return { systemMessage: r.note };
  }
  return null;
}

module.exports = { decide, mayWrite, pathWords };
// As a process (hooks/hooks.json): the payload from stdin, decide run once; any unexpected error is a silent no-op (never a block).
if (require.main === module) runHook(decide);
