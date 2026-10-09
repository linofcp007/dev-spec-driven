"use strict";
// Evidence — 1.25.1 review 7 (engine core): an _Expect: fail_ task re-run into a crash is unverified, a syntactically incomplete command (`npm test &&`) proves no _Verify:_.
// (09-evidence.js holds the evidence area's earlier tests; this file the engine-core findings of the seventh review.)

const fs = require("fs");
const path = require("path");

exports.run = async ({ ok, S, tmp, require }) => {
  const js = JSON.stringify;
  const E = require("./lib/engine/index.js");
  const REQ = "# Feature: x\n\n## Summary\nExport invoices as CSV.\n\n### US-1 (P1 — MVP): Export\n#### Acceptance Criteria (EARS)\n" +
    "1. **US-1.AC-1** — WHEN an admin clicks Export THE SYSTEM SHALL download a CSV.\n2. **US-1.AC-2** — IF the export fails THEN THE SYSTEM SHALL show the error code.\n\n" +
    "## Success Criteria\n- **SC-001** — 95% of exports finish in under 5 s.\n\n## Out of Scope\n- PDF export.\n";
  const feature = (n, tasks) => {
    const p = path.join(tmp, "proj-r7e-" + n);
    S.initProject(p, ["core"], "en");
    const f = S.createFeature(p, "Export", ["core"]);
    fs.writeFileSync(path.join(f.dir, "requirements.md"), REQ);
    fs.writeFileSync(path.join(f.dir, "tasks.md"), tasks);
    return { p, f };
  };

  // Finding 3 — expectFailIssue treated only a could-not-run record as a failed re-check: a re-run of an _Expect: fail_ task that
  // CRASHED (exit 139, an access violation 0xC0000005 — unsigned or signed) fell through to the red run carried forward, so the task
  // stayed verified and finish didn't block. A crash is a failed re-check now, like a could-not-run run.
  {
    const TASKS = "# Tasks\n\n- [ ] 1. [US1] Write the failing test for the export\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n  - _Verify: node tests/export.test.js_\n  - _Expect: fail_\n";
    const got = [];
    for (const code of [139, 0xC0000005, 0xC0000005 - 0x100000000, 134]) {
      const { p, f } = feature("xf-crash-" + (code < 0 ? "neg" : code), TASKS);
      const red = S.completeTask(p, f.slug, 1, { command: "node tests/export.test.js", exitCode: 1, summary: "AssertionError: expected 1 to equal 2" });
      const before = S.verificationStatus(p, f.slug, f.dir).unverifiedDetail;
      const fin0 = S.finishFeature(p, f.slug);
      const again = S.completeTask(p, f.slug, 1, { command: "node tests/export.test.js", exitCode: code, summary: "Segmentation fault (core dumped)" });
      const vs = S.verificationStatus(p, f.slug, f.dir);
      const fin = S.finishFeature(p, f.slug);
      got.push({ code, red: red.ok && red.verified, before, again: again.couldNotRun, after: vs.unverifiedDetail, blocked: (fin.blockers || []).some((b) => /verif/i.test(b)) && !(fin0.blockers || []).some((b) => /verif/i.test(b)), blockers: fin.blockers });
    }
    ok(got.every((g) => g.red && js(g.before) === "[]" && g.again === "crash" && js(g.after) === '[{"number":1,"reason":"failed-run"}]' && g.blocked),
      "1.25.1 review 7: an _Expect: fail_ task whose re-run crashed (139, 0xC0000005 unsigned / signed, 134) is unverified (failed-run) and blocks finish — the red run carried forward no longer covers it (got " + js(got) + ")");
  }

  // Finding 8 — a reported run `npm test &&` (a dangling operator) proved `npm test`: proofSteps dropped the empty step. A command no
  // shell runs as written (an operator with no command after / before it, or two in a row) proves no _Verify:_ now.
  {
    const TASKS = "# Tasks\n\n- [ ] 1. [US1] Build the export\n  - _Requirements: US-1.AC-1_\n  - _Verify: npm test_\n" +
      "- [ ] 2. [US1] Show the error code\n  - _Requirements: US-1.AC-2_\n  - _Verify: npm test_\n";
    const { p, f } = feature("incomplete", TASKS);
    const c1 = S.completeTask(p, f.slug, 1, { command: "npm test &&", exitCode: 0, summary: "12 passing" });
    const c2 = S.completeTask(p, f.slug, 2, { command: "npm test", exitCode: 0, summary: "12 passing" });
    const vs = S.verificationStatus(p, f.slug, f.dir);
    const inc = ["npm test &&", "npm test ||", "npm test |", "&& npm test", "a && && b", "a; && b", "a | ; b"].map((c) => E.proofIncomplete(c));
    const fine = ["npm test", "npm test && npm run lint", "npm test | tee log.txt", "npm test;", "; npm test", "npm test 2>&1", "a |& b",
      "node -e \"a &&\"", "cmd /c \"npm test &&\"", "echo $(a && b)", "npm test &"].map((c) => E.proofIncomplete(c));
    ok(c1.ok && c2.ok && js(vs.unverifiedDetail.map((d) => d.number)) === "[1]" && vs.unverifiedDetail[0].reason === "command-mismatch" &&
      inc.every(Boolean) && !fine.some(Boolean) &&
      E.runProvesVerify({ command: "npm test &&", exitCode: 0 }, ["npm test"], p) === false && E.runProvesVerify({ command: "npm test", exitCode: 0 }, ["npm test"], p) === true,
      "1.25.1 review 7: a run reported as `npm test &&` (or `npm test |`, `&& npm test`, `a && && b`) proves no _Verify:_ — the task ticks but stays unverified (command-mismatch); quoted operators, a trailing `;` / `&`, a pipe and a substitution are complete commands (got " +
      js([c1.ok, c2.ok, vs.unverifiedDetail, inc, fine]) + ")");
  }
};
