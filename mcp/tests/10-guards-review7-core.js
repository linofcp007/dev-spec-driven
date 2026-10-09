"use strict";
// Guards and hooks — 1.25.1 review 7 (engine core): the spec-implementer's stop gate reads exit codes per run (the _Verify:_ command's own runs, the last one deciding).
// (10-guards.js holds the guards area's earlier tests; this file the engine-core findings of the seventh review.)

const fs = require("fs");
const path = require("path");

exports.run = async ({ ok, S, tmp }) => {
  const js = JSON.stringify;
  const p = path.join(tmp, "proj-r7gd-impl");
  S.initProject(p, ["core"], "en");
  const f = S.createFeature(p, "Export", ["core"]);
  fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n" +
    "- [ ] 1. [US1] Build the CSV export\n  - _Verify: npm test_\n" +
    "- [ ] 2. [US1] Write T-01 red\n  - _Verify: npm test_\n  - _Expect: fail_\n" +
    "- [ ] 3. [US1] Lint and test\n  - _Verify: npm test_\n  - _Verify: npm run lint_\n" +
    "- [ ] 4. [US1] Smoke\n  - _Verify: node -e \"process.exit(0)\"_\n");
  fs.mkdirSync(path.join(f.dir, ".execution"), { recursive: true });
  const stop = (n, report) => {
    fs.writeFileSync(path.join(f.dir, ".execution", "task-" + n + "-report.md"), report);
    const r = S.stopCheck(p, { message: "Status: DONE\nReport: .specs/" + f.slug + "/.execution/task-" + n + "-report.md", agent: "dev-spec-driven:spec-implementer" });
    return r.why + (r.block ? ": " + (r.reason || "").split("\n")[0].replace(/^.*?DONE, but /, "") : "");
  };

  // Finding 4 — any exit 0 anywhere in the report passed the gate: "Ran `npm test` → exit code: 1 … Ran `npm run lint` → exit code: 0"
  // + DONE was report-ok. The codes are read per run now — the _Verify:_ command's own runs, the last one deciding.
  {
    const got = {
      lintPassed: stop(1, "# Task 1 report\n\nRan `npm test` → exit code: 1 (2 failing: export.test.js)\n\nRan `npm run lint` → exit code: 0\n"),
      redThenGreen: stop(1, "# Task 1\n\nRED: `npm test` → exit code: 1\nGREEN: `npm test` → exit 0\n"),
      greenThenRed: stop(1, "# Task 1\n\n`npm test` → exit 0 (12 passing)\n\nAfter the refactor:\n\n`npm test` → exit code: 1 (1 failing)\n"),
      transcript: stop(1, "# Task 1\n\n```\n$ npm test\n  12 passing\n```\nexit code: 0\n"),
      codeFirst: stop(1, "# Task 1\n\nexit 0 from `npm test` (12 passing); `npm run lint` → exit code: 2\n"),
      codeSpan: stop(1, "# Task 1\n\n- `npm test` → `exit 0` (12 passing)\n"),
      dangling: stop(1, "# Task 1\n\nRan `npm test &&` → exit 0\n"),
      xfRed: stop(2, "# Task 2\n\n`npm test` → exit code: 1 (AssertionError: expected 'A')\n"),
      xfGreenLast: stop(2, "# Task 2\n\n`npm test` → exit code: 1 (AssertionError)\n\n`npm test` → exit 0\n"),
      twoCmdsOneFails: stop(3, "# Task 3\n\n`npm run lint` → exit code: 1\n\n`npm test` → exit 0\n"),
      twoCmdsBoth: stop(3, "# Task 3\n\n`npm test` → exit 0\n`npm run lint` → exit 0\n"),
      cmdOnly: stop(4, "# Task 4\n\nRan `node -e \"process.exit(0)\"`.\n"),
      cmdRan: stop(4, "# Task 4\n\nRan `node -e \"process.exit(0)\"` → exit 0\n"),
    };
    ok(/^implementer-evidence: its report .* shows no passing run \(exit 0\) of `npm test`/.test(got.lintPassed) && got.redThenGreen === "report-ok" &&
      /^implementer-evidence: its report .* ends on a failing run of `npm test`/.test(got.greenThenRed) && got.transcript === "report-ok" && got.codeFirst === "report-ok" &&
      got.codeSpan === "report-ok" && /^implementer-evidence: its report .* doesn't show the _Verify:_ run/.test(got.dangling) && got.xfRed === "report-ok" &&
      /^implementer-evidence: its report .* ends on a passing run of `npm test` — the task is marked _Expect: fail_/.test(got.xfGreenLast) &&
      /^implementer-evidence: its report .* of `npm run lint`/.test(got.twoCmdsOneFails) && !/`npm test`/.test(got.twoCmdsOneFails) && got.twoCmdsBoth === "report-ok" &&
      /^implementer-evidence: its report .* doesn't show the _Verify:_ run/.test(got.cmdOnly) && got.cmdRan === "report-ok",
      "1.25.1 review 7: the implementer's gate reads exit codes per run — another command's exit 0 never passes a failing _Verify:_ run, the last run decides (red then green passes, green then red doesn't; _Expect: fail_ the reverse), each _Verify:_ command needs its own run, a code may precede its command or sit in a transcript below it, `npm test &&` is no run of `npm test`, and `process.exit(0)` inside a command is no exit code (got " +
      js(got) + ")");
  }
  {
    const pt = S.msg("pt").stopGate.implementer, es = S.msg("es").stopGate.implementer, br = S.msg("pt-BR").stopGate.implementer;
    ok([pt, es, br].every((m) => typeof m.lastNotPassing === "function" && typeof m.lastNotFailing === "function") && /^o relatório \(r\) termina/.test(pt.lastNotPassing("r", "`x`")) &&
      /^su informe \(r\) termina/.test(es.lastNotFailing("r", "`x`")),
      "1.25.1 review 7: the implementer gate's last-run messages exist in EN / PT / pt-BR / ES");
  }
};
