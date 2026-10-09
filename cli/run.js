"use strict";

/**
 * Running the user's own commands (1.27 — was cli/dev-spec.js's b5Exec / b5Verdict / b5RunChecks): a `_Verify:_` command
 * (`done --run`) or a project check of roadmap.json meta.checks (`finish --run`), only on that explicit flag — the same trust as an
 * npm script; a shell is the point, each is a shell command line. The CLI is the only surface that runs them (MCP records a run
 * reported to it); the engine judges the output (summarizeRunOutput, couldNotRunOutput…) and records the evidence.
 *
 *   execCommand(command, sh, opts)   → Promise<{ status, signal, error, heldOpen, stdout, stderr }> — the run itself
 *   runVerdict(run, sh, why, timeoutS) → { code, output, summary, cantRun, crashed? } — what the run proves
 *   runCommand(command, sh, M, opts) → Promise<the verdict + heldOpen> — both, as done --run / finish --run use them
 *   runChecks(feature, deps)         → Promise<{ ok, evidence } | a refusal> — finish --run's loop over meta.checks
 *   runSummaries(parts)              → the evidence summary of several passing commands
 *   shellName(sh)                    → the shell a run uses, as a message names it
 *
 * cli/tests/09-evidence-run-module.js tests them alone (a real child, its tree killed at --timeout, the output cap, a run held
 * open by a background process, every verdict).
 */

const path = require("path");
const { spawn, spawnSync } = require("child_process");

const facade = () => require(path.join(__dirname, "..", "mcp", "lib", "spec.js")); // the engine, read on use (never at load)

// 1.24 r6 B3: after the command EXITS, how long its output may still drain before the pipes are dropped (a background process it
// started can hold them open for good).
const RUN_DRAIN_MS = 2000;
// spawnSync's maxBuffer before 1.23 (M13), kept: a run printing more is output-too-large, recorded as nothing.
const MAX_OUTPUT = 64 * 1024 * 1024;
// A shell that execs its last command reports a crash of that command as the signal (full review R6).
const CRASH_SIGNALS = ["SIGSEGV", "SIGABRT", "SIGBUS", "SIGFPE", "SIGILL"];
// done --run with several _Verify:_ commands, all passing (1.23 review): the record keeps one summary per command, each
// re-summarized shorter when together they'd pass the record's 2,000 characters (normalizeEvidence cuts there).
const EVIDENCE_SUMMARY_MAX = 2000;

// The shell a run uses, as a message names it (the platform default spelled out). `env`: where ComSpec is read (the process's).
function shellName(sh, env) {
  const e = env || process.env;
  return sh.shell === true ? (process.platform === "win32" ? e.ComSpec || "cmd.exe" : "/bin/sh") : String(sh.shell);
}

