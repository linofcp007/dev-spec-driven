"use strict";
// Evidence — the friction budget (1.41, report only): steering/tech.md's _Budget:_ lines, the git-ignored timings.jsonl (recordTiming, observeRun's measured runs, the observe hook's duration_ms), the verdict (spec_metrics' project friction), next_action's finish-step hint.

const fs = require("fs");
const path = require("path");

exports.run = async ({ ok, all, eq, rpc, payload, S, tmp, hookIn, fsCalls, __dirname }) => {
  const E = require(path.join(__dirname, "lib", "engine", "index.js"));
  const js = JSON.stringify;
  const call = async (name, args) => payload(await rpc("tools/call", { name, arguments: args }));
  const safe = (fn) => { try { return fn(); } catch (e) { return { threw: e.message }; } }; // a regression must FAIL, not crash the file
  const F = S.msg("en").friction;
  const CHECKS = { test: "npm test", lint: "npm run lint", type_check: "npx tsc --noEmit", build: "npm run build" };
  const tech = (p, lines) => fs.writeFileSync(path.join(p, ".specs", "steering", "tech.md"), (Array.isArray(lines) ? lines.join("\n") : lines) + "\n");
  const tfile = (p) => path.join(p, ".specs", ".execution", "timings.jsonl");
  const lines = (p) => { try { return fs.readFileSync(tfile(p), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };
  const project = (name, checks) => { const p = path.join(tmp, name); S.initProject(p, ["core"], "en", { checks: checks || CHECKS }); return p; };
  // hand-written timings, oldest first: [check, seconds, exitCode = 0, checkCmd = the check's]
  const line = (checks) => ([check, s, exitCode = 0, checkCmd]) => js({ check, checkCmd: checkCmd || checks[check] || "x", exitCode, ms: Math.round(s * 1000), at: "2026-11-25T10:00:00.000Z", by: "cli" }) + "\n";
  const writeTimings = (p, rows, checks) => { fs.mkdirSync(path.dirname(tfile(p)), { recursive: true }); fs.writeFileSync(tfile(p), rows.map(line(checks || CHECKS)).join("")); };
  const many = (check, s, n, exitCode) => Array.from({ length: n }, () => [check, s, exitCode]);

  { // B1–B13, B16: the markers — tech.md only, outside fenced code and HTML comments, any case, `_…_` / `*…*`, backticks, a comment after the
    // closer; no-check / duration / duplicate said; anything else (a bold label, `$500/month`) silent
    const p = project("proj-fr-budgets");
    tech(p, [
      "# Tech", "",
      "- _Budget: test 2m_ — the suite on a laptop",
      "- _budget: lint 5s_ — any case",
      "- _Budget: `type_check` 30s_",
      "- *Budget: build 90 s*",
      "- _Budget: tset 2m_",
      "- _Budget: test 5m_",
      "- _Budget: $500/month_ · _Budget: marketing 500 euros_",
      "- **Budget:** test 1s",
      "```", "_Budget: lint 1ms_", "```",
      "<!-- _Budget: build 1ms_ -->",
    ]);
    fs.writeFileSync(path.join(p, ".specs", "steering", "structure.md"), "# Structure\n\n- _Budget: type_check 1ms_\n");
    eq(safe(() => E.frictionBudgets(p)), {
      budgets: [{ check: "test", ms: 120000, line: 3 }, { check: "lint", ms: 5000, line: 4 }, { check: "type_check", ms: 30000, line: 5 }, { check: "build", ms: 90000, line: 6 }],
      invalid: [{ line: 7, text: "_Budget: tset 2m_", why: "no-check" }, { line: 8, text: "_Budget: test 5m_", why: "duplicate" }],
      truncated: false,
    }, "1.41 friction: tech.md's _Budget:_ markers — 2m = 120 s, a lower-case label, `type_check` in backticks, *…* with `90 s`, a comment after the closer; tset → no-check, a second test → duplicate (the first counts); $500/month, `marketing 500 euros`, a bold **Budget:** label, a fenced one, one in an HTML comment and one in structure.md → nothing");
    const q = project("proj-fr-durations");
    tech(q, ["# Tech", "", "Our suite keeps _Budget: test 1500ms_ today.", "- _Budget: lint 2mn_", "- _Budget: build_", "- _Budget: type_check 0ms_"]);
    eq(safe(() => E.frictionBudgets(q)), {
      budgets: [{ check: "test", ms: 1500, line: 3 }],
      invalid: [{ line: 4, text: "_Budget: lint 2mn_", why: "duration" }, { line: 5, text: "_Budget: build_", why: "duration" }, { line: 6, text: "_Budget: type_check 0ms_", why: "duration" }],
      truncated: false,
    }, "1.41 friction: a marker mid-sentence is read (the task markers' reader, no line-start rule); a check with `2mn`, with no duration or with 0 ms → duration");
    eq(["2m", "2 min", "2M", "90 s", "1500ms", "1.5h", "24h", "1ms", "0.5s", "1.2345s", "0ms", "25h", "2mn", "", "1e3s", "-1s", "1000000s"].map((d) => E.parseDuration(d)),
      [120000, 120000, 120000, 90000, 1500, 5400000, 86400000, 1, 500, null, null, null, null, null, null, null, null],
      "1.41 friction: a duration — ms · s · m / min · h, any case, ≤ 3 decimals, 1 ms – 24 h; anything else null");
    // B14 the 20-marker bound, B17 the head bound — each said
    const r = project("proj-fr-bounds");
    tech(r, ["# Tech", "", ...Array.from({ length: 21 }, (_, i) => "- _Budget: x" + i + " 1s_")]);
    const twenty = safe(() => E.frictionBudgets(r));
    tech(r, ["# Tech", "", "x".repeat(256 * 1024), "- _Budget: test 2m_"]);
    const head = safe(() => E.frictionBudgets(r));
    all("1.41 friction: at most 20 _Budget:_ markers are read and a longer tech.md is read to 256 KB — each bound says it (truncated) (got " + js([twenty.invalid && twenty.invalid.length, twenty.truncated, head]) + ")", {
      markers: () => twenty.invalid.length === 20 && twenty.invalid.every((x) => x.why === "no-check") && twenty.invalid[19].text === "_Budget: x19 1s_" && twenty.truncated === true,
      head: () => head.budgets.length === 0 && head.truncated === true,
    });
    // B15 the label is the reader's own: the task markers never read it, nor it theirs
    const task = "- [ ] 1. Fix _Budget: test 2m_ now _Verify: npm test_";
    all("1.41 friction: `_Budget:` is a label of its own reader (tasks.js labelMarkerSpans) — the task markers never read it, it reads no task marker (got " +
      js([E.taskMarkerSpans(task), E.labelMarkerSpans(task, "Budget")]) + ")", {
      tasks: () => js(E.taskMarkerSpans(task).map((s) => [s.key, s.value])) === js([["verify", "npm test"]]),
      budget: () => js(E.labelMarkerSpans(task, "Budget").map((s) => [s.key, s.value])) === js([["budget", "test 2m"]]),
      prose: () => E.withoutTaskMarkers(task).includes("_Budget: test 2m_"),
    });
  }

  { // W1–W13: the writer — a project check's run as the matcher reads it (one command), its `cd <root> &&` stripped, the line's shape, ms bounds
    const bare = path.join(tmp, "proj-fr-bare");
    fs.mkdirSync(bare, { recursive: true });
    const none = S.recordTiming(bare, { command: "npm test", exitCode: 0, ms: 5, by: "cli" });
    ok(js(none) === js({ timed: [] }) && !fs.existsSync(path.join(bare, ".specs")), "1.41 friction: recordTiming without .specs/ creates nothing (got " + js(none) + ")");
    const p = project("proj-fr-writer");
    const t = (command, ms, extra) => S.recordTiming(p, { command, exitCode: 0, ms, by: "cli", ...extra }).timed;
    const got = {
      piped: t("npm test | tail -5", 5), joined: t("npm test && npm run build", 5), other: t("node tests/x.js", 5),
      cd: t("cd " + p + " && npm test", 6), runTest: t("npm run test", 7), env: t("FORCE_COLOR=0 npm test", 8),
      neg: t("npm test", -1), big: t("npm test", 9e9), nan: t("npm test", NaN), str: t("npm test", "12"), round: t("npm test", 4187.6),
      noBy: S.recordTiming(p, { command: "npm test", exitCode: 0, ms: 5 }).timed, noCode: S.recordTiming(p, { command: "npm test", exitCode: "0", ms: 5, by: "cli" }).timed,
      named: S.recordTiming(p, { check: "lint", command: "anything", exitCode: 1, ms: 3, by: "hook", tool: "PowerShell" }).timed,
      gone: S.recordTiming(p, { check: "nope", command: "npm test", exitCode: 0, ms: 3, by: "cli" }).timed,
    };
    const ls = lines(p);
    all("1.41 friction: a run of a project check AS ONE COMMAND is timed — `cd <root> && npm test`, `npm run test`, an env prefix; a piped, joined or other command never; ms rounded, -1 / 9e9 / NaN / a string never; no `by` or a string exit code nothing; `check` names the check (finish --run), a check no longer in meta.checks nothing; .execution/ ignores itself (got " +
      js({ got, ls }) + ")", {
      notTimed: () => [got.piped, got.joined, got.other, got.neg, got.big, got.nan, got.str, got.noBy, got.noCode, got.gone].every((x) => js(x) === "[]"),
      timed: () => [got.cd, got.runTest, got.env, got.round].every((x) => js(x) === '["test"]') && js(got.named) === '["lint"]',
      ms: () => js(ls.map((l) => l.ms)) === js([6, 7, 8, 4188, 3]),
      shape: () => js(Object.keys(ls[0])) === js(["check", "checkCmd", "exitCode", "ms", "at", "by"]) && ls[0].checkCmd === "npm test" && ls[0].by === "cli" && Number.isFinite(Date.parse(ls[0].at)),
      named: () => js(ls[4]) === js({ ...ls[4], check: "lint", checkCmd: "npm run lint", exitCode: 1, ms: 3, by: "hook", tool: "PowerShell" }),
      ignored: () => fs.readFileSync(path.join(p, ".specs", ".execution", ".gitignore"), "utf8") === "*\n",
    });
    // W13: two checks with one command — a run of it times both; finish --run's `check` only the one it ran
    const two = project("proj-fr-two", { a: "npm test", b: "npm test" });
    const both = S.recordTiming(two, { command: "npm test", exitCode: 0, ms: 1, by: "cli" }).timed;
    const oneOf = S.recordTiming(two, { check: "b", command: "npm test", exitCode: 0, ms: 2, by: "cli" }).timed;
    ok(js(both) === '["a","b"]' && js(oneOf) === '["b"]' && js(lines(two).map((l) => [l.check, l.ms])) === js([["a", 1], ["b", 1], ["b", 2]]),
      "1.41 friction: a run of a command two checks share is timed for both; finish --run's `check` times the one it ran (got " + js([both, oneOf]) + ")");
    // the matcher decides, never the text: `npm test` is in `npm test -- --coverage`'s text but no run of it; a worktree's `cd <its root> &&`
    // (one of the run's roots — the hook passes them) is stripped as observeRun strips it; a run that throws is nothing (never a throw)
    const cov = project("proj-fr-cov", { cov: "npm test -- --coverage" });
    const wt = path.join(tmp, "proj-fr-cov-wt");
    fs.mkdirSync(wt, { recursive: true });
    const sub = S.recordTiming(cov, { command: "npm test", exitCode: 0, ms: 1, by: "cli" }).timed;
    const viaWt = S.recordTiming(cov, { command: "cd " + wt + " && npm test -- --coverage", roots: [wt], cwd: wt, exitCode: 0, ms: 2, by: "hook" }).timed;
    const thrown = safe(() => S.recordTiming(cov, { get command() { throw new Error("boom"); }, exitCode: 0, ms: 3, by: "cli" }));
    all("1.41 friction: the matcher decides, never the text (a check whose command holds the run's text is no check run); a worktree's cd prefix (one of the run's roots) is stripped; a run that throws is nothing (got " +
      js([sub, viaWt, thrown]) + ")", {
      sub: () => js(sub) === "[]", wt: () => js(viaWt) === '["cov"]', thrown: () => js(thrown) === js({ timed: [] }),
    });
    // W12: observeRun forwards a measured run (by: cli for done --run's event, hook otherwise) — none without ms
    const o = project("proj-fr-observe");
    const o1 = S.observeRun(o, { command: "npm test", exitCode: 0, event: "cli", ms: 10, cwd: o });
    const o2 = S.observeRun(o, { command: "npm test", exitCode: 1, event: "PostToolUseFailure", ms: 11, cwd: o });
    const o3 = S.observeRun(o, { command: "npm test", exitCode: 0, event: "PostToolUse", cwd: o });
    const obs = fs.readFileSync(path.join(o, ".specs", ".execution", "observed.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
    all("1.41 friction: observeRun times a measured run of a check (event cli → by cli, a hook event → by hook; a failure keeps its exit code) and nothing without ms; the observed lines keep 1.40's keys (got " + js([o1, o2, o3, lines(o), obs]) + ")", {
      results: () => js(o1.timed) === '["test"]' && js(o2.timed) === '["test"]' && o3.timed === undefined && o3.recorded.length === 1,
      lines: () => js(lines(o).map((l) => [l.by, l.exitCode, l.ms])) === js([["cli", 0, 10], ["hook", 1, 11]]),
      observed: () => obs.length === 3 && obs.every((e) => js(Object.keys(e)) === js(["command", "exitCode", "at", "event"])),
    });
  }

  { // W9–W11: past TIMINGS_MAX_BYTES the log keeps, per check, its newest FRICTION_KEEP (10) passing lines — never by newest bytes (the fast
    // check's flood would push the build's few runs out); failed lines, a changed command's and a removed check's go
    const checks = { fast: "node fast.js", build: "npm run build", test: "npm test" };
    const p = project("proj-fr-trim", checks);
    const rows = [...many("build", 60, 3), ["build", 1, 1], ["test", 30, 0, "npm test --old"], ["gone", 5], ...many("fast", 1, 700)];
    writeTimings(p, rows, checks);
    const before = fs.statSync(tfile(p)).size;
    const added = S.recordTiming(p, { command: "node fast.js", exitCode: 0, ms: 2000, by: "hook" }).timed;
    const after = lines(p);
    const count = (c) => after.filter((l) => l.check === c).length;
    all("1.41 friction: the trim keeps each check's newest 10 passing lines — the 3 build runs survive 700 fast-check lines; the failed build run, the test line of an old command and the removed check's are dropped; the file shrinks under 64 KB (got " +
      js({ before, size: fs.statSync(tfile(p)).size, added, counts: [count("build"), count("fast"), count("test"), count("gone")], lastFast: after.filter((l) => l.check === "fast").slice(-1) }) + ")", {
      big: () => before > E.TIMINGS_MAX_BYTES,
      build: () => count("build") === 3 && after.filter((l) => l.check === "build").every((l) => l.exitCode === 0 && l.ms === 60000),
      fast: () => count("fast") === 10 && after.filter((l) => l.check === "fast").slice(-1)[0].ms === 2000,
      dropped: () => count("test") === 0 && count("gone") === 0 && after.every((l) => l.exitCode === 0),
      small: () => fs.statSync(tfile(p)).size <= E.TIMINGS_MAX_BYTES,
    });
  }

  { // S1–S12: the verdict — the MEDIAN of each check's newest 5 passing runs, ≥ 3 to judge, against its budget; a line counts while meta.checks
    // still runs its command; spec_metrics' project `friction` (MCP = engine), the CLI line, never at feature scope
    const checks = { ...CHECKS, e2e: "npm run e2e", fmt: "npm run fmt:check", docs: "npm run docs" };
    const p = project("proj-fr-verdict", checks);
    tech(p, ["# Tech", "", "- _Budget: test 2m_", "- _Budget: lint 1m_", "- _Budget: build 100s_", "- _Budget: type_check 10s_", "- _Budget: e2e 1m_", "- _Budget: docs 1m_", "- _Budget: tset 2m_"]);
    writeTimings(p, [
      ...[100, 100, 100, 100, 400].map((s) => ["test", s]), // the median 100 s: within (the mean, 160 s, would be over)
      ...many("test", 900, 5).map(([c, s]) => [c, s, 0, "npm test --old"]), // an old command's lines: not this check's runs
      ...many("lint", 70, 3), ...many("lint", 1, 3, 1), // three slow passes, then three fast FAILURES: the median of the passes, 70 s — over
      ...[400, 400, 400, 400, 10, 10, 10].map((s) => ["build", s]), // the newest 5: 400 400 10 10 10 → 10 s, within (the oldest 5 or 7 runs: over)
      ...many("type_check", 20, 2), // two runs: few-runs, never judged
      ...many("e2e", 90, 3), // three: judged — over
      ...[0.01, 0.02, 0.03, 0.04].map((s) => ["fmt", s]), // no budget: unbudgeted, the even median 25 ms
      ["gone", 5], // a check no longer in meta.checks: not listed
    ], checks);
    // malformed lines: skipped (else type_check would have 3+ runs)
    fs.appendFileSync(tfile(p), [{ check: "type_check", checkCmd: checks.type_check, exitCode: 0, ms: "5" }, { check: "type_check", checkCmd: checks.type_check, exitCode: 0, ms: -1 },
      { check: "type_check", checkCmd: checks.type_check, exitCode: 0, ms: 90000000 }, { check: "type_check", exitCode: 0, ms: 5 }, { check: "nope2", exitCode: 0, ms: 5 },
      { check: "type_check", checkCmd: checks.type_check, exitCode: "0", ms: 5 }].map((x) => js(x) + "\n").join("") + "not json\n");
    const st = safe(() => E.frictionStatus(p, "en"));
    eq(st, {
      checks: [
        { check: "test", budgetMs: 120000, runs: 5, medianMs: 100000, minMs: 100000, maxMs: 400000, status: "within" },
        { check: "lint", budgetMs: 60000, runs: 3, medianMs: 70000, minMs: 70000, maxMs: 70000, status: "over" },
        { check: "type_check", budgetMs: 10000, runs: 2, medianMs: 20000, minMs: 20000, maxMs: 20000, status: "few-runs" },
        { check: "build", budgetMs: 100000, runs: 5, medianMs: 10000, minMs: 10000, maxMs: 400000, status: "within" },
        { check: "e2e", budgetMs: 60000, runs: 3, medianMs: 90000, minMs: 90000, maxMs: 90000, status: "over" },
        { check: "fmt", budgetMs: null, runs: 4, medianMs: 25, minMs: 10, maxMs: 40, status: "unbudgeted" },
        { check: "docs", budgetMs: 60000, runs: 0, medianMs: null, minMs: null, maxMs: null, status: "no-runs" },
      ],
      invalid: [{ line: 9, text: "_Budget: tset 2m_", why: "no-check", message: F.invalid(9, "_Budget: tset 2m_", "no-check", Object.keys(checks).join(", ")) }],
    }, "1.41 friction: each check's verdict — the median of its newest 5 passing runs (failures, an old command's lines, malformed lines skipped; the oldest runs never), 3 needed, the even median, a check without a budget unbudgeted, a budget with no run no-runs, a removed check not listed; meta.checks' order");
    const pm = await call("spec_metrics", { projectDir: p });
    const fm = S.metrics(p);
    const cli = S.metricsLines(fm).join("\n");
    const feat = S.createFeature(p, { name: "Login", tracks: ["core"] });
    const ff = S.metrics(p, feat.slug);
    all("1.41 friction: spec_metrics' project view carries `friction` (MCP = engine), its CLI line and the unreadable line; the feature view none (got " + js([pm.friction, cli]) + ")", {
      mcp: () => js(pm.friction) === js(st) && js(fm.friction) === js(st),
      line: () => cli.includes(F.metrics([F.within("test", "1 min 40 s", "2 min", 5), F.over("lint", "1 min 10 s", "1 min", 3), F.fewRuns("type_check", 2, 3), F.within("build", "10 s", "1 min 40 s", 5),
        F.over("e2e", "1 min 30 s", "1 min", 3), F.unbudgeted("fmt", "25 ms", 4), F.noRuns("docs")].join(" · "))) && cli.includes("    ▲ " + st.invalid[0].message),
      feature: () => ff.ok && !("friction" in ff),
    });
    // S11 the boundary: the median AT the budget is within, one ms over it over · S8 null without anything, an unreadable line alone is shown
    const b = project("proj-fr-boundary", { test: "npm test" });
    writeTimings(b, many("test", 120, 5), { test: "npm test" });
    tech(b, "- _Budget: test 2m_");
    const at = safe(() => E.frictionStatus(b, "en").checks[0].status);
    tech(b, "- _Budget: test 119999ms_");
    const over = safe(() => E.frictionStatus(b, "en").checks[0].status);
    const n = project("proj-fr-nothing", { test: "npm test" });
    const nothing = safe(() => E.frictionStatus(n, "en")), nothingMetrics = S.metrics(n).friction;
    const noChecks = path.join(tmp, "proj-fr-nochecks");
    S.initProject(noChecks, ["core"], "en");
    tech(n, "- _Budget: test 2mn_");
    const onlyBad = safe(() => E.frictionStatus(n, "en"));
    all("1.41 friction: the boundary is within (a median AT the budget), 1 ms under it is over; no budget, no unreadable line and no run → null (no meta.checks → null); an unreadable line alone is shown (got " +
      js([at, over, nothing, nothingMetrics, E.frictionStatus(noChecks, "en"), onlyBad]) + ")", {
      boundary: () => at === "within" && over === "over",
      nothing: () => nothing === null && nothingMetrics === null && E.frictionStatus(noChecks, "en") === null,
      onlyBad: () => onlyBad && js(onlyBad.checks) === "[]" && onlyBad.invalid.length === 1 && onlyBad.invalid[0].why === "duration",
    });
    // S12 the read bound — a COUNT: a 1 MB log reads its newest 4 × 64 KB, never the whole file
    const big = project("proj-fr-big", { test: "npm test" });
    writeTimings(big, many("test", 1, 9000), { test: "npm test" });
    const size = fs.statSync(tfile(big)).size;
    const read = safe(() => E.frictionStatus(big, "en").read);
    ok(size > 4 * E.TIMINGS_MAX_BYTES && read === 4 * E.TIMINGS_MAX_BYTES, "1.41 friction: the reader reads a log's newest 4 × TIMINGS_MAX_BYTES bytes at most (got " + js({ size, read }) + ")");
    // the durations as every language prints them, and the bounds' line
    const fmt = require(path.join(__dirname, "lib", "i18n.js")).fmtMs;
    eq([850, 999.4, 999.6, 4200, 9949, 9950, 48000, 59600, 190000, 3599600, 3600000, 3900000, -1, NaN, "5"].map((v) => fmt(v)),
      ["850 ms", "999 ms", "1 s", "4.2 s", "9.9 s", "10 s", "48 s", "1 min", "3 min 10 s", "1 h", "1 h", "1 h 5 min", "—", "—", "—"],
      "1.41 friction: fmtMs — ms below a second, one decimal below 10 s, whole seconds, min + s, h + min (a zero part left out), — for no number");
    ok(js(E.frictionLines({ checks: [], invalid: [], truncated: true }, "en")) === js(["    ▲ " + F.truncated]) && js(E.frictionLines(null, "en")) === "[]",
      "1.41 friction: the CLI says a bound that dropped markers (truncated); nothing without friction");
  }

  { // H1–H5: the observe hook — Claude Code's duration_ms on a check's run → a timings line (by hook, rounded); none without it, none for a
    // task's _Verify:_ that is no check, the observed lines as 1.40 writes them
    const hookJs = path.join(__dirname, "..", "hooks", "observe-hook.js");
    const p = project("proj-fr-hook", { test: "npm test" });
    const f = S.createFeature(p, { name: "Auth", tracks: ["core"] });
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Login\n  - _Verify: node t1.js_\n");
    const run = (o) => hookIn(hookJs, { input: js({ session_id: "s", cwd: p, hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: { command: "npm test" }, ...o }),
      env: { ...process.env, CLAUDE_PROJECT_DIR: p, SPEC_PROJECT_DIR: "" } });
    const r1 = run({ duration_ms: 4187.6, tool_response: { exit_code: 0 } });
    const r2 = run({ tool_response: { exit_code: 0 } });
    const r3 = run({ tool_input: { command: "node t1.js" }, duration_ms: 50, tool_response: { exit_code: 0 } });
    const r4 = run({ hook_event_name: "PostToolUseFailure", error: "Command failed with exit code 1", duration_ms: 900 });
    const r5 = run({ tool_name: "PowerShell", duration_ms: 1200, tool_response: { exitCode: 0 } });
    const r6 = run({ duration_ms: -5, tool_response: { exit_code: 0 } });
    const r7 = run({ duration_ms: "12", tool_response: { exit_code: 0 } });
    const obsP = fs.readFileSync(path.join(p, ".specs", ".execution", "observed.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
    const obsF = fs.readFileSync(path.join(f.dir, ".execution", "observed.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
    all("1.41 friction: the observe hook times a check's run from the payload's duration_ms (rounded, by hook; a failure, a PowerShell run's tool) — none without it, out of range or not a number, none for a task's _Verify:_ that is no check; silent; the observed lines keep 1.40's keys (got " +
      js({ timings: lines(p), obsP, obsF }) + ")", {
      quiet: () => [r1, r2, r3, r4, r5, r6, r7].every((r) => r.status === 0 && r.stdout === "" && r.stderr === ""),
      timings: () => js(lines(p).map((l) => [l.check, l.exitCode, l.ms, l.by, l.tool || null])) === js([["test", 0, 4188, "hook", null], ["test", 1, 900, "hook", null], ["test", 0, 1200, "hook", "PowerShell"]]),
      observed: () => obsP.length === 6 && obsP.every((e) => js(Object.keys(e).filter((k) => k !== "tool")) === js(["command", "exitCode", "at", "event", "session"])) && !obsP.some((e) => "ms" in e),
      feature: () => obsF.length === 1 && obsF[0].command === "node t1.js" && !("ms" in obsF[0]),
    });
  }

  { // N1–N7: next_action — at the FINISH step only, the last hint: a budgeted check over its budget → propose friction-<check>, until a backlog
    // item or a feature (active or archived) answers to that name; never at implement; within / few-runs nothing; the cost a count
    const PASS = 'node -e "process.exit(0)"';
    const CLASS = "# Classification: x\n\n## Mode\nSpec\n\n## Active Tracks\ncore\n\n## Signals\n- none, plain feature\n\n## Blast Radius\nLow; only the login page.\n\n## Compliance Tags\nnone\n";
    const REQ = "# Feature: x\n\n## Summary\nUsers log in with email and password.\n\n## User Stories (prioritized — each independently testable)\n\n### US-1 (P1 — MVP): Log in\n" +
      "**As a** user, **I want** to log in, **so that** I see my account.\n**Why P1:** nothing works without it.\n**Independent Test:** Can be fully tested by logging in and delivers access, without the other stories.\n\n" +
      "#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN the user submits valid credentials THE SYSTEM SHALL open a session\n\n" +
      "## Success Criteria (measurable, technology-agnostic)\n- **SC-001** — 95% of logins complete in under 2 seconds\n\n## Edge Cases & Error Handling\n- **EC-1** — Locked account: show the lock message\n\n" +
      "## Non-Functional Requirements\n- **NFR-1** — p95 latency under 300 ms\n\n## Out of Scope\n- Social login\n\n## Assumptions\n- Users already have accounts\n";
    const DESIGN = "# Design: x\n\n## Overview\nA form posts to /login; the server checks the hash.\n\n## Architecture\nThe web app calls the auth service.\n\n## Data Models\nUser { id, email, hash }\n\n" +
      "## API Contracts\nPOST /login returns 200 or 401.\n\n## Security Considerations\nHashes use bcrypt.\n\n## Error Handling\nWrong credentials give 401.\n\n## Testing Strategy\n- Unit tests for the handler.\n\n" +
      "## Constitution Check\n- [x] Simplicity — complies\n\n## Complexity Tracking\nNone.\n";
    const TASKS = "# Tasks\n\n## Story US-1 (P1 — MVP)\n- [ ] 1. [US1] Implement the login handler (EC-1, NFR-1, SC-001)\n  - _Requirements: US-1.AC-1_\n  - _Verify: " + PASS + "_\n" +
      "- [ ] 2. [US1] Show the session\n  - _Requirements: US-1.AC-1_\n  - _Verify: " + PASS + "_\n**Checkpoint:** US-1 works.\n";
    const checks = { test: "npm test", type_check: "npx tsc --noEmit" };
    const p = project("proj-fr-next", checks);
    const f = S.createFeature(p, { name: "Login", tracks: ["core"] });
    for (const [n, t] of [["classification.md", CLASS], ["requirements.md", REQ], ["design.md", DESIGN], ["tasks.md", TASKS]]) fs.writeFileSync(path.join(f.dir, n), t);
    S.approvePhase(p, f.slug, null, "u", { through: "tasks" });
    tech(p, ["# Tech", "", "- _Budget: test 2m_", "- _Budget: type_check 10s_"]);
    writeTimings(p, [...many("test", 190, 5), ...many("type_check", 30, 3)], checks);
    const run = { command: PASS, exitCode: 0 };
    S.completeTask(p, f.slug, 1, run);
    const naImpl = S.nextAction(p, f.slug);
    S.completeTask(p, f.slug, 2, run);
    const na = S.nextAction(p, f.slug);
    const mcp = await call("spec_next_action", { name: f.slug, projectDir: p });
    const ms = S.msg("en").next;
    const over = [{ check: "test", medianMs: 190000, budgetMs: 120000, runs: 5 }, { check: "type_check", medianMs: 30000, budgetMs: 10000, runs: 3 }];
    const hint = F.naHint([F.naItem("test", "3 min 10 s", 5, "2 min"), F.naItem("type_check", "30 s", 3, "10 s")].join("; "),
      [S.DEV_SPEC + ' backlog add "friction-test" "' + F.backlogNote("3 min 10 s", 5, "2 min") + '"', S.DEV_SPEC + ' backlog add "friction-type_check" "' + F.backlogNote("30 s", 3, "10 s") + '"'].join(" · "));
    const checksAt = na.recommendation.indexOf("Project checks are configured");
    all("1.41 friction: next_action's finish step ends with the friction hint — each over-budget check's platform item, its `backlog add` line — and carries friction {over} (MCP = engine); never at implement (got " +
      js([naImpl.step, naImpl.friction, na.step, na.recommendation, na.friction]) + ")", {
      implement: () => naImpl.step === "implement" && naImpl.friction === undefined && !naImpl.recommendation.includes(F.naHint("", "").slice(0, 10)),
      finish: () => na.step === "finish" && na.recommendation.endsWith(" " + hint) && js(na.friction) === js({ over }),
      last: () => checksAt > 0 && checksAt < na.recommendation.indexOf(hint),
      mcp: () => js(mcp.friction) === js({ over }) && mcp.recommendation === na.recommendation,
      allDone: () => na.recommendation.startsWith(ms.allDone(f.slug).slice(0, 20)),
    });
    // filed: a backlog entry (by slug, as the backlog matches names: "Friction Type_Check") or a feature — active, then archived — stops each
    // check's hint
    S.backlog(p, "add", "Friction Type_Check", "slow types");
    const one = S.nextAction(p, f.slug);
    S.createFeature(p, { name: "friction-test", tracks: ["core"] });
    const filed = S.nextAction(p, f.slug);
    const archived = path.join(p, ".specs", "_archive");
    fs.mkdirSync(archived, { recursive: true });
    fs.renameSync(path.join(p, ".specs", "friction-test"), path.join(archived, "friction-test"));
    const arch = S.nextAction(p, f.slug);
    all("1.41 friction: the hint stops per check once the backlog holds friction-<check> (by slug) or a feature answers to it — active or archived (got " +
      js([one.friction, filed.friction, arch.friction, filed.recommendation.slice(-200)]) + ")", {
      backlog: () => js(one.friction) === js({ over: [over[0]] }) && !one.recommendation.includes("friction-type_check"),
      feature: () => filed.step === "finish" && filed.friction === undefined && !filed.recommendation.includes(F.naHint("", "").slice(0, 10)),
      archived: () => arch.friction === undefined,
    });
    // within / few-runs: no hint; the cost — with the budget lines next_action reads timings.jsonl ONCE more than the same tech.md without them
    const w = project("proj-fr-next-within", checks);
    const fw = S.createFeature(w, { name: "Login", tracks: ["core"] });
    for (const [n, t] of [["classification.md", CLASS], ["requirements.md", REQ], ["design.md", DESIGN], ["tasks.md", TASKS]]) fs.writeFileSync(path.join(fw.dir, n), t);
    S.approvePhase(w, fw.slug, null, "u", { through: "tasks" });
    S.completeTask(w, fw.slug, 1, run);
    S.completeTask(w, fw.slug, 2, run);
    writeTimings(w, [...many("test", 60, 5), ...many("type_check", 30, 2)], checks);
    const withText = ["# Tech", "", "- _Budget: test 2m_", "- _Budget: type_check 10s_"], plainText = ["# Tech", "", "- test 2m", "- type_check 10s"];
    tech(w, withText);
    const naW = S.nextAction(w, fw.slug);
    const root = w + path.sep;
    const count = (text) => { tech(w, text); return fsCalls(root, () => S.nextAction(w, fw.slug)); };
    const minus = (a, b) => { const o = {}; for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const d = (a[k] || 0) - (b[k] || 0); if (d) o[k] = d; } return o; };
    count(withText); // warm
    const diff = minus(count(withText), count(plainText));
    const noChecks = path.join(tmp, "proj-fr-next-nochecks");
    S.initProject(noChecks, ["core"], "en");
    const hintCalls = fsCalls(noChecks + path.sep, () => S.withReadCache(() => { E.loadRoadmap(noChecks); E.frictionHint(noChecks, "en"); E.frictionStatus(noChecks, "en"); }));
    const loadCalls = fsCalls(noChecks + path.sep, () => S.withReadCache(() => { E.loadRoadmap(noChecks); }));
    all("1.41 friction: a check within its budget (or with too few runs) gives no hint; the cost is a COUNT — with _Budget:_ lines next_action makes the fs calls of the same call without them plus ONE open (timings.jsonl); without meta.checks the hint and the status read nothing (got " +
      js({ naW: [naW.step, naW.friction], diff, hintCalls, loadCalls }) + ")", {
      none: () => naW.step === "finish" && naW.friction === undefined,
      count: () => js(diff) === js({ openSync: 1 }),
      noChecks: () => js(hintCalls) === js(loadCalls),
    });
    // once per call: spec_upgrade runs next_action per feature — two features at their finish step open timings.jsonl ONCE; a timing written
    // in the same call drops the memo (the next read sees it)
    tech(w, withText); // (the count above left the plain text)
    const fw2 = S.createFeature(w, { name: "Logout", tracks: ["core"] });
    for (const [n, t] of [["classification.md", CLASS], ["requirements.md", REQ], ["design.md", DESIGN], ["tasks.md", TASKS]]) fs.writeFileSync(path.join(fw2.dir, n), t);
    S.approvePhase(w, fw2.slug, null, "u", { through: "tasks" });
    S.completeTask(w, fw2.slug, 1, run);
    S.completeTask(w, fw2.slug, 2, run);
    const atFinish = [S.nextAction(w, fw.slug).step, S.nextAction(w, fw2.slug).step];
    // (the opens of this project's timings.jsonl by name — spec_upgrade may spell the project's folder another way than `w`)
    const opens = (fn) => { const orig = fs.openSync; let n = 0; fs.openSync = function (f, ...rest) { if (typeof f === "string" && path.basename(f) === "timings.jsonl" && f.includes("proj-fr-next-within")) n++; return orig.call(this, f, ...rest); };
      try { fn(); } finally { fs.openSync = orig; } return n; };
    const upg = { openSync: opens(() => S.specUpgrade(w)) };
    const inScope = S.withReadCache(() => {
      const before = E.frictionStatus(w, "en").checks.find((c) => c.check === "type_check").runs;
      S.recordTiming(w, { command: "npx tsc --noEmit", exitCode: 0, ms: 30000, by: "cli" });
      return [before, E.frictionStatus(w, "en").checks.find((c) => c.check === "type_check").runs];
    });
    all("1.41 friction: the timings are read once per engine call (spec_upgrade over two features at their finish step: one open) and a timing written in the call is seen by its next read (got " +
      js({ atFinish, upg, inScope }) + ")", {
      once: () => js(atFinish) === '["finish","finish"]' && js(upg) === js({ openSync: 1 }),
      fresh: () => js(inScope) === "[2,3]",
    });
  }
};
