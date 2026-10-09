"use strict";
// append-tasks <feature> --task … — one task per call, the same engine call as spec_append_tasks.

const fs = require("fs");
const path = require("path");

// 1.13 WP7: append-tasks <feature> --task … — one task per call, same engine call as spec_append_tasks.
exports.run = ({ ok, run, runIn, tmp, require, __dirname }) => {
  const S7 = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const mk7 = (dir, crlf) => {
    runIn(["init", "tdd", "--project", dir]);
    runIn(["create", "Conv", "tdd", "--project", dir]);
    const f = path.join(dir, ".specs", "conv");
    const eol = crlf ? "\r\n" : "\n";
    fs.writeFileSync(path.join(f, "requirements.md"), ["## Acceptance Criteria", "1. **US-1.AC-1** — WHEN a THE SYSTEM SHALL b", "2. **US-1.AC-2** — WHEN c THE SYSTEM SHALL d", ""].join(eol));
    fs.writeFileSync(path.join(f, "tasks.md"), ["# Tasks: Conv", "", "## Story US-1 (P1 — MVP)", "- [x] 1. [US1] Core", "  - _Requirements: US-1.AC-1_", "**Checkpoint:** US-1 works.", ""].join(eol));
    return f;
  };
  const w7 = path.join(tmp, "wp7-proj");
  const w7f = mk7(w7);
  runIn(["approve", "conv", "tasks", "--force", "--project", w7]); // template tasks: forced past the approve gate
  const verify7 = 'node -e "process.exit(0)"';
  const a1 = runIn(["append-tasks", "conv", "--task", "Fix the parser", "--req", "US-1.AC-2", "--implements", "src\\parser.js", "--verify", verify7, "--story", "US1", "--parallel", "--project", w7]);
  const a2 = runIn(["append-tasks", "conv", "--task", "Fix the writer", "--req", "us-1.ac-1,US-1.AC-2", "--implements", "src/writer.js", "--parallel", "--story", "US1", "--project", w7]);
  const t7 = fs.readFileSync(path.join(w7f, "tasks.md"), "utf8");
  ok(a1.code === 0 && /Appended to tasks\.md → 'Phase: Convergence' \(new phase\):/.test(a1.out) && /- \[ \] 2\. \[US1\]\[P\] Fix the parser/.test(a1.out) &&
    /⚠ tasks\.md changed after its approval — .*\/approve conv tasks/.test(a1.out) && a2.code === 0 && !/new phase/.test(a2.out) &&
    t7.endsWith("\n## Phase: Convergence\n- [ ] 2. [US1][P] Fix the parser\n  - _Requirements: US-1.AC-2_\n  - _Implements: src/parser.js_\n  - _Verify: " + verify7 + "_\n" +
      "- [ ] 3. [US1][P] Fix the writer\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n  - _Implements: src/writer.js_\n**Checkpoint:** the convergence tasks are done and verified — the spec and the code agree again.\n"),
    "append-tasks appends one task per call under 'Phase: Convergence' (the second joins the same phase), with the re-approval warning");
  ok(/parallel batch: #2 \[src\/parser\.js\]  #3 \[src\/writer\.js\]/.test(runIn(["next", "conv", "--batch", "--project", w7]).out) &&
    /# Task brief — conv · task 2/.test(runIn(["brief", "conv", "2", "--project", w7]).out) && /Task 2 done \(verified\)/.test(run(["done", "conv", "2", "--run", "--project", w7]).out),
    "appended tasks drive next --batch, brief and done --run (their _Verify:_ runs and verifies)");
  // CLI --json ≡ spec_append_tasks on an identical project (same result object).
  const w7b = path.join(tmp, "wp7-proj-b");
  mk7(w7b);
  let aj = null;
  try { aj = JSON.parse(runIn(["append-tasks", "conv", "--task", "Same thing", "--req", "US-1.AC-2", "--implements", "a.js,b.js", "--json", "--project", w7b]).out); } catch { /* invalid JSON */ }
  const w7c = path.join(tmp, "wp7-proj-c");
  mk7(w7c);
  ok(aj && JSON.stringify(aj) === JSON.stringify(S7.appendTasks(w7c, "conv", [{ text: "Same thing", requirements: ["US-1.AC-2"], implements: ["a.js,b.js"] }])) && aj.appended[0].implements.join() === "a.js,b.js",
    "append-tasks --json returns exactly what spec_append_tasks returns");
  // Errors: phantom AC (nothing written), two --task, no --task.
  const before7 = fs.readFileSync(path.join(w7f, "tasks.md"), "utf8");
  const ph7 = runIn(["append-tasks", "conv", "--task", "x", "--req", "US-1.AC-2,US-9.AC-1", "--project", w7]);
  const two7 = runIn(["append-tasks", "conv", "--task", "a", "--task", "b", "--project", w7]);
  const none7 = runIn(["append-tasks", "conv", "--project", w7]);
  const abs7 = runIn(["append-tasks", "conv", "--task", "x", "--implements", "../up.js", "--project", w7]);
  ok(ph7.code === 1 && /Unknown acceptance criteria \(not in requirements\.md\): US-9\.AC-1\. Nothing was written/.test(ph7.out) && two7.code === 1 && /one --task per call/.test(two7.out) &&
    none7.code === 1 && /usage: dev-spec append-tasks/.test(none7.out) && abs7.code === 1 && /without '\.\.'/.test(abs7.out) && fs.readFileSync(path.join(w7f, "tasks.md"), "utf8") === before7,
    "append-tasks errors (phantom AC, two --task, no --task, '..' path) exit 1 and write nothing");
  // CRLF tasks.md stays CRLF.
  const w7d = path.join(tmp, "wp7-crlf");
  const w7df = mk7(w7d, true);
  const crOrig7 = fs.readFileSync(path.join(w7df, "tasks.md"), "utf8");
  const cr7 = runIn(["append-tasks", "conv", "--task", "Keep CRLF", "--req", "US-1.AC-2", "--heading", "Story US-1 (P1 — MVP)", "--project", w7d]);
  const crNow7 = fs.readFileSync(path.join(w7df, "tasks.md"), "utf8");
  ok(cr7.code === 0 && !/new phase/.test(cr7.out) && !/[^\r]\n/.test(crNow7) &&
    crNow7 === crOrig7.replace("**Checkpoint:** US-1 works.", "- [ ] 2. Keep CRLF\r\n  - _Requirements: US-1.AC-2_\r\n**Checkpoint:** US-1 works."),
    "append-tasks --heading on a CRLF tasks.md: the task lands before that phase's checkpoint, every line stays CRLF");
  // PT project: localized output and heading.
  const pt7 = path.join(tmp, "wp7-pt");
  runIn(["init", "--lang", "pt", "--project", pt7]);
  runIn(["create", "Pagamentos", "core", "--project", pt7]);
  const ptOut7 = runIn(["append-tasks", "pagamentos", "--task", "Corrigir o desvio", "--req", "US-1.AC-1", "--project", pt7]);
  ok(ptOut7.code === 0 && /Acrescentado a tasks\.md → 'Fase: Convergência' \(nova fase\):/.test(ptOut7.out) &&
    /\n## Fase: Convergência\n- \[ \] \d+\. Corrigir o desvio\n  - _Requirements: US-1\.AC-1_\n\*\*Checkpoint:\*\* as tarefas/.test(fs.readFileSync(path.join(pt7, ".specs", "pagamentos", "tasks.md"), "utf8")) &&
    /Critérios de aceitação desconhecidos/.test(runIn(["append-tasks", "pagamentos", "--task", "x", "--req", "US-8.AC-8", "--project", pt7]).out),
    "append-tasks (PT): 'Fase: Convergência', localized output and errors");
  // Repeated --req / --implements (both spellings) are all kept — the shared parser alone kept only the last one.
  const w7e = path.join(tmp, "wp7-rep");
  const w7ef = mk7(w7e);
  const rep7 = runIn(["append-tasks", "conv", "--task", "rep req", "--req", "US-1.AC-1", "--req=US-1.AC-2", "--implements", "a.js", "--implements=b.js", "--json", "--project", w7e]);
  let repJ = null;
  try { repJ = JSON.parse(rep7.out); } catch { /* invalid JSON */ }
  const repPh = runIn(["append-tasks", "conv", "--task", "x", "--req", "US-1.AC-1", "--req", "US-9.AC-9", "--project", w7e]);
  const repTwo = runIn(["append-tasks", "conv", "--task=a", "--task", "b", "--project", w7e]);
  ok(rep7.code === 0 && repJ && repJ.appended[0].requirements.join() === "US-1.AC-1,US-1.AC-2" && repJ.appended[0].implements.join() === "a.js,b.js" &&
    fs.readFileSync(path.join(w7ef, "tasks.md"), "utf8").includes("- [ ] 2. rep req\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n  - _Implements: a.js, b.js_\n") &&
    repPh.code === 1 && /Unknown acceptance criteria \(not in requirements\.md\): US-9\.AC-9\./.test(repPh.out) && repTwo.code === 1 && /one --task per call/.test(repTwo.out),
    "append-tasks keeps every repeated --req / --implements (a phantom in any of them still refuses); --task=a --task b is still two tasks");
  // A command substitution at the end of --verify reads back intact (append-tasks --json and brief --json).
  const tick7 = runIn(["append-tasks", "conv", "--task", "check", "--verify", "test -n `echo ok`", "--json", "--project", w7e]);
  let tickJ = null, tickB = null;
  try { tickJ = JSON.parse(tick7.out); tickB = JSON.parse(runIn(["brief", "conv", String(tickJ.appended[0].number), "--json", "--project", w7e]).out); } catch { /* invalid JSON */ }
  ok(tick7.code === 0 && tickJ && tickJ.appended[0].verify === "test -n `echo ok`" && tickB && tickB.verify.join() === "test -n `echo ok`",
    "append-tasks --verify 'test -n `echo ok`': the stored command reads back exactly as given (what done --run would execute)");
  // A repeated --verify / --story / --heading (either spelling) is refused — never last-wins (a dropped check would
  // never be asked for by the evidence gate). Localized; nothing written.
  const repBefore = fs.readFileSync(path.join(w7ef, "tasks.md"), "utf8");
  const vTwice = runIn(["append-tasks", "conv", "--task", "two checks", "--verify", "npm test", "--verify=npm run lint", "--project", w7e]);
  const sTwice = runIn(["append-tasks", "conv", "--task", "x", "--story", "US1", "--story", "shared", "--project", w7e]);
  const hTwice = runIn(["append-tasks", "conv", "--task", "x", "--heading=Phase A", "--heading", "Phase B", "--project", w7e]);
  const vTwicePt = runIn(["append-tasks", "pagamentos", "--task", "x", "--verify", "a", "--verify", "b", "--project", pt7]);
  ok(vTwice.code === 1 && /takes --verify once per call — join the checks into one command/.test(vTwice.out) && sTwice.code === 1 && /--story once per call/.test(sTwice.out) &&
    hTwice.code === 1 && /--heading once per call/.test(hTwice.out) && vTwicePt.code === 1 && /aceita --verify uma só vez por chamada/.test(vTwicePt.out) &&
    fs.readFileSync(path.join(w7ef, "tasks.md"), "utf8") === repBefore,
    "append-tasks refuses a repeated --verify / --story / --heading (localized), writing nothing");
  const help7 = runIn(["help"]).out;
  const fin7 = help7.indexOf("finish <feature>");
  ok(fin7 !== -1 && help7.indexOf("append-tasks <feature>") > fin7 && help7.indexOf("append-tasks <feature>") < help7.indexOf("approve <feature>") &&
    ["--task", "--req", "--implements", "--verify", "--story", "--parallel", "--heading"].every((x) => help7.includes(x)),
    "help lists append-tasks right after finish, with every flag it reads");
};
