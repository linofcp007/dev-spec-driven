"use strict";
// Evidence on the CLI — project checks, CLI runs, the shell done --run / finish --run use.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

// 1.14 full review (Ga) — evidence, project checks, CLI runs.
exports.run = ({ ok, all, spawnIn, tmp, CLI, require, __dirname }) => {
  const Sga = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const jsonGa = (s) => { try { return JSON.parse(s); } catch { return null; } };
  const rga = (proj, args, env) => { // in-process (1.27), but a --run — it waits for its commands: spawned
    const a = [...args, "--project", proj], o = { encoding: "utf8", env: { ...process.env, ...(env || {}) } };
    const r = args.includes("--run") ? spawnSync(process.execPath, [CLI, ...a], o) : spawnIn(a, o);
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
  all("full review Ga6: append-tasks --makes-green (repeatable, as the plan spells the T-IDs) / --expect-fail / --size write the markers; a bad size, an unplanned T-ID, a non-boolean --expect-fail or a second --size writes nothing (got " +
    JSON.stringify([a6bad.out.slice(0, 120), a6ph.out.slice(0, 120), a6.out.slice(0, 200)]).slice(0, 500) + ")", [
    () => a6bad.code === 1, () => /size must be one of XS, S, M, L, XL \(got 'huge'\)/.test(a6bad.out), () => a6ph.code === 1,
    () => /Unknown tests \(not planned in test-plan\.md\): T-42/.test(a6ph.out), () => a6bool.code === 1, () => /--expect-fail/.test(a6bool.out),
    () => a6two.code === 1, () => /--size once per call/.test(a6two.out), () => same6, () => a6.code === 0, () => a6j,
    () => a6j.appended[0].expectFail === true, () => a6j.appended[0].size === "M",
    () => JSON.stringify(a6j.appended[0].makesGreen) === '["T-01","T-02"]',
    () => /  - _Makes green: T-01, T-02_\n  - _Verify: npm test_\n  - _Expect: fail_\n  - _Size: M_\n/.test(tasksGa(f6)),
  ]);

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
};
