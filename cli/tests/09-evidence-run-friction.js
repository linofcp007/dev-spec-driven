"use strict";
// The friction budget (1.41) on the CLI — done --run / finish --run time each run of a project check (spawn → exit, never the drain) into the git-ignored timings.jsonl, never an observed line of their own; metrics prints the verdict.

const fs = require("fs");
const path = require("path");

exports.run = async ({ all, runIn, runAsync, spawnAsync, tmp, require, __dirname }) => {
  const SD = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const RUN = require(path.join(__dirname, "run.js"));
  const js = JSON.stringify;
  const jsonOf = (r) => { try { return JSON.parse(r.stdout !== undefined ? r.stdout : r.out); } catch { return null; } };
  const F = SD.msg("en").friction;
  const PASS = 'node -e "process.exit(0)"';
  const timings = (p) => { try { return fs.readFileSync(path.join(p, ".specs", ".execution", "timings.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };
  const observed = (p) => path.join(p, ".specs", ".execution", "observed.jsonl");
  const sleeper = (p) => fs.writeFileSync(path.join(p, "sleep.js"), "setTimeout(() => {}, Number(process.argv[2]));\n");
  const task = (n, title, lines) => `- [ ] ${n}. [US1] ${title}\n` + lines.map((l) => "  - " + l + "\n").join("");

  { // done --run: the fast check's pre-run timed (by cli, its own ms — ≥ its 1.5 s sleep); a _Verify:_ that is another check timed on its own
    // (never with the pre-run: shorter than it); a _Verify:_ that IS the fast command timed ONCE; a _Verify:_ that is no check never; no `took` line printed.
    // finish --run: one line per check, never an observed line (an MCP-only project's fast check keeps reading unknown); metrics' verdict
    const p = path.join(tmp, "fr-done");
    fs.mkdirSync(path.join(p, "src"), { recursive: true });
    sleeper(p);
    fs.writeFileSync(path.join(p, "quick.js"), "console.log('ok');\n");
    ["a", "b"].forEach((x) => fs.writeFileSync(path.join(p, "src", x + ".js"), "// " + x + "\n"));
    SD.initProject(p, ["core"], "en", { checks: { fast: "node sleep.js 1500", quick: "node quick.js" }, fastCheck: "fast" });
    const f = SD.createFeature(p, { name: "Login", tracks: ["core"] });
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n" + task(1, "Code A", ["_Implements: src/a.js_", "_Verify: node quick.js_"]) +
      task(2, "Code B", ["_Implements: src/b.js_", "_Verify: node sleep.js 1500_"]) + task(3, "Docs", ["_Verify: " + PASS + "_"]));
    const done = async (n) => runAsync(["done", f.slug, String(n), "--run", "--project", p]);
    // (1.42 perf-14: the in-process call on the records' own clock — runAsync runs the CLI in this process, so `ms` and wall1 are
    // the same monotonic clock: a record never exceeds the call holding it, and the pre-run and the _Verify:_ run one after the
    // other inside it, so their two times fit in it — containment, never a race. It was `ms < 7500` and `verify < preRun`: both
    // compared two runs' own durations, and the pre-push's parallel run failed them. What it hides: a _Verify:_ timed from the
    // pre-run's start escapes only while the call spends more than the pre-run's ms (≥ 1.5 s) outside the two runs — the CLI's
    // own engine work, 19 ms in the pre-push log)
    const w0 = process.hrtime.bigint();
    const d1 = await done(1);
    const wall1 = Number((process.hrtime.bigint() - w0) / 1000000n);
    const t1 = timings(p);
    const d2 = await done(2);
    const t2 = timings(p);
    const d3 = await done(3);
    const t3 = timings(p);
    fs.writeFileSync(path.join(p, ".specs", "steering", "tech.md"), "# Tech\n\n- _Budget: fast 1s_\n");
    const fin = await runAsync(["finish", f.slug, "--run", "--project", p]);
    const t4 = timings(p);
    const mj = jsonOf(runIn(["metrics", "--json", "--project", p]));
    const mh = runIn(["metrics", "--project", p]);
    const ev = JSON.parse(fs.readFileSync(path.join(f.dir, ".state.json"), "utf8"));
    const keys = (o) => Object.keys(o || {}).sort();
    all("1.41 friction: done --run times the fast check's pre-run (≥ 1.5 s) and, apart, a _Verify:_ that is another check (shorter: never with the pre-run); a _Verify:_ that IS the fast command once; one that is no check never; finish --run one line per check; no `took` line; the records carry no ms; metrics judges the fast check over its 1 s budget (got " +
      js({ t1, wall1, t2: t2.slice(t1.length), t3: t3.length, t4: t4.slice(t3.length), out: [d1.out, d2.out, fin.out.slice(0, 200)], friction: mj && mj.friction }) + ")", {
      ran: () => [d1, d2, d3].every((r) => r.code === 0) && fin.out.includes("Recorded 2 project check run(s)"), // (finish: not ready — exit 1; its checks recorded)
      preRun: () => t1.length === 2 && t1[0].check === "fast" && t1[0].by === "cli" && t1[0].ms >= 1500 && t1[0].ms <= wall1,
      verify: () => t1[1].check === "quick" && t1[1].exitCode === 0 && t1[0].ms + t1[1].ms <= wall1, // (with the pre-run in it: twice the pre-run)
      once: () => t2.length === 3 && t2[2].check === "fast" && t2[2].ms >= 1500,
      noCheck: () => t3.length === 3,
      finish: () => js(t4.slice(3).map((l) => [l.check, l.by])) === js([["fast", "cli"], ["quick", "cli"]]),
      noTook: () => ![d1, d2, d3, fin].some((r) => /\btook\b/.test(r.out)),
      noMs: () => Object.values(ev.evidence || {}).every((e) => !("ms" in e)) && Object.values(ev.finishChecks || {}).every((c) => !("ms" in c)),
      metrics: () => mj && mj.friction && js(mj.friction.checks.map((c) => [c.check, c.status, c.runs])) === js([["fast", "over", 3], ["quick", "unbudgeted", 2]]) &&
        mh.out.includes("  friction (steering/tech.md _Budget:_): ▲ fast ") && keys(mj.friction.checks[0]).join() === "budgetMs,check,maxMs,medianMs,minMs,runs,status",
    });
  }

  { // finish --run on a project no hook logs (MCP-only): its timings line, and still no observed.jsonl — the fast check reads `unknown`, never
    // `missing`; a check that could not run (--timeout) is never timed
    const p = path.join(tmp, "fr-finish");
    fs.mkdirSync(p, { recursive: true });
    sleeper(p);
    fs.writeFileSync(path.join(p, "quick.js"), "console.log('ok');\n");
    SD.initProject(p, ["core"], "en", { checks: { quick: "node quick.js" } });
    const f = SD.createFeature(p, { name: "Login", tracks: ["core"] });
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [x] 1. [US1] A\n");
    const fin = await runAsync(["finish", f.slug, "--run", "--project", p]);
    const t = timings(p);
    const noLog = !fs.existsSync(observed(p));
    const ignored = fs.readFileSync(path.join(p, ".specs", ".execution", ".gitignore"), "utf8");
    SD.initProject(p, [], null, { checks: { slow: "node sleep.js 20000" } });
    const to = await runAsync(["finish", f.slug, "--run", "--timeout", "1", "--project", p]);
    all("1.41 friction: finish --run on an unlogged project writes its timings line (the folder ignoring itself first) and no observed.jsonl; a check refused at --timeout is never timed (got " +
      js({ code: fin.code, t, noLog, ignored, to: [to.code, timings(p).length] }) + ")", {
      line: () => t.length === 1 && t[0].check === "quick" && t[0].checkCmd === "node quick.js" && t[0].by === "cli" && Number.isInteger(t[0].ms),
      noObserved: () => noLog && ignored === "*\n",
      timeout: () => to.code !== 0 && timings(p).length === 2 && timings(p)[1].check === "quick",
    });
  }

  { // the measure stops at the command's EXIT — never the pipes' drain (a background process holding them: the run settles RUN_DRAIN_MS later)
    const p = path.join(tmp, "fr-drain");
    fs.mkdirSync(p, { recursive: true });
    fs.writeFileSync(path.join(p, "bg.js"), "setTimeout(() => {}, 4000);\n");
    fs.writeFileSync(path.join(p, "spawner.js"), "const path = require('path');\nrequire('child_process').spawn(process.execPath, [path.join(__dirname, 'bg.js')], { stdio: 'inherit', detached: true }).unref();\nconsole.log('server started');\n");
    SD.initProject(p, ["core"], "en", { checks: { serve: "node spawner.js" } });
    const f = SD.createFeature(p, { name: "Serve", tracks: ["core"] });
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [x] 1. [US1] A\n");
    const t0 = Date.now();
    const fin = await spawnAsync(["finish", f.slug, "--run", "--project", p]);
    const wall = Date.now() - t0;
    const t = timings(p);
    all("1.41 friction: a check whose background process holds the output is timed to its EXIT — at least the drain (" + RUN.RUN_DRAIN_MS + " ms) under the call's own time (got " +
      js({ wall, t, out: (fin.stdout || "").slice(0, 200) }) + ")", {
      held: () => /kept its output open/.test((fin.stdout || "") + (fin.stderr || "")),
      exit: () => t.length === 1 && t[0].check === "serve" && t[0].ms + RUN.RUN_DRAIN_MS * 0.75 <= wall,
    });
  }
};
