"use strict";

/**
 * git, as the CLI runs it (1.27) — ONE way: `gitRun(args, {cwd})`. The engine never runs git (MCP reads the repository's files);
 * the CLI reads what git says where a command needs it — the commit a `done --run` / `finish --run` is made on (`gitState`),
 * `log` (the commits citing a task), Git Bash's folder (`--exec-path`), a feature's own branch (`branchFacts`, then `git switch`)
 * — and writes only where the user asked it to: `merge-state --install / --uninstall` (git config), the switch to a feature's
 * branch, `git merge-file` for a hand-written overview.
 *
 * One environment for every call: GIT_OPTIONAL_LOCKS=0 (a read never takes the index lock a concurrent git needs — status
 * refreshes it otherwise; required locks, config / switch, are unaffected), GIT_TERMINAL_PROMPT=0 (never a credential prompt that
 * would hang a hook or a script), 64 MB of output (`log` over a large history), 30 s at most, no console window on Windows. The
 * user's locale is kept: no caller parses a translated message (exit codes, hex ids, porcelain, paths, the log's fixed headers),
 * and two show git's own stderr to the user (a failed `git config` / `git switch`), who reads it in their language.
 */

const { spawnSync } = require("child_process");

const GIT_MAX_BUFFER = 64 * 1024 * 1024;
const GIT_TIMEOUT_MS = 30000;

// The environment every git call gets (the CLI's — the process environment unless given).
const gitEnv = (env) => ({ ...(env || process.env), GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" });

// → { ok, status, stdout, stderr, error } — ok: git ran and exited 0. `error`: git could not run (not installed, ENOENT; the
// timeout, ETIMEDOUT; output past the buffer, ENOBUFS) or spawnSync threw. Never throws.
function gitRun(args, opts) {
  const o = opts || {};
  let r;
  try {
    r = spawnSync("git", args, { cwd: o.cwd, encoding: "utf8", timeout: GIT_TIMEOUT_MS, windowsHide: true, maxBuffer: GIT_MAX_BUFFER, env: gitEnv(o.env) });
  } catch (e) {
    return { ok: false, status: null, stdout: "", stderr: "", error: e };
  }
  const error = (r && r.error) || null;
  return { ok: !error && r.status === 0, status: r ? r.status : null, stdout: String((r && r.stdout) || ""), stderr: String((r && r.stderr) || ""), error };
}
// What git printed when it succeeded, else null (git missing, not a repository, a failed command).
function gitText(args, opts) {
  const r = gitRun(args, opts);
  return r.ok ? r.stdout : null;
}

// {commit, dirty} for evidence — {} without git / a repository / a commit (silently: git is optional). .specs/ (ticks, state) is
// not the code under test.
function gitState(cwd) {
  const commit = String(gitText(["rev-parse", "--short", "HEAD"], { cwd }) || "").trim();
  if (!/^[0-9a-f]{4,40}$/i.test(commit)) return {};
  const st = gitText(["status", "--porcelain", "--", ".", ":(exclude).specs"], { cwd });
  return st == null ? { commit } : { commit, dirty: st.trim() !== "" };
}

// What git says in the project folder before a feature is created on its own branch (create / bugfix / spike --branch) →
// undefined (git can't run here: the engine reads the repository's files instead) · { repo: false } (not inside a work tree) ·
// { repo: true, base, commit, current, exists(name) } — read only (rev-parse, symbolic-ref: no lock, no network).
function branchFacts(cwd) {
  const inside = gitRun(["rev-parse", "--is-inside-work-tree"], { cwd });
  if (inside.error) return undefined;
  if (inside.status !== 0 || inside.stdout.trim() !== "true") return { repo: false };
  const sym = gitRun(["symbolic-ref", "--quiet", "--short", "HEAD"], { cwd }); // the branch HEAD names — an unborn one too; exit 1: detached
  const base = sym.ok ? sym.stdout.trim() || null : null;
  const rev = gitRun(["rev-parse", "--verify", "--quiet", "HEAD^{commit}"], { cwd }); // nothing yet in a repository without a commit
  const sha = rev.ok ? rev.stdout.trim() : "";
  return { repo: true, base, commit: /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/.test(sha) ? sha : null, current: base,
    exists: (name) => { const s = gitRun(["rev-parse", "--verify", "--quiet", "refs/heads/" + name], { cwd }); return s.error ? null : s.status === 0; } };
}

module.exports = { gitRun, gitText, gitEnv, gitState, branchFacts, GIT_MAX_BUFFER, GIT_TIMEOUT_MS };
