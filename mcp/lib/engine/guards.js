"use strict";

/**
 * dev-spec-driven engine — the edit guard, the stop gate and the human approval guard.
 * Guard mode (meta.guard: on | scope — hooks/guard-hook.js), the end-of-turn stop gate (hooks/stop-hook.js: a "done"
 * claim with unverified recent ticks is sent back) and the human approval guard (meta.approvalGuard — hooks/
 * approval-hook.js: a pure decision over one PreToolUse payload, with its shell lexer). CLI_SWITCHES (the CLI's boolean
 * switches) lives here: the lexer reads it.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const i18n = require("../i18n.js");
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let activeTasks, approvalRolesFrom, checksInput, detectTracks, evidenceModeInput, evidenceRecords, existingFeature,
  expectsFail, featureDirs, featureLang, fingerprintMatches, FOLD_CASE, globMatcher, guessLang,
  implementsRel, insideDirAlias, isCodeFile, isDevSpecDir, isDirSafe, isFeatureFolder, isImplementsGlob, isObj, isRecord,
  isTestFile, loadRoadmap, normalizeLang, own, parseApprovalRolesText, parseTasks, projectChecks, projectLang, readIfExists, readJson,
  readRoadmap, readState, replaceHtmlCommentSpans, resolveTask, roadmapPath, safeReaddir, specsRoot, spikeInfo,
  statePath, suiteLabel, suiteStatus, taskBlocks, taskMarkers, taskSchedule, toPosix, userDefaults,
  validateApprovalRoles, verificationStatus, withRoadmapLock, writeRoadmap, phaseFile, withFeatureLock, writeFileAtomic, pwshOption,
  decodeText, isNetworkPath, runProvesVerify, withinRoot;
let approvedContentSame, proofIncomplete; // 1.25.1: gates.js (the guard's stale tasks approval) · evidence.js (an incomplete command runs nothing)
function __link(E) { ({ approvedContentSame, proofIncomplete, activeTasks, approvalRolesFrom, checksInput, detectTracks, evidenceModeInput, evidenceRecords,
  existingFeature, expectsFail, featureDirs, featureLang, fingerprintMatches, FOLD_CASE, globMatcher,
  guessLang, implementsRel, insideDirAlias, isCodeFile, isDevSpecDir, isDirSafe, isFeatureFolder, isImplementsGlob, isObj, isRecord,
  isTestFile, loadRoadmap, normalizeLang, own, parseApprovalRolesText, parseTasks, projectChecks, projectLang, readIfExists, readJson,
  readRoadmap, readState, replaceHtmlCommentSpans, resolveTask, roadmapPath, safeReaddir, specsRoot, spikeInfo,
  statePath, suiteLabel, suiteStatus, taskBlocks, taskMarkers, taskSchedule, toPosix, userDefaults,
  validateApprovalRoles, verificationStatus, withRoadmapLock, writeRoadmap, phaseFile, withFeatureLock, writeFileAtomic, pwshOption,
  decodeText, isNetworkPath, runProvesVerify, withinRoot } = E); }

// roadmap.json meta.guard — the opt-in guard mode read by hooks/guard-hook.js (PreToolUse): true, or "scope" (1.14 C1 — the
// stricter level, guardLevel()).
function guardEnabled(projectDir) {
  return guardLevel(projectDir) !== false;
}

// The guard's decision for ONE code edit (hooks/guard-hook.js). Cheap by design — it runs before every Write/Edit
// while the guard is on: roadmap.json plus each feature's .state.json and tasks.md, never a repo walk.
//   allow: guard off · the file is outside the project · inside .specs/ · not code (isCodeFile — CODE_EXT, the ONE list
//          of code the scan, coverage and the test-code scan read too: a broad list of languages — C++ .cc/.hpp, .mts/.cts,
//          Scala, Dart, Elixir, PowerShell, shell and Windows batch, SQL, Kotlin script, CUDA, Fortran, shaders, code-bearing
//          templates… — plus a test-only file where it is a test: a .bats suite, Perl's t/*.t;
//          notebooks count as code — NotebookEdit only edits them. Docs, config, data (a PowerShell .psd1), markup and
//          styles are not code) ·
//          some non-archived feature has an approved tasks phase and open
//          tasks (a FORCED approval still counts, with a `note` saying so) · an active spike — undecided or with open tasks, its
//          timebox not passed; never at the scope level once tasks are approved —
//          (why "spike": its prototype work; a spike has no tasks gate, so it is never "awaiting approval") · a TEST file while
//          a feature has an approved test plan and is unfinished (why "tests-phase": Phase 4 writes the failing tests before
//          the tasks can be approved);
//   ask:   otherwise, with a localized `reason` (project language).
// An approval covers only the tasks.md it signed off: when it carries a fingerprint and tasks.md no longer matches
// it (tasks appended or edited after approval — ticking boxes is not an edit), the feature is `stale`, not covering:
// "an approved spec that changed is not approved". An approval without a fingerprint (older state) still counts. "Changed" is
// next_action's and finish's own test (approvedContentSame, gates.js — 1.25.1): trailing whitespace, final blank lines or a
// "\r\r\n" file normalized to LF are no edit.
// meta.guard "scope" (1.14 C1): once tasks are approved, a code file must also be in the plan — scopeGuardDecision.
function guardCheck(projectDir, filePath, cwd) {
  const pdir = path.resolve(projectDir);
  const level = guardLevel(pdir);
  if (!level) return { guard: false, decision: "allow", why: "off" };
  const G = i18n.msg(projectLang(pdir)).guardMode;
  const allow = (why, extra) => Object.assign({ guard: true, decision: "allow", why }, extra);
  if (typeof filePath !== "string" || !filePath.trim()) return allow("no-file");
  // Inside the project as text or through an alias of it (8.3 short name, junction, symlink — they were "outside" and
  // allowed), spelled under pdir from here on. The path as the file system reads it first (guardTargetPath — 1.23 review 5:
  // `a.ts::$DATA` and Git Bash's `/c/…` were allowed as no code / outside).
  const abs = insideDirAlias(pdir, path.resolve(cwd ? path.resolve(pdir, guardTargetPath(cwd)) : pdir, guardTargetPath(filePath)));
  if (!abs) return allow("outside");
  // Case-folded where the filesystem folds case: `.SPECS/x.ts` IS the spec folder on Windows/macOS.
  const rel = toPosix(path.relative(pdir, abs));
  if (rel.split("/").some((s) => (FOLD_CASE ? s.toLowerCase() : s) === ".specs")) return allow("specs");
  if (!isCodeFile(rel)) return allow("not-code");
  const root = specsRoot(pdir);
  const covering = [], forced = [], pending = [], stale = [], spikes = [], testing = [];
  const texts = new Map(); // feature → tasks.md (the scope level reads its open tasks' _Implements:_)
  for (const name of safeReaddir(root).sort()) {
    if (!isFeatureFolder(name, root)) continue; // _archive, steering, dot folders are not features
    const dir = path.join(root, name);
    const st = readJson(statePath(dir)).data;
    const approvals = isObj(st) && isObj(st.approvals) ? st.approvals : {};
    const tasksText = readIfExists(path.join(dir, "tasks.md"));
    const tasks = tasksText == null ? [] : parseTasks(activeTasks(tasksText, detectTracks(dir)));
    const unfinished = !tasks.length || tasks.some((t) => !t.done);
    // A spike has no tasks gate (question → investigate → decide): while it is undecided or has open investigation tasks its
    // prototype work is covered — never listed as "awaiting approval" (approve refuses a spike's tasks phase).
    // Not once its timebox has passed undecided: an abandoned spike must not switch the guard off for the whole project.
    if (isObj(st) && st.kind === "spike") {
      const si = spikeInfo(dir);
      if ((tasks.some((t) => !t.done) || !si.decisionFilled) && !si.timeboxPassed) spikes.push(name);
      continue;
    }
    // Phase 4 (+tdd): an approved test plan, the feature not finished — the failing tests are written BEFORE the tasks can be
    // approved (next_action refuses the tasks approval until the tests gate passes), so test files are covered then.
    if (approvals["test-plan"] && unfinished) testing.push(name);
    if (tasksText == null || !tasks.some((t) => !t.done)) continue; // complete (or no tasks)
    texts.set(name, tasksText);
    const ap = approvals.tasks || null;
    if (!ap) pending.push(name);
    else if (isObj(ap) && typeof ap.fingerprint === "string" && ap.fingerprint && !approvedContentSame(dir, "tasks", ap, tasksText)) stale.push(name);
    else if (isObj(ap) && ap.forced) forced.push(name);
    else covering.push(name);
  }
  // scope: the plan is every approved feature's open tasks (a forced approval's too — noted when it is the only cover, as below).
  if (level === "scope" && (covering.length || forced.length)) {
    // A spike never overrides the approved features' plan here: scope's point is that code outside it asks.
    return scopeGuardDecision(pdir, abs, covering.concat(forced), texts, allow, covering.length ? {} : { forced, note: G.forced(forced.join(", ")) });
  }
  if (covering.length) return allow("approved", { covering });
  if (forced.length) return allow("forced", { covering: forced, forced, note: G.forced(forced.join(", ")) });
  if (spikes.length) return allow("spike", { covering: spikes, spikes });
  if (testing.length && isTestFile(rel)) return allow("tests-phase", { covering: testing });
  const list = (xs) => xs.slice(0, 3).join(", ") + (xs.length > 3 ? ", …" : "");
  return { guard: true, decision: "ask", why: "no-approved-tasks", pending, stale, reason: G.ask(list(pending), list(stale)) };
}

// 1.23 review 5 (L21) — a Write / Edit target as the Windows file system reads it (win: process.platform === "win32" by default;
// elsewhere ':' is a file name character and /c/ a folder): an NTFS stream suffix on the last segment is dropped — `a.ts::$DATA`
// IS a.ts, `a.ts:x` / `a.ts:x:$DATA` a stream of it (an edit of it all the same) — and Git Bash's `/c/…` is `C:/…` (`//host`
// untouched). Both were read as no code / outside the project and allowed with the guard on.
function guardTargetPath(p, win = process.platform === "win32") {
  let s = String(p);
  if (!win) return s;
  const m = /^\/([A-Za-z])(?=\/|$)/.exec(s);
  if (m) s = m[1].toUpperCase() + ":" + (s.slice(2) || "/");
  const cut = Math.max(s.lastIndexOf("/"), s.lastIndexOf("\\")) + 1; // the last segment
  const from = cut === 0 && /^[A-Za-z]:/.test(s) ? 2 : 0; // a drive-relative "C:a.ts" keeps its drive
  const i = s.indexOf(":", cut + from);
  return i > cut ? s.slice(0, i) : s;
}
// 1.24 review 6 (C5) — a Write / Edit target (absolute, or relative to the payload's cwd) → the paths the file system reads it as:
// [resolved] (`./`, `..` and a stream suffix taken out — `.specs/./roadmap.json`, `.specs/alpha/../roadmap.json`,
// `roadmap.json::$DATA` were matched as text and allowed) plus, on Windows, when a segment looks like an 8.3 short name
// (`ROADMA~1.JSO`, `STATE~1.JSO`), its real path (the file's, else its parent's + the name). Never a disk call on a network path;
// a relative path under a network cwd is read as text. hooks/hook-utils.js editTargets is the same reading (the hook's pre-check,
// before the engine loads — mcp/tests/10-guards-review6.js checks they agree).
function approvalEditTargets(fp, cwd, win = process.platform === "win32") {
  const s = guardTargetPath(String(fp).trim(), win);
  if (isNetworkPath(s)) return [s];
  const c = sessionUsable(cwd) ? cwd.trim() : null;
  if (c && isNetworkPath(c) && !path.isAbsolute(s) && !/^[A-Za-z]:/.test(s)) return [c.replace(/[\\/]+$/, "") + "/" + s];
  const base = c && !isNetworkPath(c) ? path.resolve(guardTargetPath(c, win)) : process.cwd();
  let abs;
  try { abs = path.resolve(base, s); } catch { return [s]; }
  const out = [abs];
  // 1.25.1 (review 7): on every platform, the real path — a folder linked to .specs/ (`ln -s .specs sx`, a junction) or to a feature
  // folder: `sx/roadmap.json` IS .specs/roadmap.json — as well as an 8.3 short name (the file's, else its folder's + the name)
  let real = null;
  try { real = fs.realpathSync.native(abs); } catch {
    try { real = path.join(fs.realpathSync.native(path.dirname(abs)), path.basename(abs)); } catch { real = null; }
  }
  if (real && real !== abs) out.push(real);
  return out;
}

// ---------------------------------------------------------------------------
// 1.23 review 5 (M8) — the session's project, worktree-aware. The MCP server is pinned to SPEC_PROJECT_DIR = CLAUDE_PROJECT_DIR (the
// folder Claude Code started in) and writes approvals / ticks / evidence there; the hooks used the payload's cwd first — in a git
// worktree (EnterWorktree, a subagent cd'd into `.claude/worktrees/<n>` or a sibling checkout) that is the worktree's own copy of
// .specs/, so the edit guard asked although the tasks were approved, the stop gate read no activity, and the SubagentStop gate looked
// for a report the controller had the implementer write in the main checkout. One resolver for the hooks and the status line.
// ---------------------------------------------------------------------------
const SESSION_MAX_UP = 40; // folders walked up from a hook's cwd looking for a dev-spec .specs/ (the status line's STATUS_MAX_UP)
const sessionUsable = (v) => typeof v === "string" && !!v.trim() && !/^\$\{[^}]*\}$/.test(v.trim()) && v.length <= 4096;
// Two folders are one: the same text (case folded where the file system folds it), else the same real path — an 8.3 short name, a
// link (git writes a worktree's gitdir / commondir with the long names). Never a network path's real path (no SMB connection).
function sessionSame(a, b) {
  if (!a || !b) return false;
  const x = path.resolve(a), y = path.resolve(b);
  if (FOLD_CASE ? x.toLowerCase() === y.toLowerCase() : x === y) return true;
  if (isNetworkPath(x) || isNetworkPath(y)) return false;
  try {
    const rx = fs.realpathSync.native(x), ry = fs.realpathSync.native(y);
    return FOLD_CASE ? rx.toLowerCase() === ry.toLowerCase() : rx === ry;
  } catch { return false; }
}
// A .specs/ dev-spec owns (isDevSpecDir — roadmap.json, steering/, a feature's .state.json — or, as the hooks read it, a feature
// folder with its classification.md).
function sessionSpecs(dir) {
  if (isDevSpecDir(dir)) return true;
  const root = path.join(dir, ".specs");
  return safeReaddir(root).some((n) => !n.startsWith(".") && fs.existsSync(path.join(root, n, "classification.md")));
}
// The git checkout holding dir — the nearest .git at or above it → { top, commonDir, linked } (linked: a `git worktree add`
// checkout: a .git FILE whose git dir has a commondir; a submodule's .git file has none — no worktree), or null (no git, a network
// path — never stat'ed, a .git that can't be read). At most ~2 small reads.
function gitCheckoutOf(dir) {
  if (!sessionUsable(dir) || isNetworkPath(dir)) return null;
  let d = path.resolve(dir);
  for (let k = 0; k < 64; k++) {
    const dotGit = path.join(d, ".git");
    let st = null;
    try { st = fs.statSync(dotGit); } catch { st = null; }
    if (st && st.isDirectory()) return { top: d, commonDir: dotGit, linked: false };
    if (st && st.isFile()) {
      let m = null;
      try { m = /^gitdir:[ \t]*(.+?)[ \t]*$/m.exec(fs.readFileSync(dotGit, "utf8").slice(0, 4096)); } catch { m = null; }
      if (!m) return null;
      const gitDir = path.resolve(d, m[1]);
      let common = null;
      try { common = path.resolve(gitDir, fs.readFileSync(path.join(gitDir, "commondir"), "utf8").trim()); } catch { common = null; }
      return common ? { top: d, commonDir: common, linked: true } : { top: d, commonDir: gitDir, linked: false };
    }
    if (st) return null;
    const up = path.dirname(d);
    if (up === d) break;
    d = up;
  }
  return null;
}
// near — a folder holding a dev-spec .specs/ — → the same folder in the checkout the session's state lives in: when near lies in
// another checkout of the same repository as an anchor (CLAUDE_PROJECT_DIR / SPEC_PROJECT_DIR / the status line's project_dir — where
// the MCP server writes), its counterpart in the anchor's checkout; else, near in a linked worktree, its counterpart in the main
// checkout — when that counterpart holds a dev-spec .specs/. Otherwise near itself (an unrelated project, a nested project of a
// monorepo, no git).
function worktreeProject(near, anchors) {
  const w = gitCheckoutOf(near);
  if (!w) return near;
  const rel = path.relative(w.top, path.resolve(near));
  for (const a of Array.isArray(anchors) ? anchors : []) {
    if (!sessionUsable(a) || isNetworkPath(a)) continue;
    const wa = gitCheckoutOf(a);
    if (!wa || sessionSame(wa.top, w.top) || !sessionSame(wa.commonDir, w.commonDir)) continue;
    const m = path.join(wa.top, rel);
    if (sessionSpecs(m)) return m;
  }
  if (w.linked && path.basename(w.commonDir).toLowerCase() === ".git") {
    const main = path.dirname(w.commonDir);
    const m = path.join(main, rel);
    if (!sessionSame(main, w.top) && sessionSpecs(m)) return m;
  }
  return near;
}
// The project a hook reads, and the folder its payload's paths are relative to. opts: { cwd (the payload's), anchors
// ([CLAUDE_PROJECT_DIR, SPEC_PROJECT_DIR]) }. The nearest folder at or above cwd holding a dev-spec .specs/ (≤ SESSION_MAX_UP levels —
// a cd'd subfolder too —, never above an anchor that holds cwd: a dev-spec folder ABOVE the session's own is another project; a
// network cwd is the user's own folder: only itself is looked at, never walked up nor mapped), mapped by worktreeProject; with
// none, the first anchor that is a dev-spec project.
// → { project (where the .specs/ state lives), root (the checkout folder of the payload's paths), worktree (root ≠ project) } | null
function sessionProject(opts = {}) {
  const anchors = (Array.isArray(opts.anchors) ? opts.anchors : []).filter(sessionUsable).map((v) => path.resolve(v.trim()));
  let near = null;
  if (sessionUsable(opts.cwd)) {
    const c = opts.cwd.trim();
    if (isNetworkPath(c)) near = sessionSpecs(c) ? path.resolve(c) : null;
    else {
      let d = path.resolve(c);
      const stop = anchors.find((a) => !isNetworkPath(a) && withinRoot(a, d));
      for (let i = 0; i < SESSION_MAX_UP; i++) {
        if (sessionSpecs(d)) { near = d; break; }
        const up = path.dirname(d);
        // at the anchor (by text, as withinRoot read it — no real-path calls in the walk): never above it
        if (up === d || (stop && path.relative(stop, d) === "")) break;
        d = up;
      }
    }
  }
  if (near) {
    const project = isNetworkPath(near) ? near : worktreeProject(near, anchors);
    return { project, root: near, worktree: !sessionSame(project, near) };
  }
  for (const a of anchors) if (sessionSpecs(a)) return { project: a, root: a, worktree: false };
  return null;
}
// A payload path (absolute, or relative to cwd) → the same file in the session's project: a file in the worktree's checkout
// (session.root) is spelled under session.project. Anything else stays as it is (resolved).
function sessionPath(session, p, cwd) {
  if (typeof p !== "string" || !p.trim()) return p;
  const base = sessionUsable(cwd) ? path.resolve(guardTargetPath(cwd)) : session && session.root ? session.root : process.cwd();
  const abs = path.resolve(base, guardTargetPath(p));
  if (!session || !session.worktree || !withinRoot(session.root, abs)) return abs;
  return path.join(session.project, path.relative(session.root, abs));
}

// roadmap.json meta.guard ← on (spec_init {guard} / `dev-spec init --guard on|off`). No write when unchanged.
function setGuard(projectDir, on) {
  return withRoadmapLock(projectDir, () => {
    const rm = readRoadmap(projectDir);
    if (isObj(rm.meta) && rm.meta.guard === on) return { ok: true };
    rm.meta = isObj(rm.meta) ? rm.meta : {};
    rm.meta.guard = on;
    writeRoadmap(projectDir, rm);
    return { ok: true };
  });
}

// ---------------------------------------------------------------------------
// 1.14 F2 — the human approval guard (roadmap.json meta.approvalGuard: off | ask | deny; hooks/approval-hook.js, PreToolUse).
// An approval is the human's act, yet an agent can call spec_approve (force included) or run `dev-spec approve` itself. With the
// guard on, an AGENT's approval — the spec_approve MCP tool under any server prefix, spec_feature {action: "remove", confirm: true},
// `dev-spec approve …` / `dev-spec feature remove … --yes` run through the Bash / PowerShell tool (also inside `bash -c "…"`,
// `cmd /c "…"`, `pwsh -Command "…"`, `$( … )`, a heredoc fed to a shell) — or a GUARD-DOWN action: lowering this guard
// (spec_init {approvalGuard} / `init --approval-guard`), weakening what it stands for (spec_init / `init`: evidence observed →
// reported, clearing or dropping approval roles, removing or changing a project check, turning the stop gate or the edit guard
// down) or a shell command writing .specs/roadmap.json — asks the user (ask: a permission prompt) or is refused with the command
// the human runs (deny: in their own terminal, or with Claude Code's `!` prefix). Raising or adding stays allowed. A guardrail
// against accidents and casual workarounds, not a sandbox: an inline or written script, a variable set by an earlier tool call can
// still reach .specs/ files (docs/maintainers/claude-code-integration.md → Known limits).
// approvalGuardDecision is PURE (reads nothing): the hook reads the level and meta (one raw read of roadmap.json) and passes them in.
// ---------------------------------------------------------------------------

const APPROVAL_GUARD_LEVELS = ["off", "ask", "deny"]; // in order: a later level is stricter
// The approve-shaped MCP tools, under any server prefix (Claude Code: mcp__plugin_dev-spec-driven_spec-driven__spec_approve;
// a project server: mcp__spec-driven__spec_approve; any name a user registered the server under) or bare.
const RE_APPROVAL_MCP = /^(?:mcp__.+__)?(spec_approve|spec_feature|spec_init|spec_add_track)$/; // spec_add_track: 1.24 review 6 (E3)
// The tools that run a shell command (tool_input.command). 1.23 review 5 (P4): Monitor — it runs its command in the Bash tool's
// shell (with the Bash permission rules), and `node cli/dev-spec.js approve …` through it went past a deny-level guard.
const APPROVAL_SHELL_TOOLS = new Set(["Bash", "PowerShell", "Monitor"]);
// 1.23 review 5: the file-editing tools — a hand edit of a feature's approvals (.specs/**/.state.json) or of .specs/roadmap.json
// (the guard's own level, the project's gates) is a guard-down action like a shell write of it. MultiEdit: an older tool name.
const APPROVAL_EDIT_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]); // NotebookEdit (notebook_path): 1.25.1
// 1.25.1 (review 7): another MCP server's file tools — filesystem's write_file / edit_file / move_file, Desktop Commander's write_file /
// edit_block, … — matched by the verb in the tool's name, never by the server (hooks/hooks.json's matcher is the same set); dev-spec's
// own tools (spec_*, steering_scaffold, ears_validate, trace_check) are never one. Their path-like arguments are read as an Edit's path.
const RE_MCP_FILE_TOOL = /^mcp__.+__[\w-]*?(?:write|edit|create|move|rename|delete|remove|copy|append|patch|replace|save|put|upload|mkdir|touch|truncate|unlink|insert)/i;
const RE_DEVSPEC_MCP_TOOL = /__(?:spec_[a-z_]+|steering_scaffold|ears_validate|trace_check)$/;
const RE_MCP_PATH_KEY = /path|file|source|src|dest|target|from|^to$|dir|folder|name|uri|location/i;
// The `unreadable` reasons that ask at both levels (never refused outright — it may be no approval at all): a form the lexer can't
// follow, a partial payload, a script fed to a shell out of sight, an unknown program run on .specs/ files (1.25.1), the hook's own
// failure past its pre-check, a projectDir the hook can't read (1.25.1).
const APPROVAL_ASK_WHYS = ["unparsed", "partial", "fed", "specs-arg", "error", "project"];
const RE_STATE_FILE = /(?:^|[\\/])\.specs[\\/]+(?:[^\\/]+[\\/]+)+\.state\.json$/i;
// 1.24 review 6 (C6): the harness-observed run log (hooks/observe-hook.js appends the runs Claude Code SAW: .specs/<f>/.execution/
// observed.jsonl, .specs/.execution/observed.jsonl for a project check) — an agent writing it forges observed evidence.
const RE_OBSERVED_FILE = /(?:^|[\\/])\.specs[\\/]+(?:[^\\/]+[\\/]+)*\.execution[\\/]+observed\.jsonl$/i;
// 1.24 review 6 (E3): the tracks that carry a gate of their own — +tdd (test-plan, Phase 4's failing tests), +ai (eval-plan, the eval
// harness): turning one off drops that gate (gates.js phaseActive). No other built-in track or a pack adds a phase.
const APPROVAL_GATED_TRACKS = ["tdd", "ai"];
const APPROVAL_COMMAND_MAX = 64 * 1024; // characters of a shell command read (the hook's payload may be anything)
const APPROVAL_SHELL_DEPTH = 3; // nested scripts (bash -c "cmd /c \"…\"") read at most this deep
const APPROVAL_LEX_DEPTH = 32; // $( … ) / `…` / heredoc scripts lexed at most this deep (deeper: read as a plain subshell)
// The CLI's boolean switches (cli/dev-spec.js BOOL_FLAGS): any other `--flag` takes the next word as its value.
const CLI_SWITCHES = new Set(["json", "run", "remove", "write", "md", "html", "batch", "include-brief", "include-body", "code", "force",
  "reopen", "yes", "brownfield", "parallel", "clear", "apply", "discovery", "expect-fail", "help", "matrix", "csv", "waves",
  "print-config"]); // the CLI's BOOL_FLAGS ARE this list (print-config: 1.16 C1 — statusline --print-config)
CLI_SWITCHES.add("revoke"); // 1.16 U2: approve <feature> <phase> --revoke (the approval hook reads it as a switch too)
CLI_SWITCHES.add("gherkin"); // 1.16 E1: export [f] --gherkin (= spec_export {format: "gherkin"})
CLI_SWITCHES.add("install").add("uninstall"); // 1.21 F1a: merge-state --install / --uninstall (the git merge driver's setup)
CLI_SWITCHES.add("explain"); // 1.21 F2: classify "<text>" --explain (= spec_classify {explain: true})
CLI_SWITCHES.add("adr"); // 1.25: export [f] --adr (= spec_export {format: "adr"})
CLI_SWITCHES.add("dry-run"); // 1.25: import … --dry-run (= spec_import {dryRun: true} — nothing written, the same result + a preview)
// Words that may come before the CLI's script in the same simple command (a launcher, an env assignment, an option, a timeout, a
// shell keyword — `! node … approve`, the very line the deny reason suggests, run by the agent itself is still an approval).
const APPROVAL_WRAPPERS = new Set(["node", "nodejs", "bun", "deno", "npx", "bunx", "pnpx", "npm", "pnpm", "yarn", "sudo", "doas", "env", "nohup",
  "time", "exec", "command", "call", "start", "timeout", "nice", "ionice", "setsid", "stdbuf", "wsl", "xargs", "!", "if", "then", "else", "elif",
  "do", "while", "until", "winpty", "flock", // winpty, flock: 1.22 review
  // 1.23 review 5 (L20): tracers, output buffers, bash's builtin / coproc, the TypeScript runners, nodemon, GNU parallel
  "strace", "ltrace", "unbuffer", "chronic", "builtin", "coproc", "tsx", "ts-node", "nodemon", "parallel", "valgrind", "caffeinate", "catchsegv"]);
