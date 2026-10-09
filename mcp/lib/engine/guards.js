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
function __link(E) { ({ activeTasks, approvalRolesFrom, checksInput, detectTracks, evidenceModeInput, evidenceRecords,
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
// "an approved spec that changed is not approved". An approval without a fingerprint (older state) still counts.
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
    else if (isObj(ap) && typeof ap.fingerprint === "string" && ap.fingerprint && !fingerprintMatches(tasksText, "tasks", ap.fingerprint)) stale.push(name);
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
  if (win && /~\d/.test(abs)) {
    let real = null;
    try { real = fs.realpathSync.native(abs); } catch {
      try { real = path.join(fs.realpathSync.native(path.dirname(abs)), path.basename(abs)); } catch { real = null; }
    }
    if (real && real !== abs) out.push(real);
  }
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
// the human runs (deny: in their own terminal, or with Claude Code's `!` prefix). Raising or adding stays allowed. A guardrail on
// the approve paths, not a sandbox: a script, a variable or the Write tool can still reach .specs/ files.
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
const APPROVAL_EDIT_TOOLS = new Set(["Write", "Edit", "MultiEdit"]);
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
const RE_APPROVAL_CANDIDATE = /dev-?spec|\.specs/i;
// The words that make a CLI call an approval or a guard-down (approve, feature remove, init's guard-down flags).
const RE_APPROVAL_VERB = /(?:^|[^\w-])(?:approve|remove|--approval-guard|--stop-check|--evidence|--guard|--roles|--check)(?![\w-])/i;
const approvalPlain = (text) => String(text).replace(/(["'])\s*\+\s*\1/g, "").replace(/[\\`^]\r?\n|['"\\`^]/g, "");
// …and a PowerShell -EncodedCommand / -ec / -e value whose decoded script names dev-spec (`powershell -enc <base64>`).
const RE_PWSH_ENCODED = /(?:^|\s)[-/]e[a-z]*\s+([A-Za-z0-9+/]{8,}={0,2})(?=\s|$)/gi;
const approvalCandidate = (text) => {
  const t = approvalPlain(text);
  if (RE_APPROVAL_CANDIDATE.test(t) || (/[*?[]/.test(t) && RE_APPROVAL_VERB.test(t))) return true;
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
const APPROVAL_WRITERS_ANY = new Set(["tee", "truncate", "rm", "unlink", "shred", "del", "erase", "remove-item", "ri", "set-content", "sc",
  "add-content", "ac", "out-file", "clear-content", "clc", "new-item", "ni", "mv", "move", "move-item", "mi", "ren", "rename", "rename-item",
  "rni", "dd"]);
// Deleting .specs/ or moving it away takes roadmap.json with it (the guard reads a missing file as off).
const APPROVAL_REMOVERS = new Set(["rm", "rmdir", "rd", "del", "erase", "remove-item", "ri"]);
const APPROVAL_MOVERS = new Set(["mv", "move", "move-item", "mi", "ren", "rename", "rename-item", "rni"]);
const APPROVAL_WRITERS_TARGET =new Set(["cp", "copy", "copy-item", "cpi", "install", "ln", "rsync", "xcopy", "robocopy"]); // the LAST path is written
const APPROVAL_WRITERS_INPLACE = new Set(["sed", "perl", "ruby"]); // with -i / --in-place
const RE_DEST_OPTION = /^-(?:destination|dest|t|-target-directory)$/i;

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
  return (isObj(l.rm.meta) && approvalGuardInput(l.rm.meta.approvalGuard)) || "off";
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
  let words = [], raws = [], redirs = [], herestrings = [], segDocs = [];
  let cur = "", raw = "", has = false, quoted = false, redir = null, paren = 0, arith = 0; // arith: the paren level inside (( … ))
  const heredocs = []; // bash: bodies waiting for the next newline — { delim, strip, quoted, shell }
  const add = (t, r) => { cur += t; raw += r === undefined ? t : r; has = true; };
  const endWord = () => {
    if (has) {
      if (redir === "<<" || redir === "<<-") { const h = { delim: cur, strip: redir === "<<-", quoted, shell: null }; heredocs.push(h); segDocs.push(h); }
      else if (redir && redir.startsWith("<<<")) herestrings.push(cur);
      else if (redir) redirs.push(cur, raw);
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
      segs.push(seg);
    }
    words = []; raws = []; redirs = []; herestrings = []; segDocs = [];
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
      if (depth < APPROVAL_LEX_DEPTH && end > pos) {
        const body = s.slice(pos, end);
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
    if (bash && (c === "<" || c === ">") && n === "(") { endWord(); continue; } // <( … ) / >( … ): a process substitution
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
        if (s[k] === c) { op += c; k++; }
        else if (c === ">" && s[k] === "|") { op += "|"; k++; }
        if (s[k] === "&") { op += "&"; k++; }
      }
      redir = op;
      i = k - 1;
      continue;
    }
    if (c === "(") { endSeg(); paren++; if (n === "(" && !arith) arith = paren + 1; continue; }
    if (c === ")") {
      if (inSub && paren === 0) { endSeg(); return i; }
      endSeg();
      if (paren) paren--;
      if (paren < arith) arith = 0;
      continue;
    }
    if (";&|{}".includes(c)) { endSeg(); continue; }
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
  return [];
}
// A simple command that writes a file the approval guard stands on → its guard-down actions ([] = none): .specs/roadmap.json (R1:
// where the approval guard lives) and (1.24 review 6) a feature's .state.json and a harness-observed log — a redirection to it (> >>
// >| &> 2> *>), a writer naming it (tee, Set-Content, Out-File, Add-Content, rm / Remove-Item, mv / Move-Item / ren, truncate, dd
// of=…), sed / perl -i on it, cp / Copy-Item / ln / install onto it (the last path, a -Destination / -t value, or a folder receiving
// a file of that name), deleting or moving .specs/ away (roadmap.json with it), and git's in-place writers (gitWriteTargets). Reading
// it (cat, jq, git show, cp FROM it) is no write. The paths are read as the file system reads them (approvalPathText).
function specsWriteActions(words, raw) {
  const out = [];
  const add = (hit) => { if (hit) out.push(Object.assign({ kind: "guard-down", setting: hit.setting, source: "shell" }, hit.setting === "roadmap" ? {} : { feature: hit.feature || null })); };
  for (const t of words.redirs || []) add(approvalGuardedFile(t));
  const k = programAt(words, raw);
  if (k < 0) return out;
  const p = approvalProgram(words[k]);
  const texts = (i) => [words[i], (raw && raw[i]) || ""];
  const hit = (i) => { for (const w of texts(i)) { const h = approvalGuardedFile(w); if (h) return h; } return null; };
  const args = [];
  for (let i = k + 1; i < words.length; i++) args.push(i);
  const specsDir = (i) => texts(i).some((w) => RE_SPECS_DIR.test(approvalPathText(w)));
  if (APPROVAL_WRITERS_ANY.has(p)) args.forEach((i) => add(hit(i)));
  if (APPROVAL_REMOVERS.has(p) && args.some(specsDir)) add({ setting: "roadmap" });
  if (APPROVAL_MOVERS.has(p) && args.filter((i) => !words[i].startsWith("-")).slice(0, -1).some(specsDir)) add({ setting: "roadmap" }); // .specs/ as a source
  if (APPROVAL_WRITERS_INPLACE.has(p) && args.some((i) => /^(?:-[A-Za-z]*i|--in-place)/.test(words[i]))) args.forEach((i) => add(hit(i)));
  if (APPROVAL_WRITERS_TARGET.has(p)) {
    const pos = args.filter((i) => !words[i].startsWith("-") && !RE_DEST_OPTION.test(words[i - 1] || ""));
    const dest = args.filter((i) => RE_DEST_OPTION.test(words[i - 1] || "") || /^--target-directory=/.test(words[i]));
    const last = pos.length > 1 ? pos[pos.length - 1] : null;
    const targets = dest.concat(last == null ? [] : [last]);
    const destText = (i) => words[i].replace(/^--target-directory=/, "");
    for (const t of targets) {
      add(hit(t));
      // a folder receiving a file of a guarded name: `cp roadmap.json .specs/`, `cp x/.state.json .specs/alpha/`
      for (const s of pos) if (s !== t) add(approvalGuardedFile(destText(t).replace(/[\\/]+$/, "") + "/" + words[s].replace(/^.*[\\/]/, "")));
    }
  }
  if (p === "git") for (const t of gitWriteTargets(words, k)) add(approvalGuardedFile(t) || approvalGuardedDir(t));
  const seen = new Set();
  return out.filter((a) => { const key = JSON.stringify(a); return !seen.has(key) && seen.add(key); });
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
function shellApprovalActions(command, level, depth, mode, meta) {
  const out = [];
  const segs = shellCommandWords(command, mode);
  const namesCli = /dev-?spec/i.test(approvalPlain(command));
  segs.forEach((words, si) => {
    const raw = words.raw || words;
    const at = devSpecWordAt(words, raw);
    if (at >= 0) out.push(...cliApprovalAction(words.slice(at + 1), level, meta));
    // 1.23 review 5 (L20): the CLI fed to a JavaScript runtime on stdin — `cat cli/dev-spec.js | node - approve …`,
    // `node - approve … < cli/dev-spec.js` — when the command names the CLI somewhere.
    const sa = at < 0 && namesCli ? stdinScriptAt(words, raw) : -1;
    if (sa >= 0) out.push(...cliApprovalAction(words.slice(sa + 1), level, meta));
    out.push(...specsWriteActions(words, raw));
    if (depth >= APPROVAL_SHELL_DEPTH) return;
    const nested = [], seen = new Set();
    const add = (acts) => { for (const a of acts) { const k = JSON.stringify(a); if (!seen.has(k)) { seen.add(k); nested.push(a); } } };
    const lex = (script, m) => { if (script && approvalCandidate(script)) add(shellApprovalActions(script, level, depth + 1, m, meta)); };
    const end = at >= 0 ? at : words.length;
    const prog = at >= 0 ? -1 : programAt(words, raw);
    let shell = null, posix = false;
    for (let j = 0; j < end; j++) {
      if (shell && /\s/.test(words[j]) && approvalCandidate(words[j])) add(shellApprovalActions(words[j], level, depth + 1, shell, meta));
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
    if (words.stdinShell) for (const h of words.herestrings || []) if (approvalCandidate(h)) add(shellApprovalActions(h, level, depth + 1, words.stdinShell, meta));
    out.push(...nested);
  });
  return out;
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
    if (a.setting === "roadmap" || a.setting === "state" || a.setting === "observed") return null;
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
  } else if (APPROVAL_EDIT_TOOLS.has(tool) && typeof ti.file_path === "string") {
    // 1.23 review 5: a hand edit of .specs/roadmap.json or of a feature's .state.json (its approvals, evidence, history); 1.24 review 6:
    // of a harness-observed log (C6), the path read as the file system reads it — `./`, `..`, a stream, an 8.3 short name (C5).
    for (const t of approvalEditTargets(ti.file_path, payload.cwd)) {
      const h = approvalGuardedFile(t);
      if (!h) continue;
      actions = [Object.assign({ kind: "guard-down", setting: h.setting, source: "edit" }, h.setting === "roadmap" ? {} : { feature: h.feature || null },
        { project: approvalSpecsProject(t) })];
      break;
    }
  }
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
  const decision = actions.every((a) => a.kind === "unreadable" && (a.why === "unparsed" || a.why === "partial")) ? "ask" : lvl;
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
  return sub === "" || RE_APPROVAL_VAR_WORD.test(sub) || /^\$(?:[@*#?!0-9]|\{[@*#0-9])/.test(sub) || /\$\(|`/.test(sub) || (mode === "ps" && /^@[A-Za-z_]/.test(sub));
}
function approvalUnparsed(command, mode) {
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
let STOP_PATTERNS = null;
function stopPatterns() {
  if (STOP_PATTERNS) return STOP_PATTERNS;
  const word = (src) => new RegExp(STOP_WORD.pre + src + STOP_WORD.post, STOP_WORD.flags);
  const all = (k) => [...new Set(i18n.LANGS.flatMap((l) => (i18n.msg(l).stopGate || {})[k] || []))]; // pt-BR repeats pt's patterns
  const langsOf = new Map();
  for (const l of i18n.LANGS) for (const src of (i18n.msg(l).stopGate || {}).claims || []) {
    if (!langsOf.has(src)) langsOf.set(src, new Set());
    langsOf.get(src).add(i18n.baseLang(l));
  }
  STOP_PATTERNS = {
    claims: [...langsOf].map(([src, langs]) => ({ re: word(src), langs })),
    admissions: all("admissions").map(word),
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
// (negations and questions stay the engine's to judge).
function stopClaimFilter() {
  const re = (r) => ({ source: r.source, flags: r.flags });
  return { word: { ...STOP_WORD }, prose: { max: STOP_MESSAGE_MAX, fence: re(RE_STOP_FENCE), code: re(RE_STOP_CODE), quote: re(RE_STOP_QUOTE) },
    claims: stopClaimSources() };
}
// The mcp/lib files that make that filter (the patterns, the wrapper, the prose) — the generated file stamps their sizes, and the
// hook takes it only while every size and package.json's version still match (else: the engine decides, as before).
const STOP_FILTER_SOURCES = ["i18n.js", "i18n/common.js", "i18n/en.js", "i18n/es.js", "i18n/pt-br.js", "i18n/pt.js", "engine/guards.js"];
// Does the message claim the work is done / verified? → { claim, admitted, claims: [matched text] }. A match does not count
// when a negator or condition sits up to STOP_WINDOW words before it in the same clause ("not done", "once the tests
// pass", "I'll verify"; words ending in n't / 'll too; a colon or a dash starts a new clause; "no" / "se" read by language —
// stopNegates), nor when its sentence is a question. `admitted`: the message says plainly that something is NOT verified or
// fails ("task 3 is not verified", "2 failing") — the honest answer is never sent back — unless that failure is one already
// fixed ("I fixed the 2 failing tests", stopPastFailure).
function stopClaims(message) {
  const P = stopPatterns();
  const text = stopProse(message);
  const lang = guessLang(text); // decides "no" (a PT text: em + o) and "se" (an ES text: reflexive) — see stopNegates
  const found = [];
  const wordsOf = (s) => s.split(/[^\p{L}\p{N}_'’]+/u).filter(Boolean);
  const hits = [];
  for (const c of P.claims) {
    c.re.lastIndex = 0;
    let m;
    while ((m = c.re.exec(text)) !== null) {
      if (m[0] === "") { c.re.lastIndex++; continue; }
      hits.push({ start: m.index, end: m.index + m[0].length, text: m[0], langs: c.langs });
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
    while ((m = re.exec(text)) !== null) {
      if (m[0] === "") { re.lastIndex++; continue; }
      if (stopZeroCount(text, m.index)) continue;
      if (!stopPastFailure(text, m.index, m.index + m[0].length, wordsOf)) return true;
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
  if (!f.ok) return { ok: false, error: f.error };
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
    const codes = reportExitCodes(body).map((x) => x.code);
    // 1.23 review 5 (M16): a _Verify:_ command is shown when the report holds its text, or a command it writes (a code span) that
    // IS a run of it by the evidence gate's matcher (runProvesVerify: `tests\x.test.js` = `tests/x.test.js`, quotes, a ` && ` join
    // of the task's commands) — the raw text compare bounced `node --test tests/login.test.js` for `_Verify: node --test tests\login.test.js_`.
    const spans = reportCommandSpans(report);
    const missing = verify.filter((c) => !body.includes(flat(c)) && !spans.some((s) => runProvesVerify({ command: s }, [c], pdir) || runProvesVerify({ command: s }, verify, pdir)));
    const cmds = (missing.length ? missing : verify).map((c) => "`" + c + "`").join(", ");
    if (missing.length || !codes.length) problem = X.noRun(rel, cmds);
    // full review Ga5: the exit code must be the one the task needs — a must-pass _Verify:_ an exit 0 ("Status: DONE … exit
    // code: 1" was allowed), an _Expect: fail_ one a non-zero exit (its red run). A +tdd report may show the red run and then
    // the green one: any matching code counts.
    else if (expectsFail(task) ? !codes.some((c) => c !== 0) : !codes.includes(0)) problem = (expectsFail(task) ? X.notFailing : X.notPassing)(rel, cmds);
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
  gitWriteTargets, approvalEditTargets, RE_PS_STOP_AFTER_CLI, cliSubcommandUnread, __link };
