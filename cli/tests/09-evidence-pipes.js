"use strict";
// A _Verify:_ that pipes reports the pipeline's LAST exit code — done --run's hint, brief and doctor.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = ({ ok, run, tmp, CLI, require, __dirname }) => {
// A4.2 — a _Verify:_ that pipes reports the pipeline's LAST exit code. `done --run` prints ONE localized hint before running
// (it still runs — here the failing first command is masked, so the task ticks: exactly the problem), then the engine's
// pipeMasked note. A quoted '|' and '||' get no hint. Brief and doctor name the piped tasks. Commands run in cmd.exe and sh alike.
const Sa4 = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
const pa4 = path.join(tmp, "pa4-proj");
Sa4.initProject(pa4, ["core"], "en");
const fa4 = Sa4.createFeature(pa4, "Pipes", ["core"], "", undefined, "en");
const tasksA4 = path.join(fa4.dir, "tasks.md");
fs.writeFileSync(tasksA4, "# Tasks\n\n" +
  "- [ ] 1. [US1] Masked failure\n  - _Verify: node -e \"process.exit(3)\" | node -e \"process.exit(0)\"_\n" +
  "- [ ] 2. [US1] Quoted pipe\n  - _Verify: node -e \"console.log('a|b')\"_\n" +
  "- [ ] 3. [US1] Or-chain\n  - _Verify: node -e \"process.exit(0)\" || node -e \"process.exit(1)\"_\n" +
  "- [ ] 4. [US1] JSON run\n  - _Verify: node -e \"process.exit(0)\" | node -e \"process.exit(0)\"_\n");
const ra4 = (args) => run([...args, "--project", pa4]);
const hintRe = /pipes into another command: the shell reports only the LAST command's exit code/;
const brA4 = ra4(["brief", "pipes", "4"]);
const brQA4 = ra4(["brief", "pipes", "2"]);
const docA4 = ra4(["doctor", "pipes"]);
ok(brA4.code === 0 && /## Verification \(_Verify:_\)[\s\S]*pipes into another command: a pipeline's exit code is its LAST command's/.test(brA4.out) && brQA4.code === 0 && !/pipes into another/.test(brQA4.out) &&
  /▲ verify-pipes — a _Verify:_ command pipes into another one .*: #1 `node -e "process\.exit\(3\)" \| node -e "process\.exit\(0\)"`; #4 /.test(docA4.out) && !/#2 |#3 /.test((docA4.out.match(/verify-pipes.*/) || [""])[0]),
  "brief notes a piped _Verify:_ (not a quoted '|'); doctor prints the verify-pipes warn naming #1 and #4 only (got " + JSON.stringify((docA4.out.match(/.*verify-pipes.*/) || [""])[0].slice(0, 300)) + ")");
const d1A4 = ra4(["done", "pipes", "1", "--run"]);
const hintAt = d1A4.out.search(hintRe), runAt = d1A4.out.indexOf("$ node -e");
ok(d1A4.code === 0 && hintAt >= 0 && runAt > hintAt && d1A4.out.split("\n").filter((l) => hintRe.test(l)).length === 1 && /Task 1 done \(verified\)/.test(d1A4.out) &&
  /⚠ Task 1: the recorded command pipes into another one/.test(d1A4.out) && /- \[x\] 1\. \[US1\] Masked failure/.test(fs.readFileSync(tasksA4, "utf8")),
  "done --run on a piped _Verify:_: one hint line BEFORE the run (it still runs — the masked failure ticks the task), then the pipeMasked note (got " + JSON.stringify(d1A4.out.slice(0, 400)) + ")");
const d2A4 = ra4(["done", "pipes", "2", "--run"]);
const d3A4 = ra4(["done", "pipes", "3", "--run"]);
ok(d2A4.code === 0 && d3A4.code === 0 && !/pipes into another/.test(d2A4.out + d3A4.out) && /a\|b/.test(d2A4.out),
  "done --run: a '|' inside quotes and '||' print no pipe hint and no pipeMasked note (got " + JSON.stringify([d2A4.out.slice(0, 200), d3A4.out.slice(0, 200)]) + ")");
const jA4 = spawnSync(process.execPath, [CLI, "done", "pipes", "4", "--run", "--json", "--project", pa4], { encoding: "utf8", env: { ...process.env, SPEC_PROJECT_DIR: tmp } });
let jA4r = null;
try { jA4r = JSON.parse(jA4.stdout); } catch { /* invalid JSON */ }
ok(jA4.status === 0 && jA4r && jA4r.pipeMasked === true && jA4r.completed === 4 && hintRe.test(jA4.stderr) && !hintRe.test(jA4.stdout),
  "done --run --json: stdout stays one JSON document carrying pipeMasked: true; the hint goes to stderr");
// PT feature: the hint and the note in Portuguese.
const ptA4 = Sa4.createFeature(pa4, "Tubos", ["core"], "", undefined, "pt");
fs.writeFileSync(path.join(ptA4.dir, "tasks.md"), "# Tarefas\n\n- [ ] 1. [US1] Pipe\n  - _Verify: node -e \"process.exit(0)\" | node -e \"process.exit(0)\"_\n");
const dPtA4 = ra4(["done", "tubos", "1", "--run"]);
ok(dPtA4.code === 0 && /⚠ `node -e "process\.exit\(0\)" \| node -e "process\.exit\(0\)"` encaminha a saída para outro comando \(pipe\): a shell só reporta o exit code do ÚLTIMO comando/.test(dPtA4.out) &&
  /⚠ Tarefa 1: o comando registado encaminha a saída para outro/.test(dPtA4.out),
  "done --run on a PT feature: the pipe hint and the pipeMasked note are in Portuguese (got " + JSON.stringify(dPtA4.out.slice(0, 300)) + ")");
};
