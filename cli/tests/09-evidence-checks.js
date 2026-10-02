"use strict";
// Evidence on the CLI — project checks, CLI runs, the shell done --run / finish --run use.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

// 1.14 full review (Ga) — evidence, project checks, CLI runs.
exports.run = ({ ok, tmp, CLI, require, __dirname }) => {
  const Sga = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const jsonGa = (s) => { try { return JSON.parse(s); } catch { return null; } };
  const rga = (proj, args, env) => {
    const r = spawnSync(process.execPath, [CLI, ...args, "--project", proj], { encoding: "utf8", env: { ...process.env, ...(env || {}) } });
    return { out: (r.stdout || "") + (r.stderr || ""), stdout: r.stdout || "", code: r.status };
  };
  const stGa = (f) => JSON.parse(fs.readFileSync(path.join(f.dir, ".state.json"), "utf8"));
  const tasksGa = (f) => fs.readFileSync(path.join(f.dir, "tasks.md"), "utf8");
  const wGa = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  const PASS = 'node -e "process.exit(0)"';
  const gp = path.join(tmp, "frga-proj");
  Sga.initProject(gp, ["core"], "en");

  // Ga1: a shell that can't start (--shell / DEV_SPEC_SHELL) is no exit 1 — done --run refuses and records nothing (an
  // _Expect: fail_ task was ticked on a "red run" that never happened); finish --run records no check run.
  const f1 = Sga.createFeature(gp, "Shellless", ["core"], "", undefined, "en");
  wGa(f1.dir, "tasks.md", "- [ ] 1. [US1] Write T-01 red\n  - _Verify: " + PASS + "_\n  - _Expect: fail_\n");
  const g1 = rga(gp, ["done", f1.slug, "1", "--run", "--shell", "no-such-shell-dsd", "--json"]);
  const g1j = jsonGa(g1.stdout);
  const g1env = rga(gp, ["done", f1.slug, "1", "--run"], { DEV_SPEC_SHELL: "no-such-shell-dsd" });
  const gpc = path.join(tmp, "frga-checks");
  Sga.initProject(gpc, ["core"], "en", { checks: { test: PASS } });
  const fc = Sga.createFeature(gpc, "Fin", ["core"], "", undefined, "en");
  wGa(fc.dir, "tasks.md", "- [x] 1. [US1] Done\n");
  const g1f = rga(gpc, ["finish", fc.slug, "--run", "--shell", "no-such-shell-dsd", "--json"]);
  const g1fj = jsonGa(g1f.stdout);
  ok(g1.code === 1 && g1j && g1j.couldNotRun === "shell-not-started" && /could not run \(the shell 'no-such-shell-dsd' could not be started: ENOENT\) — nothing was recorded; the task stays open/.test(g1j.error) &&
    g1env.code === 1 && /nothing was recorded; the task stays open/.test(g1env.out) && !(stGa(f1).evidence || {})["1"] && /- \[ \] 1\./.test(tasksGa(f1)) &&
    g1f.code === 1 && g1fj && g1fj.couldNotRun === "shell-not-started" && g1fj.check === "test" && /the project check 'test' .* could not run/.test(g1fj.error) && !stGa(fc).finishChecks,
    "full review Ga1: done --run / finish --run with a shell that can't start refuse and record nothing (no 'red run', no failed check run; --shell and DEV_SPEC_SHELL) (got " +
    JSON.stringify([g1.code, g1j, g1env.out.slice(-160), g1f.code, g1fj && g1fj.error]).slice(0, 600) + ")");

  // Ga2: an _Expect: fail_ run that fails because the test never ran (here: the runner's own "Could not find '…'") is no red
  // run — refused, nothing recorded; the same task failing on an assertion is the red proof.
  const f2 = Sga.createFeature(gp, "Missing test", ["core"], "", undefined, "en");
  wGa(f2.dir, "tasks.md", "- [ ] 1. [US1] Write T-01 and watch it fail\n  - _Verify: node t/red.js_\n  - _Expect: fail_\n");
  wGa(gp, "t/red.js", "console.error(\"Could not find 't/uppercase.test.js'\");\nprocess.exit(1);\n");
  const g2 = rga(gp, ["done", f2.slug, "1", "--run", "--json"]);
  const g2j = jsonGa(g2.stdout);
  const g2rec = (stGa(f2).evidence || {})["1"];
  wGa(gp, "t/red.js", "require(\"assert\").strictEqual(\"a\".toUpperCase(), \"B\");\n");
  const g2b = rga(gp, ["done", f2.slug, "1", "--run"]);
  ok(g2.code === 1 && g2j && g2j.couldNotRun === "output" && g2j.expected === "fail" && /its output shows the test never ran \(Could not find 't\/uppercase\.test\.js'\) — that is no red test/.test(g2j.error) &&
    !g2rec && g2b.code === 0 && /✓ red run recorded for task 1 \(exit 1\)/.test(g2b.out) && /- \[x\] 1\./.test(tasksGa(f2)),
    "full review Ga2: done --run on an _Expect: fail_ task whose test never ran (missing test file) is refused, nothing recorded; an assertion failure is then the red proof (got " +
    JSON.stringify([g2.code, g2j && g2j.error, g2b.out.slice(0, 200)]).slice(0, 500) + ")");

  // Ga3: finish --run --write, then the implementing file changes, then finish --write (no --run) → not ready: the check run is
  // for other code (code-changed) — it used to answer "ready … Replaced the baseline" on the old run.
  const g3p = path.join(tmp, "frga-drift");
  Sga.initProject(g3p, ["core"], "en", { checks: { test: PASS } });
  const f3 = Sga.createFeature(g3p, "Limiter", ["core"], "", undefined, "en");
  wGa(f3.dir, "classification.md", "# Classification: x\n\n## Mode\nSpec\n\n## Active Tracks\ncore\n\n## Signals\n- none, plain feature\n\n## Blast Radius\nLow; only the login page.\n\n## Compliance Tags\nnone\n");
  wGa(f3.dir, "requirements.md", "# Feature: x\n\n## Summary\nUsers log in with email and password.\n\n## User Stories (prioritized — each independently testable)\n\n### US-1 (P1 — MVP): Log in\n" +
    "**As a** user, **I want** to log in, **so that** I see my account.\n**Why P1:** nothing works without it.\n**Independent Test:** Can be fully tested by logging in and delivers access, without the other stories.\n\n" +
    "#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN the user submits valid credentials THE SYSTEM SHALL open a session\n2. **US-1.AC-2** — IF the credentials are wrong THEN THE SYSTEM SHALL show an error\n\n" +
    "## Success Criteria (measurable, technology-agnostic)\n- **SC-001** — 95% of logins complete in under 2 seconds\n\n## Edge Cases & Error Handling\n- **EC-1** — Locked account: show the lock message\n\n" +
    "## Non-Functional Requirements\n- **NFR-1** — p95 latency under 300 ms\n\n## Out of Scope\n- Social login\n\n## Assumptions\n- Users already have accounts\n");
  wGa(f3.dir, "design.md", "# Design: x\n\n## Overview\nA form posts to /login; the server checks the hash.\n\n## Architecture\nThe web app calls the auth service.\n\n## Data Models\nUser { id, email, hash }\n\n" +
    "## API Contracts\nPOST /login returns 200 or 401.\n\n## Security Considerations\nHashes use bcrypt.\n\n## Error Handling\nWrong credentials give 401.\n\n## Testing Strategy\n- Unit tests for the handler.\n\n" +
    "## Constitution Check\n- [x] Simplicity — complies\n\n## Complexity Tracking\nNone.\n");
  wGa(f3.dir, "tasks.md", "# Tasks\n\n## Story US-1 (P1 — MVP)\n- [ ] 1. [US1] Implement the login handler (EC-1, NFR-1)\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/limiter.js_\n  - _Verify: " + PASS + "_\n" +
    "- [ ] 2. [US1] Show the error message\n  - _Requirements: US-1.AC-2_\n  - _Verify: " + PASS + "_\n**Checkpoint:** US-1 works.\n");
  wGa(g3p, "src/limiter.js", "module.exports = 1;\n");
  Sga.approvePhase(g3p, f3.slug, null, "u", { through: "tasks" });
  rga(g3p, ["done", f3.slug, "1", "--run"]);
  rga(g3p, ["done", f3.slug, "2", "--run"]);
  const g3a = rga(g3p, ["finish", f3.slug, "--run", "--write"]);
  const fin3At = (stGa(f3).finished || {}).at;
  wGa(g3p, "src/limiter.js", "module.exports = 2; // changed after the checks ran\n");
  const g3b = rga(g3p, ["finish", f3.slug, "--write"]);
  const fin3Same = (stGa(f3).finished || {}).at === fin3At;
  const na3 = jsonGa(rga(g3p, ["next-action", f3.slug, "--json"]).stdout); // drift → "harmless → re-finish" names the check run it needs
  const g3c = rga(g3p, ["finish", f3.slug, "--run", "--write"]);
  ok(g3a.code === 0 && /is ready to finish/.test(g3a.out) && !!fin3At && g3b.code === 1 && /test \(the implementing files changed since the run\)/.test(g3b.out) && !/Replaced the baseline/.test(g3b.out) && fin3Same &&
    na3 && na3.step === "drift" && /node "[^"]*dev-spec\.js" finish limiter --run runs and records them/.test(na3.recommendation) &&
    g3c.code === 0 && /Replaced the baseline/.test(g3c.out),
    "full review Ga3: finish --write after the implementing file changed is refused on the old check run (code-changed, baseline kept); next-action's drift step names finish --run; finish --run --write runs the checks again and re-baselines (got " +
    JSON.stringify([g3a.code, g3a.out.slice(0, 160), g3b.code, g3b.out.slice(0, 300), g3c.code]).slice(0, 700) + ")");

  // Ga6: append-tasks --makes-green / --expect-fail / --size (= spec_append_tasks {makesGreen, expectFail, size}).
  const g6p = path.join(tmp, "frga-append");
  Sga.initProject(g6p, ["tdd"], "en");
  const f6 = Sga.createFeature(g6p, "Conv", ["tdd"], "", undefined, "en");
  const before6 = tasksGa(f6);
  const a6bad = rga(g6p, ["append-tasks", f6.slug, "--task", "x", "--size", "huge"]);
  const a6ph = rga(g6p, ["append-tasks", f6.slug, "--task", "x", "--makes-green", "T-42"]);
  const a6bool = rga(g6p, ["append-tasks", f6.slug, "--task", "x", "--expect-fail=maybe"]);
  const a6two = rga(g6p, ["append-tasks", f6.slug, "--task", "x", "--size", "S", "--size", "M"]);
  const same6 = tasksGa(f6) === before6;
  const a6 = rga(g6p, ["append-tasks", f6.slug, "--task", "Write the regression test", "--req", "US-1.AC-1", "--makes-green", "T-1", "--makes-green", "T-02", "--expect-fail", "--size", "m", "--verify", "npm test", "--json"]);
  const a6j = jsonGa(a6.stdout);
  ok(a6bad.code === 1 && /size must be one of XS, S, M, L, XL \(got 'huge'\)/.test(a6bad.out) && a6ph.code === 1 && /Unknown tests \(not planned in test-plan\.md\): T-42/.test(a6ph.out) &&
    a6bool.code === 1 && /--expect-fail/.test(a6bool.out) && a6two.code === 1 && /--size once per call/.test(a6two.out) && same6 &&
    a6.code === 0 && a6j && a6j.appended[0].expectFail === true && a6j.appended[0].size === "M" && JSON.stringify(a6j.appended[0].makesGreen) === '["T-01","T-02"]' &&
    /  - _Makes green: T-01, T-02_\n  - _Verify: npm test_\n  - _Expect: fail_\n  - _Size: M_\n/.test(tasksGa(f6)),
    "full review Ga6: append-tasks --makes-green (repeatable, as the plan spells the T-IDs) / --expect-fail / --size write the markers; a bad size, an unplanned T-ID, a non-boolean --expect-fail or a second --size writes nothing (got " +
    JSON.stringify([a6bad.out.slice(0, 120), a6ph.out.slice(0, 120), a6.out.slice(0, 200)]).slice(0, 500) + ")");

  // Ga9 (Windows): --shell bash is Git Bash, never WSL's launcher. An explicit System32 bash.exe is the user's choice (1.15): it
  // runs inside WSL — with no working distribution the relay fails and that is could-not-run (`wsl`), nothing recorded.
  if (process.platform === "win32") {
    const f9 = Sga.createFeature(gp, "Wsl", ["core"], "", undefined, "en");
    wGa(f9.dir, "tasks.md", "- [ ] 1. [US1] Must pass\n  - _Verify: exit 0_\n"); // a builtin: no node needed inside a WSL distribution
    const sysBash = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "bash.exe");
    const g9 = rga(gp, ["done", f9.slug, "1", "--run", "--shell", sysBash, "--json"]);
    const g9j = jsonGa(g9.stdout);
    const g9x = jsonGa(rga(gp, ["done", f9.slug, "1", "--run", "--shell", path.join(path.dirname(sysBash), "wsl.exe"), "--json"]).stdout);
    const g9none = !(stGa(f9).evidence || {})["1"] || !!(g9j && g9j.ok); // before the Git Bash run below records its pass
    ok(g9x && g9x.ok === false && g9x.couldNotRun === "wsl-exe" && /wsl\.exe/.test(g9x.error),
      "full review Ga9 (Windows): --shell <System32 wsl.exe> is no shell (it rejects -c) — refused before anything runs, nothing recorded (got " + JSON.stringify(g9x) + ")");
    const gitExec = spawnSync("git", ["--exec-path"], { encoding: "utf8" });
    const gitBash = Sga.resolveRunShell("bash", { gitExecPath: gitExec.status === 0 ? gitExec.stdout : null });
    const g9b = gitBash.shell ? rga(gp, ["done", f9.slug, "1", "--run", "--shell", "bash", "--json"]) : null;
    const g9bj = g9b && jsonGa(g9b.stdout);
    // Either WSL ran it (a working distribution: a real pass is recorded) or its relay failed (could-not-run `wsl` / the shell
    // didn't start: nothing recorded) — never a bogus failed run or red proof.
    const wslRan = g9.code === 0 && g9j && g9j.ok === true;
    const wslNot = g9.code === 1 && g9j && ["wsl", "shell-not-started"].includes(g9j.couldNotRun) && g9none;
    ok((wslRan || wslNot) && (!g9b || (g9b.code === 0 && g9bj && g9bj.verified === true)),
      "full review Ga9 (Windows): --shell <System32 bash.exe> is used as given — it runs under WSL or, when WSL can't run it, is could-not-run with nothing recorded; --shell bash runs under Git Bash when installed (got " +
      JSON.stringify([g9.code, g9j, gitBash, g9b && g9b.out.slice(0, 200)]).slice(0, 600) + ")");
  } else ok(true, "full review Ga9: --shell <System32 bash.exe> refusal — Windows only (resolveRunShell is unit-tested in mcp/test.js)");

  // Ga10: --timeout, output over the buffer and a cmd.exe failure under --shell cmd are could-not-run too — nothing recorded.
  const f10 = Sga.createFeature(gp, "Limits", ["core"], "", undefined, "en");
  wGa(f10.dir, "tasks.md", "- [ ] 1. [US1] Slow\n  - _Verify: node -e \"setTimeout(function () {}, 2500)\"_\n" +
    "- [ ] 2. [US1] Loud\n  - _Verify: node -e \"process.stdout.write(Buffer.alloc(70 * 1024 * 1024, 120).toString())\"_\n  - _Expect: fail_\n" +
    "- [ ] 3. [US1] Write T-03 red\n  - _Verify: cd no-such-dir-dsd_\n  - _Expect: fail_\n");
  const g10t = rga(gp, ["done", f10.slug, "1", "--run", "--timeout", "1", "--json"]);
  const g10tj = jsonGa(g10t.stdout);
  const g10z = rga(gp, ["done", f10.slug, "1", "--run", "--timeout", "0"]);
  const g10b = rga(gp, ["done", f10.slug, "2", "--run", "--json"]);
  const g10bj = jsonGa(g10b.stdout);
  let g10cmdOk = true, g10c = null;
  if (process.platform === "win32") {
    g10c = jsonGa(rga(gp, ["done", f10.slug, "3", "--run", "--shell", "cmd", "--json"]).stdout);
    g10cmdOk = !!g10c && g10c.ok === false && g10c.couldNotRun === "cmd" && /cmd\.exe\) could not run `cd no-such-dir-dsd`/.test(g10c.error);
  }
  const gpb = path.join(tmp, "frga-checks-big");
  Sga.initProject(gpb, ["core"], "en", { checks: { big: "node -e \"process.stdout.write(Buffer.alloc(70 * 1024 * 1024, 120).toString())\"" } });
  const fb = Sga.createFeature(gpb, "Big", ["core"], "", undefined, "en");
  wGa(fb.dir, "tasks.md", "- [x] 1. [US1] Done\n");
  const g10f = jsonGa(rga(gpb, ["finish", fb.slug, "--run", "--json"]).stdout);
  ok(g10tj && g10tj.couldNotRun === "timeout" && /did not finish within --timeout 1 s/.test(g10tj.error) && g10z.code === 1 && /--timeout must be an integer ≥ 1/.test(g10z.out) && !/^\$ /m.test(g10z.out) &&
    g10bj && g10bj.couldNotRun === "output-too-large" && /its output exceeded 64 MB/.test(g10bj.error) && g10cmdOk && !stGa(f10).evidence && /- \[ \] 1\.[\s\S]*- \[ \] 2\.[\s\S]*- \[ \] 3\./.test(tasksGa(f10)) &&
    g10f && g10f.couldNotRun === "output-too-large" && g10f.check === "big" && !stGa(fb).finishChecks,
    "full review Ga10: --timeout, output over 64 MB (done --run and finish --run) and a cmd.exe failure under --shell cmd on an _Expect: fail_ task are could-not-run — refused, nothing recorded; --timeout 0 is refused before anything runs (got " +
    JSON.stringify([g10tj, g10z.out.slice(0, 120), g10bj && g10bj.couldNotRun, g10c, g10f && g10f.couldNotRun]).slice(0, 600) + ")");

  // 1.21.1 languages: finish --run --shell pwsh runs the project checks as PowerShell (the same b5Exec as done --run): a
  // passing and a failing check, both recorded with their exit codes. Skipped where pwsh isn't installed (the Linux containers).
  let hasPwsh = false;
  try { hasPwsh = spawnSync("pwsh", ["-NoProfile", "-NonInteractive", "-Command", "exit 0"], { encoding: "utf8", windowsHide: true, timeout: 60000 }).status === 0; } catch { /* no pwsh */ }
  if (hasPwsh) {
    const gps = path.join(tmp, "l121-finish-pwsh");
    Sga.initProject(gps, ["core"], "en", { checks: { unit: "$failed = 0; Write-Output \"failed: $failed\"; exit $failed", lint: "exit 4" } });
    const fps = Sga.createFeature(gps, "Pwsh checks", ["core"], "", undefined, "en");
    wGa(fps.dir, "tasks.md", "- [x] 1. [US1] Done\n");
    const fin = jsonGa(rga(gps, ["finish", fps.slug, "--run", "--shell", "pwsh", "--json"]).stdout);
    const fc = stGa(fps).finishChecks || {};
    ok(fin && fc.unit && fc.unit.exitCode === 0 && /failed: 0/.test(fc.unit.summary || "") && fc.unit.observed === "cli" && fc.lint && fc.lint.exitCode === 4,
      "1.21.1 languages: finish --run --shell pwsh runs each project check under PowerShell 7 and records it — `$failed = 0; … exit $failed` → exit 0, `exit 4` → exit 4 (got " +
      JSON.stringify([fc.unit, fc.lint && fc.lint.exitCode]).slice(0, 400) + ")");
  } else ok(true, "1.21.1 languages: finish --run --shell pwsh — skipped: pwsh is not installed here");

  // 1.22 review (finding 11) — `done --run` / `finish --run` stamped `at`, the verify stamp and the code stamp AFTER the run: an edit
  // made while a long run went on read as tested. Now they are taken before it runs.
  {
    // finish --run: a check that edits an implementing file WHILE it runs → code-changed (it read pass)
    const p11 = path.join(tmp, "l122-runstart");
    Sga.initProject(p11, ["core"], "en", { checks: { test: "node -e \"require('fs').appendFileSync('src/a.js', '// edited during the run')\"" } });
    const f11 = Sga.createFeature(p11, "Stamps", ["core"], "", undefined, "en");
    wGa(p11, "src/a.js", "module.exports = 1;\n");
    wGa(f11.dir, "tasks.md", "- [x] 1. [US1] A\n  - _Implements: src/a.js_\n");
    const fin = jsonGa(rga(p11, ["finish", f11.slug, "--run", "--json"]).stdout);
    const chk = fin && (fin.suiteChecks || []).find((c) => c.name === "test");
    // done --run: the run's `at` is when it STARTED (a 1.5 s run)
    wGa(f11.dir, "tasks.md", "- [x] 1. [US1] A\n  - _Implements: src/a.js_\n- [ ] 2. [US1] Slow\n  - _Verify: node -e \"setTimeout(() => {}, 1500)\"_\n" +
      "- [ ] 3. [US1] Edits its own _Verify:_\n  - _Verify: node edit.js_\n");
    const t0 = Date.now();
    const d2 = rga(p11, ["done", f11.slug, "2", "--run"]);
    const t1 = Date.now();
    const ev2 = (stGa(f11).evidence || {})["2"];
    const at2 = Date.parse(ev2 ? ev2.at : "");
    // done --run: a _Verify:_ edited while it ran → the record is for the command that ran (stale-evidence), never verified
    wGa(p11, "edit.js", "const fs = require('fs'); const p = '.specs/" + f11.slug + "/tasks.md'; fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('node edit.js', 'node edit2.js'));\n");
    const d3 = jsonGa(rga(p11, ["done", f11.slug, "3", "--run", "--json"]).stdout);
    ok(chk && chk.status === "code-changed" && d2.code === 0 && Number.isFinite(at2) && at2 - t0 < (t1 - t0) - 1000 &&
      d3 && d3.ok && d3.verified === false && d3.unverifiedReason === "stale-evidence",
      "1.22 review: finish --run stamps the code BEFORE the checks run (a check editing an implementing file reads code-changed); done --run's run `at` is its start and its verify stamp the _Verify:_ it ran (edited meanwhile → stale-evidence) (got " +
      JSON.stringify([chk, d2.code, at2 - t0, t1 - t0, d3 && [d3.verified, d3.unverifiedReason]]).slice(0, 600) + ")");
  }
};