// Runs ONE command line → a Promise of the raw run: { status, signal, error, heldOpen, stdout, stderr }. Asynchronous with a timer
// of its own (1.23 review M13), so `timeoutS` kills the whole PROCESS TREE — `taskkill /T /F` on Windows, the process group (a
// detached child: its own group) elsewhere; spawnSync's timeout killed the shell alone, the check it started ran on (and held the
// output pipes). 1.21.1: a PowerShell shell (sh.args — resolveRunShell) runs `<shell> -NoProfile -NonInteractive -Command <cmd>`,
// the command one argument; any other shell: Node runs `<shell> -c "<cmd>"` (cmd.exe: /d /s /c).
// opts: cwd · timeoutS (seconds, none = no limit) · onSignal(sig) — given, a SIGINT / SIGTERM to this process kills the tree
// first, then calls it (the CLI exits 130 / 143: a detached group no longer gets the terminal's Ctrl+C) · drainMs · maxOutput.
function execCommand(command, sh, opts) {
  const o = opts || {};
  const timeoutS = o.timeoutS;
  const drainMs = o.drainMs === undefined ? RUN_DRAIN_MS : o.drainMs;
  const maxOutput = o.maxOutput === undefined ? MAX_OUTPUT : o.maxOutput;
  const win = process.platform === "win32";
  return new Promise((resolve) => {
    const chunks = [[], []];
    let size = 0, error = null, settled = false, timer = null, grace = null, child = null;
    let exited = null, drain = null, heldOpen = false; // 1.24 r6 B3: the command's exit, the drain after it, pipes still held then
    const killTree = () => {
      if (child && child.pid != null) {
        if (win) {
          try { spawnSync("taskkill", ["/T", "/F", "/PID", String(child.pid)], { windowsHide: true, stdio: "ignore", timeout: 15000 }); } catch { /* gone */ }
        } else {
          try { process.kill(-child.pid, "SIGKILL"); } catch { try { child.kill("SIGKILL"); } catch { /* gone */ } }
        }
      }
      // A process that left the tree (or a pipe someone else holds) must not keep the CLI waiting: 3 s for 'close', then settle.
      if (!grace) grace = setTimeout(() => settle(null, "SIGKILL"), 3000);
    };
    const onSignal = (sig) => { killTree(); o.onSignal(sig); };
    const settle = (status, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(grace);
      clearTimeout(drain);
      if (o.onSignal) {
        process.removeListener("SIGINT", onSignal);
        process.removeListener("SIGTERM", onSignal);
      }
      if (child) { try { child.stdout.destroy(); child.stderr.destroy(); child.unref(); } catch { /* already closed */ } }
      resolve({ status, signal, error, heldOpen, stdout: Buffer.concat(chunks[0]).toString("utf8"), stderr: Buffer.concat(chunks[1]).toString("utf8") });
    };
    try {
      const sopts = { cwd: o.cwd, windowsHide: true, detached: !win };
      // nosemgrep: javascript.lang.security.audit.spawn-shell-true.spawn-shell-true
      child = Array.isArray(sh.args) ? spawn(String(sh.shell), [...sh.args, command], sopts) : spawn(command, { shell: sh.shell, ...sopts });
    } catch (e) { error = e; return settle(null, null); }
    if (o.onSignal) {
      process.on("SIGINT", onSignal);
      process.on("SIGTERM", onSignal);
    }
    child.on("error", (e) => { if (!error) error = e; settle(null, null); }); // the shell never started (ENOENT, EACCES…)
    const take = (k) => (c) => {
      if (error) return;
      size += c.length;
      if (size > maxOutput) { error = Object.assign(new Error("output maxBuffer length exceeded"), { code: "ENOBUFS" }); killTree(); return; }
      chunks[k].push(c);
    };
    child.stdout.on("data", take(0));
    child.stderr.on("data", take(1));
    try { child.stdin.end(); } catch { /* no stdin */ }
    // 1.24 r6 B3 — the run is over when the COMMAND exits, not when its pipes close: a background process it started (a dev
    // server, a watcher) inherits them and kept the CLI waiting for that process — and --timeout refused a run that had exited 0.
    // At the exit the --timeout timer stops; what is still in the pipes drains until 'close', drainMs at most, then the pipes are
    // dropped and the exit status settles the run (heldOpen: the caller prints a note).
    child.on("exit", (code, signal) => {
      exited = { code, signal };
      if (!error) clearTimeout(timer);
      drain = setTimeout(() => { heldOpen = true; settle(code, signal); }, drainMs);
    });
    child.on("close", (code, signal) => settle(exited ? exited.code : code, exited ? exited.signal : signal));
    if (timeoutS) timer = setTimeout(() => { error = Object.assign(new Error("spawn " + shellName(sh) + " ETIMEDOUT"), { code: "ETIMEDOUT" }); killTree(); }, timeoutS * 1000);
  });
}

// A finished run → { code, output, summary, cantRun: null | { code, why }, crashed? } — cantRun (full review Ga1 / Ga9 / Ga10, stable
// codes): the run never exercised the check, so nothing may be recorded for it: shell-not-started (spawn error: a missing or
// unusable shell) · timeout · output-too-large · signal (killed) · run-error (any other spawn error) · wsl (WSL's launcher
// answered). `why`: the localized reasons (msg(lang).runGate.why).
function runVerdict(run, sh, why, timeoutS) {
  const spec = facade();
  const output = (run.stdout || "") + (run.stderr || "") + (run.error ? "\n" + run.error.message : "");
  const summary = spec.summarizeRunOutput(output);
  const W = why;
  let cantRun = null;
  if (run.error) {
    const ec = String(run.error.code || "");
    cantRun = ec === "ETIMEDOUT" ? { code: "timeout", why: W.timeout(timeoutS) }
      : ec === "ENOBUFS" ? { code: "output-too-large", why: W.buffer }
      : ["ENOENT", "EACCES", "ENOEXEC", "EPERM", "EISDIR", "ENOTDIR", "UNKNOWN"].includes(ec) ? { code: "shell-not-started", why: W.spawn(shellName(sh), ec) }
      : { code: "run-error", why: W.error(ec || String(run.error.message || "?").slice(0, 120)) };
  } else if (run.status == null) {
    // The check itself CRASHED (a shell that execs its last command reports the crash as the signal): it ran and failed — a
    // failed run (128 + the signal number, the shells' convention), never "could not run", or a crashing re-check would leave a
    // ticked task verified (full review R6). Its caller refuses it as a red test. Any other signal: killed.
    const signo = CRASH_SIGNALS.includes(run.signal) ? (require("os").constants.signals || {})[run.signal] : null;
    if (signo) return { code: 128 + signo, output, summary, cantRun: null, crashed: run.signal };
    cantRun = { code: "signal", why: W.signal(run.signal || "?") };
  } else if (run.status !== 0) {
    const o = spec.couldNotRunOutput(output);
    if (o && o.kind === "wsl") cantRun = { code: "wsl", why: W.wsl(o.text) }; // WSL's relay answered: no command of this machine ran
  }
  return { code: run.status, output, summary, cantRun };
}

// ONE command, run and judged → the verdict + heldOpen (1.24 r6 B3: a background process still held the output pipes when the
// run settled at the command's exit). M: the feature language's messages. opts: execCommand's.
async function runCommand(command, sh, M, opts) {
  const run = await execCommand(command, sh, opts);
  const r = runVerdict(run, sh, M.runGate.why, (opts || {}).timeoutS);
  r.heldOpen = !!run.heldOpen;
  return r;
}

