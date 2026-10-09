"use strict";
// `done --run` honours _Expect: fail_ (+ the git commit), init --check / finish --run (meta.checks), dev-spec log.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = ({ ok, all, tmp, CLI, require, __dirname }) => {
// B5 — `done --run` honours _Expect: fail_ (+ records the git commit), `init --check` / `finish --run` (meta.checks), `dev-spec log`.
// Commands run in cmd.exe and sh alike (node -e "…" in double quotes); git runs isolated from the user's config and is optional.
const Sb5 = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
const b5cfg = path.join(tmp, "b5-gitconfig");
fs.writeFileSync(b5cfg, "");
const b5Env = { ...process.env, SPEC_PROJECT_DIR: tmp, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: b5cfg, HOME: tmp, XDG_CONFIG_HOME: tmp,
  GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com" };
const rb5 = (args, input) => {
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", env: b5Env, input });
  return { out: (r.stdout || "") + (r.stderr || ""), stdout: r.stdout || "", stderr: r.stderr || "", code: r.status };
};
const gitB5 = (cwd, ...args) => spawnSync("git", args, { cwd, encoding: "utf8", env: b5Env });
const hasGitB5 = (() => { const g = gitB5(tmp, "--version"); return !g.error && g.status === 0; })();
const stB5 = (dir, slug) => JSON.parse(fs.readFileSync(path.join(dir, ".specs", slug, ".state.json"), "utf8"));
const jsonB5 = (s) => { try { return JSON.parse(s); } catch { return null; } };

// done --run: an _Expect: fail_ task's passing command is refused; a failing one is its red proof (a line says so; --json keeps one document).
const pb = path.join(tmp, "b5-cli");
Sb5.initProject(pb, ["tdd"], "en");
const fb = Sb5.createFeature(pb, "Redcli", ["tdd"], "", undefined, "en");
fs.writeFileSync(path.join(fb.dir, "tasks.md"), "- [ ] 1. [US1] Write T-01 red\n  - _Verify: node -e \"process.exit(0)\"_\n  - _Expect: fail_\n" +
  "- [ ] 2. [US1] Write T-02 red\n  - _Verify: node -e \"process.exit(3)\"_\n  - _Expect: fail_\n- [ ] 3. [US1] Must pass\n  - _Verify: node -e \"process.exit(0)\"_\n");
const dPass = rb5(["done", "redcli", "1", "--run", "--project", pb]);
const dRed = rb5(["done", "redcli", "2", "--run", "--project", pb]);
const dRedJ = rb5(["done", "redcli", "2", "--run", "--json", "--project", pb]);
const dRedJr = jsonB5(dRedJ.stdout);
const tasksB5 = fs.readFileSync(path.join(fb.dir, "tasks.md"), "utf8");
const ev2B5 = stB5(pb, "redcli").evidence["2"];
all("done --run on an _Expect: fail_ task: a passing _Verify:_ is refused (task stays open), a failing one ticks it as the red proof with a line saying so; --json keeps stdout one document (redRecorded, expected: 'fail'); no git repository → no commit recorded (got " +
  JSON.stringify([dPass.out.slice(0, 160), dRed.out.slice(0, 240)]) + ")", [
  () => dPass.code === 1, () => /Task 1 expects its test to FAIL \(_Expect: fail_\), but the run passed \(exit 0\)/.test(dPass.out),
  () => /- \[ \] 1\./.test(tasksB5), () => dRed.code === 0, () => /Task 2 done \(verified\)/.test(dRed.out),
  () => /✓ red run recorded for task 2 \(exit 3\) — the test fails before its fix/.test(dRed.out), () => /- \[x\] 2\./.test(tasksB5),
  () => dRedJ.code === 0, () => dRedJr, () => dRedJr.redRecorded === true, () => dRedJr.expected === "fail", () => dRedJr.alreadyDone === true,
  () => !/red run recorded/.test(dRedJ.stdout), () => ev2B5.expected === "fail", () => ev2B5.exitCode === 3,
  () => (!("commit" in ev2B5) || gitB5(pb, "rev-parse", "HEAD").status === 0),
]);

// done --run records the commit it ran on and whether the tree was dirty (changes under .specs/ don't count) — git read-only.
if (hasGitB5) {
  const pg = path.join(tmp, "b5-git");
  fs.mkdirSync(pg, { recursive: true });
  gitB5(pg, "init", "-q");
  fs.writeFileSync(path.join(pg, "app.js"), "module.exports = 1;\n");
  gitB5(pg, "add", "app.js");
  gitB5(pg, "commit", "-q", "-m", "init");
  const headB5 = (gitB5(pg, "rev-parse", "--short", "HEAD").stdout || "").trim().toLowerCase();
  Sb5.initProject(pg, ["core"], "en");
  const fg = Sb5.createFeature(pg, "Gitrun", ["core"], "", undefined, "en");
  fs.writeFileSync(path.join(fg.dir, "tasks.md"), "- [ ] 1. [US1] A\n  - _Verify: node -e \"process.exit(0)\"_\n- [ ] 2. [US1] B\n  - _Verify: node -e \"process.exit(0)\"_\n");
  const g1 = rb5(["done", "gitrun", "1", "--run", "--project", pg]);
  fs.appendFileSync(path.join(pg, "app.js"), "// edited\n");
  const g2 = rb5(["done", "gitrun", "2", "--run", "--project", pg]);
  const evg = stB5(pg, "gitrun").evidence;
  ok(g1.code === 0 && g2.code === 0 && /^[0-9a-f]{4,40}$/.test(headB5) && evg["1"].commit === headB5 && evg["1"].dirty === false && evg["2"].commit === headB5 && evg["2"].dirty === true &&
    evg["1"].history[0].commit === headB5,
    "done --run records the commit it ran on (git rev-parse --short HEAD) and whether the tree was dirty — the spec's own files under .specs/ don't count (got " + JSON.stringify([headB5, evg["1"], evg["2"].dirty]).slice(0, 300) + ")");
} else ok(true, "done --run git evidence — skipped (git is not available)");

// init --check: repeatable, name= removes one, a bad value is refused (localized); the result line lists the checks.
const pc = path.join(tmp, "b5-checks");
const rmPcB5 = () => JSON.parse(fs.readFileSync(path.join(pc, ".specs", "roadmap.json"), "utf8")).meta.checks;
const ic1 = rb5(["init", "--check", "test=npm test", "--check", "lint=npm run lint", "--project", pc]);
const m1B5 = rmPcB5();
const ic2 = rb5(["init", "--check", "lint=", "--project", pc]);
const m2B5 = rmPcB5();
const icBad = rb5(["init", "--check", "oops", "--project", pc]);
const icBadName = rb5(["init", "--check", "bad name=x", "--project", pc]);
const m3B5 = rmPcB5();
const icJ = rb5(["init", "--json", "--check=e2e=node e2e.js", "--project", pc]);
const icJr = jsonB5(icJ.stdout);
const icPt = rb5(["init", "--lang", "pt", "--check", "e2e=node e2e.js", "--project", path.join(tmp, "b5-checks-pt")]);
const icEs = rb5(["init", "--lang", "es", "--check", "oops", "--project", path.join(tmp, "b5-checks-es")]);
all("init --check name=cmd (repeatable, --check=… too) sets roadmap.json meta.checks, name= removes one, a value without '=' or a bad name is refused writing nothing; --json reports the checks; PT line, ES error (got " +
  JSON.stringify([ic1.out.slice(-120), icBad.out.slice(0, 120)]) + ")", [
  () => ic1.code === 0, () => /Project checks \(meta\.checks\): test → npm test · lint → npm run lint/.test(ic1.out),
  () => JSON.stringify(m1B5) === JSON.stringify({ test: "npm test", lint: "npm run lint" }), () => ic2.code === 0,
  () => JSON.stringify(m2B5) === JSON.stringify({ test: "npm test" }), () => icBad.code === 1,
  () => /--check expects name=command \(got 'oops'\)/.test(icBad.out), () => icBadName.code === 1,
  () => /invalid check name 'bad name'/.test(icBadName.out), () => JSON.stringify(m3B5) === JSON.stringify(m2B5), () => icJ.code === 0, () => icJr,
  () => JSON.stringify(icJr.checks) === JSON.stringify({ test: "npm test", e2e: "node e2e.js" }), () => icPt.code === 0,
  () => /Verificações do projeto \(meta\.checks\): e2e → node e2e\.js/.test(icPt.out), () => icEs.code === 1,
  () => /--check espera nombre=comando \(recibido 'oops'\)/.test(icEs.out),
]);

// finish --run: runs every project check (from the project root), records each (a failure too — it stays a blocker); --json; PT.
const pf = path.join(tmp, "b5-finish");
rb5(["init", "--check", "test=node -e \"process.exit(0)\"", "--check", "lint=node -e \"process.exit(2)\"", "--project", pf]);
const ffB5 = Sb5.createFeature(pf, "Fin", ["core"], "", undefined, "en");
fs.writeFileSync(path.join(ffB5.dir, "tasks.md"), "- [x] 1. [US1] Done\n");
const fr = rb5(["finish", "fin", "--run", "--project", pf]);
const fcB5 = stB5(pf, "fin").finishChecks;
const frJ = rb5(["finish", "fin", "--run", "--json", "--project", pf]);
const frJr = jsonB5(frJ.stdout);
const fPtB5 = Sb5.createFeature(pf, "Fim", ["core"], "", undefined, "pt");
fs.writeFileSync(path.join(fPtB5.dir, "tasks.md"), "- [x] 1. [US1] Feito\n");
const frPt = rb5(["finish", "fim", "--run", "--project", pf]);
const frNone = rb5(["finish", "redcli", "--run", "--project", pb]);
all("finish --run runs each meta.checks command and records it (a failure stays the suite-evidence blocker); --json keeps stdout one document; PT; without meta.checks it runs nothing and exits 1 (got " +
  JSON.stringify([fr.out.slice(0, 300), frNone.out.slice(0, 120)]) + ")", [
  () => fr.code === 1, () => /\$ node -e "process\.exit\(0\)" {3}\(test\)/.test(fr.out),
  () => /\$ node -e "process\.exit\(2\)" {3}\(lint\)/.test(fr.out),
  () => /Recorded 2 project check run\(s\) in \.state\.json → finishChecks\./.test(fr.out),
  () => /✗ project checks without a passing run since the last task activity: lint \(latest run failed \(exit 2\)\)/.test(fr.out),
  () => !/test \(no run/.test(fr.out), () => fcB5.test.exitCode === 0, () => fcB5.lint.exitCode === 2, () => frJ.code === 1, () => frJr,
  () => frJr.recordedChecks.length === 2, () => frJr.suiteChecks.find((c) => c.name === "test").status === "pass",
  () => /\$ node -e/.test(frJ.stderr), () => !/\$ node -e/.test(frJ.stdout),
  () => /Registada\(s\) 2 execução\(ões\) de verificações do projeto/.test(frPt.out),
  () => /verificações do projeto sem uma execução bem-sucedida .*: lint \(a última execução falhou \(exit 2\)\)/.test(frPt.out),
  () => frNone.code === 1,
  () => /no project checks to run \(roadmap\.json meta\.checks\) — set them: node "[^"]*dev-spec\.js" init --check test="npm test"/.test(frNone.out),
]);
const pp = path.join(tmp, "b5-finish-pipe");
rb5(["init", "--check", "piped=node -e \"process.exit(0)\" | node -e \"process.exit(0)\"", "--project", pp]);
Sb5.createFeature(pp, "Pipe", ["core"], "", undefined, "en");
const fpipe = rb5(["finish", "pipe", "--run", "--project", pp]);
let posixOk = true;
if (process.platform === "win32") {
  const px = path.join(tmp, "b5-finish-posix");
  rb5(["init", "--check", "sq=node -e 'process.exit(0)'", "--project", px]);
  Sb5.createFeature(px, "Posix", ["core"], "", undefined, "en");
  const fpx = rb5(["finish", "posix", "--run", "--project", px]);
  posixOk = fpx.code === 1 && /the project check 'sq' \(`node -e 'process\.exit\(0\)'`\) uses POSIX shell syntax \(single quotes/.test(fpx.out) && !stB5(px, "posix").finishChecks;
}
ok(/pipes into another command: the shell reports only the LAST command's exit code/.test(fpipe.out) && stB5(pp, "pipe").finishChecks.piped.exitCode === 0 && posixOk,
  "finish --run prints the pipe hint for a piped check (it still runs and is recorded); on Windows a check in POSIX syntax is refused before anything runs under cmd.exe");

// dev-spec log: per task the commits citing it + the +tdd red-first check, from git log (read-only) or a log on stdin; localized.
const lgIn = rb5(["log", "redcli", "-", "--project", pb], "abc1234 feat(redcli): task #3 done\ndef5678 chore: other\n");
const fRegB5 = Sb5.createFeature(pb, "Registo", ["core"], "", undefined, "pt");
fs.writeFileSync(path.join(fRegB5.dir, "tasks.md"), "- [ ] 1. [US1] Algo\n");
const fEsB5 = Sb5.createFeature(pb, "Registro", ["core"], "", undefined, "es");
fs.writeFileSync(path.join(fEsB5.dir, "tasks.md"), "- [ ] 1. [US1] Algo\n");
const lgPt = rb5(["log", "registo", "-", "--project", pb], "abc1234 x\n");
const lgEs = rb5(["log", "registro", "-", "--project", pb], "abc1234 x\n");
const lgUnknown = rb5(["log", "nope", "-", "--project", pb], "");
ok(lgIn.code === 0 && /^Commits: redcli — 2 commit\(s\) read, 1 cite its tasks/m.test(lgIn.out) && /\[ \] #3 Must pass — abc1234 feat\(redcli\): task #3 done \(#3\)/.test(lgIn.out) &&
  /^Commits: registo — 1 commit\(s\) lido\(s\), 0 citam as suas tarefas/m.test(lgPt.out) && /Nenhum commit cita uma tarefa de 'registo'/.test(lgPt.out) &&
  /^Commits: registro — 1 commit\(s\) leído\(s\), 0 citan sus tareas/m.test(lgEs.out) && /Ningún commit cita una tarea de 'registro'/.test(lgEs.out) && lgUnknown.code === 1,
  "dev-spec log <feature> - reads a log from stdin (no git needed): 'task #N' with the feature name cites task N; PT / ES output; an unknown feature exits 1 (got " + JSON.stringify(lgIn.out.slice(0, 200)) + ")");
const noRepoB5 = !hasGitB5 || gitB5(pb, "rev-parse", "--git-dir").status !== 0;
const lgNo = rb5(["log", "redcli", "--project", pb]);
ok(!noRepoB5 || (lgNo.code === 1 && /git is not available here, or this is not a git repository with commits/.test(lgNo.out)),
  "dev-spec log outside a git repository (or without git) exits 1 with a localized hint to pipe a log in");
if (hasGitB5) {
  const pl = path.join(tmp, "b5-log");
  fs.mkdirSync(path.join(pl, "src"), { recursive: true });
  gitB5(pl, "init", "-q");
  Sb5.initProject(pl, ["tdd"], "en");
  const fl = Sb5.createFeature(pl, "Clog", ["tdd"], "", undefined, "en");
  fs.writeFileSync(path.join(fl.dir, "tasks.md"), "- [ ] 1. [US1] Write T-01 red\n  - _Expect: fail_\n- [ ] 2. [US1] Implement\n  - _Makes green: T-01_\n- [ ] 3. [US1] Docs\n");
  fs.writeFileSync(path.join(pl, "src", "a.js"), "module.exports = 1;\n");
  gitB5(pl, "add", "src/a.js");
  gitB5(pl, "commit", "-q", "-m", "feat(clog): implement\n\nPart of .specs/clog/ task #2.\nMakes T-01 green.");
  fs.mkdirSync(path.join(pl, "tests"));
  fs.writeFileSync(path.join(pl, "tests", "clog.test.js"), "test(\"T-01 works\", () => {});\n");
  gitB5(pl, "add", "tests/clog.test.js");
  gitB5(pl, "commit", "-q", "-m", "test(clog): T-01");
  const lg = rb5(["log", "clog", "--project", pl]);
  const lgJ = rb5(["log", "clog", "--json", "--project", pl]);
  const lgJr = jsonB5(lgJ.stdout);
  const lgMax = rb5(["log", "clog", "--max", "1", "--project", pl]);
  ok(lg.code === 0 && /^Commits: clog — 2 commit\(s\) read, 2 cite its tasks/m.test(lg.out) && /\[ \] #2 Implement — [0-9a-f]{7} test\(clog\): T-01 \(T-01\); [0-9a-f]{7} feat\(clog\): implement \(#2, T-01\)/.test(lg.out) &&
    /▲ red-first: task 2 \(makes T-01 green\) was first committed in [0-9a-f]{7}, before any commit touching a test file that names T-01 \(tests\/clog\.test\.js — first in [0-9a-f]{7}\)/.test(lg.out) &&
    /\[ \] #3 Docs — no commit cites it/.test(lg.out) && lgJr && lgJr.commits === 2 && lgJr.redFirst.find((r) => r.task === 2).status === "impl-first" &&
    lgMax.code === 0 && /1 commit\(s\) read \(the window is full/.test(lgMax.out) && /red-first: task 2 \(T-01\) — can't tell: the log window is full/.test(lgMax.out),
    "dev-spec log reads git log (read-only): per task the commits citing it ('task #N' + the feature name, T-IDs), the red-first warning when the implementation was committed before its test; --json; --max bounds the window (got " +
    JSON.stringify(lg.out.slice(0, 500)) + ")");
} else ok(true, "dev-spec log over a real git repository — skipped (git is not available)");

// help and the header docblock document the new command and flags.
const hB5 = rb5(["help"]).out;
const docB5 = fs.readFileSync(CLI, "utf8").split("*/")[0];
ok(["log <feature> [--max N] [-]", "--check name=\"cmd\"", "finish <feature> [--write] [--include-body] [--run]", "_Expect: fail_"].every((w) => hB5.includes(w) && docB5.includes(w)),
  "help and the header docblock document log, init --check, finish --run and _Expect: fail_");
};
