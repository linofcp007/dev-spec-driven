"use strict";
// The bugfix gate on the CLI (1.25.1 review 7) — a fix (_Makes green:_) written before the root-cause task is refused by done / done --run while bug.md → Root Cause is empty.

const fs = require("fs");
const path = require("path");

exports.run = ({ ok, run, tmp }) => {
  const p = path.join(tmp, "r7-bugorder-proj");
  run(["init", "core", "--project", p]);
  run(["bugfix", "Crash", "--summary", "crash on save", "--project", p]);
  const dir = path.join(p, ".specs", "crash");
  const ran = path.join(p, "ran-fix.txt");
  fs.writeFileSync(path.join(dir, "tasks.md"), "# Tasks: Crash\n\n## Phase: Fix\n" +
    "- [ ] 1. [US1] Write regression test T-01 and watch it fail\n  - _Requirements: US-1.AC-1_\n" +
    "- [ ] 2. [US1] Fix the crash in the save handler\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n  - _Makes green: T-01_\n" +
    "  - _Verify: node -e \"require('fs').writeFileSync('ran-fix.txt', 'x')\"_\n" +
    "- [ ] 3. [US1] Document the root cause in bug.md\n  - _Requirements: US-1.AC-1_\n");
  const t1 = run(["done", "crash", "1", "--project", p]);
  const t2 = run(["done", "crash", "2", "--project", p]);
  const t2run = run(["done", "crash", "2", "--run", "--project", p]);
  const tasks = fs.readFileSync(path.join(dir, "tasks.md"), "utf8");
  ok(t1.code === 0 && t2.code === 1 && /Task 2 can't be completed yet: bug\.md → Root Cause is not filled\. .*do task 3 first/.test(t2.out) &&
    t2run.code === 1 && /do task 3 first/.test(t2run.out) && !fs.existsSync(ran) && /- \[ \] 2\./.test(tasks),
    "1.25.1 review 7: done / done --run refuse a bugfix's fix (_Makes green:_) written BEFORE the root-cause task while Root Cause is empty — 'do task 3 first', nothing run, nothing ticked (got " +
    JSON.stringify([t1.code, t2.code, t2.out.slice(0, 200), t2run.code, fs.existsSync(ran)]) + ")");
};
