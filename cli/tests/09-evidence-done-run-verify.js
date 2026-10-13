"use strict";
// `done --run` / `--cmd` and what a run proves — another command (command-mismatch), several _Verify:_ commands, a run that ran no test.

const fs = require("fs");
const path = require("path");

// 1.30 (review 8, ds-maint 2): split from 09-evidence-done-run.js by topic — the one file ran 37 `done --run` processes in a row
// (the CLI suite's critical path, ~55 s).
exports.run = ({ ok, all, run, runIn, tmp, require, __dirname }) => {
// 1.22 review (finding 1): `done --cmd <another command> --exit 0` ticks the task WITHOUT "(verified)" and says why
// (command-mismatch); `--run` (the CLI runs the _Verify:_ itself) verifies.
const cm = path.join(tmp, "122-cmd-mismatch");
fs.mkdirSync(cm, { recursive: true }); // 1.23 review: --project names an existing folder (only init creates one)
runIn(["create", "Proof", "core", "--project", cm]);
fs.writeFileSync(path.join(cm, ".specs", "proof", "tasks.md"), "- [ ] 1. a\n  - _Verify: node -e \"process.exit(0)\"_\n- [ ] 2. b\n  - _Verify: node -e \"process.exit(0)\"_\n");
const cm1 = runIn(["done", "proof", "1", "--cmd", "echo hello", "--exit", "0", "--project", cm]);
const cm1j = JSON.parse(runIn(["done", "proof", "1", "--cmd", "echo hello", "--exit", "0", "--json", "--project", cm]).out);
const cm2 = run(["done", "proof", "2", "--run", "--project", cm]);
ok(cm1.code === 0 && /Task 1 done\. 1\/2/.test(cm1.out) && !/\(verified\)/.test(cm1.out) && /is not a run of its _Verify:_ command/.test(cm1.out) &&
  cm1j.verified === false && cm1j.unverifiedReason === "command-mismatch" && cm2.code === 0 && /Task 2 done \(verified\)/.test(cm2.out),
  "1.22 review: done --cmd \"echo hello\" --exit 0 on a task whose _Verify:_ is another command ticks it unverified (no '(verified)', the command-mismatch note; --json: unverifiedReason command-mismatch); done --run verifies (got " +
  JSON.stringify([cm1.out, cm1j.unverifiedReason, cm2.out]) + ")");

// 1.22 review 2: a run must cover EVERY _Verify:_ command of a task (one of two verified it) — `done --run` on a task with two of
// them, and on a Windows-path _Verify:_ (`node t\ok.js` under cmd.exe; `node t/ok.js` elsewhere), records a run the rule accepts:
// verified, and the recorded command proves the task on its own too (without the "cli" stamp); `--cmd` with one of the two does not.
const SR2 = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
const dm = path.join(tmp, "122r2-done-run-multi");
fs.mkdirSync(dm, { recursive: true }); // 1.23 review: --project names an existing folder (only init creates one)
runIn(["create", "Multi", "core", "--project", dm]);
fs.mkdirSync(path.join(dm, "t"), { recursive: true });
fs.writeFileSync(path.join(dm, "t", "ok.js"), "process.exit(0)\n");
const winPath = process.platform === "win32" ? "node t" + String.fromCharCode(92) + "ok.js" : "node t/ok.js";
fs.writeFileSync(path.join(dm, ".specs", "multi", "tasks.md"), "- [ ] 1. a\n  - _Verify: node -e \"process.exit(0)\"_\n  - _Verify: node --version_\n" +
  "- [ ] 2. b\n  - _Verify: " + winPath + "_\n  - _Verify: node --version_\n- [ ] 3. c\n  - _Verify: node -e \"process.exit(0)\"_\n  - _Verify: node --version_\n");
// (runIn() hands back stdout and stderr together: the JSON document, then the commands it ran)
const dmJ = (n) => { const r = run(["done", "multi", n, "--run", "--json", "--project", dm]); try { return JSON.parse(r.out.slice(0, r.out.indexOf("\n}") + 2)); } catch { return { raw: r.out }; } };
const dm1 = dmJ("1"), dm2 = dmJ("2");
const dm3 = JSON.parse(runIn(["done", "multi", "3", "--cmd", "node --version", "--exit", "0", "--json", "--project", dm]).out);
const evDm = JSON.parse(fs.readFileSync(path.join(dm, ".specs", "multi", ".state.json"), "utf8")).evidence;
const vDm = (n) => SR2.taskBrief(dm, "multi", n).verify;
ok(dm1.ok && dm1.verified === true && dm2.ok && dm2.verified === true && evDm["1"].observed === "cli" &&
  SR2.runProvesVerify({ command: evDm["1"].command }, vDm(1)) && SR2.runProvesVerify({ command: evDm["2"].command }, vDm(2)) &&
  dm3.verified === false && dm3.unverifiedReason === "command-mismatch",
  "1.22 review 2: done --run on a task with two _Verify:_ commands and on a Windows-path _Verify:_ verifies it, and the command it records (the commands joined) proves the task on its own; done --cmd with one of the two is command-mismatch (got " +
  JSON.stringify([dm1, dm2, evDm["1"] && evDm["1"].command, evDm["2"] && evDm["2"].command, dm3.unverifiedReason]) + ")");
// 1.23 review: a task with several _Verify:_ commands, all passing, keeps one summary per command ("$ <command>" + its output) —
// the record kept the LAST command's summary alone; four noisy ones are each cut to fit the record's 2,000 characters.
fs.writeFileSync(path.join(dm, "t", "noisy.js"), "const n = process.argv[2];\nfor (let i = 0; i < 400; i++) console.log('run ' + n + ' line ' + i + ' ' + 'x'.repeat(120));\nconsole.log('# pass ' + n);\n");
fs.appendFileSync(path.join(dm, ".specs", "multi", "tasks.md"), "- [ ] 4. d\n" + [1, 2, 3, 4].map((n) => "  - _Verify: node t/noisy.js " + n + "_\n").join(""));
const dm4 = dmJ("4");
const evDm2 = JSON.parse(fs.readFileSync(path.join(dm, ".specs", "multi", ".state.json"), "utf8")).evidence;
const sm1 = String((evDm2["1"] && evDm2["1"].summary) || ""), sm4 = String((evDm2["4"] && evDm2["4"].summary) || "");
ok(/^\$ node -e "process\.exit\(0\)"$/m.test(sm1) && /^\$ node --version\r?\nv\d+\.\d+\.\d+/m.test(sm1) &&
  dm4.ok && dm4.verified === true && sm4.length <= 2000 && [1, 2, 3, 4].every((n) => sm4.includes("$ node t/noisy.js " + n) && sm4.includes("# pass " + n)),
  "1.23 review: done --run with several _Verify:_ commands records one summary per command (its command line + its output, the count line kept), within 2,000 characters (got " +
  JSON.stringify([sm1, sm4.length, sm4.split("\n").filter((l) => /^\$ |# pass/.test(l))]) + ")");

// 1.24 r6 D4 / D5 / D8: done --run refuses a PASS that ran no test (node --test on a file with no test: "tests 0" — couldNotRun
// no-tests), and, on an _Expect: fail_ task, a test file that doesn't parse (node's SyntaxError, TAP or spec reporter) or a runner
// that isn't there (python -m's "No module named") — nothing recorded; a real run of a real test still verifies.
{
  const vp = path.join(tmp, "r6-done-run-vacuous");
  fs.mkdirSync(path.join(vp, "tests"), { recursive: true });
  runIn(["create", "Vac", "core", "--project", vp]);
  fs.writeFileSync(path.join(vp, "tests", "syn.test.js"), "const t = require('node:test');\nt.test('T-01', () => { let x = ; });\n");
  fs.writeFileSync(path.join(vp, "tests", "real.test.js"), "const t = require('node:test');\nt.test('T-02', () => {});\n");
  // (task 1: a runner's own zero-count summary — node --test prints "# tests 0" when its glob matches no file; Node 18 / 20 have no
  // globs, so the line is printed directly)
  fs.writeFileSync(path.join(vp, ".specs", "vac", "tasks.md"), "- [ ] 1. Empty suite\n  - _Verify: node -e \"console.log('# tests 0'); console.log('# pass 0')\"_\n" +
    "- [ ] 2. Write the failing test T-01\n  - _Verify: node --test tests/syn.test.js_\n  - _Expect: fail_\n" +
    "- [ ] 3. Write the failing test T-03\n  - _Verify: node -e \"console.error('/usr/bin/python3: No module named pytest'); process.exit(1)\"_\n  - _Expect: fail_\n" +
    "- [ ] 4. Real test\n  - _Verify: node --test tests/real.test.js_\n");
  const vj = (n) => { const r = run(["done", "vac", n, "--run", "--json", "--project", vp]); try { return Object.assign(JSON.parse(r.out.slice(0, r.out.indexOf("\n}") + 2)), { code: r.code }); } catch { return { raw: r.out, code: r.code }; } };
  const v1 = vj("1"), v2 = vj("2"), v3 = vj("3"), v4 = vj("4");
  const stFile = path.join(vp, ".specs", "vac", ".state.json");
  const st = fs.existsSync(stFile) ? JSON.parse(fs.readFileSync(stFile, "utf8")) : {};
  const ev = st.evidence || {};
  const tasksNow = fs.readFileSync(path.join(vp, ".specs", "vac", "tasks.md"), "utf8");
  all("1.24 r6 D4 / D5 / D8: done --run refuses a pass that ran no test (no-tests), a red run of a test file that doesn't parse and of a runner that isn't there (output) — nothing recorded, tasks open; a real test verifies (got " +
    JSON.stringify([v1, v2.couldNotRun, (v2.error || v2.raw || "").slice(0, 120), v3.couldNotRun, v4.verified, Object.keys(ev)]) + ")", [
    () => v1.code === 1, () => v1.couldNotRun === "no-tests", () => /tests 0/.test(v1.error), () => v2.code === 1, () => v2.couldNotRun === "output",
    () => /SyntaxError/.test(v2.error), () => v3.code === 1, () => v3.couldNotRun === "output", () => /No module named pytest/.test(v3.error),
    () => v4.code === 0, () => v4.verified === true, () => !ev["1"], () => !ev["2"], () => !ev["3"],
    () => /- \[ \] 1\.[\s\S]*- \[ \] 2\.[\s\S]*- \[ \] 3\.[\s\S]*- \[x\] 4\./.test(tasksNow),
  ]);
}
};