// Wrappers whose first N plain words are theirs, not the program: flock <lockfile> <command> (1.22 review).
const APPROVAL_POSITIONALS = new Map([["flock", 1]]);
// Launchers that run a package's bin through a subcommand only: npm exec / npm x, pnpm dlx / pnpm exec, yarn dlx / yarn exec,
// bun x / bun run, deno run (`yarn dev-spec …` — the CLI named directly — is found as it is). Any other subcommand runs no bin.
const APPROVAL_SUBCOMMANDS = new Map([["npm", ["exec", "x"]], ["pnpm", ["dlx", "exec"]], ["yarn", ["dlx", "exec"]], ["bun", ["x", "run"]], ["deno", ["run"]]]);
// The launchers' options that take the NEXT word as their value (`sudo -u bob`, `exec -a name`, `node -r ./hook.js`); any other
// option is a switch (a value glued with = or attached — `-ubob` — is part of the option word).
const APPROVAL_OPTION_VALUES = new Map(Object.entries({
  sudo: "-u -g -p -C -D -r -t -U -T -R -h --user --group --prompt --close-from --chdir --role --type --other-user --command-timeout --chroot --host",
  doas: "-u -C",
  exec: "-a",
  env: "-u -C --unset --chdir",
  node: "-r --require --import --loader --experimental-loader -C --conditions --title --env-file --input-type --inspect-port --redirect-warnings --openssl-config --icu-data-dir --diagnostic-dir --report-dir",
  bun: "-r --preload --cwd -c --config --env-file --tsconfig-override",
  deno: "-c --config --import-map --location --seed --cert --env-file --lock -L --log-level",
  npx: "-p --package -c --call --cache --userconfig -w --workspace --prefix",
  npm: "-p --package -c --call --cache --userconfig -w --workspace --prefix -C",
  pnpm: "-C --dir --filter -F --package",
  yarn: "--cwd -p --package",
  timeout: "-s -k --signal --kill-after",
  nice: "-n --adjustment",
  ionice: "-c -n -p --class --classdata --pid",
  time: "-f -o --format --output",
  stdbuf: "-i -o -e --input --output --error",
  xargs: "-I -n -P -L -d -E -s -a --max-args --max-procs --delimiter --arg-file --max-lines --max-chars --eof --replace",
  wsl: "-d -u --distribution --user --cd --shell-type",
  flock: "-w --wait --timeout -E --conflict-exit-code -c --command", // -c: its script, read as one (APPROVAL_SHELLS)
  strace: "-o -e -p -s -u -E -P -I -b -S -X -a --output --signal --trace --attach --user --env", // 1.23 review 5
  ltrace: "-o -e -p -s -u -n -a -l --output --library",
  nodemon: "-x --exec -w --watch -e --ext -i --ignore -d --delay --signal --config",
  "ts-node": "-r --require -P --project -C --compiler -O --compiler-options -I --ignore --cwd",
  tsx: "--tsconfig --env-file -r --require --import",
}).map(([p, list]) => [p, new Set(list.split(" "))]));
APPROVAL_OPTION_VALUES.set("nodejs", APPROVAL_OPTION_VALUES.get("node"));
APPROVAL_OPTION_VALUES.set("pnpx", APPROVAL_OPTION_VALUES.get("npx"));
// Programs whose quoted argument is itself a script: bash -c "…", cmd /c "…", pwsh -Command "…", eval "…", Start-Process … "…",
// env -S "…", npx -c "…" — read in that program's syntax (cmd → cmd.exe, the PowerShell ones → PowerShell, the rest → Bash).
const APPROVAL_SHELLS = new Set(["bash", "sh", "zsh", "dash", "ksh", "fish", "cmd", "powershell", "pwsh", "eval", "iex", "invoke-expression",
  "start-process", "wsl", "su", "watch", "env", "npx", "pnpx", "npm", "pnpm", "yarn", "flock", "script", // flock / script -c "…": 1.22 review
  "trap"]); // trap '…' EXIT: 1.23 review 5
