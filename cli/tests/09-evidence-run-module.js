"use strict";
// cli/run.js alone (1.27) — a command's run and exit code, its process tree killed at --timeout, the output cap, a run a background process holds open, every verdict, finish --run's loop.

const fs = require("fs");
const path = require("path");

// Is the process alive? (process.kill(pid, 0) tests it on Windows and POSIX alike.)
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === "EPERM"; } };
const waitFor = async (cond, ms) => { const end = Date.now() + ms; while (Date.now() < end) { if (cond()) return true; await new Promise((r) => setTimeout(r, 100)); } return cond(); };

exports.run = async ({ ok, all, eq, tmp, __dirname }) => {
  const RUN = require(path.join(__dirname, "run.js"));
  const S = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const M = S.msg("en");
  const sh = S.resolveRunShell("", {}); // the platform default, as done --run's: cmd.exe on Windows, /bin/sh elsewhere
  const dir = path.join(tmp, "run-module");
  fs.mkdirSync(dir, { recursive: true });
  const fwd = (p) => p.split(path.sep).join("/");
  const script = (name, code) => { const f = path.join(dir, name); fs.writeFileSync(f, code); return "node \"" + fwd(f) + "\""; };

  // 1.27 run.js: a command's exit code and output, through the platform shell; its verdict: the code, the summary, nothing that
  // "could not run"; a pass is 0.
  {
    const fail3 = await RUN.execCommand(script("exit3.js", "console.log('three-out'); console.error('three-err'); process.exit(3);\n"), sh, { cwd: dir });
    const pass = await RUN.execCommand(script("pass.js", "console.log('fine');\n"), sh, { cwd: dir });
    const v3 = RUN.runVerdict(fail3, sh, M.runGate.why), v0 = RUN.runVerdict(pass, sh, M.runGate.why);
    all("1.27 run.js: execCommand runs a command line through the platform shell — its exit code, stdout and stderr; runVerdict: the code, a summary, no cantRun (got " + JSON.stringify([fail3, pass].map((r) => [r.status, r.signal, r.stdout, r.stderr, r.heldOpen])) + ")", {
      exit3: fail3.status === 3, out3: /three-out/.test(fail3.stdout), err3: /three-err/.test(fail3.stderr), noError: fail3.error === null && pass.error === null,
      pass: pass.status === 0 && /fine/.test(pass.stdout), notHeld: !fail3.heldOpen && !pass.heldOpen,
      verdict3: v3.code === 3 && v3.cantRun === null && /three-out/.test(v3.summary) && /three-err/.test(v3.output), verdict0: v0.code === 0 && v0.cantRun === null,
    });
  }

  // 1.27 run.js: --timeout kills the whole PROCESS TREE (taskkill /T /F on Windows, the process group elsewhere) — the command, and a
  // grandchild it started that holds the output pipes, are gone; the run settles as "timeout" (nothing may be recorded).
  {
    const pidFile = path.join(dir, "grand.pid");
    const grand = path.join(dir, "grand.js");
    fs.writeFileSync(grand, "require('fs').writeFileSync(" + JSON.stringify(pidFile) + ", String(process.pid)); setTimeout(() => {}, 60000);\n");
    const cmd = script("tree.js", "require('child_process').spawn(process.execPath, [" + JSON.stringify(grand) + "], { stdio: 'inherit' }); setTimeout(() => {}, 60000);\n");
    const t0 = Date.now();
    const run = await RUN.execCommand(cmd, sh, { cwd: dir, timeoutS: 2 });
    const took = Date.now() - t0;
    const v = RUN.runVerdict(run, sh, M.runGate.why, 2);
    const gpid = Number(fs.existsSync(pidFile) ? fs.readFileSync(pidFile, "utf8") : 0);
    const gone = gpid > 0 && (await waitFor(() => !alive(gpid), 10000));
    if (gpid > 0 && alive(gpid)) { try { process.kill(gpid); } catch { /* gone */ } }
    all("1.27 run.js: --timeout kills the command's process tree — the grandchild holding the pipes is gone; the run is could-not-run 'timeout' (got " + JSON.stringify([run.status, run.signal, run.error && run.error.code, took, gpid, v.cantRun]) + ")", {
      timedOut: run.error && run.error.code === "ETIMEDOUT", verdict: v.cantRun && v.cantRun.code === "timeout" && /2/.test(v.cantRun.why),
      grandchildStarted: gpid > 0, grandchildGone: gone, settled: took < 30000,
    });
  }

  // 1.27 run.js: output past the cap (maxOutput — 64 MB in the CLI) is "output-too-large", the run killed; a run ends when its COMMAND
  // exits — a background process still holding the pipes is cut off after the drain (heldOpen), the exit status kept.
  {
    const big = await RUN.execCommand(script("big.js", "process.stdout.write('x'.repeat(200000)); setTimeout(() => {}, 30000);\n"), sh, { cwd: dir, maxOutput: 50000 });
    const vb = RUN.runVerdict(big, sh, M.runGate.why);
    const pidFile = path.join(dir, "held.pid");
    const holder = path.join(dir, "holder.js");
    fs.writeFileSync(holder, "require('fs').writeFileSync(" + JSON.stringify(pidFile) + ", String(process.pid)); setTimeout(() => {}, 30000);\n");
    const t0 = Date.now();
    const held = await RUN.execCommand(script("held.js", "const c = require('child_process').spawn(process.execPath, [" + JSON.stringify(holder) + "], { stdio: 'inherit', detached: true }); c.unref(); console.log('started'); setTimeout(() => process.exit(0), 300);\n"),
      sh, { cwd: dir, drainMs: 500 });
    const took = Date.now() - t0;
    const hpid = Number(fs.existsSync(pidFile) ? fs.readFileSync(pidFile, "utf8") : 0);
    if (hpid > 0) { try { process.kill(hpid); } catch { /* gone */ } }
    all("1.27 run.js: output over maxOutput → could-not-run 'output-too-large'; a command that exits while a background process holds its pipes settles after the drain — heldOpen, exit 0 kept (got " +
      JSON.stringify([big.error && big.error.code, vb.cantRun, held.status, held.heldOpen, held.stdout, took]) + ")", {
      cap: big.error && big.error.code === "ENOBUFS" && vb.cantRun && vb.cantRun.code === "output-too-large",
      held: held.heldOpen === true && held.status === 0 && /started/.test(held.stdout) && took < 20000,
    });
  }

  // 1.27 run.js: a shell that cannot start is "shell-not-started" (nothing ran); runVerdict reads every other way a run can end —
  // a timeout, the cap, any other spawn error, a kill, a crash (128 + the signal: a failed run, never "could not run"), WSL's relay.
  {
    const noShell = { shell: path.join(dir, "no-such-shell.exe") };
    const ns = await RUN.execCommand("echo x", noShell, { cwd: dir });
    const vns = RUN.runVerdict(ns, noShell, M.runGate.why);
    const W = M.runGate.why;
    const v = (run) => RUN.runVerdict({ stdout: "", stderr: "", ...run }, sh, W, 5);
    const err = (code) => Object.assign(new Error("e " + code), { code });
    const segv = (require("os").constants.signals || {}).SIGSEGV;
    const crash = v({ status: null, signal: "SIGSEGV" });
    const wsl = v({ status: 1, stdout: "<3>WSL (10 - Relay) ERROR: CreateProcessCommon:818: execvpe(/bin/bash) failed: No such file or directory\n" });
    all("1.27 run.js: runVerdict — a missing shell, ETIMEDOUT, ENOBUFS, another spawn error, a kill, a crash, WSL's relay, a failed and a passing run (got " +
      JSON.stringify([ns.error && ns.error.code, vns.cantRun, crash, wsl.cantRun]) + ")", {
      missingShell: ns.error && vns.cantRun && vns.cantRun.code === "shell-not-started",
      timeout: v({ status: null, error: err("ETIMEDOUT") }).cantRun.code === "timeout",
      cap: v({ status: null, error: err("ENOBUFS") }).cantRun.code === "output-too-large",
      spawnCodes: ["ENOENT", "EACCES", "ENOEXEC", "EPERM", "EISDIR", "ENOTDIR", "UNKNOWN"].every((c) => v({ status: null, error: err(c) }).cantRun.code === "shell-not-started"),
      runError: v({ status: null, error: err("EWHATEVER") }).cantRun.code === "run-error",
      killed: v({ status: null, signal: "SIGTERM" }).cantRun.code === "signal",
      crash: crash.cantRun === null && crash.crashed === "SIGSEGV" && crash.code === 128 + segv,
      wsl: wsl.cantRun && wsl.cantRun.code === "wsl",
      failed: v({ status: 2, stdout: "boom" }).cantRun === null && v({ status: 2 }).code === 2, passed: v({ status: 0 }).cantRun === null,
    });
  }

  // 1.27 run.js: runCommand = execCommand + runVerdict + heldOpen; runSummaries keeps one "$ <command>" section per passing command,
  // within the record's 2,000 characters (a long command cut at 120); shellName spells the platform default out.
  {
    const rc = await RUN.runCommand(script("rc.js", "console.log('rc-out'); process.exit(5);\n"), sh, M, { cwd: dir });
    const one = RUN.runSummaries([{ cmd: "a", output: "x", summary: "sum a" }]);
    const two = RUN.runSummaries([{ cmd: "npm test", output: "", summary: "12 passed" }, { cmd: "npm run lint", output: "", summary: "clean" }]);
    const long = RUN.runSummaries([{ cmd: "c".repeat(200), output: "o\n".repeat(3000), summary: "s".repeat(1500) }, { cmd: "d", output: "", summary: "t" }]);
    all("1.27 run.js: runCommand's verdict carries heldOpen; runSummaries — one command its summary, several a section each within 2,000 characters; shellName (got " +
      JSON.stringify([rc.code, rc.heldOpen, two, long.length, RUN.shellName({ shell: true }), RUN.shellName({ shell: "bash" })]) + ")", {
      runCommand: rc.code === 5 && rc.cantRun === null && rc.heldOpen === false && /rc-out/.test(rc.summary),
      one: one === "sum a", two: two === "$ npm test\n12 passed\n$ npm run lint\nclean",
      long: long.length <= RUN.EVIDENCE_SUMMARY_MAX && long.startsWith("$ " + "c".repeat(119) + "…\n") && /\n\$ d\nt$/.test(long),
      shellName: RUN.shellName({ shell: true }) === (process.platform === "win32" ? process.env.ComSpec || "cmd.exe" : "/bin/sh") && RUN.shellName({ shell: "bash" }) === "bash",
    });
  }

  // 1.27 run.js: runChecks — finish --run's loop over meta.checks with what the CLI passes in (the shell resolver, the lines, the git
  // state, the run options): every check run and recorded (a failure too), the lines said; no checks, a shell that can't run and a
  // check that could not run are refusals (nothing recorded).
  {
    const p = path.join(tmp, "run-module-proj");
    S.initProject(p, ["core"], "en", { checks: { ok: "node -e \"process.exit(0)\"", bad: "node -e \"process.exit(4)\"" } });
    S.createFeature(p, "Login", ["core"], "", undefined, "en");
    const said = [], warned = [];
    const deps = (over) => ({ projectDir: p, resolveShell: () => sh, say: (l) => said.push(l), warn: (l) => warned.push(l), gitState: () => ({ commit: "abc1234" }),
      execOpts: () => ({ cwd: p }), ...(over || {}) });
    const r = await RUN.runChecks("login", deps());
    const noShell = await RUN.runChecks("login", deps({ resolveShell: () => ({ error: "no-git-bash" }) }));
    const cant = await RUN.runChecks("login", deps({ resolveShell: () => ({ shell: path.join(p, "no-such-shell.exe") }) }));
    const none = path.join(tmp, "run-module-none");
    S.initProject(none, ["core"], "en");
    S.createFeature(none, "Login", ["core"], "", undefined, "en");
    const empty = await RUN.runChecks("login", deps({ projectDir: none }));
    const missing = await RUN.runChecks("nope", deps());
    all("1.27 run.js: runChecks runs every meta.checks command through the injected shell and records each run with the git state; a missing shell, a shell that can't start, no checks and an unknown feature are refusals (got " +
      JSON.stringify([r, noShell, cant.couldNotRun, empty.error, missing.ok, said]).slice(0, 900) + ")", {
      ran: r.ok === true && r.evidence.length === 2, codes: r.evidence.map((e) => e.name + ":" + e.exitCode).join() === "ok:0,bad:4" || r.evidence.map((e) => e.name + ":" + e.exitCode).join() === "bad:4,ok:0",
      git: r.evidence.every((e) => e.commit === "abc1234"), said: said.some((l) => /^\$ node -e .*\(ok\)$/.test(l)) && said.some((l) => /\(bad\)$/.test(l)),
      noShell: noShell.ok === false && noShell.couldNotRun === "no-git-bash", cant: cant.ok === false && cant.couldNotRun === "shell-not-started" && cant.check,
      empty: empty.ok === false && /no project checks/i.test(empty.error), missing: missing.ok === false,
    });
  }
};
