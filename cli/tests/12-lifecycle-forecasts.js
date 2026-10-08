"use strict";
// Forecasts (ticks → velocity → ETA) and cross-feature overlaps on the CLI, EN and PT.

const fs = require("fs");
const path = require("path");

exports.run = ({ ok, run, tmp, CLI, require, __dirname }) => {
  // Forecasts (done records ticks → velocity → ETA) and cross-feature overlaps on the CLI = the engine (spec_roadmap / spec_metrics
  // / spec_doctor), EN and PT; a project with no completed task prints nothing new.
  const Sb4 = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const jsonB4 = (r) => { try { return JSON.parse(r.out); } catch { return null; } };
  const pb4 = path.join(tmp, "pb4-proj");
  const rb4 = (args) => run([...args, "--project", pb4]);
  run(["init", "--lang", "en", "--project", pb4]);
  const apiB4 = Sb4.createFeature(pb4, "Api", ["core"], "", undefined, "en");
  const webB4 = Sb4.createFeature(pb4, "Web", ["core"], "", undefined, "en");
  fs.writeFileSync(path.join(apiB4.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Routes\n  - _Size: S_\n  - _Implements: src/api/routes.js_\n- [ ] 2. [US1] Auth\n  - _Size: S_\n" +
    "- [ ] 3. [US1] Paging\n  - _Size: S_\n- [ ] 4. [US1] Shared client\n  - _Size: M_\n  - _Implements: src/shared/client.js_\n");
  fs.writeFileSync(path.join(webB4.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Web shell\n  - _Implements: src/shared/_\n");
  const noDataB4 = rb4(["roadmap"]);
  ok(noDataB4.code === 0 && !/Velocity|ETA/.test(noDataB4.out) && /⚠ 1 cross-feature file overlap\(s\):\n {2}api ↔ web: src\/shared\/client\.js/.test(noDataB4.out),
    "roadmap before any completed task: no velocity / ETA line (nothing new), but the overlap is listed (got " + JSON.stringify(noDataB4.out) + ")");
  const doneB4 = [1, 2, 3].map((n) => rb4(["done", "api", String(n)]));
  const ticksB4 = (JSON.parse(fs.readFileSync(path.join(apiB4.dir, ".state.json"), "utf8")).ticks) || {};
  ok(doneB4.every((r) => r.code === 0) && ["1", "2", "3"].every((k) => typeof ticksB4[k] === "string" && Math.abs(Date.parse(ticksB4[k]) - Date.now()) < 120000),
    "done records when each task was ticked (.state.json ticks[n])");
  const rmB4 = rb4(["roadmap"]);
  const engB4 = Sb4.roadmapReport(pb4);
  const fApi = engB4.features.find((f) => f.name === "api");
  const etaApi = Sb4.etaText(fApi.forecast, "en", true);
  ok(rmB4.code === 0 && typeof fApi.forecast.eta === "string" && etaApi && new RegExp("^ {5}api +\\d+% .*  · " + etaApi.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "m").test(rmB4.out) &&
    /^Velocity: \d+(\.\d+)? point\(s\)\/working day — 3 task\(s\), 6 point\(s\) completed since \d{4}-\d{2}-\d{2} \(last 28 days\)$/m.test(rmB4.out) &&
    /^ETA = remaining points ÷ velocity, in working days \(±25%\)/m.test(rmB4.out) && /^ {2}api ↔ web: src\/shared\/client\.js$/m.test(rmB4.out),
    "roadmap prints each feature's ETA, the velocity, the ETA rule and the overlaps (got " + JSON.stringify(rmB4.out) + ")");
  const rjB4 = jsonB4(rb4(["roadmap", "--json"]));
  const pickB4 = (r) => JSON.stringify(r && [r.velocity, r.overlaps, r.features.map((f) => [f.name, f.forecast])]);
  ok(rjB4 && pickB4(rjB4) === pickB4(engB4) && rjB4.velocity.enough === true, "roadmap --json = spec_roadmap: the same velocity, forecasts and overlaps");
  const docB4 = rb4(["doctor", "web"]);
  ok(/▲ cross-feature-overlap — open tasks plan the same files as another active feature — api \(src\/shared\/client\.js\)/.test(docB4.out) &&
    /verdict=/.test(docB4.out) && !/✗ cross-feature-overlap/.test(docB4.out),
    "doctor prints the cross-feature-overlap line as a warn (▲, never ✗) (got " + JSON.stringify((docB4.out.match(/.*cross-feature.*/) || [""])[0].slice(0, 200)) + ")");
  const metB4 = rb4(["metrics", "api"]);
  const metJB4 = jsonB4(rb4(["metrics", "--json"]));
  ok(/^ {2}velocity: \d+(\.\d+)? point\(s\)\/working day \(3 task\(s\), 6 point\(s\) since \d{4}-\d{2}-\d{2}, last 28 days\)$/m.test(metB4.out) &&
    metJB4 && JSON.stringify(metJB4.velocity) === JSON.stringify(Sb4.metrics(pb4).velocity),
    "metrics prints the feature's velocity; metrics --json carries the project's (= spec_metrics)");
  const wrB4 = rb4(["roadmap", "--write"]);
  const rmMdB4 = fs.readFileSync(path.join(pb4, ".specs", "ROADMAP.md"), "utf8");
  ok(wrB4.code === 0 && /\| Next \| ETA \|/.test(rmMdB4) && rmMdB4.includes("| " + Sb4.etaText(fApi.forecast, "en") + " |") && /- \*\*api\*\* — plans the same files as web: src\/shared\/client\.js/.test(rmMdB4),
    "roadmap --write: ROADMAP.md carries the ETA column and the overlap under Needs attention");

  const ptB4 = path.join(tmp, "pb4-pt");
  run(["init", "--lang", "pt", "--project", ptB4]);
  const agoraB4 = Sb4.createFeature(ptB4, "Agora", ["core"], "", undefined, "pt");
  const depoisB4 = Sb4.createFeature(ptB4, "Depois", ["core"], "", undefined, "pt");
  fs.writeFileSync(path.join(agoraB4.dir, "tasks.md"), "# Tarefas\n\n- [ ] 1. [US1] A\n- [ ] 2. [US1] B\n- [ ] 3. [US1] C\n- [ ] 4. [US1] D\n  - _Implements: src/x.js_\n");
  fs.writeFileSync(path.join(depoisB4.dir, "tasks.md"), "# Tarefas\n\n- [ ] 1. [US1] E\n  - _Implements: src/x.js:3_\n");
  [1, 2, 3].forEach((n) => run(["done", "agora", String(n), "--project", ptB4]));
  const ptRmB4 = run(["roadmap", "--project", ptB4]);
  const ptMetB4 = run(["metrics", "agora", "--project", ptB4]);
  const ptDocB4 = run(["doctor", "depois", "--project", ptB4]);
  ok(/^ {5}agora .*  · previsão \d{4}-\d{2}-\d{2}/m.test(ptRmB4.out) && /^Velocidade: .* ponto\(s\)\/dia útil — 3 tarefa\(s\)/m.test(ptRmB4.out) &&
    /^⚠ 1 sobreposição\(ões\) de ficheiros entre features:\n {2}agora ↔ depois: src\/x\.js$/m.test(ptRmB4.out) && /^ {2}velocidade: .* ponto\(s\)\/dia útil/m.test(ptMetB4.out) &&
    /▲ cross-feature-overlap — há tarefas por fazer que planeiam os mesmos ficheiros que outra feature ativa — agora \(src\/x\.js\)/.test(ptDocB4.out),
    "PT project: roadmap's previsão / Velocidade / sobreposição lines, metrics' velocidade and doctor's overlap detail in European Portuguese (got " + JSON.stringify(ptRmB4.out.slice(0, 500)) + ")");
  const helpB4 = run(["help"]).out;
  const docblockB4 = fs.readFileSync(CLI, "utf8").split("*/")[0];
  ok(/roadmap \[--write\]\[--html\]\[--lang\] +Roadmap: .*ETA per feature \(velocity from ticked tasks, _Size: XS\|S\|M\|L\|XL_\), cross-feature file overlaps/.test(helpB4) &&
    /metrics \[feature\] \[--write\] +Lead times.*velocity/.test(helpB4) && /Multi-feature roadmap: ETA forecasts, cross-feature overlaps/.test(docblockB4),
    "help and the header docblock mention the roadmap's ETA / overlaps and metrics' velocity");

  // 1.24 r6 G6: `dev-spec roadmap` names every dependency cycle — the head line the first (as before), one line each for the rest
  // (a → a hid b ↔ c).
  {
    const pc = path.join(tmp, "r6-cycles");
    run(["init", "--lang", "en", "--project", pc]);
    for (const n of ["a", "b", "c"]) Sb4.createFeature(pc, n, ["core"], "", undefined, "en");
    const rmf = path.join(pc, ".specs", "roadmap.json");
    const rm = JSON.parse(fs.readFileSync(rmf, "utf8"));
    Object.assign(rm.features, { a: { dependsOn: ["a"] }, b: { dependsOn: ["c"] }, c: { dependsOn: ["b"] } });
    fs.writeFileSync(rmf, JSON.stringify(rm, null, 2));
    const r = run(["roadmap", "--project", pc]);
    const j = jsonB4(run(["roadmap", "--json", "--project", pc]));
    ok(r.code === 0 && /CYCLE: a → a/.test(r.out) && /⚠ Circular dependency: b → c → b/.test(r.out) && j && j.cycles && j.cycles.length === 2,
      "1.24 r6 G6: `dev-spec roadmap` names every cycle (the head line's first, a line per other one); --json carries `cycles` (got " + JSON.stringify(r.out.slice(0, 300)) + ")");
  }
};