const APPROVAL_PS_SHELLS = new Set(["powershell", "pwsh", "iex", "invoke-expression", "start-process"]);
// The shells that run a heredoc / here-string fed to them as their script (`bash <<'EOF' … EOF`, `sh <<< "…"`).
const APPROVAL_STDIN_SHELLS = new Set(["bash", "sh", "zsh", "dash", "ksh", "fish", "cmd", "powershell", "pwsh", "wsl", "su"]);
const approvalShellMode = (prog) => (prog === "cmd" ? "cmd" : APPROVAL_PS_SHELLS.has(prog) ? "ps" : "bash");
const RE_DEVSPEC_WORD = /(?:^|[\\/])dev-spec(?:\.(?:[cm]?js|cmd|ps1|exe))?$/i;
// 1.23 review 5 (L20): a glob that names the CLI's script (`node cli/dev-sp?c.js approve …` — the shell expands it) — its last
// path segment, read as a glob (* ? [set]), matches one of the script's names. Bounded: a word over 200 characters is no glob here.
const DEVSPEC_NAMES = ["dev-spec", "dev-spec.js", "dev-spec.cjs", "dev-spec.mjs", "dev-spec.cmd", "dev-spec.ps1", "dev-spec.exe"];
function devSpecGlob(word) {
  const w = String(word);
  if (w.length > 200 || !/[*?[]/.test(w)) return false;
  const base = w.replace(/^.*[\\/]/, "");
  let re = "";
  for (let i = 0; i < base.length; i++) {
    const c = base[i];
    if (c === "*") re += "[^/\\\\]*";
    else if (c === "?") re += ".";
    else if (c === "[") {
      const end = base.indexOf("]", i + 2);
      if (end < 0) { re += "\\["; continue; }
      const set = base.slice(i + 1, end).replace(/^[!^]/, "^").replace(/[\\\]]/g, "\\$&");
      re += "[" + set + "]";
      i = end;
    } else re += c.replace(/[.+^${}()|\\]/g, "\\$&");
  }
  try { const r = new RegExp("^(?:" + re + ")$", "i"); return DEVSPEC_NAMES.some((n) => r.test(n)); } catch { return false; }
}
const isDevSpecWord = (w) => RE_DEVSPEC_WORD.test(w) || devSpecGlob(w);
// A word that is only a substitution or a variable ($(which node), `…`, $NODE, ${NODE}, $env:NODE, %NODE%): an unknown launcher.
const RE_APPROVAL_VAR_WORD = /^(?:\$(?:\{[^{}]*\}|[A-Za-z_][\w:]*)|%\w+%)$/;
// …except cmd.exe named through its variable: `& $env:ComSpec /c "…"`, `%ComSpec% /c …` (1.23 review 5).
const RE_COMSPEC_WORD = /^(?:\$env:comspec|\$\{env:comspec\}|%comspec%)$/i;
// A shell command can run the CLI or write .specs/roadmap.json only if it names dev-spec or .specs — read with quotes, escapes and
// line continuations taken out (`dev\-spec`, `d'e'v-spec`, `dev`-spec`), PowerShell's / JavaScript's string joints too
// (`"cli/dev" + "-spec.js"` — 1.23 review 5). Or (1.23) a glob together with an approval word: the glob may name the CLI. The
// hook's own pre-check is the same test.
// 1.25.1 (review 7): or the files the guard stands on by name (`find . -name roadmap.json -delete`), or a glob / brace expansion that
// may name .specs (`.s*/road*.json`, `.spec?/…`) or stand beside a writer / remover (PowerShell's `Remove-Item * -Recurse` reaches
// .specs/). The hook's pre-check (approval-hook.js candidate) is the same test — mcp/tests/10-guards-review7.js checks they agree.
const RE_APPROVAL_CANDIDATE = /dev-?spec|\.specs|roadmap\.json|\.state\.json|observed\.jsonl/i;
const RE_APPROVAL_DOT_GLOB = /(?:^|[\s/\\'"=,(;&|])\.[^\s/\\'";&|]*[*?[{]/;
const RE_APPROVAL_WRITE_WORD = /(?:^|[\s;&|(])(?:rm|rmdir|rd|del|erase|remove-item|ri|mv|move|move-item|mi|cp|copy|copy-item|cpi|set-content|sc|add-content|ac|clear-content|clc|out-file|new-item|ni|tee|robocopy|xcopy|rsync)(?=[\s;&|)]|$)/i;
// The words that make a CLI call an approval or a guard-down (approve, feature remove, init's guard-down flags).
const RE_APPROVAL_VERB = /(?:^|[^\w-])(?:approve|remove|--approval-guard|--stop-check|--evidence|--guard|--roles|--check)(?![\w-])/i;
const approvalPlain = (text) => String(text).replace(/(["'])\s*\+\s*\1/g, "").replace(/[\\`^]\r?\n|['"\\`^]/g, "");
// …and a PowerShell -EncodedCommand / -ec / -e value whose decoded script names dev-spec (`powershell -enc <base64>`).
const RE_PWSH_ENCODED = /(?:^|\s)[-/]e[a-z]*\s+([A-Za-z0-9+/]{8,}={0,2})(?=\s|$)/gi;
const approvalCandidate = (text) => {
  const t = approvalPlain(text);
  if (RE_APPROVAL_CANDIDATE.test(t) || (/[*?[{]/.test(t) && (RE_APPROVAL_VERB.test(t) || RE_APPROVAL_DOT_GLOB.test(t) || RE_APPROVAL_WRITE_WORD.test(t)))) return true;
  if (!/powershell|pwsh/i.test(t)) return false;
  let n = 0;
  for (const m of t.matchAll(RE_PWSH_ENCODED)) {
    if (++n > 8) break;
    const s = decodePwshEncoded(m[1]);
    if (s && RE_APPROVAL_CANDIDATE.test(approvalPlain(s))) return true;
  }
  return false;
};
// 1.23 review 5 (L20, fail closed): the programs whose arguments are only text or files read — a simple command run by one of
// them never runs the CLI (`echo dev-spec approve x`, `git commit -m "…approve…"`, `grep -r "dev-spec.js approve" .`).
const APPROVAL_TEXT_PROGRAMS = new Set(["echo", "printf", "print", "git", "gh", "grep", "egrep", "fgrep", "rg", "ag", "ack", "findstr",
  "select-string", "sls", "cat", "type", "gc", "get-content", "less", "more", "head", "tail", "bat", "write-host", "write-output",
  "write-error", "write-verbose", "write-warning", "out-host", "man", "which", "where", "whereis", "ls", "dir", "gci", "get-childitem",
  "tree", "code", "vim", "vi", "nvim", "nano", "notepad", "emacs", "wc", "diff", "cmp", "jq", "sort", "uniq", "touch", "test", "[",
  "true", "false", ":", "read", "curl", "wget", "stat", "file", "realpath", "readlink", "basename",
  "dirname", "test-path", "resolve-path", "get-item", "gi", "measure-object", "format-list", "fl", "format-table", "ft"]);
// The JavaScript runtimes that read their script from stdin with `-` (`cat cli/dev-spec.js | node - approve …`).
const APPROVAL_STDIN_RUNTIMES = new Set(["node", "nodejs", "bun"]);
// .specs/roadmap.json as a write target (R1): a redirection's target, or the file a writer program names.
const RE_ROADMAP_FILE = /(?:^|[\\/])\.specs[\\/]+roadmap\.json$/i;
const RE_SPECS_DIR = /(?:^|[\\/])\.specs[\\/]*$/i;
// The programs whose operands are written (each one) — 1.25.1 (review 7): + sponge, dos2unix / unix2dos (in place), the PowerShell
// file cmdlets read by their parameters (shellSegOps).
const APPROVAL_WRITERS_ANY = new Set(["tee", "truncate", "rm", "unlink", "shred", "del", "erase", "remove-item", "ri", "set-content", "sc",
  "add-content", "ac", "out-file", "clear-content", "clc", "new-item", "ni", "mv", "move", "move-item", "mi", "ren", "rename", "rename-item",
  "rni", "dd", "sponge", "dos2unix", "unix2dos", "tee-object", "export-csv", "epcsv", "export-clixml"]);
// Deleting .specs/ or moving it away takes roadmap.json with it (the guard reads a missing file as off).
const APPROVAL_REMOVERS = new Set(["rm", "rmdir", "rd", "del", "erase", "remove-item", "ri", "unlink"]);
const APPROVAL_MOVERS = new Set(["mv", "move", "move-item", "mi", "ren", "rename", "rename-item", "rni"]);
const APPROVAL_WRITERS_TARGET =new Set(["cp", "copy", "copy-item", "cpi", "install", "ln", "rsync", "xcopy", "robocopy", "scp"]); // the LAST path is written
const APPROVAL_WRITERS_INPLACE = new Set(["sed", "perl", "ruby"]); // with -i / --in-place
const RE_DEST_OPTION = /^-(?:destination|dest|t|-target-directory)$/i;
// 1.25.1 (review 7): the other programs that write the files they name — editors run with their commands (ed, ex, vim -c …), awk -i
// inplace, the downloaders' output files (curl -o, wget -O / -P), the archivers' extraction folders and members (tar -x -C, unzip -d,
// 7z x -o, Expand-Archive), patch, sort -o, uniq's output, iconv -o, xxd's output, zip's archive — and the link makers (ln, mklink,
// New-Item -ItemType SymbolicLink / Junction / HardLink, subst, junction, fsutil hardlink, mount --bind).
const APPROVAL_WRITERS_OTHER = new Set(["ed", "red", "ex", "vi", "vim", "nvim", "view", "awk", "gawk", "mawk", "nawk", "curl", "wget", "tar", "bsdtar",
  "unzip", "7z", "7za", "7zr", "expand-archive", "patch", "sort", "uniq", "iconv", "xxd", "zip", "base64", "mklink", "subst", "junction", "fsutil",
  "mount", "git", "find", "cd", "chdir", "pushd", "popd", "sl", "set-location", "push-location", "pop-location"]);
// 1.25.1 (review 7, fail closed): the programs known to only READ the files they name (beyond the text-only ones) — interpreters (their
// inline scripts are a known limit), JSON / text tools, checksums, PowerShell's readers. Any OTHER program run on .specs/ itself,
// roadmap.json, a .state.json or an observed log — a glob or a variable that may be one — asks (`unreadable`, why "specs-arg").
const APPROVAL_READERS = new Set(["node", "nodejs", "bun", "deno", "python", "python3", "py", "pypy", "pypy3", "php", "lua", "jq", "yq", "gojq", "jless",
  "fx", "cut", "tr", "od", "hexdump", "md5sum", "sha1sum", "sha224sum", "sha256sum", "sha384sum", "sha512sum", "shasum", "cksum", "b2sum", "md5",
  "nl", "column", "fold", "fmt", "strings", "tac", "rev", "paste", "join", "comm", "expand", "unexpand", "pr", "look", "split", "csplit", "du", "df",
  "open", "xdg-open", "explorer", "start", "invoke-item", "ii", "certutil", "npm", "npx", "pnpm", "yarn", "make", "for", "in", "case", "select",
  "do", "done", "esac", "while", "until", "if", "then", "else", "elif", "fi", "function", "return", "exit", "export", "declare", "local", "readonly",
  "typeset", "set", "unset", "shift", "wait", "sleep", "chmod", "chown", "attrib", "icacls", "touch", "mkdir", "md"]);
const RE_PS_READER = /^(?:get|select|where|foreach|measure|format|out-string|out-null|out-host|write|convertfrom|convertto|test|resolve|join|split|compare|sort|group|import|show|find|search|read|wait|trace|start-sleep)(?:-|$)|^[%?]$/;

// "off" | "ask" | "deny" (any case, trimmed), else undefined — spec_init {approvalGuard} / `init --approval-guard`.
function approvalGuardInput(v) {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  return APPROVAL_GUARD_LEVELS.includes(s) ? s : undefined;
}
// A roadmap.json that exists but doesn't parse keeps the strictest meta.approvalGuard its raw text names (fail closed: appending
// a byte to the file must not switch the guard off). Linear: one literal key, no nested quantifier. NULs are taken out first (1.24
// review 6, A4): a BOM-less UTF-16 file read as UTF-8 is that text with a NUL after each ASCII character.
const RE_RAW_APPROVAL_GUARD = /"approvalGuard"\s*:\s*"\s*(ask|deny)\s*"/gi;
function rawApprovalGuard(text) {
  let lvl = 0;
  for (const m of String(text || "").replace(/\0/g, "").matchAll(RE_RAW_APPROVAL_GUARD)) lvl = Math.max(lvl, APPROVAL_GUARD_LEVELS.indexOf(m[1].toLowerCase()));
  return APPROVAL_GUARD_LEVELS[lvl];
}
// roadmap.json meta.approvalGuard → "off" | "ask" | "deny" (anything else, or no roadmap.json: off; a broken one: what its text
// names — rawApprovalGuard). The hook reads it raw the same way.
function approvalGuardLevel(projectDir) {
  const l = loadRoadmap(projectDir);
  if (l.parseError) return rawApprovalGuard(readIfExists(roadmapPath(projectDir)));
  if (approvalRoadmapGone(projectDir)) return "ask";
  return (isObj(l.rm.meta) && approvalGuardInput(l.rm.meta.approvalGuard)) || "off";
}
// 1.25.1 (review 7): a .specs/ holding features (a feature folder with its .state.json) but no roadmap.json — every engine write that
// makes a feature writes roadmap.json, so it was deleted (a route the guard didn't see, or by hand): the approval guard's level is
// unknown, and it FAILS CLOSED at ask (the hook reads it the same way) until roadmap.json is back. (The engine's next roadmap write
// recreates it with the default meta — off: deleting it from the shell is itself a guard-down.)
function approvalRoadmapGone(projectDir) {
  const root = specsRoot(projectDir);
  if (fs.existsSync(path.join(root, "roadmap.json"))) return false;
  return safeReaddir(root).some((n) => !n.startsWith(".") && fs.existsSync(path.join(root, n, ".state.json")));
}
// Inside initProject's roadmap lock. Off is the default (absent = off): no write when the effective value doesn't change.
function setApprovalGuard(projectDir, level) {
  const rm = readRoadmap(projectDir);
  rm.meta = isObj(rm.meta) ? rm.meta : {};
  if ((approvalGuardInput(rm.meta.approvalGuard) || "off") === level) return;
  rm.meta.approvalGuard = level;
  writeRoadmap(projectDir, rm);
}
const lowersApprovalGuard = (to, level) => APPROVAL_GUARD_LEVELS.indexOf(to) < APPROVAL_GUARD_LEVELS.indexOf(level);

// $'…' (Bash ANSI-C quoting): the escape after the backslash at s[k] → { text, end } (end: the index after it). Bounded reads.
const ANSI_C_ESCAPES = { a: "\x07", b: "\b", e: "\x1b", E: "\x1b", f: "\f", n: "\n", r: "\r", t: "\t", v: "\v", "\\": "\\", "'": "'", '"': '"', "?": "?" };
function ansiCEscape(s, k) {
  const c = s[k];
  if (c === undefined) return { text: "\\", end: k };
  if (own(ANSI_C_ESCAPES, c)) return { text: ANSI_C_ESCAPES[c], end: k + 1 };
  let m;
  if (c === "x" && (m = /^[0-9A-Fa-f]{1,2}/.exec(s.slice(k + 1, k + 3)))) return { text: String.fromCharCode(parseInt(m[0], 16)), end: k + 1 + m[0].length };
  if ((c === "u" || c === "U") && (m = (c === "u" ? /^[0-9A-Fa-f]{1,4}/ : /^[0-9A-Fa-f]{1,8}/).exec(s.slice(k + 1, k + 9)))) {
    const cp = parseInt(m[0], 16);
    return { text: cp <= 0x10ffff ? String.fromCodePoint(cp) : "", end: k + 1 + m[0].length };
  }
  if ((m = /^[0-7]{1,3}/.exec(s.slice(k, k + 3)))) return { text: String.fromCharCode(parseInt(m[0], 8) & 0xff), end: k + m[0].length };
  if (c === "c" && k + 1 < s.length) return { text: String.fromCharCode(s.charCodeAt(k + 1) & 0x1f), end: k + 2 };
  return { text: "\\" + c, end: k + 1 };
}
const PS_ESCAPES = { 0: "\0", a: "\x07", b: "\b", e: "\x1b", f: "\f", n: "\n", r: "\r", t: "\t", v: "\v" }; // "`n" in a PowerShell string

// A shell command → its simple commands: each a list of words (quotes and escapes removed) carrying `raw` (the same words with a
// Bash backslash kept — `node C:\x\cli\dev-spec.js` names the CLI in either spelling), `redirs` (the targets of its redirections,
// never words: `>log node cli/dev-spec.js approve …` still runs the CLI) and `herestrings` (`<<< "…"` words). `mode` = the shell
// that reads it (the tool: Bash / PowerShell; a nested script: its program's):
//  bash — '…' literal; "…" escapes \ " $ ` and a newline; $'…' ANSI-C escapes; outside quotes \x is x and \⏎ continues the line;
//         $( … ) and `…` are commands of their own (also inside "…" and an unquoted heredoc); a heredoc body (<<WORD, <<-WORD,
//         <<'WORD', <<"WORD", up to its terminator line) is data — read only for its $( ) / `…` when WORD is unquoted, or as a
//         whole script when the command is a shell (`bash <<'EOF'`); # at the start of a word starts a comment.
//  ps   — PowerShell: '…' literal ('' is a quote); in "…" and outside quotes the backtick escapes (`⏎ continues the line), "" is
//         a quote; $( … ) is a command; @'…'@ / @"…"@ here-strings are data ($( ) read in @"…"@); # and <# … #> are comments.
//  cmd  — cmd.exe: "…" literal, ^ escapes outside quotes (^⏎ continues the line), no ' quoting.
// Separators outside quotes: newline ; & | ( ) { }. One pass: a substitution is read by a nested call that returns where it ended
// (a backtick body at most twice), bounded by APPROVAL_LEX_DEPTH; nothing is evaluated.
function shellCommandWords(cmd, mode) {
  const segs = [];
  shellLexList(String(cmd), 0, mode === "ps" || mode === "cmd" ? mode : "bash", segs, false, 0);
  return segs;
}
// The first word that is the program run (after launchers, their options and values, env assignments, timeouts, shell keywords,
// an unknown substitution / variable) → its index, or -1. A launcher that needs a subcommand (npm exec) returns the word that
// stands where the subcommand should be when it is another one (`npm run …` → "run": no bin run).
function programAt(words, raw) {
  let prog = null, sub = null, positional = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (RE_COMSPEC_WORD.test(w) && !positional && !sub) return i; // cmd.exe through its variable (approvalProgram reads it as cmd)
    if (w === "" || RE_APPROVAL_VAR_WORD.test(w)) continue;
    if (w.startsWith("-")) {
      const vals = prog ? APPROVAL_OPTION_VALUES.get(prog) : null;
      if (vals && vals.has(w)) i++;
      continue;
    }
    if (positional > 0) { positional--; continue; } // flock's lock file
    if (sub) {
      const need = sub;
      sub = null;
      if (need.includes(w.toLowerCase())) continue;
      return i;
    }
    if (/^[A-Za-z_]\w*=/.test(w) || /^\d+(?:\.\d+)?[smhd]?$/.test(w)) continue;
    const p = approvalProgram(w);
    if (APPROVAL_WRAPPERS.has(p) && !isDevSpecWord(w) && !isDevSpecWord((raw && raw[i]) || "")) {
      prog = p;
      sub = APPROVAL_SUBCOMMANDS.get(p) || null;
      positional = APPROVAL_POSITIONALS.get(p) || 0;
      continue;
    }
    return i;
  }
  return -1;
}
// A simple command's shell (the program, when it is one that runs a heredoc / here-string fed to it) → its lexer mode, else null.
function stdinShellMode(words, raw) {
  const k = programAt(words, raw);
  const p = k >= 0 ? approvalProgram(words[k]) : "";
  return APPROVAL_STDIN_SHELLS.has(p) ? approvalShellMode(p) : null;
}
// The lexer (see shellCommandWords): reads s from `start` — to its end, or, inSub, to the `)` closing a `$(` (its index is
// returned) — pushing every simple command it finds (nested ones too) into segs.
function shellLexList(s, start, mode, segs, inSub, depth) {
  const bash = mode === "bash", ps = mode === "ps", cmdm = mode === "cmd";
  let words = [], raws = [], redirs = [], herestrings = [], segDocs = [], writes = [], procs = [], stdinRedir = false;
  let cur = "", raw = "", has = false, quoted = false, redir = null, paren = 0, arith = 0; // arith: the paren level inside (( … ))
  // 1.25.1 (review 7): the pipeline — the simple command a `|` feeds (pipeIn: the one before it, lastSeg: the last one this list ended)
  let pipeIn = null, lastSeg = null;
  const heredocs = []; // bash: bodies waiting for the next newline — { delim, strip, quoted, shell, body }
  const add = (t, r) => { cur += t; raw += r === undefined ? t : r; has = true; };
  const endWord = () => {
    if (has) {
      if (redir === "<<" || redir === "<<-") { const h = { delim: cur, strip: redir === "<<-", quoted, shell: null, body: null }; heredocs.push(h); segDocs.push(h); }
      else if (redir && redir.startsWith("<<<")) herestrings.push(cur);
      else if (redir) {
        redirs.push(cur, raw);
        // 1.25.1: an OUTPUT redirection's target (> >> >| &> 2> *> <>) is written; `2>&1` / `>&-` duplicate or close a descriptor
        if (redir.includes(">")) { if (!(/&$/.test(redir) && /^(?:\d+|-)?$/.test(cur))) writes.push(cur, raw); }
        else stdinRedir = true; // `< file`: the command reads its stdin from a file
      }
      else { words.push(cur); raws.push(raw); }
      redir = null;
    }
    cur = ""; raw = ""; has = false; quoted = false;
  };
  const endSeg = () => {
    endWord();
    redir = null;
    if (words.length || redirs.length || herestrings.length) {
      const seg = words;
      seg.raw = raws;
      seg.redirs = redirs;
      seg.herestrings = herestrings;
      const sh = segDocs.length || herestrings.length ? stdinShellMode(words, raws) : null;
      for (const h of segDocs) h.shell = sh;
      seg.stdinShell = sh;
      // 1.25.1 (review 7): what the reader of writes and of fed scripts needs — the output redirections' targets, the heredocs (their
      // bodies once read), the process substitutions <( … ) / >( … ) among the words, a `< file` stdin, and the command a `|` feeds in
      seg.writes = writes;
      seg.docs = segDocs;
      seg.procs = procs;
      seg.stdinRedir = stdinRedir;
      seg.pipeFrom = pipeIn;
      pipeIn = null;
      lastSeg = seg;
      segs.push(seg);
    }
    words = []; raws = []; redirs = []; herestrings = []; segDocs = []; writes = []; procs = []; stdinRedir = false;
    return segs.length ? segs[segs.length - 1] : null;
  };
  // A `$(` whose text starts at `from` → its nested command list; returns the index of its `)` (or the end), -1 past the depth bound.
  const subst = (from) => (depth < APPROVAL_LEX_DEPTH ? shellLexList(s, from, mode, segs, true, depth + 1) : -1);
  // A Bash `…` substitution opening at s[at] → the index of its closing backtick (or the end); its body is lexed as a script.
  const backtick = (at) => {
    if (depth >= APPROVAL_LEX_DEPTH) return -1;
    let k = at + 1;
    while (k < s.length && s[k] !== "`") k += s[k] === "\\" ? 2 : 1;
    k = Math.min(k, s.length);
    shellLexList(s.slice(at + 1, k), 0, mode, segs, false, depth + 1);
    return k;
  };
  // After a newline: the pending heredoc bodies, in order → the index where the command text resumes.
  const heredocBodies = (pos) => {
    for (const h of heredocs.splice(0)) {
      let p = pos, end = s.length, next = s.length;
      while (p < s.length) {
        let e = s.indexOf("\n", p);
        if (e < 0) e = s.length;
        let line = s.slice(p, e);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if ((h.strip ? line.replace(/^\t+/, "") : line) === h.delim) { end = p; next = Math.min(e + 1, s.length); break; }
        p = e + 1;
      }
      h.body = s.slice(pos, end); // 1.25.1: kept — `cat <<'EOF' | bash` feeds it to a shell
      if (depth < APPROVAL_LEX_DEPTH && end > pos) {
        const body = h.body;
        if (h.shell) shellLexList(body, 0, h.shell, segs, false, depth + 1); // `bash <<'EOF'`: the body IS the script
        else if (!h.quoted) shellSubstitutionsIn(body, "bash", segs, depth + 1); // unquoted: its $( ) / `…` run
      }
      pos = next;
    }
    return pos;
  };
  let i = start;
  for (; i < s.length; i++) {
    const c = s[i], n = s[i + 1];
    if (c === "'" && !cmdm) { // single quotes: literal ('' is a quote in PowerShell)
      quoted = true; has = true;
      let j = i + 1;
      for (; j < s.length; j++) {
        if (s[j] === "'") { if (ps && s[j + 1] === "'") { add("'"); j++; continue; } break; }
        add(s[j]);
      }
      i = j;
      continue;
    }
    if (bash && c === "$" && n === "'") { // $'…' ANSI-C
      quoted = true; has = true;
      let j = i + 2;
      while (j < s.length && s[j] !== "'") {
        if (s[j] === "\\") { const e = ansiCEscape(s, j + 1); add(e.text); j = Math.max(e.end, j + 1); }
        else add(s[j++]);
      }
      i = j;
      continue;
    }
    if (c === '"' || (bash && c === "$" && n === '"')) { // double quotes ($"…" is Bash's locale string)
      quoted = true; has = true;
      let j = c === "$" ? i + 2 : i + 1;
      for (; j < s.length; j++) {
        const d = s[j];
        if (d === '"') { if (ps && s[j + 1] === '"') { add('"'); j++; continue; } break; }
        if (bash && d === "\\") {
          if (s[j + 1] === "\n") { j++; continue; }
          if (s[j + 1] === "\r" && s[j + 2] === "\n") { j += 2; continue; }
          if (j + 1 < s.length && "\"\\$`".includes(s[j + 1])) { add(s[++j]); continue; }
        }
        if (ps && d === "`" && j + 1 < s.length) { j++; add(own(PS_ESCAPES, s[j]) ? PS_ESCAPES[s[j]] : s[j]); continue; }
        if (!cmdm && d === "$" && s[j + 1] === "(") { const e = subst(j + 2); if (e >= 0) { j = e; continue; } }
        if (bash && d === "`") { const e = backtick(j); if (e >= 0) { j = e; continue; } }
        add(d);
      }
      i = j;
      continue;
    }
    if (bash && c === "\\") { // \x is x (raw keeps the backslash), \⏎ continues the line
      if (n === "\n") { i++; continue; }
      if (n === "\r" && s[i + 2] === "\n") { i += 2; continue; }
      if (n !== undefined) { add(n, "\\" + n); quoted = true; i++; continue; }
      add("\\");
      continue;
    }
    if ((ps && c === "`") || (cmdm && c === "^")) { // PowerShell's / cmd.exe's escape character
      if (n === "\n") { i++; continue; }
      if (n === "\r" && s[i + 2] === "\n") { i += 2; continue; }
      if (n !== undefined) { add(n); i++; }
      continue;
    }
    if (bash && c === "$" && n === "{") { // ${…}: part of the word ({ } are no separators inside it)
      let k = i + 2, lvl = 1;
      for (; k < s.length && lvl; k++) { if (s[k] === "{") lvl++; else if (s[k] === "}") lvl--; }
      const body = s.slice(i, k);
      add(body);
      if (/\$\(|`/.test(body) && depth < APPROVAL_LEX_DEPTH) shellSubstitutionsIn(body.slice(2), "bash", segs, depth + 1);
      i = k - 1;
      continue;
    }
    if (!cmdm && c === "$" && n === "(") { // $( … ): a command of its own; its output is part of this word
      const e = subst(i + 2);
      if (e >= 0) { has = true; i = e; continue; }
      endSeg(); paren++; i++;
      continue;
    }
    if (bash && c === "`") {
      const e = backtick(i);
      if (e >= 0) { has = true; i = e; continue; }
      endSeg();
      continue;
    }
    if (ps && c === "@" && (n === "'" || n === '"')) { // @'…'@ / @"…"@ here-string: data (a @"…"@ runs its $( ))
      const m = /^[ \t]*\r?\n/.exec(s.slice(i + 2, i + 66));
      if (m) {
        const bodyStart = i + 2 + m[0].length;
        const k = s.indexOf("\n" + n + "@", bodyStart - 1);
        const bodyEnd = k < 0 ? s.length : k;
        if (n === '"' && depth < APPROVAL_LEX_DEPTH && bodyEnd > bodyStart) shellSubstitutionsIn(s.slice(bodyStart, bodyEnd), "ps", segs, depth + 1);
        quoted = true; has = true;
        i = k < 0 ? s.length : k + 2;
        continue;
      }
    }
    if (ps && c === "<" && n === "#") { // <# … #> block comment
      endWord();
      const k = s.indexOf("#>", i + 2);
      i = (k < 0 ? s.length : k + 2) - 1;
      continue;
    }
    if (ps && c === "-" && !has && n === "-" && s[i + 2] === "%" && (i + 3 >= s.length || " \t\r\n|".includes(s[i + 3]))) {
      // 1.24 review 6 (C1): PowerShell's stop-parsing token. The rest of the line — to a newline or a `|` outside "…" — goes to the
      // program as it is written: split at blanks, "…" grouping (the quotes dropped); ' ; $ ( ` are plain characters there. The
      // token itself is PowerShell's, never an argument (`node <cli> --% approve …` runs `approve`).
      let j = i + 3, w = "", any = false, inQ = false;
      const flush = () => { if (any) { words.push(w); raws.push(w); } w = ""; any = false; };
      for (; j < s.length; j++) {
        const d = s[j];
        if (d === "\n" || (d === "\r" && s[j + 1] === "\n") || (d === "|" && !inQ)) break;
        if (d === '"') { inQ = !inQ; any = true; continue; }
        if ((d === " " || d === "\t") && !inQ) { flush(); continue; }
        w += d; any = true;
      }
      flush();
      i = j - 1;
      continue;
    }
    if (!cmdm && c === "#" && !has) { // a comment runs to the end of the line
      const k = s.indexOf("\n", i);
      i = (k < 0 ? s.length : k) - 1;
      continue;
    }
    if (c === "\n" || c === "\r") {
      endSeg();
      if (c === "\n" && heredocs.length) i = heredocBodies(i + 1) - 1;
      continue;
    }
    if (c === " " || c === "\t") { endWord(); continue; }
    if (bash && c === "&" && n === ">") continue; // &> / &>>: the redirection below
    if (bash && (c === "<" || c === ">") && n === "(") { // <( … ) / >( … ): a process substitution
      // 1.25.1 (review 7): its commands are read as a nested list (they run), and the seg keeps its text — `bash <(echo '…')`,
      // `source <(…)` run that text as a script. It stands as a word ("") or as a redirection's target (`bash < <(…)`).
      const at = redir ? -1 : (endWord(), words.length);
      const e = subst(i + 2);
      if (e < 0) { endWord(); continue; }
      procs.push({ at, text: s.slice(i + 2, e), out: c === ">", stdin: !!redir && !redir.includes(">") });
      has = true; i = e;
      continue;
    }
    if (bash && c === "<" && n === "<" && s[i + 2] !== "<" && arith && paren >= arith) { add("<<"); i++; continue; } // (( 1 << 2 )): a shift, no heredoc
    if (c === "<" || c === ">") { // a redirection: its target is no word of the command
      let op = "";
      if (has && !quoted && (ps ? /^(?:\d+|\*)$/ : /^\d+$/).test(cur)) { op = cur; cur = ""; raw = ""; has = false; } else endWord();
      let k;
      if (c === "<" && n === "<" && s[i + 2] === "<") { op += "<<<"; k = i + 3; }
      else if (bash && c === "<" && n === "<") { op = s[i + 2] === "-" ? "<<-" : "<<"; k = i + op.length; }
      else {
        op += c;
        k = i + 1;
        if (c === "<" && s[k] === ">") { op += ">"; k++; } // <> opens the file for reading AND writing (1.25.1)
        else if (s[k] === c) { op += c; k++; }
        else if (c === ">" && s[k] === "|") { op += "|"; k++; }
        if (s[k] === "&") { op += "&"; k++; }
      }
      redir = op;
      i = k - 1;
      continue;
    }
    if (c === "(") {
      // 1.25.1 (review 7): a simple command ended by `(` — its next one is a ( … ) argument list (PowerShell: `New-Object X('…')`)
      const had = words.length > 0 || has;
      const sg = endSeg();
      if (had && sg) sg.openParen = true;
      paren++; if (n === "(" && !arith) arith = paren + 1;
      continue;
    }
    if (c === ")") {
      if (inSub && paren === 0) { endSeg(); return i; }
      endSeg();
      if (paren) paren--;
      if (paren < arith) arith = 0;
      continue;
    }
    // 1.25.1 (review 7): in Bash `{` / `}` are reserved words only standing alone (`{ cmd; }`); inside a word they are brace expansion
    // (`{approve,}`, `{.specs,x}/roadmap.json`, find's `{}`) — the word keeps them (it was cut there: `{approve,} …` read as no CLI call).
    if (bash && (c === "{" || c === "}") && (has || (n !== undefined && !/[\s;&|)]/.test(n)))) { add(c); continue; }
    if (c === "|") { // a pipe feeds the next simple command (`||` is no pipe; `|&` pipes stderr too)
      endSeg();
      if (n === "|") { i++; pipeIn = null; continue; }
      if (bash && n === "&") i++;
      pipeIn = lastSeg;
      continue;
    }
    if (";&{}".includes(c)) { endSeg(); if (c === ";" || c === "&") pipeIn = null; continue; }
    add(c);
  }
  endSeg();
  return s.length;
}
// The $( … ) / `…` substitutions inside data that a shell still expands (an unquoted heredoc body, a PowerShell @"…"@ here-string,
// a ${…} expansion) → their commands, pushed into segs. Everything else in it is text.
function shellSubstitutionsIn(t, mode, segs, depth) {
  if (depth >= APPROVAL_LEX_DEPTH) return;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if ((mode === "bash" && c === "\\") || (mode === "ps" && c === "`")) { i++; continue; }
    if (c === "$" && t[i + 1] === "(") { i = shellLexList(t, i + 2, mode, segs, true, depth + 1); continue; }
    if (mode === "bash" && c === "`") {
      let k = i + 1;
      while (k < t.length && t[k] !== "`") k += t[k] === "\\" ? 2 : 1;
      k = Math.min(k, t.length);
      shellLexList(t.slice(i + 1, k), 0, mode, segs, false, depth + 1);
      i = k;
    }
  }
}
const approvalProgram = (w) => (RE_COMSPEC_WORD.test(w) ? "cmd" : w.replace(/^.*[\\/]/, "").toLowerCase().replace(/\.exe$/, ""));
// The index of the CLI's script in a simple command, when it is the program run (after launchers / env assignments / options) —
// never an argument of another program (`echo dev-spec approve x`, `git commit -m "…"`): -1.
function devSpecWordAt(words, raw) {
  const k = programAt(words, raw);
  return k >= 0 && (isDevSpecWord(words[k]) || isDevSpecWord((raw && raw[k]) || "")) ? k : -1;
}
// 1.24 review 6 (C5, C2) — a path as the file system reads it, for the guarded-file tests: a writer's option prefix (of=, -Path:,
// -Destination:) dropped, an NTFS stream suffix and Git Bash's /c/ read as Windows reads them (guardTargetPath), `\` as `/`, the
// `.` / `..` segments folded (`.specs/./roadmap.json`, `.specs/alpha/../roadmap.json` — written through, read past the guard).
function approvalPathText(w) {
  const s = guardTargetPath(String(w).replace(/^(?:of=|-(?:path|literalpath|filepath|destination)[:=])/i, "")).replace(/\\/g, "/");
  if (!s) return s;
  const n = path.posix.normalize(s);
  return n === "." ? "" : n;
}
// The files the approval guard stands on → { setting, feature? } | null for a path: .specs/roadmap.json ("roadmap": the guard and the
// project's gates), a feature's .state.json ("state": its approvals, evidence, history) and (1.24 review 6, C6) a harness-observed run
// log ("observed": .specs/<f>/.execution/observed.jsonl, or the project's .specs/.execution/observed.jsonl — feature null).
function approvalGuardedFile(p) {
  const t = approvalPathText(p);
  if (!t) return null;
  if (RE_ROADMAP_FILE.test(t)) return { setting: "roadmap" };
  if (RE_OBSERVED_FILE.test(t)) {
    const segs = t.split("/");
    const f = segs[segs.length - 3];
    return { setting: "observed", feature: f && f.toLowerCase() !== ".specs" ? f : null };
  }
  if (RE_STATE_FILE.test(t)) { const segs = t.split("/"); return { setting: "state", feature: segs[segs.length - 2] || null }; }
  return null;
}
// A folder a whole-folder writer (git checkout / restore -- <dir>) rewrites: .specs/ itself (roadmap.json with it) or a feature's
// folder (its .state.json) → { setting, feature? } | null. Files (an extension: ROADMAP.md, roadmap.json) and dot folders aren't one.
function approvalGuardedDir(p) {
  const t = approvalPathText(p);
  if (RE_SPECS_DIR.test(t)) return { setting: "roadmap" };
  const m = /(?:^|\/)\.specs\/([^/]+)\/?$/i.exec(t);
  return m && !/^\./.test(m[1]) && !/\.(?:md|json|jsonl|html?|ya?ml|txt)$/i.test(m[1]) ? { setting: "state", feature: m[1] } : null;
}
// git's subcommands that rewrite files of the work tree they name (1.24 review 6, C2: `git checkout HEAD~1 -- .specs/roadmap.json`
// brought back an older roadmap.json — approvalGuard off): checkout / restore (unless --staged alone: the index only) / merge-file
// (its first file, unless -p) / rm (unless --cached) / mv. → the words they write. Read-only git (diff, log, show, add, commit…), and
// the forms whose files can't be known from the command (apply, stash pop, reset --hard, a branch switch), name nothing.
const GIT_VALUE_OPTIONS = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--exec-path", "--super-prefix", "--config-env"]);
function gitWriteTargets(words, k) {
  let i = k + 1;
  while (i < words.length && words[i].startsWith("-")) { if (GIT_VALUE_OPTIONS.has(words[i])) i++; i++; }
  const sub = String(words[i] || "").toLowerCase();
  const args = words.slice(i + 1);
  const has = (...xs) => args.some((a) => xs.some((x) => a === x || a.startsWith(x + "=")));
  // the non-option words (`--` ends the options; the options in `vals` take the next word)
  const plain = (vals) => {
    const r = [];
    for (let j = 0, dd = false; j < args.length; j++) {
      const a = args[j];
      if (dd) { r.push(a); continue; }
      if (a === "--") { dd = true; continue; }
      if (a.startsWith("-")) { if (vals.includes(a)) j++; continue; }
      r.push(a);
    }
    return r;
  };
  if (sub === "checkout") return plain(["-b", "-B", "--orphan", "--conflict", "--pathspec-from-file"]);
  if (sub === "restore") return has("--staged", "-S") && !has("--worktree", "-W") ? [] : plain(["-s", "--source", "--pathspec-from-file"]);
  if (sub === "merge-file") return has("-p", "--stdout") ? [] : plain(["-L"]).slice(0, 1);
  if (sub === "rm") return has("--cached") ? [] : plain(["--pathspec-from-file"]);
  if (sub === "mv") return plain([]);
  // 1.25.1 (review 7): `git clean -fdx .specs` deletes the untracked files it names (unless -n / --dry-run); `git stash push -- .specs`
  // puts them back to HEAD (a pathspec — the other stash forms name no file: a known limit)
  if (sub === "clean") return has("-n", "--dry-run") || args.some((a) => /^-[A-Za-z]*n/.test(a) && !a.startsWith("--")) ? [] : plain(["-e", "--exclude"]);
  if (sub === "stash" && /^(?:push|save|-)/.test(String(args[0] || "-"))) return plain(["-m", "--message", "--pathspec-from-file"]).filter((a) => a !== "push" && a !== "save");
  return [];
}
// A simple command that writes a file the approval guard stands on → its guard-down actions ([] = none): .specs/roadmap.json (R1:
// where the approval guard lives) and (1.24 review 6) a feature's .state.json and a harness-observed log — a redirection to it (> >>
// >| &> 2> *>), a writer naming it (tee, Set-Content, Out-File, Add-Content, rm / Remove-Item, mv / Move-Item / ren, truncate, dd
// of=…), sed / perl -i on it, cp / Copy-Item / ln / install onto it (the last path, a -Destination / -t value, or a folder receiving
// a file of that name), deleting or moving .specs/ away (roadmap.json with it), and git's in-place writers (gitWriteTargets). Reading
// it (cat, jq, git show, cp FROM it) is no write. The paths are read as the file system reads them (approvalPathText).
// 1.25.1 (review 7): read ONCE for both guards (shellSegOps → shellOpActions here; shellOpPaths for the edit guard's code files) — and
// beyond the exact paths: a target that is a glob, a brace expansion or a variable (`.specs/road*.json`, `.spec?/…`, `{.specs,x}/…`,
// `D=.specs; cp t $D/roadmap.json`), a remover / mover on a folder or glob under .specs/ (`rm -rf .specs/<feature>`, `rm -rf .specs/*`,
// `find .specs … -delete`, `git clean … .specs`), the extractors and copiers into .specs/ (rsync, tar -C, unzip -d, robocopy, xcopy, cp
// -r), the editors and downloaders (ed, ex, vim, awk -i inplace, curl -o, wget -O, sponge…), a link to .specs/ (ln -s, mklink, New-Item
// -ItemType Junction…), PowerShell's file cmdlets by their parameters and the [IO.File] methods, a target fed by a pipe (`gci .specs
// -Filter roadmap.json | Remove-Item`, `find … | xargs rm`), and — fail closed — a program the guard doesn't know run on .specs/,
// roadmap.json or a .state.json (`unreadable`, why "specs-arg": ask). ctx: { vars (assigned earlier in the command), cwd (an earlier cd) }.
function specsWriteActions(words, raw, ctx, mode, nextSeg) {
  const m = mode === "ps" || mode === "cmd" ? mode : "bash";
  const out = [];
  for (const o of shellSegOps(words, raw || words, m, nextSeg)) out.push(...shellOpActions(o, m, ctx));
  const seen = new Set();
  return out.filter((a) => { const key = JSON.stringify(a); return !seen.has(key) && seen.add(key); });
}

// --- the shell's file operations (1.25.1, review 7) ---------------------------------------------------------------------------
const SHELL_VAR = "\u0001"; // in a path: a variable left unresolved ($X, ${X}, $env:X, %X%) — it may hold anything but is never read as .specs
const SHELL_ANY = "\u0002"; // in a path: any chain of folders, dot folders included (find descends into .specs/, a recursive listing)
const GUARDED_NAMES = ["roadmap.json", ".state.json", "observed.jsonl"];
const RE_SHELL_WILD = /[*?[\u0001\u0002]/;
// A path word with the variables the same command assigned put in (`D=.specs; … $D/roadmap.json`), any other one marked SHELL_VAR.
function shellVarText(w, vars) {
  return String(w).replace(/\$\{(?:env:)?([A-Za-z_]\w*)\}|\$\{[^{}]*\}|\$(?:env:)?([A-Za-z_]\w*)|\$[0-9@*#?$!]|%([A-Za-z_]\w*)%/gi, (m, a, b, c) => {
    const k = String(a || b || c || "").toLowerCase();
    return k && vars && own(vars, k) ? vars[k] : SHELL_VAR;
  });
}
// Bash's brace expansion of a word (`{.specs,x}/roadmap.json`, `roadmap.json{,}`, `appro{v,}e`) → its words (at most `cap`); a group
// without a comma — or after a `$` — stays as it is.
function braceExpand(s, cap = 32) {
  let depth = 0, open = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "{" && s[i - 1] !== "$") { if (depth++ === 0) open = i; }
    else if (c === "}" && depth && --depth === 0) {
      const body = s.slice(open + 1, i), parts = [];
      for (let j = 0, d = 0, from = 0; j <= body.length; j++) {
        if (j === body.length || (body[j] === "," && d === 0)) { parts.push(body.slice(from, j)); from = j + 1; }
        else if (body[j] === "{") d++;
        else if (body[j] === "}" && d) d--;
      }
      if (parts.length < 2) continue;
      const out = [];
      for (const part of parts) for (const e of braceExpand(s.slice(0, open) + part + s.slice(i + 1), cap)) { if (out.length >= cap) return out; out.push(e); }
      return out;
    }
  }
  return [s];
}
// One path segment read as a glob → a RegExp (case folded — a superset where the file system keeps case), or null. Bash (dotglob
// off): a leading * ? [ never matches a dot; PowerShell / cmd.exe wildcards do. SHELL_VAR / SHELL_ANY match anything.
function shellGlobRe(seg, mode) {
  let re = "";
  for (let i = 0; i < seg.length; i++) {
    const c = seg[i];
    if (c === "*" || c === SHELL_VAR || c === SHELL_ANY) re += "[\\s\\S]*";
    else if (c === "?") re += "[\\s\\S]";
    else if (c === "[") {
      const end = seg.indexOf("]", i + 2);
      if (end < 0) { re += "\\["; continue; }
      re += "[" + seg.slice(i + 1, end).replace(/^[!^]/, "^").replace(/[\\\]]/g, "\\$&") + "]";
      i = end;
    } else re += c.replace(/[.+^${}()|\\]/g, "\\$&");
  }
  const lead = mode === "bash" && /^[*?[]/.test(seg) ? "(?!\\.)" : "";
  try { return new RegExp("^" + lead + re + "$", "i"); } catch { return null; }
}
// May the segment be `name`? A plain one equals it (case folded); a glob may match it; a variable never stands for .specs (varOk false).
function shellSegCould(seg, name, mode, varOk) {
  if (!RE_SHELL_WILD.test(seg)) return seg.toLowerCase() === name;
  if (!varOk && seg.includes(SHELL_VAR)) return false;
  const re = shellGlobRe(seg, mode);
  return !!re && re.test(name);
}
// A path (its variables already put in) → what it may name: { text, wild, specs (the first segment that is or may be .specs, else -1),
// dir (it is — or may be — .specs itself), guarded (approvalGuardedFile: an exact path), may (it may be roadmap.json, a .state.json or an
// observed log there), name (its last segment may be one of those names, wherever it lies), folder (it may be a folder: no extension),
// execution (inside an .execution/ folder), lock (a lock file) }.
function shellPathFacts(t0, mode) {
  const t = approvalPathText(t0);
  const segs = t.split("/").filter(Boolean);
  const n = segs.length;
  const wild = RE_SHELL_WILD.test(t);
  let specs = -1;
  for (let i = 0; i < n && specs < 0; i++) if (shellSegCould(segs[i], ".specs", mode, false)) specs = i;
  const last = n ? segs[n - 1] : "";
  const could = (name) => shellSegCould(last, name, mode, true);
  const guarded = wild ? null : approvalGuardedFile(t);
  const may = !!guarded || (wild && specs >= 0 && ((specs === n - 2 && could("roadmap.json")) || (specs < n - 1 && could(".state.json")) ||
    (specs < n - 2 && shellSegCould(segs[n - 2], ".execution", mode, true) && could("observed.jsonl")))) ||
    // a guarded name in a folder an unknown variable names (`$DIR/roadmap.json`, `$F/.state.json`): it may be there — fail closed
    (n >= 2 && !RE_SHELL_WILD.test(last) && segs.slice(0, -1).some((s) => s.includes(SHELL_VAR)) && GUARDED_NAMES.includes(last.toLowerCase()));
  const tail = wild ? last.replace(/^[\s\S]*[*?\]\u0001\u0002]/, "") : last;
  return { text: t, wild, specs, dir: specs >= 0 && specs === n - 1, guarded, may, name: GUARDED_NAMES.some(could),
    folder: wild ? !/\.[A-Za-z0-9]{1,10}$/.test(tail) : !/^[^.][\s\S]*\.[A-Za-z0-9]{1,10}$/.test(last),
    execution: specs >= 0 && segs.slice(specs + 1).some((s) => s.toLowerCase() === ".execution"), lock: !wild && /\.lock$/i.test(last) };
}
// A path word → its readings: each brace expansion (Bash), as written and — after a `cd` earlier in the same command — under that folder.
function shellPathReadings(w, mode, ctx) {
  const t = shellVarText(w, ctx && ctx.vars);
  const out = [];
  for (const a of mode === "bash" ? braceExpand(t) : [t]) {
    out.push(shellPathFacts(a, mode));
    if (ctx && ctx.cwd && !/^(?:[\\/~]|[A-Za-z]:|\u0001)/.test(a)) out.push(shellPathFacts(ctx.cwd + "/" + a, mode));
  }
  return out;
}
// The operands of a POSIX-style command from words[from] → { pos: [indices], val: {option: {i} | {text}}, flags: [words] }: `--` ends the
// options, `--x=v` carries its value, an option in `takes` takes the next word; `slash` (cmd.exe, robocopy, xcopy): `/x` is an option.
function shellOperands(words, from, takes, slash) {
  const pos = [], val = Object.create(null), flags = [];
  for (let i = from, dd = false; i < words.length; i++) {
    const w = words[i];
    const opt = !dd && w.length > 1 && (w[0] === "-" || (slash && /^\/(?:[A-Za-z?]{1,3}|[A-Z]{2,})(?::\S*)?$/.test(w)));
    if (!opt) { pos.push(i); continue; }
    if (w === "--") { dd = true; continue; }
    const eq = /^(--?[A-Za-z][\w-]*)=([\s\S]*)$/.exec(w);
    if (eq) { val[eq[1]] = { text: eq[2] }; continue; }
    flags.push(w);
    if (takes && takes.has(w) && i + 1 < words.length) val[w] = { i: ++i };
  }
  return { pos, val, flags };
}
const shellTakes = (list) => new Set(list.split(" "));
const SHELL_TAKES = {
  cp: shellTakes("-t --target-directory -S --suffix"), mv: shellTakes("-t --target-directory -S --suffix"), ln: shellTakes("-t --target-directory -S --suffix"),
  install: shellTakes("-t --target-directory -S --suffix -m --mode -o --owner -g --group"), scp: shellTakes("-P -i -o -F -c -l -S -J"),
  rsync: shellTakes("-e --rsh --rsync-path --exclude --include --filter -f --exclude-from --include-from --files-from --log-file --partial-dir --temp-dir -T --backup-dir --suffix --chmod --chown --link-dest --compare-dest --copy-dest -B --block-size --max-size --min-size --timeout --port --password-file --out-format --iconv --bwlimit --info --debug -M --remote-option"),
  truncate: shellTakes("-s --size -r --reference"), shred: shellTakes("-n --iterations -s --size --random-source"),
  sed: shellTakes("-e -f --expression --file -l --line-length"), perl: shellTakes("-e -E -I -M -m"), ruby: shellTakes("-e -r -I -C -E"),
  awk: shellTakes("-f -v -F -i -e -l -E --include --source --load --file --assign --field-separator"),
  editor: shellTakes("-c --cmd -S -u -U -i -T -w -W -t -q"), unzip: shellTakes("-d -P -I -O"), zip: shellTakes("-b -n -t -tt -x -i -O --out"),
  patch: shellTakes("-p -i --input -o --output -d --directory -r --reject-file -B --prefix -D --ifdef -F --fuzz -V -z --suffix -Y --basename-prefix"),
  uniq: shellTakes("-f -s -w --skip-fields --skip-chars --check-chars"), mount: shellTakes("-o -t -L -U"),
};
// PowerShell: the aliases of the file cmdlets (in the PowerShell tool, `rm` IS Remove-Item), and the switch parameters among the ones
// they take (any other parameter takes the next word).
const PS_FILE_ALIASES = { rm: "remove-item", del: "remove-item", erase: "remove-item", rd: "remove-item", rmdir: "remove-item", ri: "remove-item",
  cp: "copy-item", copy: "copy-item", cpi: "copy-item", mv: "move-item", move: "move-item", mi: "move-item", ren: "rename-item", rni: "rename-item",
  ni: "new-item", sc: "set-content", ac: "add-content", clc: "clear-content", tee: "tee-object", epcsv: "export-csv" };
const PS_FILE_CMDLETS = new Set(["remove-item", "copy-item", "move-item", "rename-item", "new-item", "set-content", "add-content", "clear-content",
  "out-file", "tee-object", "export-csv", "export-clixml", "expand-archive"]);
const PS_SWITCHES = new Set(["recurse", "force", "confirm", "whatif", "passthru", "nonewline", "append", "noclobber", "container", "asbytestream",
  "verbose", "debug", "usetransaction", "wait", "r", "fo"]);
// A PowerShell command's parameters from words[from] → { named: {name: {i} | {text} | {sw} | {missing}}, pos: [indices] }. `-Name:value`
// carries its value; a parameter whose value is a ( … ) expression ends the lexer's simple command (missing).
function psParams(words, from) {
  const named = Object.create(null), pos = [];
  for (let i = from; i < words.length; i++) {
    const m = /^-([A-Za-z][\w-]*)(?::([\s\S]*))?$/.exec(words[i]);
    if (!m) { pos.push(i); continue; }
    const n = m[1].toLowerCase();
    const isSwitch = PS_SWITCHES.has(n) || (n.length >= 3 && [...PS_SWITCHES].some((s) => s.startsWith(n)));
    if (m[2]) named[n] = { text: m[2] };
    else if (isSwitch && m[2] === undefined) named[n] = { sw: true };
    else if (i + 1 < words.length && /^-[A-Za-z]/.test(words[i + 1])) named[n] = { sw: true }; // followed by another parameter
    else named[n] = i + 1 < words.length ? { i: ++i } : { missing: true };
  }
  return { named, pos };
}
const RE_NET_FILE = /^\[(?:system\.)?io\.(file|directory)\]::(\w+)$/i;
// find's options that take the next word (its producer side: `find .specs -maxdepth 1 -name roadmap.json`), Get-ChildItem's too.
const RE_FIND_VALUE = /^-(?:maxdepth|mindepth|type|newer|anewer|cnewer|size|[acm]time|[acm]min|user|group|uid|gid|perm|regextype|printf|fstype|links|inum|samefile|depth|exclude|attributes|d)$/i;
const RE_NAME_FILTER = /^-(?:i?name|i?path|i?wholename|i?regex|filter|include|fi|inc)$/i;
// The paths a command lists (the producer of a pipe — `find .specs -name roadmap.json`, `gci .specs -Filter roadmap.json`, `echo …`):
// each named folder, with a name filter below it (directly and deeper — SHELL_ANY).
function shellProducedPaths(seg) {
  const words = seg, raw = seg.raw || seg;
  const k = programAt(words, raw);
  if (k < 0) return [];
  const paths = [], filters = [];
  for (let i = k + 1; i < words.length; i++) {
    const w = words[i];
    if (RE_NAME_FILTER.test(w) && i + 1 < words.length) { filters.push(words[++i]); continue; }
    if (/^-(?:path|literalpath|lp)$/i.test(w) && i + 1 < words.length) { paths.push(words[++i]); continue; }
    if (/^[-(!)]/.test(w)) { if (RE_FIND_VALUE.test(w)) i++; continue; }
    paths.push(w);
  }
  if (!paths.length) paths.push(".");
  return paths.flatMap((p) => (filters.length ? filters.flatMap((f) => [p + "/" + f, p + "/" + SHELL_ANY + "/" + f]) : [p]));
}
// A simple command → its file operations: [{ op, paths: [[cooked, raw]], sources?, recursive?, archive?, kind?, producer? }] — op: write
// (its content), replace (removed or replaced as a whole: rm, a move's source, an extracted member, git's restores — op git), into (a
// folder receiving files: the sources, or everything — archive), link (the target a link is made to), piped (the targets come from the
// pipe: kind write | replace), unknown (an argument of a program the guard doesn't know). nextSeg: the lexer's next simple command (a
// PowerShell ( … ) argument — `-Destination (Join-Path .specs roadmap.json)`, `[IO.File]::WriteAllText('…', …)`).
function shellSegOps(words, raw, mode, nextSeg) {
  const ops = [];
  const pair = (i) => [words[i], (raw && raw[i]) || words[i]];
  const vpair = (v) => (!v ? null : v.i !== undefined ? pair(v.i) : v.text !== undefined ? [v.text, v.text] : null);
  const W = words.writes || [];
  for (let i = 0; i < W.length; i += 2) ops.push({ op: "write", paths: [[W[i], W[i + 1]]] });
  const net = mode === "ps" ? words.findIndex((w) => RE_NET_FILE.test(w)) : -1;
  if (net >= 0) return ops.concat(netFileOps(RE_NET_FILE.exec(words[net]), nextSeg));
  const k = programAt(words, raw);
  if (k < 0) return ops;
  let p = approvalProgram(words[k]);
  if (mode === "ps" && own(PS_FILE_ALIASES, p)) p = PS_FILE_ALIASES[p];
  const xargs = words.slice(0, k).some((w) => /^(?:xargs|parallel)$/.test(approvalProgram(w)));
  const piped = (kind) => { if (words.pipeFrom) ops.push({ op: "piped", kind, producer: words.pipeFrom }); };
  const posOf = (o) => o.pos.filter((i) => !(xargs && /^(?:\{\}|%|@)$/.test(words[i])));
  const slash = mode !== "bash";
  if (PS_FILE_CMDLETS.has(p)) return ops.concat(psFileOps(p, words, raw, k, nextSeg, piped));
  if (p === "dd") { for (let i = k + 1; i < words.length; i++) if (/^of=/i.test(words[i])) ops.push({ op: "write", paths: [pair(i)] }); return ops; }
  if (["tee", "truncate", "shred", "sponge", "dos2unix", "unix2dos"].includes(p)) {
    const pos = posOf(shellOperands(words, k + 1, SHELL_TAKES[p]));
    if (pos.length) ops.push({ op: "write", paths: pos.map(pair) }); else if (xargs) piped("write");
    return ops;
  }
  if (["rm", "unlink", "rmdir", "del", "erase", "rd"].includes(p)) {
    const pos = posOf(shellOperands(words, k + 1, null, slash));
    if (pos.length) ops.push({ op: "replace", paths: pos.map(pair) }); else if (xargs) piped("replace");
    return ops;
  }
  if (["mv", "move", "cp", "install", "scp", "copy", "ln"].includes(p)) {
    const o = shellOperands(words, k + 1, SHELL_TAKES[p === "move" ? "mv" : p === "copy" ? "cp" : p], slash);
    const t = o.val["-t"] || o.val["--target-directory"];
    const pos = posOf(o);
    const dest = t ? vpair(t) : pos.length > 1 ? pair(pos[pos.length - 1]) : null;
    const src = (t || pos.length < 2 ? pos : pos.slice(0, -1)).map(pair);
    const recursive = p === "mv" || p === "move" || o.flags.some((f) => /^-[A-Za-z]*[rRa]/.test(f) && !f.startsWith("--")) || o.flags.some((f) => /^--(?:recursive|archive)$/.test(f));
    if (p === "ln") { if (src.length) ops.push({ op: "link", paths: src }); }
    else if ((p === "mv" || p === "move") && src.length) ops.push({ op: "replace", paths: src });
    if (dest) ops.push({ op: "write", paths: [dest] }, { op: "into", paths: [dest], sources: src, recursive });
    else if (!pos.length && xargs && p !== "ln") piped(p === "mv" || p === "move" ? "replace" : "write");
    return ops;
  }
  if (p === "ren" || p === "rename") {
    const pos = shellOperands(words, k + 1, null, slash).pos;
    if (mode === "cmd" && pos.length >= 2) {
      const dir = words[pos[0]].replace(/[^\\/]*$/, ""), rdir = pair(pos[0])[1].replace(/[^\\/]*$/, "");
      ops.push({ op: "replace", paths: [pair(pos[0])] }, { op: "write", paths: [[dir + words[pos[1]], rdir + words[pos[1]]]] });
    } else if (pos.length) ops.push({ op: "replace", paths: pos.map(pair) }); // rename <expression | from to> <files…>: superset
    return ops;
  }
  if (p === "rsync" || p === "xcopy" || p === "robocopy") {
    const o = shellOperands(words, k + 1, SHELL_TAKES.rsync, p !== "rsync");
    if (p === "rsync" && o.pos.length > 1) {
      const dest = pair(o.pos[o.pos.length - 1]);
      ops.push({ op: "write", paths: [dest] }, { op: "into", paths: [dest], sources: o.pos.slice(0, -1).map(pair), recursive: true, contents: true });
    } else if (p === "xcopy" && o.pos.length > 1) {
      ops.push({ op: "write", paths: [pair(o.pos[1])] }, { op: "into", paths: [pair(o.pos[1])], sources: [pair(o.pos[0])], recursive: o.flags.some((f) => /^\/[se]$/i.test(f)), contents: true });
    } else if (p === "robocopy" && o.pos.length > 1) { // robocopy <source> <destination> [<files>…]: the files (else all) land in the destination
      const files = o.pos.slice(2).map(pair);
      ops.push({ op: "into", paths: [pair(o.pos[1])], sources: files.length ? files : [["*", "*"]], recursive: o.flags.some((f) => /^\/(?:s|e|mir)$/i.test(f)) });
    }
    return ops;
  }
  if (p === "mklink" || p === "junction") { // mklink [/D|/H|/J] <link> <target>
    const pos = shellOperands(words, k + 1, null, true).pos;
    if (pos.length >= 2) ops.push({ op: "write", paths: [pair(pos[0])] }, { op: "link", paths: [pair(pos[1])] });
    return ops;
  }
  if (p === "subst") { const pos = shellOperands(words, k + 1, null, true).pos; if (pos.length >= 2) ops.push({ op: "link", paths: [pair(pos[1])] }); return ops; }
  if (p === "fsutil") { // fsutil hardlink create <new> <existing>
    if (/^hardlink$/i.test(words[k + 1] || "") && /^create$/i.test(words[k + 2] || "") && words.length > k + 4) ops.push({ op: "write", paths: [pair(k + 3)] }, { op: "link", paths: [pair(k + 4)] });
    return ops;
  }
  if (p === "mount") {
    const o = shellOperands(words, k + 1, SHELL_TAKES.mount);
    if (o.flags.some((f) => /^(?:--r?bind|-B)$/.test(f)) && o.pos.length >= 2) ops.push({ op: "link", paths: [pair(o.pos[0])] }, { op: "write", paths: [pair(o.pos[1])] });
    return ops;
  }
  if (p === "sed" || p === "perl" || p === "ruby") {
    const o = shellOperands(words, k + 1, SHELL_TAKES[p]);
    const inplace = o.flags.some((f) => (p === "sed" ? /^-[nrEsuz]*i/ : /^-[pnlaws0]*i/).test(f)) || o.flags.concat(Object.keys(o.val)).some((f) => /^--in-place/.test(f));
    if (!inplace) return ops;
    const script = Object.keys(o.val).some((x) => /^(?:-e|-E|-f|--expression|--file)$/.test(x));
    const files = posOf(o).slice(script ? 0 : 1);
    if (files.length) ops.push({ op: "write", paths: files.map(pair) }); else if (xargs) piped("write");
    return ops;
  }
  if (["awk", "gawk", "mawk", "nawk"].includes(p)) {
    const o = shellOperands(words, k + 1, SHELL_TAKES.awk);
    const inc = ["-i", "--include"].map((x) => vpair(o.val[x])).filter(Boolean).map((x) => x[0]);
    if (!inc.some((v) => /^inplace$/i.test(v)) && !o.flags.some((f) => /^-iinplace$/i.test(f))) return ops;
    const prog = ["-f", "--file", "-e", "--source", "-E"].some((x) => o.val[x]);
    const files = (prog ? o.pos : o.pos.slice(1)).filter((i) => !/^[A-Za-z_]\w*=/.test(words[i]));
    if (files.length) ops.push({ op: "write", paths: files.map(pair) });
    return ops;
  }
  if (["ed", "red", "ex", "vi", "vim", "nvim", "view"].includes(p)) {
    const pos = shellOperands(words, k + 1, SHELL_TAKES.editor).pos.filter((i) => !words[i].startsWith("+"));
    if (pos.length) ops.push({ op: "write", paths: pos.map(pair) });
    return ops;
  }
  if (p === "curl" || p === "wget") {
    const long = p === "curl" ? /^--(output|dump-header|cookie-jar|trace|trace-ascii|stderr|etag-save|libcurl|output-dir)(?:=([\s\S]*))?$/
      : /^--(output-document|output-file|append-output|directory-prefix)(?:=([\s\S]*))?$/;
    const short = p === "curl" ? /^-([A-Za-z]*?)([oDc])([\s\S]*)$/ : /^-([A-Za-z]*?)([OoaP])([\s\S]*)$/;
    for (let i = k + 1; i < words.length; i++) {
      const w = words[i];
      let m = long.exec(w), dir = false, v = null;
      if (m) { dir = /dir/.test(m[1]); v = m[2] !== undefined ? [m[2], m[2]] : i + 1 < words.length ? pair(++i) : null; }
      else if (!w.startsWith("--") && (m = short.exec(w))) { dir = m[2] === "P"; v = m[3] ? [m[3], m[3]] : i + 1 < words.length ? pair(++i) : null; }
      if (v) ops.push(dir ? { op: "into", paths: [v], archive: true } : { op: "write", paths: [v] });
    }
    return ops;
  }
  if (p === "tar" || p === "bsdtar") return ops.concat(tarOps(words, k, pair));
  if (p === "unzip") {
    const o = shellOperands(words, k + 1, SHELL_TAKES.unzip);
    const d = vpair(o.val["-d"]) || (o.flags.map((f) => /^-d(.+)$/.exec(f)).filter(Boolean).map((m) => [m[1], m[1]])[0]);
    if (d) ops.push({ op: "into", paths: [d], archive: true });
    if (o.pos.length > 1) ops.push({ op: "replace", paths: o.pos.slice(1).map(pair) });
    return ops;
  }
  if (p === "7z" || p === "7za" || p === "7zr") {
    const cmd = String(words[k + 1] || "").toLowerCase();
    const o = shellOperands(words, k + 2, null);
    if (cmd === "x" || cmd === "e") {
      for (const f of o.flags) { const m = /^-o([\s\S]+)$/.exec(f); if (m) ops.push({ op: "into", paths: [[m[1], m[1]]], archive: true }); }
      if (o.pos.length > 1) ops.push({ op: "replace", paths: o.pos.slice(1).map(pair) });
    } else if (["a", "u", "d", "rn"].includes(cmd) && o.pos.length) ops.push({ op: "write", paths: [pair(o.pos[0])] });
    return ops;
  }
  if (p === "zip") {
    const o = shellOperands(words, k + 1, SHELL_TAKES.zip);
    const out = vpair(o.val["-O"]) || vpair(o.val["--out"]);
    if (out) ops.push({ op: "write", paths: [out] }); else if (o.pos.length) ops.push({ op: "write", paths: [pair(o.pos[0])] });
    return ops;
  }
  if (p === "patch") {
    const o = shellOperands(words, k + 1, SHELL_TAKES.patch);
    for (const x of ["-o", "--output", "-r", "--reject-file"]) { const v = vpair(o.val[x]); if (v) ops.push({ op: "write", paths: [v] }); }
    if (o.pos.length) ops.push({ op: "write", paths: [pair(o.pos[0])] });
    return ops;
  }
  if ((p === "sort" || p === "iconv" || p === "base64") && mode !== "ps") {
    for (let i = k + 1; i < words.length; i++) {
      const m = /^(?:-o|--output)(?:=?([\s\S]+))?$/.exec(words[i]);
      if (m) { const v = m[1] ? [m[1], m[1]] : i + 1 < words.length ? pair(++i) : null; if (v) ops.push({ op: "write", paths: [v] }); }
    }
    return ops;
  }
  if (p === "uniq" || p === "xxd") { const pos = shellOperands(words, k + 1, SHELL_TAKES.uniq).pos; if (pos.length >= 2) ops.push({ op: "write", paths: [pair(pos[1])] }); return ops; }
  if (p === "git") {
    let dir = null;
    for (let i = k + 1; i < words.length && words[i].startsWith("-"); i++) if (words[i] === "-C" && i + 1 < words.length) dir = words[++i]; else if (GIT_VALUE_OPTIONS.has(words[i])) i++;
    const targets = gitWriteTargets(words, k);
    if (targets.length) ops.push({ op: "git", paths: targets.map((t) => [t, t]).concat(dir ? targets.map((t) => [dir + "/" + t, dir + "/" + t]) : []) });
    return ops;
  }
  if (p === "find") return ops.concat(findFileOps(words, raw, k, pair));
  if (!shellKnownProgram(p, words[k], raw[k], mode)) {
    const args = [];
    for (let i = k + 1; i < words.length; i++) {
      const w = words[i].replace(/^-{1,2}[A-Za-z][\w-]*[=:]/, "");
      if (w && !w.startsWith("-") && !/\s/.test(w)) args.push([w, String(raw[i] || w).replace(/^-{1,2}[A-Za-z][\w-]*[=:]/, "")]);
    }
    // its ( … ) argument list too (PowerShell: `New-Object IO.StreamWriter('.specs/roadmap.json')`)
    if (words.openParen && nextSeg) for (const x of nextSeg.join(" ").split(",")) { const w = x.trim(); if (w && !/\s/.test(w)) args.push([w, w]); }
    if (args.length) ops.push({ op: "unknown", paths: args });
  }
  return ops;
}
// A program the approval guard knows what it does with the files it names (a reader, a writer read above, a shell, a launcher, the CLI).
function shellKnownProgram(p, word, rawWord, mode) {
  return APPROVAL_TEXT_PROGRAMS.has(p) || APPROVAL_READERS.has(p) || APPROVAL_WRITERS_ANY.has(p) || APPROVAL_REMOVERS.has(p) || APPROVAL_MOVERS.has(p) ||
    APPROVAL_WRITERS_TARGET.has(p) || APPROVAL_WRITERS_INPLACE.has(p) || APPROVAL_WRITERS_OTHER.has(p) || APPROVAL_SHELLS.has(p) ||
    APPROVAL_WRAPPERS.has(p) || APPROVAL_STDIN_SHELLS.has(p) || PS_FILE_CMDLETS.has(p) || RE_PS_READER.test(p) || p === "source" || p === "." ||
    p === "[[" || p === "]]" || isDevSpecWord(word) || isDevSpecWord(rawWord || "");
}
// tar: the mode (x — extract; c r u A — write the archive) and its value letters (f C T X K N g b F H L V, in the order they come) in the
// first word (old style: `xzf b.tar`) or a -bundle; --extract / --get, --create …, -C / --directory, -f / --file. → its operations: the
// extraction folder (into, archive) and the members named (replace); the archive written in a writing mode.
function tarOps(words, k, pair) {
  const ops = [], dirs = [], members = [];
  let extract = false, create = false, archive = null;
  const VAL = "fCTXKNgbFHLV";
  for (let i = k + 1; i < words.length; i++) {
    const w = words[i];
    let m;
    if ((m = /^--(extract|get|create|append|update|catenate|concatenate|directory|file)(?:=([\s\S]*))?$/.exec(w))) {
      if (m[1] === "extract" || m[1] === "get") extract = true;
      else if (m[1] === "directory" || m[1] === "file") { const v = m[2] !== undefined ? [m[2], m[2]] : i + 1 < words.length ? pair(++i) : null; if (v) (m[1] === "file" ? (archive = v) : dirs.push(v)); }
      else create = true;
      continue;
    }
    const bundle = /^-[A-Za-z]+$/.test(w) ? w.slice(1) : i === k + 1 && /^[A-Za-z]{1,8}$/.test(w) && /[xtcruA]/.test(w) ? w : null;
    if (bundle) {
      for (const c of bundle) {
        if (c === "x") extract = true;
        else if ("cruA".includes(c)) create = true;
        if (VAL.includes(c) && i + 1 < words.length) { const v = pair(++i); if (c === "f") archive = v; else if (c === "C") dirs.push(v); }
      }
      continue;
    }
    if (w.startsWith("-")) continue;
    members.push(pair(i));
  }
  if (extract) { if (dirs.length) ops.push({ op: "into", paths: dirs, archive: true }); if (members.length) ops.push({ op: "replace", paths: members }); }
  if (create && archive) ops.push({ op: "write", paths: [archive] });
  return ops;
}
// find: the starting points (before the expression) and its name tests; -delete, or -exec / -execdir / -ok a remover, a mover, a writer
// or a shell → those paths (each start with each name, directly and deeper) are replaced / written; -fprint / -fls FILE writes FILE.
function findFileOps(words, raw, k, pair) {
  const ops = [];
  let i = k + 1;
  while (i < words.length && /^-(?:[HLP]|D|O\d*)$/.test(words[i])) i += words[i] === "-D" ? 2 : 1;
  const starts = [];
  for (; i < words.length && !/^[-(!,)]/.test(words[i]); i++) starts.push(words[i]);
  const names = [];
  let kind = null;
  for (; i < words.length; i++) {
    const w = words[i];
    if (/^-i?(?:name|path|wholename)$/.test(w) && i + 1 < words.length) { names.push(words[++i]); continue; }
    if (/^-(?:fprint0?|fls|fprintf)$/.test(w) && i + 1 < words.length) { ops.push({ op: "write", paths: [pair(++i)] }); if (w === "-fprintf") i++; continue; }
    if (w === "-delete") { kind = "replace"; continue; }
    if (/^-(?:exec|execdir|ok|okdir)$/.test(w)) {
      let e = i + 1;
      while (e < words.length && words[e] !== ";" && words[e] !== "+") e++;
      const sub = words.slice(i + 1, e), subRaw = (raw || words).slice(i + 1, e);
      const sk = programAt(sub, subRaw);
      const sp = sk >= 0 ? approvalProgram(sub[sk]) : "";
      if (APPROVAL_REMOVERS.has(sp) || APPROVAL_MOVERS.has(sp) || APPROVAL_SHELLS.has(sp)) kind = "replace";
      else if (!kind && (APPROVAL_WRITERS_ANY.has(sp) || APPROVAL_WRITERS_INPLACE.has(sp) || APPROVAL_WRITERS_TARGET.has(sp) || APPROVAL_WRITERS_OTHER.has(sp))) kind = "write";
      i = e;
    }
  }
  if (!kind) return ops;
  const paths = (starts.length ? starts : ["."]).flatMap((s) => (names.length ? names.flatMap((n) => [s + "/" + n, s + "/" + SHELL_ANY + "/" + n]) : [s]));
  ops.push({ op: kind, paths: paths.map((t) => [t, t]) });
  return ops;
}
// PowerShell's file cmdlets, read by their parameters (unique prefixes and aliases included): the paths they remove, write, move or
// link to; a value given as a `( … )` expression is the next simple command — Join-Path is read, any other one is unknown.
function psFileOps(p, words, raw, k, nextSeg, piped) {
  const ops = [];
  const { named, pos } = psParams(words, k + 1);
  const split = (pr) => { const a = String(pr[0]).split(","), b = String(pr[1]).split(","); return a.map((x, j) => [x.trim(), (b.length === a.length ? b[j] : x).trim()]).filter((x) => x[0]); };
  const exprPath = () => {
    if (!nextSeg) return [];
    const nk = programAt(nextSeg, nextSeg.raw || nextSeg);
    if (nk >= 0 && approvalProgram(nextSeg[nk]) === "join-path") {
      const parts = nextSeg.slice(nk + 1).filter((w) => !/^-/.test(w));
      return parts.length ? [[parts.join("/"), parts.join("/")]] : [];
    }
    ops.push({ op: "unknown", paths: nextSeg.filter((w) => !/^-/.test(w) && !/\s/.test(w)).map((w) => [w, w]) });
    return [];
  };
  const get = (...names) => {
    const out = [];
    for (const [k2, v] of Object.entries(named)) {
      if (!names.some((n) => n === k2 || (k2.length >= 3 && n.startsWith(k2)))) continue;
      if (v.i !== undefined) out.push(...split([words[v.i], (raw && raw[v.i]) || words[v.i]]));
      else if (v.text !== undefined) out.push(...split([v.text, v.text]));
      else if (v.missing) out.push(...exprPath());
    }
    return out;
  };
  const at = (j) => (pos[j] !== undefined ? split([words[pos[j]], (raw && raw[pos[j]]) || words[pos[j]]]) : []);
  const path0 = get("path", "literalpath", "lp", "pspath", "filepath", "fullname").concat(at(0));
  if (p === "remove-item") { if (path0.length) ops.push({ op: "replace", paths: path0 }); else piped("replace"); }
  else if (["set-content", "add-content", "clear-content", "out-file", "tee-object", "export-csv", "export-clixml"].includes(p)) {
    if (path0.length) ops.push({ op: "write", paths: path0 }); else piped("write");
  } else if (p === "new-item") {
    const names = get("name");
    let items = path0.length ? path0 : names.length ? [[".", "."]] : [];
    if (names.length) items = items.flatMap((d) => names.map((n) => [d[0] + "/" + n[0], d[1] + "/" + n[1]]));
    if (items.length) ops.push({ op: "write", paths: items });
    if (/symbolic|junction|hard/i.test(get("itemtype", "type").map((x) => x[0]).join(" "))) { const t = get("value", "target"); if (t.length) ops.push({ op: "link", paths: t }); }
  } else if (p === "copy-item" || p === "move-item") {
    const dest = get("destination").concat(at(1));
    const recursive = p === "move-item" || Object.keys(named).some((n) => n === "r" || (n.length >= 3 && "recurse".startsWith(n)));
    if (p === "move-item") { if (path0.length) ops.push({ op: "replace", paths: path0 }); else piped("replace"); }
    if (dest.length) ops.push({ op: "write", paths: dest }, { op: "into", paths: dest, sources: path0.length ? path0 : [["*", "*"]], recursive });
  } else if (p === "rename-item") {
    const nn = get("newname").concat(at(1));
    if (path0.length) ops.push({ op: "replace", paths: path0 }); else piped("replace");
    for (const src of path0.length ? path0 : [["", ""]]) {
      const d0 = String(src[0]).replace(/[^\\/]*$/, ""), d1 = String(src[1]).replace(/[^\\/]*$/, "");
      for (const n of nn) ops.push({ op: "write", paths: [[d0 + n[0], d1 + n[1]]] });
    }
  } else if (p === "expand-archive") {
    const d = get("destinationpath").concat(at(1));
    if (d.length) ops.push({ op: "into", paths: d, archive: true });
  }
  return ops;
}
// [IO.File]:: / [IO.Directory]:: methods (PowerShell): their arguments are the next simple command (`('.specs/roadmap.json', '{}')`).
function netFileOps(m, nextSeg) {
  const args = nextSeg ? nextSeg.join(" ").split(",").map((x) => x.trim()).filter(Boolean).map((x) => [x, x]) : [];
  const kind = m[1].toLowerCase(), meth = m[2].toLowerCase();
  if (!args.length) return [];
  if (meth === "delete") return [{ op: "replace", paths: [args[0]] }];
  if (meth === "move") return [{ op: "replace", paths: [args[0]] }].concat(args[1] ? [{ op: "write", paths: [args[1]] }, { op: "into", paths: [args[1]], sources: [args[0]], recursive: true }] : []);
  if (meth === "copy") return args[1] ? [{ op: "write", paths: [args[1]] }] : [];
  if (meth === "replace") return [{ op: "replace", paths: [args[0]] }].concat(args[1] ? [{ op: "write", paths: args.slice(1, 3) }] : []);
  if (meth === "createsymboliclink") return [{ op: "write", paths: [args[0]] }].concat(args[1] ? [{ op: "link", paths: [args[1]] }] : []);
  if (/^(?:write|append|create|open|set|encrypt|decrypt)/.test(meth) && kind === "file") return [{ op: "write", paths: [args[0]] }];
  if (/^(?:read|exists|get|enumerate)/.test(meth)) return [];
  return [{ op: "unknown", paths: args }];
}
// One file operation → the approval guard's actions ([] = none): a guarded file written, removed, replaced or received (its setting —
// roadmap, state, observed), .specs/ itself removed or moved away (roadmap), any other glob / folder / variable write or removal that may
// reach them (setting "specs"), a link made to .specs/ or under it ("link"), an unknown program run on them (unreadable "specs-arg").
// What stays allowed: reading, writing a spec document (no guarded name), anything inside an .execution/ folder but the observed log,
// a lock file.
const shellDown = (setting, extra) => Object.assign({ kind: "guard-down", setting, source: "shell" }, extra || {});
const shellHit = (h) => shellDown(h.setting, h.setting === "roadmap" ? {} : { feature: h.feature || null });
function shellOpActions(o, mode, ctx) {
  const out = [];
  if (o.op === "piped") {
    for (const t of shellProducedPaths(o.producer)) out.push(...shellOpActions({ op: o.kind, paths: [[t, t]] }, mode, ctx));
    return out;
  }
  for (const pr of o.paths || []) {
    for (const f of [...new Set(pr)].flatMap((t) => shellPathReadings(t, mode, ctx))) {
      if (o.op === "write") {
        if (f.guarded) out.push(shellHit(f.guarded));
        else if (f.may) out.push(shellDown("specs"));
      } else if (o.op === "replace" || o.op === "git") {
        const h = f.guarded || (o.op === "git" && !f.wild ? approvalGuardedDir(f.text) : null);
        if (h) out.push(shellHit(h));
        else if (f.dir && !f.wild) out.push(shellDown("roadmap"));
        else if (f.specs >= 0 && !f.execution && !f.lock && (f.may || f.folder || f.dir)) out.push(shellDown("specs"));
      } else if (o.op === "into") {
        // (a destination that reads as a file — an extension, no glob — is the write above, not a folder receiving files)
        if ((f.specs < 0 && !f.dir) || f.execution || (!f.folder && !f.wild && !/[\\/]$/.test(pr[0]))) continue;
        if (o.archive) { out.push(shellDown("specs")); continue; }
        for (const sp of o.sources || []) {
          const base = shellVarText(sp[0], ctx && ctx.vars).replace(/[\\/]+$/, "");
          const names = [base.replace(/^[\s\S]*[\\/]/, "") || "*"];
          if (o.contents && shellPathFacts(base, mode).folder) names.push("*"); // xcopy / robocopy / rsync copy a folder's CONTENTS
          for (const name of names) {
            for (const sf of shellPathReadings(f.text + "/" + name, mode, null)) {
              if (sf.guarded) out.push(shellHit(sf.guarded));
              else if (sf.may || (o.recursive && sf.folder)) out.push(shellDown("specs"));
            }
          }
        }
      } else if (o.op === "link") {
        if (f.guarded || f.specs >= 0) out.push(shellDown("link"));
      } else if (o.op === "unknown") {
        if (f.guarded || f.dir || f.may || (!f.wild && f.name)) out.push({ kind: "unreadable", why: "specs-arg", source: "shell" });
      }
    }
  }
  return out;
}
// The paths of an operation that a code edit is (the edit guard — shellWriteTargets): written, replaced, received (the sources' names
// in the folder). Variables put in; one standing first ($TMP/x.ts) — anywhere — is left out. git's restores are not read here: the edit
// guard leaves git to the user (`git checkout -- src/a.ts`, a stash, a merge — no prompt on git).
function shellOpPaths(o, mode, ctx) {
  if (!["write", "replace", "into"].includes(o.op)) return [];
  const out = [];
  const read = (t) => {
    for (const a of mode === "bash" ? braceExpand(shellVarText(t, ctx && ctx.vars)) : [shellVarText(t, ctx && ctx.vars)]) {
      if (!a || a.startsWith(SHELL_VAR) || /^(?:\/dev\/|\$null$|nul$|con$)/i.test(a)) continue;
      const h = (/^~(?=$|[\\/])/.test(a) ? os.homedir() + a.slice(1) : a).split(SHELL_VAR).join("_").split(SHELL_ANY).join("_");
      out.push(h);
      if (ctx && ctx.cwd && !/^(?:[\\/~]|[A-Za-z]:)/.test(h)) out.push(ctx.cwd + "/" + h);
    }
  };
  for (const pr of o.paths || []) {
    if (o.op !== "into") { read(pr[0]); continue; }
    for (const sp of o.sources || []) { const name = String(sp[0]).replace(/[\\/]+$/, "").replace(/^[\s\S]*[\\/]/, ""); if (name && !/[*?]/.test(name)) read(String(pr[0]).replace(/[\\/]+$/, "") + "/" + name); }
  }
  return out;
}
const approvalStr = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
const approvalTruthy = (v) => v === true || (typeof v === "string" && !/^(?:false|0|no|off)$/i.test(v.trim()));
// Track words (`tdd`, `+ai`, 'sec,tdd', '+sec +AI' — spec_add_track's `track`, add-track's positionals and --tracks) → the gated ones
// among them (APPROVAL_GATED_TRACKS), in the order given, once each.
function approvalGatedTracks(list) {
  const out = [];
  for (const v of list) for (const t of String(v == null ? "" : v).split(/[\s,]+/)) {
    const n = t.replace(/^\+/, "").toLowerCase();
    if (APPROVAL_GATED_TRACKS.includes(n) && !out.includes(n)) out.push(n);
  }
  return out;
}
// The edit guard's strength (meta.guard): off < on < scope.
const guardRank = (g) => (g === "scope" ? 2 : g === true ? 1 : 0);
const guardName = (g) => (g === "scope" ? "scope" : g === true ? "on" : "off");
// spec_init / `init` settings → the GUARD-DOWN actions among them (R10: what weakens a protection the approval guard stands for;
// raising or adding is never one). ch = { approvalGuard, evidence, stopCheck, guard, roles (a validated map), checks ({name:
// command | ""}) } — the values the call would set; meta = the project's roadmap.json meta, or undefined when it can't be read
// (then every change that COULD weaken counts — fail closed).
function initGuardDowns(ch, level, meta) {
  const known = isObj(meta);
  const m = known ? meta : {};
  const out = [];
  if (ch.approvalGuard && lowersApprovalGuard(ch.approvalGuard, level)) out.push({ setting: "approvalGuard", from: level, to: ch.approvalGuard });
  if (ch.evidence === "reported" && (!known || m.evidence === "observed")) out.push({ setting: "evidence", from: known ? "observed" : null, to: "reported" });
  if (ch.stopCheck === false && (!known || m.stopCheck !== false)) out.push({ setting: "stopCheck", from: known ? "on" : null, to: "off" });
  if (ch.guard !== undefined) {
    const cur = known ? (m.guard === true || m.guard === "scope" ? m.guard : false) : null;
    if (cur === null ? ch.guard !== "scope" : guardRank(ch.guard) < guardRank(cur)) out.push({ setting: "guard", from: cur === null ? null : guardName(cur), to: guardName(ch.guard) });
  }
  if (ch.roles) {
    const cur = known ? approvalRolesFrom(m.approvalRoles) : null;
    const removed = cur ? Object.entries(cur).flatMap(([ph, rs]) => rs.filter((r) => !(own(ch.roles, ph) ? ch.roles[ph] : []).includes(r)).map((r) => ph + "=" + r)) : null;
    if (!cur || removed.length) out.push({ setting: "roles", to: ch.roles, removed });
  }
  if (ch.checks) {
    for (const [name, command] of Object.entries(ch.checks)) {
      const cur = !known ? null : isObj(m.checks) && own(m.checks, name) && typeof m.checks[name] === "string" ? m.checks[name] : undefined;
      if (command === "" ? cur !== undefined : cur === null || (typeof cur === "string" && cur.trim() !== command.trim())) out.push({ setting: "check", name, to: command === "" ? null : command });
    }
  }
  return out.map((a) => Object.assign({ kind: "guard-down" }, a));
}
// spec_init {approvalRoles} / {checks} → what they would set (the engine's own validation — a refused value changes nothing).
function initRolesInput(v) {
  if (v === undefined || v === null) return undefined;
  const r = validateApprovalRoles(v, "en");
  return r.ok ? r.map : undefined;
}
function initChecksInput(v) {
  const nc = checksInput(v, "en");
  if (!nc || nc.error) return undefined;
  const out = {};
  for (const k of nc.remove) out[k] = "";
  return Object.assign(out, nc.set);
}
// The words after the CLI's script → the approvals / guard-down actions it would record ([] = none). Read twice: with the CLI's
// value flags (a `--flag` that is no switch takes the next word), then with every flag as a switch — `approve` is found either way.
function cliApprovalAction(args, level, meta) {
  for (const valueFlags of [true, false]) {
    const pos = [];
    const fl = Object.create(null);
    const checkVals = []; // --check is repeatable (init --check name=cmd)
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === "--") { pos.push(...args.slice(i + 1)); break; }
      const m = /^--([A-Za-z][\w-]*)(?:=([\s\S]*))?$/.exec(a);
      if (!m) { pos.push(a); continue; }
      const k = m[1].toLowerCase();
      if (m[2] !== undefined) fl[k] = m[2];
      else if (valueFlags && !CLI_SWITCHES.has(k) && args[i + 1] !== undefined && !/^--[A-Za-z]/.test(args[i + 1])) fl[k] = args[++i];
      else fl[k] = true;
      if (k === "check") checkVals.push(fl[k]);
    }
    if (approvalTruthy(fl.help)) return []; // `<command> --help` prints the help and runs nothing
    const cmd = String(pos[0] || "").toLowerCase();
    const base = { source: "cli", project: approvalStr(fl.project) };
    if (cmd === "approve") {
      return [Object.assign({ kind: "approve", feature: approvalStr(pos[1]), phase: approvalStr(pos[2]), through: approvalStr(fl.through),
        role: approvalStr(fl.role), by: approvalStr(fl.by), force: approvalTruthy(fl.force) }, approvalExtras(approvalTruthy(fl.revoke), fl.reason, fl.expires), base)];
    }
    // `feature remove <name>` without --yes only previews what it would delete.
    if (cmd === "feature" && String(pos[1] || "").toLowerCase() === "remove" && approvalTruthy(fl.yes)) return [Object.assign({ kind: "remove", feature: approvalStr(pos[2]) }, base)];
    // 1.24 review 6 (C2): `merge-state <base> <ours> <theirs> [<path>]` — git's merge driver — writes its merge into <ours>: run by an
    // agent on a .state.json (its approvals) or on .specs/roadmap.json (this guard), it is a hand edit of them. Git runs the driver
    // inside `git merge` on its own temp files (never through the Bash tool); --install / --uninstall / --check write no state.
    if (cmd === "merge-state" && pos.length >= 4 && fl.install === undefined && fl.uninstall === undefined && fl.check === undefined) {
      const h = approvalGuardedFile(pos[2]);
      if (h && h.setting !== "observed") return [Object.assign({ kind: "guard-down", setting: h.setting }, h.setting === "state" ? { feature: h.feature || null } : {}, base)];
    }
    // 1.24 review 6 (E3): `add-track <feature> <track…> --remove` turning off +tdd / +ai drops the gates they carry.
    if (cmd === "add-track" && approvalTruthy(fl.remove)) {
      const tracks = approvalGatedTracks(pos.slice(2).concat(typeof fl.tracks === "string" ? [fl.tracks] : []));
      if (tracks.length) return [Object.assign({ kind: "guard-down", setting: "track", feature: approvalStr(pos[1]), tracks }, base)];
    }
    if (cmd === "init") {
      const onOff = (v) => { const s = typeof v === "string" ? v.trim().toLowerCase() : ""; return ["on", "true", "yes", "1"].includes(s) ? true : ["off", "false", "no", "0"].includes(s) ? false : s === "scope" ? "scope" : undefined; };
      const rolesText = typeof fl.roles === "string" ? parseApprovalRolesText(fl.roles, "en") : undefined;
      // A --check without name= makes the CLI stop before anything is written: no check changes then.
      const checks = checkVals.length && checkVals.every((v) => typeof v === "string" && v.indexOf("=") > 0)
        ? initChecksInput(Object.fromEntries(checkVals.map((v) => [v.slice(0, v.indexOf("=")).trim(), v.slice(v.indexOf("=") + 1)]))) : undefined;
      const stop = onOff(fl["stop-check"]);
      const acts = initGuardDowns({ approvalGuard: approvalGuardInput(fl["approval-guard"]), evidence: evidenceModeInput(fl.evidence),
        stopCheck: stop === false ? false : undefined, guard: onOff(fl.guard), roles: rolesText && !rolesText.error ? initRolesInput(rolesText) : undefined, checks }, level, meta);
      if (acts.length) return acts.map((a) => Object.assign(a, base));
    }
  }
  return [];
}
// Every approval / guard-down action a shell command runs (each simple command; the scripts of bash -c / cmd /c / pwsh -Command
// …, of a heredoc / here-string fed to a shell; a write to .specs/roadmap.json).
// 1.22 review: + the UNQUOTED forms — `cmd /c node cli\dev-spec.js approve …`, `pwsh -Command node cli/dev-spec.js approve …`
// (the words after cmd's /c /k /r or pwsh / powershell's -Command / -c, joined: restScript), `Start-Process node -ArgumentList
// 'cli/dev-spec.js','approve',…` (startProcessLine), `find … -exec node cli/dev-spec.js approve … ;` (findExecActions), and the
// wrappers winpty / flock (+ `flock … -c "…"`, `script -c "…"`) — all allowed at deny before. One simple command's nested
// actions are deduplicated (a quoted script is read both as a word and as the joined rest).
// 1.25.1 (review 7): ctx — { vars, cwd } — carries what the command set before each simple command (a variable assigned, a `cd`) into
// the reading of its paths, and `collect` (shellWriteTargets — the edit guard) receives every file operation, nested scripts included
// (read whatever they name). Text fed to a shell as its script (a pipe, a process substitution, xargs → sh -c) is read as that shell's
// script when it is visible, else it is unreadable (why "fed": ask). PowerShell's `node <cli> @('approve', …)`: the array's elements.
function shellApprovalActions(command, level, depth, mode, meta, ctx) {
  const out = [];
  const segs = shellCommandWords(command, mode);
  const namesCli = /dev-?spec/i.test(approvalPlain(command));
  const c = ctx || { vars: Object.create(null), cwd: "" };
  const want = (script) => !!script && (c.collect ? true : approvalCandidate(script));
  segs.forEach((words, si) => {
    const raw = words.raw || words;
    shellTrack(words, raw, mode, c);
    const at = devSpecWordAt(words, raw);
    if (at >= 0) {
      let args = words.slice(at + 1);
      if (mode === "ps" && args.length && args[args.length - 1] === "@" && segs[si + 1]) {
        args = args.slice(0, -1).concat(segs[si + 1].join(" ").split(",").map((x) => x.trim()).filter(Boolean));
      }
      out.push(...cliApprovalAction(args, level, meta));
    }
    // 1.23 review 5 (L20): the CLI fed to a JavaScript runtime on stdin — `cat cli/dev-spec.js | node - approve …`,
    // `node - approve … < cli/dev-spec.js` — when the command names the CLI somewhere.
    const sa = at < 0 && namesCli ? stdinScriptAt(words, raw) : -1;
    if (sa >= 0) out.push(...cliApprovalAction(words.slice(sa + 1), level, meta));
    if (c.collect) for (const o of shellSegOps(words, raw, mode, segs[si + 1])) c.collect(o, mode, c);
    else out.push(...specsWriteActions(words, raw, c, mode, segs[si + 1]));
    if (depth >= APPROVAL_SHELL_DEPTH) return;
    const nested = [], seen = new Set();
    const add = (acts) => { for (const a of acts) { const k = JSON.stringify(a); if (!seen.has(k)) { seen.add(k); nested.push(a); } } };
    const lex = (script, m) => { if (want(script)) add(shellApprovalActions(script, level, depth + 1, m, meta, c)); };
    const fed = shellFedScript(words, raw);
    if (fed && fed.script != null) lex(fed.script, fed.mode);
    else if (fed && fed.unknown && !c.collect) add([{ kind: "unreadable", why: "fed", source: "shell" }]);
    const end = at >= 0 ? at : words.length;
    const prog = at >= 0 ? -1 : programAt(words, raw);
    let shell = null, posix = false;
    for (let j = 0; j < end; j++) {
      if (shell && /\s/.test(words[j]) && want(words[j])) add(shellApprovalActions(words[j], level, depth + 1, shell, meta, c));
      // 1.23 review 5 (L20): `sh -c 'node "$0" approve x tasks' cli/dev-spec.js` — a POSIX shell's -c script with its positional
      // parameters ($0 … $9, "$@", $*) taken from the words after it, then read as a script.
      if (posix && words[j] === "-c" && j + 1 < end && /\$(?:[0-9@*]|\{[0-9@*]\})/.test(words[j + 1])) lex(withPositionals(words[j + 1], raw.slice(j + 2, end)), "bash");
      const p = approvalProgram(words[j]);
      if (APPROVAL_SHELLS.has(p)) { shell = approvalShellMode(p); posix = APPROVAL_POSIX_SHELLS.has(p); }
      // the unquoted forms only where the word RUNS — the program (after launchers) or a find -exec's command: `echo cmd /c …` is text
      // (PowerShell's `start` is Start-Process — programAt reads it as cmd.exe's launcher and points past it)
      const psStart = p === "start" && mode === "ps" && words.slice(0, j).every((x) => x === "");
      if (j !== prog && !psStart && !/^-(?:exec|execdir|ok|okdir)$/.test(words[j - 1] || "")) continue;
      const rest = restScript(words, raw, j, p);
      if (rest) lex(rest.script, rest.mode);
      if (APPROVAL_START_PROCESS.has(p) && (p !== "start" || mode === "ps")) lex(startProcessLine(words, raw, j, segs[si + 1]), "cmd");
    }
    add(findExecActions(words, raw, level, meta));
    if (words.stdinShell) for (const h of words.herestrings || []) if (want(h)) add(shellApprovalActions(h, level, depth + 1, words.stdinShell, meta, c));
    out.push(...nested);
  });
  return out;
}
// What a simple command sets for the ones after it (ctx): a variable (`D=.specs`, `export D=…`, `set D=…` — cmd.exe, `$d = '.specs'` —
// PowerShell; its value with the variables known so far put in) and the folder a `cd` / `pushd` / `Set-Location` moves to (relative to
// the previous one; `cd` alone, `cd -`, `popd`: forgotten). Text only, nothing evaluated.
function shellTrack(words, raw, mode, ctx) {
  if (!ctx || !words.length) return;
  const set = (name, value) => { ctx.vars[String(name).replace(/^env:/i, "").toLowerCase()] = shellVarText(String(value), ctx.vars); };
  let m;
  if (mode === "ps") {
    if ((m = /^\$([A-Za-z_][\w:]*)=([\s\S]*)$/.exec(words[0]))) set(m[1], m[2] !== "" ? m[2] : words[1] || "");
    else if ((m = /^\$([A-Za-z_][\w:]*)$/.exec(words[0])) && words[1] === "=") set(m[1], words[2] || "");
  } else {
    const lead = /^(?:export|declare|local|readonly|typeset|set)$/i.test(words[0]) ? 1 : 0;
    if (lead || /^[A-Za-z_]\w*=/.test(words[0])) for (const w of words.slice(lead)) if ((m = /^([A-Za-z_]\w*)=([\s\S]*)$/.exec(w))) set(m[1], m[2]);
  }
  const k = programAt(words, raw);
  const p = k >= 0 ? approvalProgram(words[k]) : "";
  if (/^(?:popd|pop-location)$/.test(p)) { ctx.cwd = ""; return; }
  if (!/^(?:cd|chdir|pushd|sl|set-location|push-location)$/.test(p)) return;
  const t = words.slice(k + 1).find((w) => !/^-[A-Za-z]|^\/d$/i.test(w)); // past cmd's /d, PowerShell's -Path / -LiteralPath
  const dir = t === undefined ? "" : shellVarText(t, ctx.vars);
  if (!dir || dir === "-" || /^~/.test(dir) || dir.includes(SHELL_VAR)) { ctx.cwd = ""; return; }
  ctx.cwd = /^(?:[\\/]|[A-Za-z]:)/.test(dir) || !ctx.cwd ? dir : ctx.cwd + "/" + dir;
}
// Text fed to a shell as its script (1.25.1, review 7) — the simple command is a shell with no script of its own reading stdin (bash /
// sh -s / no operand, cmd without /c, pwsh / powershell without -Command / -File or with `-Command -`, `iex` / Invoke-Expression without
// an argument, xargs feeding `sh -c` its script) or `source` / `.` / a shell running a process substitution (`bash <(…)`). → { script,
// mode } when the text is visible (piped from echo / printf / Write-Output / a PowerShell string / a heredoc to cat, or such a process
// substitution), { unknown: true } when it isn't (`cat x | bash`, `curl … | sh`, `bash < file`), null when nothing is fed.
function shellFedScript(words, raw) {
  const k = programAt(words, raw);
  if (k < 0) return null;
  const p = approvalProgram(words[k]);
  const procs = words.procs || [];
  const mode = p === "cmd" ? "cmd" : /^(?:pwsh|powershell|iex|invoke-expression)$/.test(p) ? "ps" : "bash";
  const fromProc = (pr) => { const t = shellProcText(pr.text); return t == null ? { unknown: true } : { script: t, mode }; };
  if (p === "source" || p === ".") {
    const pr = procs.find((x) => x.at === k + 1 && !x.out);
    if (pr) return fromProc(pr);
    if (!/^(?:\/dev\/stdin|-|\/dev\/fd\/0|\/proc\/self\/fd\/0)$/.test(words[k + 1] || "")) return null;
  } else if (APPROVAL_POSIX_SHELLS.has(p) || p === "fish") {
    let operand = -1, cAt = -1, sFlag = false, dash = false;
    for (let i = k + 1; i < words.length; i++) {
      const w = words[i];
      if (w === "-") { dash = true; break; }
      if (w === "--") { operand = i + 1 < words.length ? i + 1 : -1; break; }
      if (/^-[A-Za-z]+$/.test(w)) { if (w.includes("c")) { cAt = i; break; } if (w.includes("s")) sFlag = true; continue; }
      if (/^[-+]o$/.test(w) || w === "--rcfile" || w === "--init-file") { i++; continue; }
      if (/^(?:--|\+)/.test(w)) continue;
      operand = i;
      break;
    }
    if (cAt >= 0) {
      // xargs / parallel hand `sh -c` its script: the -c ends the command, or its script is the replace string ({} — or -I's)
      const under = words.slice(0, k).some((w) => /^(?:xargs|parallel)$/.test(approvalProgram(w)));
      const script = words[cAt + 1];
      const repl = words.slice(0, k).map((w, i, a) => (/^-(?:I|i|-replace)$/.test(a[i - 1] || "") ? w : null)).filter(Boolean);
      if (!under || (script !== undefined && !/\{\}/.test(script) && !repl.some((r) => script.includes(r)))) return null;
    } else if (!dash && !sFlag && operand >= 0) {
      const pr = procs.find((x) => x.at === operand && !x.out);
      return pr ? fromProc(pr) : null; // a script file
    }
  } else if (p === "cmd") {
    if (restScript(words, raw, k, "cmd")) return null;
  } else if (p === "pwsh" || p === "powershell") {
    const r = restScript(words, raw, k, p);
    if (r && r.script.trim() !== "-") return null;
    if (!r) {
      for (let i = k + 1; i < words.length; i++) {
        const w = words[i];
        if (!/^[-/]/.test(w)) return null; // pwsh's positional is -File
        const o = pwshOption(w);
        if (o === "file") { if (words[i + 1] !== "-") return null; break; }
        if (o === "value") i++;
      }
    }
  } else if (p === "iex" || p === "invoke-expression") {
    if (words.length > k + 1) return null; // a script argument: read as the shell's word
  } else return null;
  const pr = procs.find((x) => x.stdin);
  if (pr) return fromProc(pr);
  if ((words.docs || []).length || (words.herestrings || []).length) return null; // a heredoc / here-string: read where the lexer meets it
  if (words.pipeFrom) { const t = shellProducedText(words.pipeFrom); return t == null ? { unknown: true } : { script: t, mode }; }
  return words.stdinRedir ? { unknown: true } : null;
}
// The text a simple command prints, when it can be read from the command itself — echo / print / Write-Output / write (its words;
// escapes read as `echo -e` would), printf (its format with the arguments put in), cat (or nothing) with a heredoc / here-string, a
// PowerShell string expression ('…', '…' + '…') — else null.
function shellProducedText(seg) {
  const words = seg, raw = seg.raw || seg;
  const k = programAt(words, raw);
  const docs = (seg.docs || []).map((h) => h.body).filter((b) => typeof b === "string").concat(seg.herestrings || []);
  const p = k >= 0 ? approvalProgram(words[k]) : "";
  const unesc = (t) => t.replace(/\\(n|t|r|\\)/g, (m, e) => ({ n: "\n", t: "\t", r: "\r", "\\": "\\" })[e]);
  if (docs.length && (k < 0 || (p === "cat" && words.slice(k + 1).every((w) => w === "-")))) return docs.join("\n");
  if (k < 0) return null;
  if (k === 0 && (/\s/.test(words[0]) || words[1] === "+")) return words.filter((w) => w !== "+").join(words[1] === "+" ? "" : " "); // a PowerShell string
  if (/^(?:echo|echo\.|print|write-output|write)$/.test(p)) {
    let i = k + 1;
    while (i < words.length && /^-[neE]+$/.test(words[i])) i++;
    return unesc(words.slice(i).join(" "));
  }
  if (p === "printf") {
    const args = words.slice(k + 1);
    if (args[0] === "--") args.shift();
    if (args[0] === "-v") return null; // printf -v VAR: prints nothing
    const fmt = args.shift() || "";
    const text = fmt.replace(/%(?:[-+ #0]*\d*(?:\.\d+)?)([sbqdiouxXcfeEgG%])/g, (m, c) => (c === "%" ? "%" : args.length ? args.shift() : ""));
    return unesc(text) + (args.length ? " " + args.join(" ") : "");
  }
  return null;
}
// A process substitution's text → the text it prints (every simple command in it prints visible text — shellProducedText), or null.
function shellProcText(text) {
  const segs = shellCommandWords(text, "bash");
  if (!segs.length) return "";
  const parts = segs.map(shellProducedText);
  return parts.some((x) => x == null) ? null : parts.join("\n");
}
// 1.25.1 (review 7) — the edit guard on the shell (hooks/guard-hook.js, Bash / PowerShell / Monitor): the files a command writes, removes,
// replaces or copies into (shellSegOps — the approval guard's own reader; nested scripts read too), as it names them (relative to its
// cwd — and, after a `cd` in the command, to that folder too), `~` expanded; a path that starts with an unknown variable is left out
// ($TMP/x.ts). Bounded: 64 paths. guardCheck decides which are code.
function shellWriteTargets(command, mode) {
  const out = [];
  const ctx = { vars: Object.create(null), cwd: "", collect: (o, m, c) => { for (const p of shellOpPaths(o, m, c)) if (out.length < 64) out.push(p); } };
  shellApprovalActions(String(command == null ? "" : command).slice(0, APPROVAL_COMMAND_MAX), "deny", 0, mode === "ps" ? "ps" : "bash", {}, ctx);
  return [...new Set(out)];
}
// A word of a joined script: one holding whitespace is quoted again ("C:\My Tools\cli\dev-spec.js"), so the script keeps its words.
const joinScriptWords = (list) => list.map((w) => (/\s/.test(w) && !w.includes('"') ? '"' + w + '"' : w)).join(" ");
// 1.23 review 5 (L20) — the POSIX shells whose `-c script arg0 arg1 …` hands the script its positional parameters.
const APPROVAL_POSIX_SHELLS = new Set(["bash", "sh", "zsh", "dash", "ksh"]);
// A -c script with $0 … $9, ${N}, "$@" / $@ / $* replaced by the words after it (arg0 is $0), each quoted when it holds whitespace.
function withPositionals(script, args) {
  const q = (w) => joinScriptWords([w]);
  const rest = joinScriptWords(args.slice(1));
  return String(script).replace(/"\$(?:@|\{@\})"|\$(?:@|\*|\{[@*]\})/g, rest)
    .replace(/"?\$(?:([0-9])|\{([0-9])\})"?/g, (m, a, b) => { const v = args[Number(a !== undefined ? a : b)]; return v === undefined ? "" : q(v); });
}
// The index of a JavaScript runtime's stdin script marker in a simple command (`node - approve …`: the `-`; `node < cli/dev-spec.js`:
// the runtime itself, no arguments), after launchers / env assignments and the runtime's options — or -1.
function stdinScriptAt(words, raw) {
  let runtime = null;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (!runtime) {
      if (w === "" || /^[A-Za-z_]\w*=/.test(w)) continue;
      const p = approvalProgram(w);
      if (APPROVAL_STDIN_RUNTIMES.has(p)) { runtime = p; continue; }
      if (APPROVAL_WRAPPERS.has(p) || w.startsWith("-")) continue;
      return -1;
    }
    if (w === "-") return i;
    if (w.startsWith("-")) { const vals = APPROVAL_OPTION_VALUES.get(runtime); if (vals && vals.has(w)) i++; continue; }
    return -1; // the runtime runs a script file (devSpecWordAt's business)
  }
  return runtime && (words.redirs || []).some((t) => isDevSpecWord(t)) ? words.length - 1 : -1;
}
// powershell -EncodedCommand / -ec / -e <base64 of UTF-16LE> → the script, or null (not base64, or past APPROVAL_COMMAND_MAX).
function decodePwshEncoded(word) {
  const b = String(word || "").trim();
  if (!b || b.length > APPROVAL_COMMAND_MAX * 2 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b)) return null;
  try { return Buffer.from(b, "base64").toString("utf16le"); } catch { return null; }
}
// cmd's /c /k /r — or pwsh / powershell's -Command / -c (any abbreviation, `-` or `/`), -CommandWithArgs, -EncodedCommand
// (pwshOption), Windows PowerShell's first positional (its default is -Command; pwsh 7's is -File: none) — at words[j] (program
// p): the rest of the words is the script, joined (the raw words: a Windows path keeps its backslashes). → { script, mode } | null
function restScript(words, raw, j, p) {
  if (p === "cmd") {
    // (`cmd //c …`: Git Bash's spelling of /c — MSYS turns // into / — 1.23 review 5)
    for (let k = j + 1; k < words.length && /^\//.test(words[k]); k++) {
      if (/^\/\/?[ckr]$/i.test(words[k])) return k + 1 < words.length ? { script: joinScriptWords(raw.slice(k + 1)), mode: "cmd" } : null;
    }
    return null;
  }
  if (p !== "pwsh" && p !== "powershell") return null;
  for (let k = j + 1; k < words.length; k++) {
    const w = words[k];
    if (/^[-/]/.test(w)) {
      const o = pwshOption(w);
      // -EncodedCommand (-ec, -e…): its value is the script, base64 of UTF-16LE — decoded and read (1.23 review 5)
      const opt = w.slice(1).toLowerCase();
      if (o === "script" && (opt === "ec" || (opt[0] === "e" && "encodedcommand".startsWith(opt)))) {
        const s = k + 1 < words.length ? decodePwshEncoded(raw[k + 1]) : null;
        return s ? { script: s, mode: "ps" } : null;
      }
      if (o === "script") return k + 1 < words.length ? { script: joinScriptWords(raw.slice(k + 1)), mode: "ps" } : null;
      if (o === "file") return null;
      if (o === "value") k++;
      continue;
    }
    return p === "powershell" ? { script: joinScriptWords(raw.slice(k)), mode: "ps" } : null;
  }
  return null;
}
// Start-Process (saps; PowerShell's `start`) at words[j] → the command line it starts: -FilePath (or the first positional) and
// -ArgumentList / -Args (or the second positional) — a string, a comma list ('a','b' — the lexer joins it as a,b), or an
// @( … ) / ( … ) array (the lexer's next segment) — joined with spaces, as PowerShell hands them to the process. Or null.
const APPROVAL_START_PROCESS = new Set(["start-process", "saps", "start"]);
const START_PROCESS_VALUES = ["credential", "workingdirectory", "redirectstandarderror", "redirectstandardinput", "redirectstandardoutput",
  "windowstyle", "verb", "environment"];
function startProcessLine(words, raw, j, nextSeg) {
  let file = null, args = null, argsFlag = false, pos = 0;
  for (let k = j + 1; k < words.length; k++) {
    const w = words[k];
    if (/^-[A-Za-z]/.test(w)) {
      const n = w.slice(1).toLowerCase().replace(/:$/, "");
      if (n === "path" || n === "pspath" || (n.length >= 1 && "filepath".startsWith(n))) file = raw[++k] != null ? raw[k] : null;
      else if (n === "args" || (n.length >= 1 && "argumentlist".startsWith(n))) { argsFlag = true; args = raw[++k] != null ? raw[k] : null; }
      else if (["rse", "rsi", "rso", "wd"].includes(n) || (n.length >= 3 && START_PROCESS_VALUES.some((v) => v.startsWith(n)))) k++;
      continue;
    }
    if (pos === 0) file = raw[k];
    else if (pos === 1) { args = raw[k]; argsFlag = true; }
    pos++;
  }
  if (!file) return null;
  if (argsFlag && (args == null || args === "@") && nextSeg) args = (nextSeg.raw || nextSeg).join(",");
  const list = args == null ? [] : String(args).split(",").map((a) => a.trim()).filter(Boolean);
  return joinScriptWords([file]) + (list.length ? " " + list.join(" ") : "");
}
// find … -exec / -execdir / -ok / -okdir <command> … ; (or +) → the actions of each such command (the CLI in its program position).
function findExecActions(words, raw, level, meta) {
  const k0 = programAt(words, raw);
  if (k0 < 0 || approvalProgram(words[k0]) !== "find") return [];
  const out = [];
  for (let k = k0 + 1; k < words.length; k++) {
    if (!/^-(?:exec|execdir|ok|okdir)$/.test(words[k])) continue;
    let e = k + 1;
    while (e < words.length && words[e] !== ";" && words[e] !== "+") e++;
    const sub = words.slice(k + 1, e), subRaw = raw.slice(k + 1, e);
    const at = devSpecWordAt(sub, subRaw);
    if (at >= 0) out.push(...cliApprovalAction(sub.slice(at + 1), level, meta));
    k = e;
  }
  return out;
}
// 1.16 U: a revocation (revoke: true — the same gate as an approval: the approval record is the human's) and a waiver's reason /
// expiry (carried into the command the human runs) → the extra fields of an "approve" action (none when absent).
function approvalExtras(revoke, reason, expires) {
  const out = {};
  if (revoke) out.revoke = true;
  if (approvalStr(reason)) out.reason = approvalStr(reason);
  if (approvalStr(expires)) out.expires = approvalStr(expires);
  return out;
}
function mcpApprovalAction(tool, ti, level, meta) {
  const base = { source: "mcp", project: approvalStr(ti.projectDir) };
  if (tool === "spec_approve") {
    return [Object.assign({ kind: "approve", feature: approvalStr(ti.name), phase: approvalStr(ti.phase), through: approvalStr(ti.through),
      role: approvalStr(ti.role), by: approvalStr(ti.by), force: ti.force === true }, approvalExtras(ti.revoke === true, ti.reason, ti.expires), base)];
  }
  // spec_feature remove without confirm: true only previews what it would delete; archive / rename / restore / flow aren't approvals.
  if (tool === "spec_feature") return String(approvalStr(ti.action) || "").toLowerCase() === "remove" && ti.confirm === true ? [Object.assign({ kind: "remove", feature: approvalStr(ti.name) }, base)] : [];
  // 1.24 review 6 (E3): spec_add_track {remove: true} turning off +tdd / +ai (the gates they carry); adding a track is never one.
  if (tool === "spec_add_track") {
    // (`track`: the schema's string; an array, or a `tracks` key, read too — a superset)
    const tracks = ti.remove === true ? approvalGatedTracks([].concat(ti.track == null ? [] : ti.track, ti.tracks == null ? [] : ti.tracks)) : [];
    return tracks.length ? [Object.assign({ kind: "guard-down", setting: "track", feature: approvalStr(ti.name), tracks }, base)] : [];
  }
  // spec_init: only what LOWERS a protection (the approval guard, the evidence mode, roles, project checks, the stop gate, the edit guard).
  return initGuardDowns({ approvalGuard: approvalGuardInput(ti.approvalGuard), evidence: evidenceModeInput(ti.evidence), stopCheck: ti.stopCheck === false ? false : undefined,
    guard: guardInput(ti.guard), roles: initRolesInput(ti.approvalRoles), checks: initChecksInput(ti.checks) }, level, meta).map((a) => Object.assign(a, base));
}
// The command the human runs instead (`! node "<clone>/cli/dev-spec.js" approve <f> <phase> …`), or null when there is none (a
// shell write of roadmap.json). A value from the agent's call goes in only when it is plainly safe to paste into bash / PowerShell
// (else a <placeholder>): no quote, $, backtick, backslash or !.
function approvalCommand(a, cli) {
  const safe = (v, re) => (typeof v === "string" && re.test(v) ? v : null);
  const word = (v, ph) => safe(v, /^[\p{L}\p{N}_.-]{1,80}$/u) || ph;
  const name = (v) => { const s = safe(v, /^[\p{L}\p{N} _.@+,-]{1,120}$/u); return s ? (/\s/.test(s) ? '"' + s + '"' : s) : "<feature>"; };
  if (a.kind === "unreadable") return null; // a command the guard can't read: there is no CLI line to suggest (1.23 review 5)
  const words = [i18n.cliPrefix(cli)]; // 1.21 F3: `node "<cli>"`, quoted like every runnable CLI line (i18n/common.js cliQuote)
  if (a.kind === "remove") words.push("feature", "remove", name(a.feature), "--yes");
  else if (a.kind === "guard-down") {
    // a write / edit of the file itself (1.24: or of the harness-observed log — evidence is recorded by the harness, never by hand):
    // the user makes it
    if (a.setting === "roadmap" || a.setting === "state" || a.setting === "observed" || a.setting === "specs" || a.setting === "link") return null;
    if (a.setting === "track") words.push("add-track", name(a.feature), ...(Array.isArray(a.tracks) ? a.tracks : []).map((t) => word(t, "<track>")), "--remove");
    else if (a.setting === "evidence") words.push("init", "--evidence", "reported");
    else if (a.setting === "stopCheck") words.push("init", "--stop-check", "off");
    else if (a.setting === "guard") words.push("init", "--guard", a.to === "on" ? "on" : "off");
    else if (a.setting === "roles") {
      const map = isObj(a.to) ? a.to : {};
      words.push("init", "--roles", Object.keys(map).length ? '"' + Object.entries(map).map(([p, r]) => p + "=" + r.join("+")).join(",") + '"' : "none");
    } else if (a.setting === "check") {
      const n = safe(a.name, /^[A-Za-z0-9][A-Za-z0-9._:-]{0,39}$/) || "<name>";
      words.push("init", "--check", '"' + n + "=" + (a.to == null ? "" : safe(a.to, /^[\p{L}\p{N} _.@+,:/=-]{1,200}$/u) || "<command>") + '"');
    } else words.push("init", "--approval-guard", a.to);
  } else {
    words.push("approve", name(a.feature));
    if (a.through) words.push("--through", word(a.through, "<phase>"));
    else words.push(word(a.phase, "<phase>"));
    if (a.role) words.push("--role", word(a.role, "<role>"));
    if (a.revoke) words.push("--revoke"); // 1.16 U2: the human revokes — never an approve line in its place
    else if (a.force) words.push("--force");
    // 1.16 U3 / U2: the reason (a waiver's, a revocation's) and the expiry go in only when plainly safe to paste, else a placeholder
    if (a.reason) words.push("--reason", "\"" + (safe(a.reason, /^[\p{L}\p{N} _.,:;@+()/-]{1,200}$/u) || "<reason>") + "\"");
    if (a.expires && !a.revoke) words.push("--expires", word(a.expires, "<YYYY-MM-DD>"));
  }
  const proj = a.project ? safe(a.project.replace(/\\/g, "/"),/^[\p{L}\p{N} _.@+,:/()~-]{1,400}$/u) : null;
  if (proj) words.push("--project", '"' + proj + '"');
  return words.join(" ");
}

// The approval guard's decision for ONE tool call (the PreToolUse payload: tool_name + tool_input) at `level` ("off" | "ask" |
// "deny" — the project's meta.approvalGuard, read by the caller). Pure. → { decision: "allow" | "ask" | "deny", why, level, … };
// why (stable): off · no-payload · not-pre-tool-use · not-an-approval · approval. On an approval: `actions` [{kind: approve |
// remove | guard-down, source: mcp | cli | shell, feature, phase, through, role, by, force, setting (guard-down: approvalGuard |
// evidence | roles | check | stopCheck | guard | roadmap), from, to, name, removed, project}], `force`, `command` (what the human
// runs, `!`-prefixed — opts.plain: without the `!`, for the MCP server; null when there is none), `reason` (localized — opts.lang:
// the user reads it for ask, the agent for deny) and, for deny, `userNote` (the line the user sees). opts.cli: the CLI path shown (default: this clone's cli/dev-spec.js);
// opts.meta: the project's roadmap.json meta (what a spec_init / `init` change is compared with — absent: unknown, fail closed).
// opts.resolveFeature (1.23 — the MCP server): name → the slug the engine resolves it to, or null; a resolved action shows (and
// its command names) that slug, never the raw argument — slugify drops text in other scripts, which must not reach the question.
function approvalGuardDecision(payload, level, opts = {}) {
  const lvl = approvalGuardInput(level) || "off";
  const allow = (why, extra) => Object.assign({ decision: "allow", why, level: lvl }, extra);
  if (lvl === "off") return allow("off");
  if (!isObj(payload)) return allow("no-payload");
  const event = payload.hook_event_name || payload.hookEventName;
  if (event && event !== "PreToolUse") return allow("not-pre-tool-use");
  const tool = typeof payload.tool_name === "string" ? payload.tool_name : typeof payload.toolName === "string" ? payload.toolName : "";
  const ti = isObj(payload.tool_input) ? payload.tool_input : isObj(payload.toolInput) ? payload.toolInput : {};
  const meta = isObj(opts.meta) ? opts.meta : undefined;
  let actions = [];
  const m = RE_APPROVAL_MCP.exec(tool);
  // 1.24 review 6 (C-I10): the approval hook got the payload only in part (stdin still open at its 2 s safety net) and that part names
  // dev-spec, .specs/ or an approval tool — what the call does can't be read: ask (never allowed, never refused).
  if (opts.partial === true) actions = [{ kind: "unreadable", why: "partial", source: "hook" }];
  else if (m) actions = mcpApprovalAction(m[1], ti, lvl, meta);
  else if (APPROVAL_SHELL_TOOLS.has(tool) && typeof ti.command === "string") {
    const mode = tool === "PowerShell" ? "ps" : "bash"; // Monitor runs its command in the Bash tool's shell
    const head = ti.command.slice(0, APPROVAL_COMMAND_MAX);
    if (ti.command.length > APPROVAL_COMMAND_MAX && approvalCandidate(ti.command.slice(APPROVAL_COMMAND_MAX - 64))) {
      // 1.23 review 5 (L20): past the read limit nothing was seen — an approval after the first 64 KB went through at deny. A
      // command whose unread tail names dev-spec (or .specs) is refused / asked as unreadable; an unread tail that names neither
      // runs nothing of dev-spec's, and the head is read as before.
      actions = [{ kind: "unreadable", why: "too-long", length: ti.command.length, source: "shell" }];
    } else if (approvalCandidate(head)) {
      actions = shellApprovalActions(head, lvl, 0, mode, meta);
      // 1.23 review 5 (fail closed): the CLI named with an approval word, in a form the lexer can't follow (a launcher it doesn't
      // know, a string built by concatenation, a glob, a variable) — the user is asked instead of the call being allowed.
      if (!actions.length && approvalUnparsed(head, mode)) actions = [{ kind: "unreadable", why: "unparsed", source: "shell" }];
    }
  } else if (APPROVAL_EDIT_TOOLS.has(tool) && (typeof ti.file_path === "string" || typeof ti.notebook_path === "string")) {
    // 1.23 review 5: a hand edit of .specs/roadmap.json or of a feature's .state.json (its approvals, evidence, history); 1.24 review 6:
    // of a harness-observed log (C6), the path read as the file system reads it — `./`, `..`, a stream, an 8.3 short name (C5) — and
    // (1.25.1) through a link to .specs/ (the real path of its folder).
    actions = approvalEditActions([typeof ti.file_path === "string" ? ti.file_path : ti.notebook_path], payload.cwd, false);
  } else if (RE_MCP_FILE_TOOL.test(tool) && !RE_DEVSPEC_MCP_TOOL.test(tool)) {
    // 1.25.1 (review 7): another MCP server's file tool — each path-like argument read as an Edit's path; a move / rename / delete of
    // .specs/ itself, of a folder or a glob under it, too
    actions = approvalEditActions(approvalPathArgs(ti, opts.uriPath), payload.cwd, /(?:move|rename|delete|remove|unlink)/i.test(tool.replace(/^mcp__.+__/, "")));
  }
  if (opts.projectUnreadable === true && actions.length) actions.push({ kind: "unreadable", why: "project", source: "mcp" });
  if (!actions.length) return allow("not-an-approval", { tool });
  if (typeof opts.resolveFeature === "function") {
    actions = actions.map((a) => {
      if (typeof a.feature !== "string" || !a.feature) return a;
      let slug = null;
      try { slug = opts.resolveFeature(a.feature); } catch { slug = null; }
      return typeof slug === "string" && slug ? Object.assign({}, a, { feature: slug }) : a;
    });
  }
  const A = i18n.msg(normalizeLang(opts.lang || "en")).approvalGuard;
  // Shown as text (the prompt, the agent's context): one line each, bounded.
  const show = (v) => (v == null ? v : (() => { const s = String(v).replace(/[\u0000-\u001f\u007f]+/g, " "); return s.length > 80 ? s.slice(0, 79) + "…" : s; })());
  const list = actions.map((a) => A.action(Object.assign({}, a, { feature: show(a.feature), phase: show(a.phase), through: show(a.through), role: show(a.role), by: show(a.by),
    name: show(a.name), removed: Array.isArray(a.removed) ? a.removed.map(show) : a.removed })));
  const text = [...new Set(list)].join("; ");
  const force = actions.some((a) => a.force);
  const cli = typeof opts.cli === "string" && opts.cli ? opts.cli : i18n.DEV_SPEC_SCRIPT;
  const commands = [...new Set(actions.map((a) => approvalCommand(a, cli)).filter(Boolean))];
  // opts.plain (1.21 review A4 — the MCP server, for a client outside Claude Code): the command as a plain runnable line, without
  // Claude Code's `!` prefix (a PowerShell or cmd.exe user can't run `! node …`), and a deny reason that never mentions it.
  const plain = opts.plain === true;
  const command = commands.length ? (plain ? "" : "! ") + commands.join(" && ") : null;
  // summary (1.21 F1b): the actions as one localized line — what the MCP server's elicitation asks the user about.
  // A command the guard could not follow (why: "unparsed") is never refused outright — it may be no approval at all: ask.
  // (1.25.1: a script fed to a shell out of sight, an unknown program run on .specs/ files, the hook's own failure — the same)
  const decision = actions.every((a) => a.kind === "unreadable" && APPROVAL_ASK_WHYS.includes(a.why)) ? "ask" : lvl;
  const res = { decision, why: "approval", level: lvl, tool, actions, force, command, summary: text,
    reason: decision === "deny" ? (plain ? A.denyMcp(text, command) : A.deny(text, command)) : A.ask(text, force) };
  if (decision === "deny") res.userNote = A.denyUser(text, command);
  return res;
}
// The project folder of a .specs/ path (the folder holding .specs/) — the project an edit of its roadmap.json / .state.json acts on.
function approvalSpecsProject(fp) {
  const m = /^(.*?)[\\/]*\.specs[\\/]/i.exec(String(fp));
  return m && m[1] ? m[1] : null;
}
// Edited paths (a Write / Edit / NotebookEdit target, an MCP file tool's path arguments) → the guard-down actions: the first one that is
// .specs/roadmap.json, a .state.json or an observed log (as the file system reads it — approvalEditTargets); with `whole` (a move /
// rename / delete tool) also .specs/ itself, a folder or a glob under it (not an .execution/ folder, a lock).
function approvalEditActions(paths, cwd, whole) {
  for (const p of paths) {
    for (const t of approvalEditTargets(p, cwd)) {
      const h = approvalGuardedFile(t);
      if (h) return [Object.assign({ kind: "guard-down", setting: h.setting, source: "edit" }, h.setting === "roadmap" ? {} : { feature: h.feature || null }, { project: approvalSpecsProject(t) })];
      if (!whole) continue;
      const f = shellPathFacts(t, "ps");
      if ((f.dir || (f.specs >= 0 && (f.folder || f.may))) && !f.execution && !f.lock) return [{ kind: "guard-down", setting: "specs", source: "edit", project: approvalSpecsProject(t + "/") }];
    }
  }
  return [];
}
// An MCP tool's arguments → the strings that may be paths: the values (strings, or arrays / objects of them, 3 levels deep) of keys
// named like one (path, file, source, destination, target, from, to, dir…), one line each, at most 32; a file:// URI read as its path
// (uriPath — hook-utils.js fileUriToPath, the hook's and the MCP server's one reading).
function approvalPathArgs(ti, uriPath) {
  const out = [];
  const walk = (v, keyed, depth) => {
    if (out.length >= 32 || depth > 3) return;
    if (typeof v === "string") {
      if (!keyed || !v.trim() || v.length > 4096 || /[\r\n]/.test(v)) return;
      const s = v.trim();
      const u = /^file:\/\//i.test(s) && typeof uriPath === "function" ? uriPath(s) : null;
      out.push(u || s);
    } else if (Array.isArray(v)) v.forEach((x) => walk(x, keyed, depth + 1));
    else if (isObj(v)) for (const [k, x] of Object.entries(v)) walk(x, keyed || RE_MCP_PATH_KEY.test(k), depth + 1);
  };
  walk(ti, false, 0);
  return out;
}
// 1.23 review 5 (fail closed) — a shell command that names the CLI (dev-spec, a glob that may be it, a string joined from pieces)
// together with an approval word, in a simple command whose program is no text-only program (echo, git, grep, cat…), or a
// JavaScript runtime whose script is a substitution / variable — when the lexer found no action in it. → true: ask the user.
const RE_PS_STOP_AFTER_CLI = /dev-?spec[^\s|;]*\s+--%(?=\s|$)/i;
// The words after the CLI at words[at] → true when its subcommand (the first word after its --flags and their values) can't be read:
// "" (a substitution), a variable, a positional parameter, a word holding $( or a backtick, a PowerShell @splat — or no subcommand at
// all where one may come at run time (xargs / parallel feed it; a PowerShell ( ) expression ends the lexer's simple command).
function cliSubcommandUnread(words, at, mode) {
  let i = at + 1;
  for (; i < words.length; i++) {
    const w = words[i];
    if (w === "--") { i++; break; }
    const m = /^--([A-Za-z][\w-]*)(=[\s\S]*)?$/.exec(w);
    if (!m) break;
    if (m[2] === undefined && !CLI_SWITCHES.has(m[1].toLowerCase()) && i + 1 < words.length) i++;
  }
  const sub = words[i];
  if (sub === undefined) return mode === "ps" || words.slice(0, at).some((w) => /^(?:xargs|parallel)$/.test(approvalProgram(w)));
  return sub === "" || RE_APPROVAL_VAR_WORD.test(sub) || /^\$(?:[@*#?!0-9]|\{[@*#0-9])/.test(sub) || /\$\(|`/.test(sub) || (mode === "ps" && /^@(?:[A-Za-z_]|$)/.test(sub));
}
// 1.25.1 (review 7): in Bash the CLI's subcommand word is a glob or a brace expansion (`{approve,}`, `appro?e`, `app[r]ove`,
// `appro{v,}e`) that may expand to a subcommand the guard stands on — the shell expands it (a glob, when a file of that name exists),
// the guard can't know to what: unreadable, whatever approval word the text holds.
const CLI_GUARDED_COMMANDS = ["approve", "feature", "init", "add-track", "merge-state"];
function cliSubcommandGlob(words, at) {
  let i = at + 1;
  for (; i < words.length; i++) {
    const m = /^--([A-Za-z][\w-]*)(=[\s\S]*)?$/.exec(words[i]);
    if (!m) break;
    if (m[2] === undefined && !CLI_SWITCHES.has(m[1].toLowerCase()) && i + 1 < words.length) i++;
  }
  const sub = words[i];
  if (typeof sub !== "string" || !/[*?[{]/.test(sub)) return false;
  return braceExpand(sub).some((x) => {
    if (!/[*?[]/.test(x)) return CLI_GUARDED_COMMANDS.includes(x.toLowerCase());
    const re = shellGlobRe(x, "bash");
    return !re || CLI_GUARDED_COMMANDS.some((c) => re.test(c));
  });
}
function approvalUnparsed(command, mode) {
  if (mode === "bash") {
    for (const words of shellCommandWords(command, mode)) {
      const at = devSpecWordAt(words, words.raw || words);
      if (at >= 0 && cliSubcommandGlob(words, at)) return true;
    }
  }
  const plain = approvalPlain(command);
  // the approval word in the plain text — a ${X:-approve} / ${X:=…} default too — or in the raw text (`printf 'approve\nalpha'`)
  if (!RE_APPROVAL_VERB.test(plain.replace(/:[-=+?]/g, " ")) && !RE_APPROVAL_VERB.test(String(command))) return false;
  const mentions = (list) => list.some((w) => /dev-?spec/i.test(w) || devSpecGlob(w)) || /dev-?spec/i.test(list.join("").replace(/\+/g, ""));
  const named = /dev-?spec/i.test(plain);
  for (const words of shellCommandWords(command, mode)) {
    const raw = words.raw || words;
    const at = devSpecWordAt(words, raw);
    if (at >= 0) {
      // 1.24 review 6 (C7): the CLI where it runs, its subcommand a value the guard can't read — a variable (`A=approve; node cli $A`,
      // PowerShell's `$s`), a substitution (`$(echo approve)`, backticks, `"$(printf approve)"`), `"$@"` / `${args[@]}`, a PowerShell
      // ( ) expression or @splat, or nothing at all under xargs (`echo approve a b | xargs node cli`): ask.
      if (cliSubcommandUnread(words, at, mode)) return true;
      // (C1) PowerShell's --% right after the CLI: the rest reaches it raw — the lexer found no action in it, yet the text holds an
      // approval word (`node cli --% status "x" approve`): ask.
      if (mode === "ps" && RE_PS_STOP_AFTER_CLI.test(command)) return true;
      // the CLI read where it runs (`dev-spec status x`, `approve a b --help`, a preview): the lexer's answer stands
      continue;
    }
    if (named && stdinScriptAt(words, raw) >= 0) continue;
    const k = programAt(words, raw);
    const p = k >= 0 ? approvalProgram(words[k]) : "";
    if (mentions(words.concat(raw, words.redirs || [])) && !APPROVAL_TEXT_PROGRAMS.has(p)) return true;
    // `node $(echo cli/dev-spec.js) approve …`, `node $p approve …` ($p = 'cli/dev-spec.js'): the script is a substitution or a variable
    if (named) {
      const r = words.findIndex((w) => APPROVAL_STDIN_RUNTIMES.has(approvalProgram(w)) || approvalProgram(w) === "deno");
      if (r >= 0 && r + 1 < words.length && (words[r + 1] === "" || RE_APPROVAL_VAR_WORD.test(words[r + 1]))) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// 1.14 C1 — "evidence before claims" at the END OF A TURN (hooks/stop-hook.js on Stop / SubagentStop; `dev-spec stop-check`)
// and the scope guard (roadmap.json meta.guard = "scope": a code edit no open task plans in _Implements:_ asks).
// ---------------------------------------------------------------------------

const STOP_RECENT_HOURS = 4; // "recently active": a task ticked, evidence recorded or tasks.md edited (lastEditAt) within these hours
const STOP_MESSAGE_MAX = 20000; // the message's LAST characters are read (the claim sits in the closing lines)
const STOP_MAX_FEATURES = 50; // recently active features checked, at most — the most recent first (bounded: the hook runs at the end of every turn)
const STOP_TASKS_SHOWN = 8; // task numbers listed per feature in the reason
const STOP_REPORT_MAX = 256 * 1024; // bytes of an implementer's report read
const STOP_WINDOW = 3; // words before a claim, in its sentence, looked at for a negator / condition

// roadmap.json meta.guard → false | true | "scope" (anything else: off); unset → the user's GUARD_DEFAULT (1.16 C2), else off.
// The user's default applies to a dev-spec project only (isDevSpecDir): roadmap.json without meta.guard, or no roadmap.json in a
// .specs/ dev-spec owns (steering/ or a feature folder with its .state.json — a project made before roadmap.json) — never a folder
// without one, nor another tool's .specs/. A roadmap.json that exists but doesn't parse: off (the guard never acts on a file it
// can't read). hooks/guard-hook.js reads the same values raw, with the same rule.
function guardLevel(projectDir) {
  const l = loadRoadmap(projectDir);
  if (l.parseError) return false;
  const g = isObj(l.rm.meta) ? l.rm.meta.guard : undefined;
  if (g === undefined) {
    const d = userDefaults().guard;
    return (d === true || d === "scope") && isDevSpecDir(path.resolve(projectDir)) ? d : false;
  }
  return g === true ? true : g === "scope" ? "scope" : false;
}
// spec_init {guard} / `init --guard`: true | "on" → true, false | "off" → false, "scope" → "scope" (strings case-insensitive);
// anything else → undefined (unchanged).
function guardInput(v) {
  if (v === true || v === false) return v;
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  return s === "on" ? true : s === "off" ? false : s === "scope" ? "scope" : undefined;
}
// roadmap.json meta.stopCheck — the evidence gate is ON unless it is exactly false (spec_init {stopCheck} / `init --stop-check`);
// not a boolean (unset) → the user's STOP_CHECK option (1.16 C2), else on. An unreadable roadmap.json: the user's option too, else
// on (the gate itself never blocks on a file it can't read) — DEV_SPEC_STOP_CHECK=off was ignored while the file didn't parse.
function stopCheckEnabled(projectDir) {
  const l = loadRoadmap(projectDir);
  if (l.parseError) return userDefaults().stopCheck !== false;
  const v = isObj(l.rm.meta) ? l.rm.meta.stopCheck : undefined;
  if (typeof v === "boolean") return v;
  return userDefaults().stopCheck !== false;
}
// Inside initProject's roadmap lock. ON is the default (absent = on): no write when the effective value doesn't change — with or
// without the user's STOP_CHECK option (an explicit on / off where that option decides pins it for the project).
function setStopCheck(projectDir, on) {
  const rm = readRoadmap(projectDir);
  rm.meta = isObj(rm.meta) ? rm.meta : {};
  if (rm.meta.stopCheck === on) return;
  if (rm.meta.stopCheck === undefined && on === true && userDefaults().stopCheck !== false) return;
  rm.meta.stopCheck = on;
  writeRoadmap(projectDir, rm);
}

// The claim patterns of every language (i18n stopGate.claims / negators / admissions / fixed), compiled once: whole words
// (unicode boundaries — JS \b never matched "concluído"), case-insensitive, ^/$ per line. Each claim pattern keeps the base
// languages that list it (pt-BR is pt): the two negators the languages disagree on are read by language (stopNegates).
// 1.24 r6 I-I4: the claim scan's parts the Stop hook's pre-filter reuses before the engine loads — scripts/build.js writes them, with
// every language's claim patterns (stopClaimSources), into hooks/stop-claims.generated.json (stopClaimFilter).
const STOP_WORD = Object.freeze({ pre: "(?<![\\p{L}\\p{N}_])(?:", post: ")(?![\\p{L}\\p{N}_])", flags: "gimu" });
// A claim pattern { source, flags, langs, re } whose RegExp is built on its first use (1.27): a message runs only the patterns of
// the languages it triggers (~18 of ~47), and each RegExp built parses its Unicode property classes (~0.2 ms).
function stopLazyPattern(source, flags, langs) {
  let re = null;
  return { source, flags, langs, get re() { return re || (re = new RegExp(source, flags)); } };
}
let STOP_PATTERNS = null;
function stopPatterns() {
  if (STOP_PATTERNS) return STOP_PATTERNS;
  const all = (k) => [...new Set(i18n.LANGS.flatMap((l) => (i18n.msg(l).stopGate || {})[k] || []))]; // pt-BR repeats pt's patterns
  const langsOf = new Map();
  for (const l of i18n.LANGS) for (const src of (i18n.msg(l).stopGate || {}).claims || []) {
    if (!langsOf.has(src)) langsOf.set(src, new Set());
    langsOf.get(src).add(i18n.baseLang(l));
  }
  // 1.25.1 — each base language's trigger words (i18n stopGate.triggers; pt-BR's are pt's): a claim pattern of a language runs only
  // when the text holds one of its triggers — every pattern holds one, so the answer is the same, and a message that triggers no
  // language compiles none of the ~47 patterns (~35 ms of the first stopClaims in a process).
  const triggers = new Map();
  for (const l of i18n.LANGS) {
    const b = i18n.baseLang(l), src = ((i18n.msg(l).stopGate || {}).triggers || []).join("|");
    if (src) triggers.set(b, triggers.has(b) ? triggers.get(b) + "|" + src : src);
  }
  // triggers / admissions: built on first use too (1.27 — a text scanned as its one-byte projection runs rewritten copies of them)
  let trig = null, adm = null;
  STOP_PATTERNS = {
    claims: [...langsOf].map(([src, langs]) => stopLazyPattern(STOP_WORD.pre + src + STOP_WORD.post, STOP_WORD.flags, langs)),
    triggerSources: new Map([...triggers].map(([b, src]) => [b, STOP_WORD.pre + src + STOP_WORD.post])), // flags "iu"
    get triggers() { return trig || (trig = new Map([...this.triggerSources].map(([b, src]) => [b, new RegExp(src, "iu")]))); },
    admissionSources: all("admissions").map((src) => STOP_WORD.pre + src + STOP_WORD.post), // flags STOP_WORD.flags
    get admissions() { return adm || (adm = this.admissionSources.map((src) => new RegExp(src, STOP_WORD.flags))); },
    negators: new Set(all("negators").map((w) => w.toLowerCase())),
    fixed: new Set(all("fixed").map((w) => w.toLowerCase())),
    // 1.22 review: a zero count right before an admission ("0 tests failing", "none of the tests fail") — read on the few
    // characters before it, so `\s+$` anchors it to the admission; "now pass(es)" after a failure in its clause (fixed).
    zero: new RegExp("(?<![\\p{L}\\p{N}_])(?:" + all("zeroes").join("|") + ")\\s+$", "iu"),
    passNow: new RegExp("(?<![\\p{L}\\p{N}_])(?:" + all("passNow").join("|") + ")(?![\\p{L}\\p{N}_])", "iu"),
  };
  return STOP_PATTERNS;
}
// Where the clause holding position `i` starts: after the last line / sentence break, or a colon or a dash ("No problem — task
// 2 is done": the "no" belongs to another clause). → the index of the break (−1: the text's start)
// Only the few words before i matter (STOP_WINDOW / 4): the look-back is bounded, so every hit costs O(1) — slicing the whole
// text before each hit made a long message of admissions quadratic (20 KB of "was 2 failing": half a second).
const STOP_CLAUSE_SPAN = 400;
function stopClauseStart(text, i) {
  const lo = Math.max(0, i - STOP_CLAUSE_SPAN);
  const before = text.slice(lo, i);
  const k = Math.max(...["\n", ".", "!", "?", ";", ":", "—", "–", " - "].map((c) => before.lastIndexOf(c)));
  return k < 0 ? lo - 1 : lo + k;
}
// ES "no" before a verb, a clitic or "todo" is a negation ("no está terminado", "no se ha completado", "no todo está hecho");
// PT "no" (em + o) comes before a noun ("a correção no módulo").
const RE_ES_NO_NEXT = /^(?:est[áa]n?|estaba|estaban|es|son|era|eran|fue|fueron|ha|han|he|hemos|has|había|habían|hay|se|lo|la|los|las|le|les|me|te|nos|queda|quedan|quedó|quedaron|funciona|funcionan|pasa|pasan|puede|pueden|tiene|tienen|debe|deben|todo|todos|todas|del|todavía|aún)$/u;
// ES reflexive "se" before an auxiliary or a preterite ("se ha completado", "se han implementado", "se completó") — PT "se" (if)
// is never followed by those (PT writes "há", with the accent).
const RE_ES_SE_NEXT = /^(?:ha|han|has|he|hemos|había|habían|hubo|fue|fueron|queda|quedan|quedó|quedaron|\p{L}{3,}ó|\p{L}{3,}(?:aron|ieron))$/u;
// Is words[i] a negator for a claim that reads as `langs` (its pattern's languages and those of any other pattern matching at the
// same place — "está terminado" is PT and ES) in a message guessed as `lang`? Pooled across languages, except the two words they
// disagree on: "no" (EN / ES: not; PT: em + o) and "se" (PT: if; ES: the reflexive pronoun).
function stopNegates(words, i, langs, lang) {
  const w = words[i];
  if (/n['’]t$/.test(w) || /['’]ll$/.test(w)) return true;
  if (!stopPatterns().negators.has(w)) return false;
  const next = words[i + 1] || "";
  if (w === "no") return lang !== "pt" && (langs.has("en") || (langs.has("es") && (i === words.length - 2 || RE_ES_NO_NEXT.test(next))));
  if (w === "se") return lang !== "es" && langs.has("pt") && !RE_ES_SE_NEXT.test(next);
  return true;
}
// Does a failure the message names (an admission at [start, end)) describe what was already FIXED — "I fixed the 2 failing
// tests", "Previously 4 tests failed", "the 3 failures from yesterday are fixed"? A fixed-word (i18n stopGate.fixed: fixing
// verbs and "previously" — never an auxiliary like "was" / "had", which any honest "2 tests failed and I was unable to fix
// them" holds) among the 4 words before it in its clause, or the 4 words after it before the clause ends — and no negator
// anywhere in that window ("I haven't fixed the 2 failing tests", "the 3 failing tests were not fixed").
// 1.22 review: …or a "now pass(es)" (i18n stopGate.passNow) after it in its clause with no negator before it ("Fixed the bug;
// the 2 failing tests now pass" — the `;` cut the fixed word off, and it read as an admission).
function stopPastFailure(text, start, end, wordsOf) {
  const P = stopPatterns();
  const neg = (w) => P.negators.has(w) || /n['’]t$/.test(w);
  const before = wordsOf(text.slice(stopClauseStart(text, start) + 1, start)).slice(-4).map((w) => w.toLowerCase());
  const tail = (text.slice(end, end + STOP_CLAUSE_SPAN).match(/^[^\n.!?;:,—–]*/) || [""])[0];
  const after = wordsOf(tail).slice(0, 4).map((w) => w.toLowerCase());
  const fixedIn = (ws) => ws.some((w) => P.fixed.has(w)) && !ws.some(neg);
  const now = P.passNow.exec(tail);
  return fixedIn(before) || fixedIn(after) || (!!now && !wordsOf(tail.slice(0, now.index)).some((w) => neg(w.toLowerCase())));
}
// 1.22 review: is the admission at `start` counted as ZERO ("0 tests failing", "no tests fail", "none of the tests fail", PT
// "nenhum teste falha", ES "ninguna prueba falla")? A zero word (i18n stopGate.zeroes) right before it in its clause.
function stopZeroCount(text, start) {
  const from = Math.max(stopClauseStart(text, start) + 1, start - 60);
  return stopPatterns().zero.test(text.slice(from, start));
}
// The message as prose: its last STOP_MESSAGE_MAX characters without fenced code, inline code, HTML comments and quoted
// lines (> …) — a pasted command output or a quoted instruction claims nothing.
// (?=(…))\2: the fence opener taken whole, never backtracked (a line of 20,000 backticks was quadratic — 1.17 H); the comments by
// replaceHtmlCommentSpans (/<!--[\s\S]*?-->/g rescanned the rest from each unclosed "<!--"). The regexes are constants: the Stop
// hook's pre-filter (hooks/hook-utils.js claimProse) runs the same ones from hooks/stop-claims.generated.json (1.24 r6 I-I4).
const RE_STOP_FENCE = /(^|\n)[ \t]*(?=(`{3,}|~{3,}))\2[^\n]*\n[\s\S]*?(?:\n[ \t]*\2[^\n]*(?=\n|$)|$)/g;
const RE_STOP_CODE = /`[^`\n]*`/g;
const RE_STOP_QUOTE = /^[ \t]*>/;
function stopProse(message) {
  const s = String(message == null ? "" : message).replace(/\r\n?/g, "\n");
  const unfenced = s.slice(-STOP_MESSAGE_MAX).replace(RE_STOP_FENCE, "$1");
  return replaceHtmlCommentSpans(unfenced, () => " ")
    .replace(RE_STOP_CODE, " ")
    .split("\n").filter((l) => !RE_STOP_QUOTE.test(l)).join("\n");
}
// 1.24 r6 I-I4 — every language's claim patterns (i18n stopGate.claims; pt-BR's are pt's plus its own), once each, in
// stopPatterns' order.
function stopClaimSources() {
  return [...new Set(i18n.LANGS.flatMap((l) => (i18n.msg(l).stopGate || {}).claims || []))];
}
// What the Stop hook's claim pre-filter needs to decide "no claim" before the engine loads (scripts/build.js →
// hooks/stop-claims.generated.json): the claim patterns, the word wrapper stopPatterns compiles them with, and stopProse's
// tail length and regexes. The hook answers "maybe" whenever any pattern matches the prose — a superset of stopClaims' claim
// (negations and questions stay the engine's to judge). 1.25.1: `triggers` — per base language, its trigger words (`source`) and
// the indexes in `claims` of its patterns: the hook compiles only the patterns of the languages whose triggers the prose holds
// (none → no claim), as stopClaims runs them.
function stopClaimFilter() {
  const re = (r) => ({ source: r.source, flags: r.flags });
  const claims = stopClaimSources();
  const triggers = i18n.BASE_LANGS.map((b) => {
    const ls = i18n.LANGS.filter((l) => i18n.baseLang(l) === b);
    const source = ls.flatMap((l) => (i18n.msg(l).stopGate || {}).triggers || []).filter((s, i, a) => a.indexOf(s) === i).join("|");
    const mine = new Set(ls.flatMap((l) => (i18n.msg(l).stopGate || {}).claims || []));
    return { lang: b, source, claims: claims.map((c, i) => (mine.has(c) ? i : -1)).filter((i) => i >= 0) };
  });
  // A language without triggers: its patterns always run — no trigger group may then gate them (the hook reads `triggers` only whole).
  return { word: { ...STOP_WORD }, prose: { max: STOP_MESSAGE_MAX, fence: re(RE_STOP_FENCE), code: re(RE_STOP_CODE), quote: re(RE_STOP_QUOTE) },
    claims, ...(triggers.every((t) => t.source) ? { triggers } : {}) };
}
// The mcp/lib files that make that filter (the patterns, the wrapper, the prose) — the generated file stamps their sizes, and the
// hook takes it only while every size still matches (else: the engine decides, as before). No version (1.26): a release that
// changes none of these files leaves the generated file as it was.
const STOP_FILTER_SOURCES = ["i18n.js", "i18n/common.js", "i18n/en.js", "i18n/es.js", "i18n/pt-br.js", "i18n/pt.js", "engine/guards.js"];
// 1.27 — the claim scan on a one-byte text (mcp/lib/latin1-scan.js). V8 compiles a regex for a one-byte and for a two-byte subject
// apart, and the two-byte code of the patterns' [\p{L}\p{N}_] boundaries is large: one em dash, curly quote or emoji in the closing
// message made stopClaims ~120 ms slower (one-byte ~18 ms, Node 26 on Windows). Such a text is scanned as its exact one-byte
// projection with the patterns rewritten once for it (an index map leads every match back); a text without a character past U+00FF
// as a one-byte copy (a prose cut from a two-byte message — a wide character inside a code fence — stays two-byte in V8).
let STOP_LATIN1 = undefined; // { L1, table, P: the rewritten patterns } | null (a pattern the rewrite can't read: the text as it is)
function stopLatin1() {
  if (STOP_LATIN1 !== undefined) return STOP_LATIN1;
  const P = stopPatterns();
  const L1 = require("../latin1-scan.js");
  const table = L1.latin1Table([...P.claims.map((c) => c.source), ...P.triggerSources.values(), ...P.admissionSources]);
  if (!table) return (STOP_LATIN1 = null);
  const re = (src, flags) => new RegExp(L1.latin1Pattern(src, table), flags);
  const claims = P.claims.map((c) => stopLazyPattern(L1.latin1Pattern(c.source, table), c.flags, c.langs)); // built on first use, as P's
  const triggers = new Map([...P.triggerSources].map(([b, src]) => [b, re(src, "iu")]));
  const admissions = P.admissionSources.map((src) => re(src, STOP_WORD.flags));
  STOP_LATIN1 = { L1, table, P: { claims, triggers, admissions, zero: P.zero, passNow: P.passNow, negators: P.negators, fixed: P.fixed } };
  return STOP_LATIN1;
}
// The prose → { text: what the regexes of `P` scan, orig: the text indexes refer to (for the clause, negation and question reads),
// at: projected index → orig index (null: the same), P }. plain (tests): the prose as it is, with the patterns as written.
function stopScan(prose, plain) {
  const P = stopPatterns();
  if (plain) return { text: prose, orig: prose, at: null, P };
  if (!/[^\x00-\xff]/.test(prose)) { const one = Buffer.from(prose, "latin1").toString("latin1"); return { text: one, orig: one, at: null, P }; }
  const l1 = stopLatin1();
  const pr = l1 ? l1.L1.latin1Text(prose, l1.table) : null;
  return pr ? { text: pr.text, orig: prose, at: pr.at, P: l1.P } : { text: prose, orig: prose, at: null, P };
}
// Does the message claim the work is done / verified? → { claim, admitted, claims: [matched text] }. A match does not count
// when a negator or condition sits up to STOP_WINDOW words before it in the same clause ("not done", "once the tests
// pass", "I'll verify"; words ending in n't / 'll too; a colon or a dash starts a new clause; "no" / "se" read by language —
// stopNegates), nor when its sentence is a question. `admitted`: the message says plainly that something is NOT verified or
// fails ("task 3 is not verified", "2 failing") — the honest answer is never sent back — unless that failure is one already
// fixed ("I fixed the 2 failing tests", stopPastFailure).
// opts.allPatterns (tests): run every claim pattern, whatever the triggers say — the answer must be the same. opts.plain (tests): scan
// the prose as it is, never its one-byte projection (stopScan) — the answer must be the same.
function stopClaims(message, opts = {}) {
  const scan = stopScan(stopProse(message), opts.plain === true);
  const P = scan.P, text = scan.orig; // the patterns run on scan.text; what follows reads the prose itself
  const pos = (k) => (scan.at ? scan.at[k] : k); // a scanned index → the prose's
  const lang = guessLang(text); // decides "no" (a PT text: em + o) and "se" (an ES text: reflexive) — see stopNegates
  const found = [];
  const wordsOf = (s) => s.split(/[^\p{L}\p{N}_'’]+/u).filter(Boolean);
  const hits = [];
  // 1.25.1: only the patterns of a language whose trigger words the text holds (a language without triggers: always).
  const hot = new Map();
  const runs = (langs) => opts.allPatterns === true || [...langs].some((l) => {
    if (!hot.has(l)) { const t = P.triggers.get(l); hot.set(l, !t || t.test(scan.text)); }
    return hot.get(l);
  });
  for (const c of P.claims) {
    if (!runs(c.langs)) continue;
    c.re.lastIndex = 0;
    let m;
    while ((m = c.re.exec(scan.text)) !== null) {
      if (m[0] === "") { c.re.lastIndex++; continue; }
      const start = pos(m.index), end = pos(m.index + m[0].length);
      hits.push({ start, end, text: text.slice(start, end), langs: c.langs });
    }
  }
  const langsAt = new Map(); // the languages every claim starting at an index reads as
  for (const h of hits) { const s = langsAt.get(h.start) || new Set(); h.langs.forEach((l) => s.add(l)); langsAt.set(h.start, s); }
  for (const h of hits) {
    // The words before it in its clause, and the claim's own first word ("Nothing is done", "None of the tests pass" match
    // from their subject on).
    const words = wordsOf(text.slice(stopClauseStart(text, h.start) + 1, h.start)).slice(-STOP_WINDOW).concat(wordsOf(h.text).slice(0, 1)).map((w) => w.toLowerCase());
    if (words.some((w, i) => stopNegates(words, i, langsAt.get(h.start), lang))) continue;
    const tail = text.slice(h.end, h.end + 2000).match(/^[^\n.!?]*([.!?]?)/); // bounded: a sentence ends well before that
    if (tail && tail[1] === "?") continue; // a question claims nothing
    if (found.length < 10) found.push(h.text.trim());
  }
  // An admission counts unless it names a failure already fixed ("I fixed the 2 failing tests", "Previously 4 tests failed",
  // "the 2 failing tests now pass") or a count of zero ("0 tests failing", "none of the tests fail" — 1.22 review: those
  // were read as admissions and the gate stayed silent on "All tasks done. 0 tests failing.").
  const admitted = P.admissions.some((re) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(scan.text)) !== null) {
      if (m[0] === "") { re.lastIndex++; continue; }
      const start = pos(m.index);
      if (stopZeroCount(text, start)) continue;
      if (!stopPastFailure(text, start, pos(m.index + m[0].length), wordsOf)) return true;
    }
    return false;
  });
  return { claim: found.length > 0, admitted, claims: [...new Set(found)] };
}
// The feature's last activity (ms, or null): lastTickAt, every ticks[n], every evidence record's run / note time (history and
// the records kept aside under `others` included) — only what the engine RECORDED. Never a file date: a fresh clone stamps
// every tasks.md "now", and a repo someone else wrote then made the gate fire on unrelated work and hand the agent that repo's
// _Verify:_ commands. A stamp in the future (a committed .state.json can hold any date) is ignored.
// 1.22 review: + lastEditAt — tasks.md / change.md saved through the Write / Edit tool (recordSpecEdit, the PostToolUse spec-hook):
// a box ticked by hand never counted, so "All tasks done" after hand ticks read `no-recent`.
function stopActivity(state) {
  let best = null;
  const horizon = Date.now() + 5 * 60 * 1000; // clock skew tolerated
  const see = (v) => { const t = typeof v === "string" ? Date.parse(v) : NaN; if (Number.isFinite(t) && t <= horizon && (best == null || t > best)) best = t; };
  see(state.lastTickAt);
  see(state.lastEditAt);
  if (isRecord(state.ticks)) Object.values(state.ticks).forEach(see);
  for (const slot of Object.values(isRecord(state.evidence) ? state.evidence : {})) {
    for (const r of evidenceRecords(slot)) {
      see(r.at);
      see(r.noteAt);
      (Array.isArray(r.history) ? r.history : []).forEach((h) => { if (isRecord(h)) see(h.at); });
    }
  }
  return best;
}
// 1.22 review — a feature's tasks.md (a change's change.md) saved through the Write / Edit tool is activity the stop gate sees:
// hooks/spec-hook.js (PostToolUse) stamps `lastEditAt` in the feature's .state.json — under its lock, with a short wait (a hook
// has 10 s; busy → nothing stamped, never an error). What the engine RECORDS, never a file date (a fresh clone stamps every file
// "now"). git's merge driver keeps the later stamp (state.js). → { ok: true, feature, at } | { ok: false, … }
const SPEC_EDIT_LOCK_WAIT_MS = 2000;
function recordSpecEdit(projectDir, name) {
  const f = existingFeature(projectDir, name);
  if (!f.ok) return { ok: false, error: f.error, code: f.code };
  return withFeatureLock(f.dir, () => {
    const state = readState(projectDir, f.slug);
    if (state.invalid) return { ok: false, error: state.invalid }; // never "repaired"
    const at = new Date().toISOString();
    state.lastEditAt = at;
    writeFileAtomic(statePath(f.dir), JSON.stringify(state, null, 2));
    return { ok: true, feature: f.slug, at };
  }, { waitMs: SPEC_EDIT_LOCK_WAIT_MS, onBusy: () => ({ ok: false, busy: true }) });
}
// One unverified task as the reason lists it: "#3 (latest run failed)".
function stopTaskLabel(d, lng) {
  const M = i18n.msg(lng);
  const why = d.specChanged ? M.impact.staleSpec : d.unticked ? M.undo.label : M.evidenceGate.reason[d.reason] || d.reason;
  return "#" + d.number + ` (${why})`;
}
// The evidence gate at the end of a turn — hooks/stop-hook.js (Stop / SubagentStop) and `dev-spec stop-check`. It sends the
// turn back ({block: true, reason}) ONLY when (a) the message claims the work is done or verified (stopClaims — conservative;
// never when it says plainly what is not verified) AND (b) a feature active in the last STOP_RECENT_HOURS has ticked tasks
// verificationStatus reports unverified (a failed run, a note on a runnable _Verify:_, stale evidence, an unexpected pass,
// no evidence for a runnable _Verify:_…) or, every active task done, project checks without a passing run since the last
// task activity (suiteStatus). opts: { message, agent (the subagent type — a spec-implementer is checked on its REPORT: it
// never ticks tasks; 1.22: a spec-simplifier on its simplification report), stopHookActive (the hook already sent this
// stop back once: never twice in a row) }. The reason is in the project language (a subagent's: its feature's). Read-only and bounded; a feature whose .state.json is unreadable
// is skipped — the gate never blocks on its own trouble.
// → { ok, block, why, lang, claims, features: [{feature, unverified: [{number, reason}], suite: [{name, status}]}], reason? }
function stopCheck(projectDir, opts = {}) {
  const pdir = path.resolve(projectDir);
  const lng = projectLang(pdir);
  const res = (block, why, extra) => Object.assign({ ok: true, block, why, lang: lng, claims: [], features: [] }, extra);
  if (opts.stopHookActive === true) return res(false, "stop-hook-active");
  const root = specsRoot(pdir);
  if (!isDirSafe(root)) return res(false, "no-specs");
  if (!stopCheckEnabled(pdir)) return res(false, "off");
  const cl = stopClaims(opts.message);
  const agent = typeof opts.agent === "string" ? opts.agent.trim() : "";
  if (agent && /(?:^|:)spec-implementer$/i.test(agent)) return implementerStopCheck(pdir, String(opts.message == null ? "" : opts.message), cl, res);
  if (agent && /(?:^|:)spec-simplifier$/i.test(agent)) return simplifierStopCheck(pdir, String(opts.message == null ? "" : opts.message), cl, res);
  if (!cl.claim) return res(false, "no-claim");
  if (cl.admitted) return res(false, "admitted", { claims: cl.claims });
  const since = Date.now() - STOP_RECENT_HOURS * 3600 * 1000;
  const features = [];
  const clean = [];
  // 1.22 review: the activity of EVERY non-archived feature (one .state.json read each — cheap), then the STOP_MAX_FEATURES most
  // recently active are checked (verificationStatus / suiteStatus — the costly part), in folder order. The cap used to apply
  // to the folders first: the 51st feature alphabetically ("zeta", ticked a minute ago) was never looked at — `no-recent`.
  const recent = [];
  featureDirs(pdir).filter((x) => !x.archived).forEach((f, order) => {
    const state = readState(pdir, f.slug);
    if (state.invalid) return; // unreadable state: never block on it (doctor reports it)
    const last = stopActivity(state);
    if (last != null && last >= since) recent.push({ f, state, last, order });
  });
  const checked = recent.sort((a, b) => b.last - a.last || a.order - b.order).slice(0, STOP_MAX_FEATURES).sort((a, b) => a.order - b.order);
  for (const { f, state } of checked) {
    const tasksFile = path.join(f.dir, "tasks.md");
    const tracks = detectTracks(f.dir);
    const blocks = taskBlocks(activeTasks(readIfExists(tasksFile) || "", tracks) || "");
    const vs = verificationStatus(pdir, f.slug, f.dir);
    // A spike has no project-check gate anywhere (spec_finish, doctor and next_action close it on its decision): never here either.
    const suite = state.kind !== "spike" && blocks.length && blocks.every((b) => b.done) ? suiteStatus(pdir, state, f.dir).missing : [];
    if (!vs.unverifiedDetail.length && !suite.length) { clean.push(f.slug); continue; }
    features.push({ feature: f.slug, unverified: vs.unverifiedDetail, suite, file: phaseFile("tasks", state.kind) }); // a change's tasks are in change.md (1.21 review C10)
  }
  if (!features.length) return res(false, clean.length ? "verified" : "no-recent", { claims: cl.claims, verifiedFeatures: clean });
  const S = i18n.msg(lng).stopGate;
  // The head says what is missing: ticked tasks without evidence, or — when only project checks are listed — the checks' runs.
  const lines = [features.some((f) => f.unverified.length) ? S.head : S.headSuite];
  for (const f of features) {
    if (f.unverified.length) {
      const shown = f.unverified.slice(0, STOP_TASKS_SHOWN).map((d) => stopTaskLabel(d, lng));
      lines.push(S.taskLine(f.feature, shown.join(", ") + (f.unverified.length > shown.length ? ", " + S.more(f.unverified.length - shown.length) : "")));
    }
    if (f.suite.length) lines.push(S.suiteLine(f.feature, suiteLabel(f.suite, lng)));
  }
  const firstTasks = features.find((f) => f.unverified.length);
  if (firstTasks) lines.push(S.todoTasks(firstTasks.feature, firstTasks.unverified[0].number, firstTasks.file));
  const firstSuite = features.find((f) => f.suite.length);
  if (firstSuite) lines.push(S.todoSuite(firstSuite.feature));
  lines.push(S.plainly);
  return res(true, "unverified", {
    claims: cl.claims,
    features: features.map((f) => ({ feature: f.feature, unverified: f.unverified.map((d) => ({ number: d.number, reason: d.reason, ...(d.specChanged ? { specChanged: true } : {}), ...(d.unticked ? { unticked: true } : {}) })),
      suite: f.suite.map((s) => ({ name: s.name, status: s.status })) })),
    reason: lines.join("\n"),
  });
}
// A subagent's status as the gates read it: its prose (stopProse) with a status TOKEN in inline code unwrapped first — only
// on a line that starts with "Status" ("**Status:** `DONE`" is a status, not code) — while every other code span still
// drops out ("`order.status === "blocked"`" or "with status `blocked`" in a commit line is no status; 1.22 reviews 2–3).
const statusProse = (message) => stopProse(String(message).replace(/^([ \t>*_#+-]*status\W{0,8})`\s*(done_with_concerns|done|blocked|needs_context|no_changes)\s*`/gim, "$1$2"));
const STATUS_DONE_RE = /(?<![\p{L}_])status\W{0,8}done(?:_with_concerns)?(?![\p{L}_])/iu;
const STATUS_NOT_DONE_RE = /(?<![\p{L}_])status\W{0,8}(?:blocked|needs_context)(?![\p{L}_])/iu;
// A spec-implementer's stop (SubagentStop): it never ticks tasks (the controller does, after review), so its gate is its
// REPORT — reporting DONE (or DONE_WITH_CONCERNS) for a task whose _Verify:_ holds a runnable command needs the report file
// (.specs/<feature>/.execution/task-N-report.md, named in the reply as the protocol asks) to carry each command and an exit
// code. BLOCKED / NEEDS_CONTEXT, no report path in the reply, or no runnable _Verify:_ → allowed.
function implementerStopCheck(pdir, message, cl, res) {
  // 1.22 review: a status in backticks (`DONE`) is a status too — it used to read as no claim and skip the report
  const prose = statusProse(message);
  if (STATUS_NOT_DONE_RE.test(prose)) return res(false, "not-done");
  if (!cl.claim && !STATUS_DONE_RE.test(prose)) return res(false, "no-claim");
  // 1.22 review: the LAST task-N-report.md path the reply names (a report wins over a brief) — "Task 2 builds on task 1 (see
  // …/task-1-report.md). Report: …/task-2-report.md" was checked against task 1's report and passed.
  const tailText = message.slice(-STOP_MESSAGE_MAX);
  const paths = [...tailText.matchAll(/\.specs[\\/]+([^\\/\s`'"()<>]+)[\\/]+\.execution[\\/]+task-(\d+)-(report|brief)\.md/gi)];
  const m = paths.filter((x) => x[3].toLowerCase() === "report").pop() || paths.pop();
  if (!m) return res(false, "no-task", { claims: cl.claims });
  const f = existingFeature(pdir, m[1]);
  if (!f.ok) return res(false, "no-task", { claims: cl.claims });
  const lng = featureLang(pdir, f.slug);
  const n = parseInt(m[2], 10);
  const task = resolveTask(taskBlocks(readIfExists(path.join(f.dir, "tasks.md")) || ""), n);
  const verify = task ? taskMarkers(task).verify : [];
  const info = { claims: cl.claims, lang: lng, feature: f.slug, task: n };
  if (!verify.length) return res(false, "nothing-to-verify", info);
  const file = stopReportFile(pdir, path.join(f.dir, ".execution", `task-${n}-report.md`), tailText, m.index, `task-${n}-report.md`);
  const rel = toPosix(path.relative(pdir, file));
  const report = readStopReport(file);
  const X = i18n.msg(lng).stopGate.implementer;
  const flat = flatReport;
  let problem = null;
  if (report == null) problem = X.noReport(rel);
  else {
    const body = flat(report);
    // 1.23 review 5 (M16): a _Verify:_ command is shown when the report holds its text, or a command it writes (a code span) that
    // IS a run of it by the evidence gate's matcher (runProvesVerify: `tests\x.test.js` = `tests/x.test.js`, quotes, a ` && ` join
    // of the task's commands) — the raw text compare bounced `node --test tests/login.test.js` for `_Verify: node --test tests\login.test.js_`.
    const spans = reportCommandSpans(report);
    const missing = verify.filter((c) => !body.includes(flat(c)) && !spans.some((s) => runProvesVerify({ command: s }, [c], pdir) || runProvesVerify({ command: s }, verify, pdir)));
    const list = (xs) => xs.map((c) => "`" + c + "`").join(", ");
    // full review Ga5: the exit code must be the one the task needs — a must-pass _Verify:_ an exit 0 ("Status: DONE … exit
    // code: 1" was allowed), an _Expect: fail_ one a non-zero exit (its red run). 1.25.1 (review 7): read per run — the codes of
    // each _Verify:_ command's OWN runs (verifyRunCodes), its LAST run deciding: any exit 0 anywhere passed "Ran `npm test` → exit
    // code: 1 … Ran `npm run lint` → exit code: 0". A +tdd report may show the red run and then the green one (the last is green).
    const xf = expectsFail(task);
    const per = verifyRunCodes(report, verify, pdir);
    const unrun = verify.filter((c, i) => !per[i].length);
    const wrong = verify.filter((c, i) => per[i].length && (xf ? per[i][per[i].length - 1] === 0 : per[i][per[i].length - 1] !== 0));
    const earlier = wrong.some((c) => { const k = per[verify.indexOf(c)]; return xf ? k.some((x) => x !== 0) : k.includes(0); }); // the right code, then the wrong one
    if (missing.length || unrun.length) problem = X.noRun(rel, list(missing.length ? missing : unrun));
    else if (wrong.length) problem = (xf ? (earlier ? X.lastNotFailing : X.notFailing) : (earlier ? X.lastNotPassing : X.notPassing))(rel, list(wrong));
  }
  if (!problem) return res(false, "report-ok", info);
  return res(true, "implementer-evidence", { ...info, report: rel, reason: [X.head(n, f.slug) + " " + problem, X.todo].join("\n") });
}
// 1.23 review 5 (M8) — the report file a subagent's reply names. `own`: the project's copy (.specs/<f>/.execution/<name>); `text` /
// `at`: the reply (its tail) and where the `.specs…` path it names starts. When that path is written out absolute — the controller
// hands the implementer the report path in the MAIN checkout (subagent-execution.md, parallel mode), or a subagent in a worktree
// writes its own copy — the file it names is read when it lies in the project or in another checkout of the project's repository
// (`git worktree`: the same common git dir) and exists; else the project's copy. A path elsewhere is never read.
function stopReportFile(pdir, own, text, at, name) {
  const lineStart = text.lastIndexOf("\n", at - 1) + 1;
  const head = text.slice(lineStart, at);
  const named = text.slice(at).match(/^\.specs[\\/]+[^\\/\s`'"()<>]+[\\/]+\.execution[\\/]+/i);
  if (!named || head.length > 4096) return own;
  let repo; // the project's git common dir, read once (undefined: not yet)
  for (let j = 0; j < head.length; j++) {
    if (j > 0 && !/[\s`'"(<:=*>]/.test(head[j - 1])) continue;
    if (!/^(?:[A-Za-z]:[\\/]|[\\/])/.test(head.slice(j))) continue;
    const prefix = head.slice(j);
    if (isNetworkPath(prefix)) continue;
    const dir = path.resolve(guardTargetPath(prefix));
    let inRepo = sessionSame(dir, pdir);
    if (!inRepo) {
      if (repo === undefined) { const g = gitCheckoutOf(pdir); repo = g ? g.commonDir : null; }
      const g = repo ? gitCheckoutOf(dir) : null;
      inRepo = !!g && sessionSame(g.commonDir, repo);
    }
    if (!inRepo) continue;
    const file = path.join(dir, named[0], name);
    if (fs.existsSync(file)) return file;
  }
  return own;
}
// 1.25.1 (review 7) — the exit codes of each _Verify:_ command's OWN runs in an implementer's report, in order → [[codes of verify[0]'s
// runs], [verify[1]'s], …]. Every other command a report shows (`npm run lint` → exit 0) has codes of its own: "Ran `npm test` → exit
// code: 1 … Ran `npm run lint` → exit code: 0" passed as a green task (any exit 0 anywhere counted). Read line by line (the report as
// written, each line's backticks dropped): a MENTION is a code span — a run of the _Verify:_ commands it proves by the evidence
// gate's matcher (runProvesVerify: one of them, or a ` && ` join of all), else another command — or a _Verify:_ command's own text
// on the line (`$ npm test`, a transcript); an exit code (reportExitCodes) belongs to the last mention before it on its line, else
// to the first one after it there ("exit 0 for `npm test`"), else to the last mention of the lines above (an output block under
// its command). A syntactically incomplete span (`npm test &&` — proofIncomplete) runs nothing it names. Bounded: the report is
// already ≤ STOP_REPORT_MAX; ≤ 500 spans of ≤ 4000 characters are matched, as reportCommandSpans.
function verifyRunCodes(report, verify, pdir) {
  const per = verify.map(() => []);
  const flatV = verify.map(flatReport);
  const words = flatV.map((v) => (v ? new RegExp("(?<![\\w-])" + v.split(" ").map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[ \\t]+") + "(?![\\w-])", "g") : null));
  const proves = (cmd) => {
    if (proofIncomplete(cmd)) return [];
    const all = runProvesVerify({ command: cmd }, verify, pdir);
    return verify.map((c, i) => i).filter((i) => all || flatReport(cmd) === flatV[i] || runProvesVerify({ command: cmd }, [verify[i]], pdir));
  };
  let current = null; // the verify indices the codes below belong to ([] = another command), null = none named yet
  let spansSeen = 0;
  for (const raw of String(report).split(/\r?\n/)) {
    const marks = []; // { at, to, prov: [verify indices] }
    let text = "", k = 0;
    for (const m of raw.matchAll(/``\s?([^`\n]+?)\s?``|`([^`\n]+)`/g)) {
      text += raw.slice(k, m.index).replace(/`/g, "");
      const cmd = (m[1] !== undefined ? m[1] : m[2]).trim();
      const at = text.length;
      text += cmd;
      k = m.index + m[0].length;
      // (a span that is an exit code itself — "`exit 0`", "exit code: `1`" — is no command)
      const codeSpan = /^-?\d+$/.test(cmd) || reportExitCodes(cmd).some((x) => x.index === 0);
      if (cmd && !codeSpan && cmd.length <= 4000 && spansSeen++ < 500) marks.push({ at, to: text.length, prov: proves(cmd) });
    }
    text += raw.slice(k).replace(/`/g, "");
    words.forEach((re, i) => {
      if (!re) return;
      re.lastIndex = 0;
      for (let w; (w = re.exec(text));) if (!marks.some((x) => w.index >= x.at && w.index < x.to)) marks.push({ at: w.index, to: w.index + w[0].length, prov: [i] });
    });
    marks.sort((a, b) => a.at - b.at);
    for (const c of reportExitCodes(text)) {
      if (marks.some((x) => c.index >= x.at && c.index < x.to)) continue; // inside a command (`node -e "process.exit(0)"`): no code
      let owner = null;
      for (const x of marks) if (x.at < c.index) owner = x;
      if (!owner) owner = marks.find((x) => x.at > c.index) || null;
      for (const i of owner ? owner.prov : current || []) per[i].push(c.code);
    }
    if (marks.length) current = marks[marks.length - 1].prov;
  }
  return per;
}
// The commands a report writes in code spans (`…` or ``…``) — what the implementer's gate matches against a _Verify:_ (1.23 review
// 5, M16). Bounded: at most 500 spans, each ≤ 4000 characters (the evidence gate's command limit).
function reportCommandSpans(report) {
  const out = [];
  for (const m of String(report).matchAll(/``\s?([^`\n]+?)\s?``|`([^`\n]+)`/g)) {
    const s = (m[1] !== undefined ? m[1] : m[2]).trim();
    if (s && s.length <= 4000) out.push(s);
    if (out.length >= 500) break;
  }
  return out;
}
// A subagent's report, at most STOP_REPORT_MAX bytes of it (null when it can't be read) — the stop gates read one file
// each: the implementer's from its start, the simplifier's from its END (`tail`), where its final runs are. 1.23 review 5 (L8): a
// UTF-16 report (a BOM — Windows PowerShell 5.1's `>` / Out-File write one) is decoded as such (decodeText), its tail read from an
// even offset so the code units stay aligned; a leading BOM is dropped.
function readStopReport(file, tail) {
  try {
    const fd = fs.openSync(file, "r");
    try {
      const size = fs.fstatSync(fd).size;
      const bom = Buffer.alloc(2);
      const bn = size >= 2 ? fs.readSync(fd, bom, 0, 2, 0) : 0;
      const le = bn === 2 && bom[0] === 0xff && bom[1] === 0xfe, be = bn === 2 && bom[0] === 0xfe && bom[1] === 0xff;
      let len = Math.min(STOP_REPORT_MAX, size), pos = tail ? size - len : 0;
      if ((le || be) && pos % 2) { pos++; len--; }
      const buf = Buffer.alloc(len);
      const n = fs.readSync(fd, buf, 0, len, pos);
      let text;
      if (pos === 0) text = decodeText(buf, n); // the BOM, when there is one, is in the buffer
      else if (le) text = buf.toString("utf16le", 0, n - (n % 2));
      else if (be) text = Buffer.from(buf.subarray(0, n - (n % 2))).swap16().toString("utf16le");
      else text = buf.toString("utf8", 0, n);
      return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
    } finally { fs.closeSync(fd); }
  } catch { return null; }
}
// A report or a command as the gates compare them: backticks dropped, whitespace runs collapsed.
const flatReport = (s) => s.replace(/`/g, "").replace(/\s+/g, " ").trim();
// The exit codes a (flattened) report writes out, in order, with where each sits: "exit 0", "exit code: 1", "exitCode 0",
// "exited with code 0", "exit status 2", PT "código de saída 0", ES "código de salida 0".
function reportExitCodes(body) {
  return [...body.matchAll(/(?<![\p{L}_])(?:exit(?:ed)?(?:\s+with)?(?:[\s_-]*(?:code|status))?|c[óo]digo\s+de\s+(?:sa[íi]da|salida))\W{0,4}(-?\d+)/giu)]
    .map((x) => ({ code: parseInt(x[1], 10), index: x.index }));
}
// The runs a simplification report proves its claim with: everything after its LAST "## Final runs" heading (a heading at
// the margin, any level; English-stable like a marker — PT "Execuções finais" / ES "Ejecuciones finales" are read too) to
// the END of the file — the section is the report's last, so nothing after it ends it: a "# pass 212" output line can't,
// and a revert round written below it without a new heading still counts. A run is ONE line at the margin: an optional
// bullet, the command in backticks (``double`` when it holds one), then its exit code — "- `npm test` → exit 0 (212
// passing)" — or an indented bullet with both (a run nested under a group). Other indented lines are output and fenced
// blocks (counted from the heading — the read window may start inside one) are skipped, so a code quoted in output never
// counts, and a command that starts with a check's (`npm test -- t/x.test.js`) is another command. Text reads have
// limits — a run pasted only inside a fenced transcript is not seen; spec_finish's code-changed is the hard gate.
// → null without such a heading, else [{command (flattened), code (null: the line names none)}] — a command's last line wins.
function finalRuns(report) {
  const lines = report.split(/\r?\n/);
  let start = -1;
  lines.forEach((s, i) => { if (/^#{1,6}\s*(?:final runs|execu[çc][õo]es finais|ejecuciones finales)(?![\p{L}])/iu.test(s)) start = i; });
  if (start < 0) return null;
  const runs = new Map();
  let fence = false;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\s{0,3}(?:`{3,}|~{3,})/.test(lines[i])) { fence = !fence; continue; }
    if (fence) continue;
    const m = lines[i].match(/^(\s*)((?:[-*+]|\d+[.)])\s+)?(?:``\s?(.+?)\s?``|`([^`]+)`)(.*)$/);
    if (!m) continue;
    const code = (reportExitCodes(flatReport(m[5]))[0] || {}).code;
    // indented, only a bullet + a command + its exit code is a run (one nested under a group bullet — review 3: a failing one
    // was skipped as output); any other indented line is output
    if (m[1] && !(m[2] && code !== undefined)) continue;
    const command = flatReport(m[3] !== undefined ? m[3] : m[4]);
    runs.delete(command);
    runs.set(command, code === undefined ? null : code);
  }
  return [...runs].map(([command, code]) => ({ command, code }));
}
// 1.22 — a spec-simplifier's stop (SubagentStop): it rewrites code that is already reviewed and verified, so its DONE (or
// DONE_WITH_CONCERNS) needs its report (.specs/<feature>/.execution/simplify-report.md, named in the reply) to END with the
// proof — a "## Final runs" section (finalRuns) where every run exits 0 and, with project checks (meta.checks), each check's
// command is one of them. A baseline run higher up never stands in, a failed run never hides behind a later passing one,
// and a run line without its exit code is no proof. BLOCKED / NEEDS_CONTEXT / NO_CHANGES, no claim, or no report path in
// the reply → allowed.
function simplifierStopCheck(pdir, message, cl, res) {
  const prose = statusProse(message);
  if (STATUS_NOT_DONE_RE.test(prose)) return res(false, "not-done");
  if (/(?<![\p{L}_])status\W{0,8}no_changes(?![\p{L}_])/iu.test(prose)) return res(false, "no-changes");
  if (!cl.claim && !STATUS_DONE_RE.test(prose)) return res(false, "no-claim");
  const tailText = message.slice(-STOP_MESSAGE_MAX);
  const m = tailText.match(/\.specs[\\/]+([^\\/\s`'"()<>]+)[\\/]+\.execution[\\/]+simplify-report\.md/i);
  if (!m) return res(false, "no-report", { claims: cl.claims });
  const f = existingFeature(pdir, m[1]);
  if (!f.ok) return res(false, "no-report", { claims: cl.claims });
  const lng = featureLang(pdir, f.slug);
  const info = { claims: cl.claims, lang: lng, feature: f.slug };
  const file = stopReportFile(pdir, path.join(f.dir, ".execution", "simplify-report.md"), tailText, m.index, "simplify-report.md");
  const rel = toPosix(path.relative(pdir, file));
  const report = readStopReport(file, true);
  const X = i18n.msg(lng).stopGate.simplifier;
  const checks = [...new Set(projectChecks(pdir).checks.map((c) => flatReport(c.command)))];
  let problem = null;
  if (report == null) problem = X.noReport(rel);
  else {
    const runs = finalRuns(report);
    if (!runs || !runs.length) problem = X.noFinal(rel);
    else {
      const list = (a) => a.map((c) => "`" + c + "`").join(", ");
      // 1.23 review 5 (M16): a check's run is the run line that IS a run of its command by the evidence gate's matcher
      // (runProvesVerify — `\` vs `/`, quotes, spacing), the same text first; the last such line wins (finalRuns keeps each
      // command's last line, in order). A longer command (`npm test -- t/x.test.js`) is still another run.
      const runOf = (c) => {
        let hit = null;
        for (const r of runs) if (r.command === c || runProvesVerify({ command: r.command }, [c], pdir)) hit = r;
        return hit;
      };
      const proven = new Set();
      const unrun = checks.filter((c) => { const r = runOf(c); if (r) proven.add(r); return !r || r.code == null; })
        .concat(runs.filter((r) => r.code == null && !proven.has(r)).map((r) => r.command));
      const failing = runs.filter((r) => r.code != null && r.code !== 0).map((r) => r.command);
      if (unrun.length) problem = X.noRun(rel, list(unrun));
      else if (failing.length) problem = X.notPassing(rel, list(failing));
    }
  }
  if (!problem) return res(false, "simplify-ok", info);
  return res(true, "simplifier-evidence", { ...info, report: rel, reason: [X.head(f.slug) + " " + problem, X.todo].join("\n") });
}

// The scope guard's decision for a code file once some feature has approved, unfinished tasks (guardCheck, level "scope"):
// allowed when an OPEN task of one of those features names it in _Implements:_ — the file itself (implementsKey: anchors,
// backticks, ./ and case where the file system folds it dropped), a folder above it, or a glob matching it — and for a test
// file (tests are planned by T-ID in test-plan.md, not in _Implements:_); otherwise "ask", naming the likely task: one that
// plans a file in the same folder, else the nearest folder, else the next open task. Text reads only.
function scopeGuardDecision(pdir, abs, features, texts, allow, extra) {
  const rel = toPosix(path.relative(pdir, abs));
  const fold = (s) => (FOLD_CASE ? s.toLowerCase() : s);
  const key = fold(rel);
  if (isTestFile(rel)) return allow("test-file", { level: "scope", covering: features, ...extra });
  const usable = (k) => !!k && k !== "." && !/^\[.*\]$/.test(k) && !/^(?:tbd|todo|n\/?a|none|-+|…|\.{3})$/i.test(k) && !k.split("/").includes("..");
  const open = [];
  let scheduled = null; // 1.14 F3: the first feature's next task by next_task's rule (_Depends:_ all done)
  for (const name of features) {
    const dir = path.join(specsRoot(pdir), name);
    const blocks = taskBlocks(activeTasks(texts.get(name) || "", detectTracks(dir)) || "");
    const sn = scheduled ? null : taskSchedule(blocks).next;
    if (sn) scheduled = { feature: name, number: sn.number };
    for (const b of blocks) {
      if (b.done) continue;
      const refs = [];
      for (const ref of taskMarkers(b).implements) {
        let r = implementsRel(ref);
        if (path.isAbsolute(r)) { const a = insideDirAlias(pdir, path.resolve(r)); r = a ? toPosix(path.relative(pdir, a)) : ""; } // an alias of the project counts
        if (usable(r)) refs.push({ rel: r, key: fold(r), glob: isImplementsGlob(r) });
      }
      open.push({ feature: name, number: b.number, refs });
    }
  }
  const covers = (r) => (r.glob ? globMatcher(r.key)(key) : r.key === key || key.startsWith(r.key + "/"));
  const hit = open.find((t) => t.refs.some(covers));
  if (hit) return allow("in-scope", { level: "scope", covering: features, task: { feature: hit.feature, number: hit.number }, ...extra });
  // The likely task: a planned file (or a glob's literal folders) in the same folder, else the longest shared folder prefix.
  const globBase = (k) => { const parts = k.split("/"), lit = []; for (let i = 0; i < parts.length - 1 && !/[*?{]/.test(parts[i]); i++) lit.push(parts[i]); return lit.join("/") || "."; };
  const folderOf = (r) => (r.glob ? globBase(r.key) : path.posix.dirname(r.key));
  const fileDir = path.posix.dirname(key);
  const shared = (a) => { const x = a === "." ? [] : a.split("/"), y = fileDir === "." ? [] : fileDir.split("/"); let i = 0; while (i < x.length && i < y.length && x[i] === y[i]) i++; return i; };
  let likely = null;
  for (const t of open) {
    for (const r of t.refs) {
      const d = folderOf(r);
      const score = d === fileDir ? Infinity : shared(d);
      if (score > 0 && (!likely || score > likely.score)) likely = { t, r, score };
    }
  }
  const S = i18n.msg(projectLang(pdir)).scopeGuard;
  const next = (scheduled && open.find((t) => t.feature === scheduled.feature && t.number === scheduled.number)) || open[0] || null;
  const hint = likely ? S.hint[likely.score === Infinity ? "same-folder" : "nearby"](likely.t.number, likely.t.feature, likely.r.rel)
    : next ? S.hint.next(next.number, next.feature) : "";
  const pick = likely ? likely.t : next;
  const list = (xs) => xs.slice(0, 3).join(", ") + (xs.length > 3 ? ", …" : "");
  return { guard: true, level: "scope", decision: "ask", why: "out-of-scope", file: rel, covering: features,
    ...(pick ? { likely: { feature: pick.feature, number: pick.number, via: likely ? (likely.score === Infinity ? "same-folder" : "nearby") : "next" } } : {}),
    ...(extra.forced ? { forced: extra.forced } : {}),
    reason: S.ask(rel, list(features), hint).replace(/ {2,}/g, " ") + (extra.note ? " " + extra.note : "") };
}

module.exports = { guardEnabled, guardCheck, setGuard, APPROVAL_GUARD_LEVELS, RE_APPROVAL_MCP, APPROVAL_SHELL_TOOLS,
  APPROVAL_COMMAND_MAX, APPROVAL_SHELL_DEPTH, APPROVAL_LEX_DEPTH, CLI_SWITCHES, APPROVAL_WRAPPERS, APPROVAL_SUBCOMMANDS,
  APPROVAL_OPTION_VALUES, APPROVAL_SHELLS, APPROVAL_PS_SHELLS, APPROVAL_STDIN_SHELLS, approvalShellMode,
  RE_DEVSPEC_WORD, RE_APPROVAL_VAR_WORD, RE_APPROVAL_CANDIDATE, approvalCandidate, RE_ROADMAP_FILE, RE_SPECS_DIR,
  APPROVAL_WRITERS_ANY, APPROVAL_REMOVERS, APPROVAL_MOVERS, APPROVAL_WRITERS_TARGET, APPROVAL_WRITERS_INPLACE,
  RE_DEST_OPTION, approvalGuardInput, RE_RAW_APPROVAL_GUARD, rawApprovalGuard, approvalGuardLevel, setApprovalGuard,
  lowersApprovalGuard, ANSI_C_ESCAPES, ansiCEscape, PS_ESCAPES, shellCommandWords, programAt, stdinShellMode,
  shellLexList, shellSubstitutionsIn, approvalProgram, devSpecWordAt, specsWriteActions, approvalStr, approvalTruthy,
  guardRank, guardName, initGuardDowns, initRolesInput, initChecksInput, cliApprovalAction, shellApprovalActions,
  APPROVAL_POSITIONALS, joinScriptWords, restScript, APPROVAL_START_PROCESS, START_PROCESS_VALUES, startProcessLine, findExecActions,
  approvalExtras, mcpApprovalAction, approvalCommand, approvalGuardDecision, STOP_RECENT_HOURS, STOP_MESSAGE_MAX,
  STOP_MAX_FEATURES, STOP_TASKS_SHOWN, STOP_REPORT_MAX, STOP_WINDOW, guardLevel, guardInput, stopCheckEnabled,
  setStopCheck, stopPatterns, STOP_CLAUSE_SPAN, stopClauseStart, RE_ES_NO_NEXT, RE_ES_SE_NEXT, stopNegates,
  stopPastFailure, stopZeroCount, STOP_WORD, RE_STOP_FENCE, RE_STOP_CODE, RE_STOP_QUOTE, stopProse, stopClaimSources, STOP_FILTER_SOURCES, stopClaimFilter, stopClaims, stopActivity, SPEC_EDIT_LOCK_WAIT_MS, recordSpecEdit, stopTaskLabel, stopCheck, implementerStopCheck,
  scopeGuardDecision, APPROVAL_EDIT_TOOLS, RE_STATE_FILE, DEVSPEC_NAMES, devSpecGlob, isDevSpecWord, RE_COMSPEC_WORD, RE_APPROVAL_VERB,
  approvalPlain, APPROVAL_TEXT_PROGRAMS, APPROVAL_STDIN_RUNTIMES, APPROVAL_POSIX_SHELLS, withPositionals, stdinScriptAt,
  decodePwshEncoded, approvalSpecsProject, approvalUnparsed, guardTargetPath, SESSION_MAX_UP, sessionUsable, sessionSame, sessionSpecs,
  gitCheckoutOf, worktreeProject, sessionProject, sessionPath, stopReportFile, reportCommandSpans, readStopReport,
  RE_OBSERVED_FILE, APPROVAL_GATED_TRACKS, approvalGatedTracks, approvalPathText, approvalGuardedFile, approvalGuardedDir, GIT_VALUE_OPTIONS,
  gitWriteTargets, approvalEditTargets, RE_PS_STOP_AFTER_CLI, cliSubcommandUnread,
  // 1.25.1 (review 7): the shell's file operations, fed scripts, MCP file tools, the edit guard on the shell
  APPROVAL_WRITERS_OTHER, APPROVAL_READERS, RE_PS_READER, RE_APPROVAL_DOT_GLOB, RE_APPROVAL_WRITE_WORD, RE_MCP_FILE_TOOL, RE_DEVSPEC_MCP_TOOL,
  RE_MCP_PATH_KEY, APPROVAL_ASK_WHYS, approvalRoadmapGone, SHELL_VAR, SHELL_ANY, GUARDED_NAMES, shellVarText, braceExpand, shellGlobRe,
  shellSegCould, shellPathFacts, shellPathReadings, shellOperands, SHELL_TAKES, PS_FILE_ALIASES, PS_FILE_CMDLETS, PS_SWITCHES, psParams,
  shellProducedPaths, shellSegOps, shellKnownProgram, tarOps, findFileOps, psFileOps, netFileOps, shellOpActions, shellOpPaths, shellTrack,
  shellFedScript, shellProducedText, shellProcText, shellWriteTargets, CLI_GUARDED_COMMANDS, cliSubcommandGlob, approvalEditActions,
  approvalPathArgs, __link };
