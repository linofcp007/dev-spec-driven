"use strict";
// Evidence on the CLI — finish --run under pwsh, the stamps taken before a run, a background process holding the pipes (split from 09-evidence-checks, 1.27).

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

  // 1.24 r6 B3: done --run / finish --run settle on the command's EXIT — a check that starts a background process (a dev server,
  // a watcher) holding the output pipes made the CLI wait for THAT process, and --timeout refused a run that had exited 0. After
  // the exit: a short drain (until the pipes close, ≈2 s at most), then the pipes are dropped, the exit status recorded and a
  // note says a background process kept the output open; --timeout's timer stops at the exit.
  {
    const pb = path.join(tmp, "r6b3-bg");
    Sga.initProject(pb, ["core"], "en", { checks: { serve: "node spawner-r6.js finish" } });
    wGa(pb, "bg-r6.js", "require('fs').writeFileSync(process.argv[2], String(process.pid));\nsetTimeout(() => {}, 25000);\n");
    wGa(pb, "spawner-r6.js", "const path = require('path');\nrequire('child_process').spawn(process.execPath, [path.join(__dirname, 'bg-r6.js'), path.join(__dirname, 'bg-' + process.argv[2] + '.pid')], " +
      "{ stdio: 'inherit', detached: true }).unref();\nconsole.log('server started');\n");
    const fb3 = Sga.createFeature(pb, "Serve", ["core"], "", undefined, "en");
    wGa(fb3.dir, "tasks.md", "- [ ] 1. [US1] Starts the server\n  - _Verify: node spawner-r6.js done_\n");
    const t0 = Date.now();
    const d = rga(pb, ["done", fb3.slug, "1", "--run", "--timeout", "15"]);
    const tookDone = Date.now() - t0;
    const t1 = Date.now();
    const f = rga(pb, ["finish", fb3.slug, "--run", "--json"]);
    const tookFin = Date.now() - t1;
    const fj = jsonGa(f.stdout);
    const ev = (stGa(fb3).evidence || {})["1"];
    const fc3 = (stGa(fb3).finishChecks || {}).serve;
    for (const k of ["done", "finish"]) { try { process.kill(Number(fs.readFileSync(path.join(pb, "bg-" + k + ".pid"), "utf8"))); } catch { /* gone */ } }
    ok(d.code === 0 && /Task 1 done \(verified\)/.test(d.out) && /server started/.test(d.out) && /a process it started .*kept its output open/.test(d.out) && ev && ev.exitCode === 0 &&
      tookDone < 12000 && fj && fc3 && fc3.exitCode === 0 && /kept its output open/.test(f.out) && tookFin < 12000,
      "1.24 r6 B3: done --run / finish --run on a check that leaves a background process holding the output settle at the command's exit (≈2 s drain, a note), record exit 0 and never wait for that process or hit --timeout (got " +
      JSON.stringify([d.code, d.out.slice(0, 300), tookDone, ev && ev.exitCode, f.code, fc3, tookFin]).slice(0, 700) + ")");
  }
};
