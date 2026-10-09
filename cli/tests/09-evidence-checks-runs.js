"use strict";
// Evidence on the CLI — runs at their limits: --timeout, the output cap, a refused --timeout, the process tree killed (split from 09-evidence-checks, 1.27).

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
  all("full review Ga10: --timeout, output over 64 MB (done --run and finish --run) and a cmd.exe failure under --shell cmd on an _Expect: fail_ task are could-not-run — refused, nothing recorded; --timeout 0 is refused before anything runs (got " +
    JSON.stringify([g10tj, g10z.out.slice(0, 120), g10bj && g10bj.couldNotRun, g10c, g10f && g10f.couldNotRun]).slice(0, 600) + ")", [
    () => g10tj, () => g10tj.couldNotRun === "timeout", () => /did not finish within --timeout 1 s/.test(g10tj.error), () => g10z.code === 1,
    () => /--timeout must be an integer ≥ 1/.test(g10z.out), () => !/^\$ /m.test(g10z.out), () => g10bj,
    () => g10bj.couldNotRun === "output-too-large", () => /its output exceeded 64 MB/.test(g10bj.error), () => g10cmdOk, () => !stGa(f10).evidence,
    () => /- \[ \] 1\.[\s\S]*- \[ \] 2\.[\s\S]*- \[ \] 3\./.test(tasksGa(f10)), () => g10f, () => g10f.couldNotRun === "output-too-large",
    () => g10f.check === "big", () => !stGa(fb).finishChecks,
  ]);

  // 1.24 r6 B6: --timeout past Node's timer limit (2147483 s) became a TimeoutOverflowWarning and a timeout after 1 ms — the run
  // was refused as could-not-run; it is a usage error now, before anything runs (done and finish).
  {
    const big = rga(gp, ["done", f10.slug, "1", "--run", "--timeout", "9999999"]);
    const edge = jsonGa(rga(gp, ["done", f10.slug, "1", "--run", "--timeout", "2147484", "--json"]).stdout);
    const fin = rga(gpb, ["finish", fb.slug, "--run", "--timeout", "3000000000"]);
    ok(big.code === 1 && /--timeout must be an integer ≥ 1, at most 2147483 \(got "9999999"\)/.test(big.out) && !/^\$ /m.test(big.out) && !/TimeoutOverflowWarning/.test(big.out) &&
      edge && edge.ok === false && /at most 2147483 \(got "2147484"\)/.test(edge.error) && fin.code === 1 && /at most 2147483/.test(fin.out) && !/^\$ /m.test(fin.out),
      "1.24 r6 B6: --timeout above 2147483 s (Node's timer limit) is refused before anything runs — done and finish, --json too (got " +
      JSON.stringify([big.code, big.out.slice(0, 160), edge, fin.out.slice(0, 120)]) + ")");
  }

  // 1.23 review (M13): --timeout kills the whole process TREE (taskkill /T on Windows, the process group elsewhere), never the
  // shell alone — a check that starts a worker of its own left it running, holding the output pipe (the CLI waited for it too).
  const f13 = Sga.createFeature(gp, "Tree", ["core"], "", undefined, "en");
  wGa(gp, "grandchild-123.js", "require('fs').writeFileSync(process.argv[2], String(process.pid));\nsetTimeout(() => {}, 60000);\n");
  wGa(gp, "spawner-123.js", "const path = require('path');\nrequire('child_process').spawn(process.execPath, [path.join(__dirname, 'grandchild-123.js'), " +
    "path.join(__dirname, 'grandchild-123.pid')], { stdio: 'inherit' });\nsetTimeout(() => {}, 60000);\n");
  wGa(f13.dir, "tasks.md", "- [ ] 1. [US1] Spawns a worker\n  - _Verify: node spawner-123.js_\n");
  const t13 = Date.now();
  const g13 = jsonGa(rga(gp, ["done", f13.slug, "1", "--run", "--timeout", "4", "--json"]).stdout);
  const took13 = Date.now() - t13;
  let pid13 = 0;
  try { pid13 = Number(fs.readFileSync(path.join(gp, "grandchild-123.pid"), "utf8")); } catch { /* the worker never started */ }
  const alive13 = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === "EPERM"; } };
  let dead13 = pid13 > 0 && !alive13(pid13);
  for (let i = 0; i < 50 && pid13 > 0 && !dead13; i++) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100); dead13 = !alive13(pid13); }
  if (pid13 > 0 && !dead13) { try { process.kill(pid13); } catch { /* gone */ } }
  ok(g13 && g13.ok === false && g13.couldNotRun === "timeout" && took13 < 40000 && pid13 > 0 && dead13 && !(stGa(f13).evidence || {})["1"],
    "1.23 review: done --run --timeout kills the check's whole process tree (its worker too) and returns — could-not-run, nothing recorded (got " +
    JSON.stringify([g13 && g13.couldNotRun, took13, pid13, dead13]) + ")");
};