// done --run with several passing _Verify:_ commands: "$ <command>" and its summary per command, each re-summarized shorter when
// together they'd pass EVIDENCE_SUMMARY_MAX. One command: its summary, as ever.
function runSummaries(parts) {
  if (parts.length === 1) return parts[0].summary;
  const budget = Math.floor(EVIDENCE_SUMMARY_MAX / parts.length);
  return parts.map((p) => {
    const head = "$ " + (p.cmd.length > 120 ? p.cmd.slice(0, 119) + "…" : p.cmd);
    const room = budget - head.length - 1;
    const body = room < 20 ? "" : p.summary && p.summary.length <= room ? p.summary : facade().summarizeRunOutput(p.output, room);
    return body ? head + "\n" + body : head;
  }).join("\n").slice(0, EVIDENCE_SUMMARY_MAX);
}

// finish --run: every project check (meta.checks), in order, from the project root — the same shell rules as done --run (--shell /
// DEV_SPEC_SHELL, POSIX syntax refused under cmd.exe, a pwsh script under a POSIX shell, the pipe hint). Every run is recorded, a
// failure too; a check that could not run refuses the whole run (all-or-nothing, like spec_finish {evidence}).
// deps: projectDir · resolveShell() (the CLI's: --shell / DEV_SPEC_SHELL, --timeout checked first) · say(line) (stdout, or stderr
// under --json) · warn(line) (stderr) · gitState() · execOpts() (runCommand's opts — read once the shell is resolved).
async function runChecks(feature, deps) {
  const spec = facade();
  const { projectDir } = deps;
  const fx = spec.existingFeature(projectDir, feature);
  if (!fx.ok) return fx;
  const M = spec.msg(spec.featureLang(projectDir, fx.slug));
  const { checks, unsafe } = spec.projectChecks(projectDir);
  // 1.25.1 (review 7): a stored check holding a control character — nothing runs while one is there (spec_init refuses one)
  if (unsafe && unsafe.length) return { ok: false, code: "control-chars", error: M.verifyControl.checks(unsafe.join(", ")) };
  if (!checks.length) return { ok: false, error: M.projectChecks.noneToRun };
  const sh = deps.resolveShell();
  if (sh.error) return { ok: false, couldNotRun: sh.error, error: sh.error === "wsl-exe" ? M.runGate.wslExe(sh.path) : M.runGate.noGitBash };
  if (sh.wsl) deps.say(M.runGate.wslBash(sh.shell)); // 1.15: an explicit WSL launcher is used as given
  if (process.platform === "win32" && sh.shell === true) {
    const posix = checks.map((c) => [c, spec.posixShellSyntax(c.command)]).find(([, k]) => k.length);
    if (posix) return { ok: false, error: M.projectChecks.posixOnWindows(posix[0].name, posix[0].command, posix[1]) };
  }
  if (sh.posix) { // 1.21.1 review: a POSIX shell would expand the pwsh script's `$…` first (done --run's rule)
    const pw = checks.map((c) => [c, spec.posixPwshScript(c.command)]).find(([, k]) => k.length);
    if (pw) return { ok: false, error: M.projectChecks.pwshInPosix(pw[0].name, pw[0].command, pw[1], shellName(sh)) };
  }
  checks.map((c) => c.command).filter(spec.verifyPipeMasked).forEach((c) => deps.say(M.verifyPipe.runHint(c)));
  const git = deps.gitState();
  const exec = deps.execOpts();
  const evidence = [];
  let cmdFailed = false;
  for (const c of checks) {
    deps.say("$ " + c.command + "   (" + c.name + ")");
    const x = await runCommand(c.command, sh, M, exec);
    if (x.summary) deps.say(x.summary.replace(/^/gm, "  "));
    if (x.heldOpen && !x.cantRun) deps.say("  " + M.cliOutput.runHeldOpen(x.code)); // 1.24 r6 B3: settled at its exit
    // full review Ga1 / Ga9 / Ga10: a check that could not run is refused and NOTHING is recorded (all-or-nothing, like
    // spec_finish {evidence}) — it used to be recorded as a failed run (exit 1).
    if (x.cantRun) return { ok: false, couldNotRun: x.cantRun.code, check: c.name, error: M.runGate.checkRefused(c.name, c.command, x.cantRun.why) };
    if (x.code !== 0 && sh.cmd && spec.windowsShellFailure(x.output, x.code)) cmdFailed = true;
    evidence.push({ name: c.name, command: c.command, exitCode: x.code, summary: x.summary, ...git });
  }
  if (cmdFailed) deps.warn(M.taskDone.shellHint);
  return { ok: true, evidence };
}

module.exports = { execCommand, runVerdict, runCommand, runChecks, runSummaries, shellName, RUN_DRAIN_MS, MAX_OUTPUT, EVIDENCE_SUMMARY_MAX, CRASH_SIGNALS };
