"use strict";
// append-tasks takes the EC / NFR / SC IDs requirements.md writes; trace resolves _Implements:_ globs (CLI = MCP).

const fs = require("fs");
const path = require("path");

exports.run = ({ ok, run, tmp, require, __dirname }) => {
  const S12 = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const p12 = path.join(tmp, "wp12-proj");
  run(["init", "core", "--project", p12]);
  run(["create", "Login", "core", "--project", p12]);
  const f12 = path.join(p12, ".specs", "login");
  const tasks12 = path.join(f12, "tasks.md");
  fs.writeFileSync(path.join(f12, "requirements.md"), "## Acceptance Criteria\n1. **US-1.AC-1** — WHEN a user signs in THE SYSTEM SHALL create a session\n\n" +
    "## Edge Cases\n- **EC-2** — a locked account is refused.\n\n```md\n- **EC-7** — an example in a fence\n2. **US-1.AC-9** — WHEN x THE SYSTEM SHALL y\n```\n");
  fs.writeFileSync(tasks12, "# Tasks\n\n## Phase: Build\n- [x] 1. [US1] Sessions\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/**/*.js_\n");
  fs.mkdirSync(path.join(p12, "src", "auth"), { recursive: true });
  fs.writeFileSync(path.join(p12, "src", "auth", "session.js"), "x\n");
  const ap12 = run(["append-tasks", "login", "--task", "Lock the account", "--req", "US-1.AC-1,ec-2", "--project", p12]);
  const bad12 = run(["append-tasks", "login", "--task", "x", "--req", "EC-7", "--project", p12]);
  ok(ap12.code === 0 && fs.readFileSync(tasks12, "utf8").includes("- [ ] 2. Lock the account\n  - _Requirements: US-1.AC-1, EC-2_\n") &&
    bad12.code === 1 && /Unknown acceptance criteria \(not in requirements\.md\): EC-7\./.test(bad12.out),
    "append-tasks --req accepts an EC ID requirements.md writes (ec-2 → EC-2); one written only inside a fenced example is refused (exit 1)");
  const tr12 = run(["trace", "login", "--project", p12]);
  ok(tr12.code === 0 && /verdict=pass {2}ACs=1 /.test(tr12.out) && !/src\/\*\*/.test(tr12.out) && !/EC-2/.test(tr12.out),
    "trace: a glob that matches a file (src/**/*.js) is present, a fenced AC is not required, EC-2 is covered — exit 0");
  fs.appendFileSync(tasks12, "- [x] 3. [US1] Web\n  - _Implements: web/**/*.ts_\n- [ ] 4. [US1] Jobs\n  - _Implements: jobs/*.js_\n");
  const tr12b = run(["trace", "login", "--project", p12]);
  let tr12j = null;
  try { tr12j = JSON.parse(run(["trace", "login", "--json", "--project", p12]).out); } catch { /* invalid JSON */ }
  ok(tr12b.code === 1 && /_Implements:_ files that don't exist: web\/\*\*\/\*\.ts$/m.test(tr12b.out) && !/jobs\/\*\.js/.test(tr12b.out) &&
    tr12j && JSON.stringify(tr12j) === JSON.stringify(S12.traceCheck(p12, "login")) && tr12j.plannedImplFiles.join() === "jobs/*.js",
    "trace: a done task's glob that matches nothing is a missing file (exit 1); an open task's is planned; --json = trace_check");
};
