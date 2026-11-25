"use strict";
// Evidence on the CLI — METRIC lines (1.41): done --run and finish --run read their real children's whole output (a line printed first, then noise; node's TAP reporter; several commands), store and print the readings; finish --run compares them with the last other finish and says what got worse; a manual note yields none.

const fs = require("fs");
const path = require("path");

exports.run = async ({ all, spawnIn, spawnAsync, tmp, require, __dirname }) => {
  const S = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const i18n = require(path.join(__dirname, "..", "mcp", "lib", "i18n.js"));
  const MT = i18n.msg("en").metric;
  const json = (s) => { try { return JSON.parse(s); } catch { return null; } };
  const run = async (proj, args) => { const r = await spawnAsync([...args, "--project", proj], { env: { ...process.env } }); return { out: (r.stdout || "") + (r.stderr || ""), stdout: r.stdout || "", code: r.status }; };
  const state = (dir) => JSON.parse(fs.readFileSync(path.join(dir, ".state.json"), "utf8"));
  const w = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  const p = path.join(tmp, "metric-runs");
  S.initProject(p, ["core"], "en", { checks: { size: "node scripts/size.js", tap: "node --test --test-reporter=tap tests/tap.test.js" } });
  // the checks' real outputs: a size script (a METRIC line, a malformed one, then noise) and node --test's TAP (a nested subtest's console.log)
  const size = (v) => w(p, "scripts/size.js", "console.log(\"METRIC bundle-size=" + v + " kB better=lower tolerance=2%\");\nconsole.log(\"METRIC broken=1,5\");\n" +
    "for (let i = 0; i < 50; i++) console.log(\"building chunk \" + i);\n");
  size("120");
  w(p, "tests/tap.test.js", "const test = require(\"node:test\");\ntest(\"outer\", async (t) => { await t.test(\"inner\", () => { console.log(\"METRIC parse.ms=3 ms\"); }); });\n");
  w(p, "scripts/first.js", "console.log(\"METRIC queries_per_request=7 better=lower tolerance=0\");\nconsole.log(\"METRIC first_only=1\");\n" +
    "for (let i = 0; i < 50; i++) console.log(\"ok \" + i + \" - noise\");\n");
  w(p, "scripts/many.js", "for (let i = 0; i < 21; i++) console.log(\"METRIC m\" + i + \"=\" + i);\n"); // 21 names: one past the bound
  w(p, "scripts/second.js", "console.log(\"METRIC queries_per_request=6 better=lower tolerance=0\");\nconsole.log(\"METRIC heap_mb=48.25 MB\");\n");
  const change = (name) => {
    const c = S.createFeature(p, name, undefined, "x", undefined, "en", "change");
    fs.writeFileSync(path.join(c.dir, "change.md"), "# Change: " + name + "\n\n## Summary\nThe change " + name + ".\n\n## Acceptance Criteria (EARS)\n" +
      "1. **US-1.AC-1** — WHEN any page renders THE SYSTEM SHALL show the footer.\n\n## Approach\nOne string.\n\n## Tasks\n- [ ] 1. [US1] Measure it\n" +
      "  - _Requirements: US-1.AC-1_\n  - _Verify: node scripts/first.js_\n  - _Verify: node scripts/second.js_\n- [ ] 2. [US1] Note it\n  - _Requirements: US-1.AC-1_\n" +
      "- [ ] 3. [US1] Count them\n  - _Requirements: US-1.AC-1_\n  - _Verify: node scripts/many.js_\n");
    S.approvePhase(p, c.slug, null, "t", { through: "tasks" });
    return c;
  };

  // done --run: both commands' whole outputs read (the line printed first survives 50 noise lines; the later command wins), stored on
  // the run and printed; a manual --evidence note holding a METRIC line yields none
  const a = change("Alpha");
  const tick = await run(p, ["done", a.slug, "1", "--run"]);
  const tickJ = json((await run(p, ["done", a.slug, "1", "--run", "--json"])).stdout);
  const note = json((await run(p, ["done", a.slug, "2", "--evidence", "METRIC manual=1", "--json"])).stdout);
  const many = await run(p, ["done", a.slug, "3", "--run"]);
  const st = state(a.dir);
  all("1.41 done --run reads every passing command's WHOLE output: the line printed before 50 noise lines, the first command's own name, the second command's reading of a shared name winning; the readings go on the run (never its history), into --json and as METRIC lines in the human output, a reader bound said; a --evidence note holding a METRIC line yields none (got " +
    JSON.stringify({ tick: tick.out.slice(0, 400), tickJ: tickJ && tickJ.metrics, rec: st.evidence["1"].metrics, note: note && note.metrics, rec2: st.evidence["2"], many: many.out.slice(-300) }) + ")", {
    human: tick.code === 0 && tick.out.includes("  METRIC first_only=1\n") && tick.out.includes("  METRIC queries_per_request=6 better=lower tolerance=0\n") && tick.out.includes("  METRIC heap_mb=48.25 MB\n"),
    json: !!tickJ && JSON.stringify(tickJ.metrics) === JSON.stringify([{ name: "first_only", value: 1, unit: null, better: null, tolerance: null },
      { name: "queries_per_request", value: 6, unit: null, better: "lower", tolerance: { amount: 0, percent: false } }, { name: "heap_mb", value: 48.25, unit: "MB", better: null, tolerance: null }]),
    stored: JSON.stringify(st.evidence["1"].metrics) === JSON.stringify([{ name: "first_only", value: 1 }, { name: "queries_per_request", value: 6, better: "lower", tolerance: { amount: 0, percent: false } },
      { name: "heap_mb", value: 48.25, unit: "MB" }]) && st.evidence["1"].history.every((h) => h.metrics === undefined),
    manual: !!note && note.ok && note.metrics === undefined && st.evidence["2"].metrics === undefined,
    bound: many.code === 0 && many.out.includes("  ⚠ " + MT.dropped("names") + "\n") && st.evidence["3"].metrics.length === 20,
  });

  // finish --run: each check's whole output (TAP's "# METRIC" too) read; the malformed line said per check; a first finish measures
  const f1 = await run(p, ["finish", a.slug, "--run", "--write"]);
  const fin1 = state(a.dir).finished;
  // a second feature: the size grew past its tolerance — one ▲ warning (never a blocker), the report's METRIC lines, --json's metrics
  const b = change("Beta");
  await run(p, ["done", b.slug, "1", "--run"]);
  await run(p, ["done", b.slug, "2", "--evidence", "noted"]);
  await run(p, ["done", b.slug, "3", "--run"]);
  size("142.3");
  const f2 = await run(p, ["finish", b.slug, "--run"]);
  const f2j = json((await run(p, ["finish", b.slug, "--run", "--json"])).stdout);
  const day = S.dayOf(fin1 && fin1.at);
  all("1.41 finish --run reads each project check's whole output — a size script's line before 50 noise lines, node --test's TAP '# METRIC' of a nested subtest — says the malformed line per check, records the readings on a ready written finish; the next feature's finish compares each (check, name): the size that grew past its tolerance is ONE ▲ warning (exit 0: ready), the report's METRIC lines and --json's metrics (got " +
    JSON.stringify({ f1: f1.out.slice(0, 900), fin1: fin1 && fin1.metrics, f2: f2.out.slice(0, 1200), f2j: f2j && [f2j.readyToFinish, f2j.metrics, f2j.recordedChecks] }) + ")", {
    readFirst: f1.code === 0 && JSON.stringify(fin1.metrics) === JSON.stringify([{ check: "size", name: "bundle-size", value: 120, unit: "kB", better: "lower", tolerance: { amount: 2, percent: true } },
      { check: "tap", name: "parse.ms", value: 3, unit: "ms" }]),
    malformed: f1.out.includes("  ⚠ size: " + MT.notRead(1, "METRIC broken=1,5", S.METRIC_GRAMMAR) + "\n"),
    recorded: f1.out.includes("  " + MT.recorded(2)),
    warning: f2.code === 0 && (f2.out.match(/▲ \d+ METRIC reading/g) || []).length === 1 &&
      f2.out.includes(MT.flagged("bundle-size", "size", "120 kB", "142.3 kB", a.slug, day, "+22.3", "2.4", "regressed")),
    report: f2.out.includes(MT.reportHead + "\n  " + MT.line("bundle-size", "size", "142.3 kB", "120 kB", a.slug, day, "+22.3", MT.verdict.regressed + " (2.4)") + "\n"),
    json: !!f2j && f2j.readyToFinish === true && f2j.metrics.map((m) => m.check + ":" + m.name + ":" + m.verdict).join() === "size:bundle-size:regressed,tap:parse.ms:unjudged" &&
      JSON.stringify(f2j.recordedChecks) === JSON.stringify([{ name: "size", exitCode: 0, metrics: 1, metricsMalformed: 1, metricsLastMalformed: "METRIC broken=1,5" }, { name: "tap", exitCode: 0, metrics: 1 }]),
  });

  // spec_metrics: the CLI's project view shows each (check, name) across the finishes
  {
    await run(p, ["finish", b.slug, "--run", "--write"]);
    const m = spawnIn(["metrics", "--project", p], { encoding: "utf8" });
    all("1.41 dev-spec metrics (the project): each METRIC reading across the finishes that recorded it, first → last (got " + (m.stdout || "").split("\n").slice(-5).join(" | ") + ")", {
      lines: m.status === 0 && (m.stdout || "").includes(MT.measuredHead + "\n    " + MT.measuredLine("bundle-size", "size", "120", "142.3 kB", 2, "+18.6 %")),
    });
  }
};
