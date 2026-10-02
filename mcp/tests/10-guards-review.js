"use strict";
// Guards and hooks — 1.22 review regressions: the stop gate's admissions, activity and feature cap, the implementer's report, the approval guard's nested scripts.
// (10-guards.js holds the guards area's earlier tests; this file the findings of the 1.22 review of that area.)

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = async ({ ok, S, tmp, __dirname }) => {
  const js = JSON.stringify;

  // 1.22 review (finding 2) — a zero count is no admission ("All tasks done. 0 tests failing." was `admitted`, silent), and a
  // failure that "now passes" is history ("Fixed the bug; the 2 failing tests now pass." — the `;` cut the fixed word off).
  {
    const notAdmitted = ["All tasks done. 0 tests failing.", "All tasks done; no tests fail.", "All tasks done — none of the tests fail.", "All tasks done. Zero tests failed.",
      "All tasks done. No tests are failing.", "Todas as tarefas concluídas. 0 testes a falhar.", "Concluído: nenhum dos testes falha.", "Todas las tareas completadas. 0 pruebas fallan.",
      "Fixed the bug; the 2 failing tests now pass. All tasks done.", "Feito. Os 2 testes a falhar agora passam.", "Hecho. Los 2 tests fallando ahora pasan.",
      "Feito. Os 2 testes falhando agora estão passando."];
    const stillAdmitted = ["All tasks done, but 2 tests are failing.", "Task 3 is done. 2 tests still fail.", "All done; the 2 failing tests don't now pass.",
      "All tasks done. I haven't fixed the 2 failing tests.", "Tudo concluído, mas 2 testes a falhar.", "Todo completado, pero 2 pruebas fallan.", "All done. No, 2 tests fail.",
      "All tasks done. 10 tests failing."];
    const wrong = notAdmitted.filter((m) => { const c = S.stopClaims(m); return !c.claim || c.admitted; }).map((m) => "admitted: " + m)
      .concat(stillAdmitted.filter((m) => !S.stopClaims(m).admitted).map((m) => "not admitted: " + m));
    // …and end to end: the gate now looks at the features (a recent unverified tick → block) instead of reading "0 tests failing" as honest.
    const p = path.join(tmp, "g122-zero");
    S.initProject(p, ["core"], "en");
    const f = S.createFeature(p, "Billing", ["core"], "", undefined, "en");
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "- [ ] 1. [US1] Charge\n  - _Verify: npm test_\n");
    S.completeTask(p, "billing", 1);
    const s = S.stopCheck(p, { message: "All tasks done. 0 tests failing." });
    // linear: a long run of zero words before an admission
    const t0 = Date.now();
    S.stopClaims("All done. " + "none of the ".repeat(4000) + "tests fail. " + "no ".repeat(20000) + "tests fail.");
    const ms = Date.now() - t0;
    ok(!wrong.length && s.block === true && s.why === "unverified" && ms < 3000,
      "1.22 review: stopClaims — a zero count before an admission (0 / zero / no / none of; PT nenhum(a); ES ninguno(a)) is no admission, nor is a failure that now passes in its clause (EN / PT / PT-BR / ES); real admissions stay; the gate then checks the features (wrong: " +
      js(wrong) + ", gate " + js([s.block, s.why]) + ", " + ms + " ms)");
  }
};
