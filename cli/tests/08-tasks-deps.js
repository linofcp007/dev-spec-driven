"use strict";
// Task dependencies (_Depends:_) and execution waves on the CLI — next --waves, append-tasks --depends.

const fs = require("fs");
const path = require("path");

exports.run = ({ ok, run, runIn, tmp, require, __dirname }) => {
  const SD = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const mk = (n, lang = "en") => {
    const p = path.join(tmp, "ffdeps-" + n);
    SD.initProject(p, ["core"], lang);
    const f = SD.createFeature(p, "Deps " + n, ["core"], "", undefined, lang);
    return { p, slug: f.slug, dir: f.dir };
  };
  const put = (x, txt) => fs.writeFileSync(path.join(x.dir, "tasks.md"), txt);
  const tasksOf = (x) => fs.readFileSync(path.join(x.dir, "tasks.md"), "utf8");

  // next --waves: the next task, then the waves; --json is spec_next_task {waves}'s result; --waves=false prints none.
  const w = mk("waves");
  put(w, "# Tasks\n\n- [ ] 1. Schema\n  - _Implements: db/schema.sql_\n- [ ] 2. API\n  - _Depends: 1_\n  - _Implements: src/api.js_\n" +
    "- [ ] 3. UI\n  - _Depends: 1_\n  - _Implements: src/ui.js_\n- [ ] 4. E2E\n  - _Depends: 2, 3_\n  - _Implements: test/e2e.js_\n");
  const n1 = runIn(["next", w.slug, "--waves", "--project", w.p]);
  const nj = runIn(["next", w.slug, "--waves", "--json", "--project", w.p]);
  let njr = null;
  try { njr = JSON.parse(nj.out); } catch { /* not JSON */ }
  const nOff = runIn(["next", w.slug, "--waves=false", "--project", w.p]);
  ok(n1.code === 0 && n1.out === "Next → #1 Schema  (4/4 left)\nWaves (3):\n  1. #1\n  2. #2 #3\n  3. #4\n" && njr && JSON.stringify(njr) === JSON.stringify(SD.nextTask(w.p, w.slug, { waves: true })) &&
    JSON.stringify(njr.waves) === "[[1],[2,3],[4]]" && nOff.code === 0 && !/Waves/.test(nOff.out),
    "feature F3: next --waves prints the next task and the waves (#1 · #2 #3 · #4); --json is spec_next_task {waves}'s result; --waves=false prints no waves (got " + JSON.stringify([n1.out, nOff.out]) + ")");

  // done on a task whose dependencies are open: ticked (exit 0) with the warning; a task that waits is passed over by next.
  const dn = runIn(["done", w.slug, "4", "--project", w.p]);
  const s = mk("skip");
  put(s, "# Tasks\n\n- [ ] 1. Late\n  - _Depends: 2_\n- [ ] 2. Early\n");
  const sn = runIn(["next", s.slug, "--project", s.p]);
  ok(dn.code === 0 && /^Task 4 done\. 1\/4 {2}next → #1 Schema\n {2}⚠ Task 4 was ticked while its dependencies #2, #3 are still open/.test(dn.out) && /^- \[x\] 4\./m.test(tasksOf(w)) &&
    sn.code === 0 && sn.out === "Next → #2 Early  (2/2 left)\n  waiting: #1 waits on #2\n",
    "feature F3: done on a task whose _Depends:_ are open ticks it and warns (never refused); next passes over a waiting task and names what it waits on (got " + JSON.stringify([dn.out, sn.out]) + ")");

  // No open task can start: next / brief / done say so (never 'all done'); doctor fails task-deps (exit 1).
  const b = mk("blocked");
  put(b, "# Tasks\n\n- [ ] 1. A\n  - _Depends: 2_\n- [ ] 2. B\n  - _Depends: 1_\n");
  const bn = runIn(["next", b.slug, "--waves", "--project", b.p]);
  const bb = runIn(["brief", b.slug, "--project", b.p]);
  const bd = runIn(["doctor", b.slug, "--project", b.p]);
  const lb = mk("leftblocked");
  put(lb, "# Tasks\n\n- [ ] 1. A\n- [ ] 2. B\n  - _Depends: 3_\n- [ ] 3. C\n  - _Depends: 2_\n");
  const ld = runIn(["done", lb.slug, "1", "--project", lb.p]);
  ok(bn.code === 0 && /^No open task can start — each waits on a dependency that is not done: #1 waits on #2; #2 waits on #1\./.test(bn.out) && !/All tasks done/.test(bn.out) &&
    /\nWaves \(0\):\n {2}\(no open task can start\)\n {2}⚠ cycle: #1, #2\n$/.test(bn.out) && bb.code === 0 && /^No open task can start/.test(bb.out) &&
    bd.code === 1 && /✗ task-deps — tasks waiting on each other \(a cycle\): #1, #2/.test(bd.out) &&
    ld.code === 0 && /^Task 1 done\. 1\/3\n/.test(ld.out) && !/all done/.test(ld.out) && /⚠ No open task can start — each waits on a dependency that is not done: #2 waits on #3; #3 waits on #2\./.test(ld.out),
    "feature F3: when no open task can start (a cycle), next / brief / done say so and name what each waits on — never 'all done'; next --waves shows no wave and the cycle; doctor fails task-deps (exit 1) (got " +
    JSON.stringify([bn.out, bd.out.split("\n").find((l) => /task-deps/.test(l)), ld.out]) + ")");

  // append-tasks --depends (repeatable, #n accepted); a number naming no task is refused (exit 1, nothing written); --depends needs a value.
  const ap = mk("append");
  put(ap, "# Tasks\n\n## Build\n- [ ] 1. Writer\n**Checkpoint:** built\n");
  const a1 = runIn(["append-tasks", ap.slug, "--task", "Reader", "--depends", "#1", "--project", ap.p]);
  const a2 = runIn(["append-tasks", ap.slug, "--task", "Glue", "--depends", "1", "--depends", "2", "--project", ap.p]);
  const aBad = runIn(["append-tasks", ap.slug, "--task", "Nope", "--depends", "7", "--project", ap.p]);
  const aMiss = runIn(["append-tasks", ap.slug, "--task", "Nope", "--depends", "--project", ap.p]);
  ok(a1.code === 0 && a2.code === 0 && /- \[ \] 2\. Reader\n {2}- _Depends: 1_\n- \[ \] 3\. Glue\n {2}- _Depends: 1, 2_\n/.test(tasksOf(ap)) &&
    aBad.code === 1 && /Task 1: depends names no task: #7 — .*\(numbered 4 here\)\. Nothing was written\./.test(aBad.out) &&
    aMiss.code === 1 && /missing value for --depends/.test(aMiss.out) && !/Nope/.test(tasksOf(ap)),
    "feature F3: append-tasks --depends writes _Depends:_ (repeatable, #1 = 1); a number naming no task is refused with the number the task would get (exit 1, nothing written); --depends needs a value (got " +
    JSON.stringify([a1.out, a2.out, aBad.out, aMiss.out]) + ")");

  // Localized: the waves, the cycle and the blocked task in PT.
  const pt = mk("pt", "pt");
  put(pt, "# Tarefas\n\n- [ ] 1. Base\n- [ ] 2. Topo\n  - _Depends: 1_\n- [ ] 3. Laço\n  - _Depends: 3_\n");
  const pn = runIn(["next", pt.slug, "--waves", "--project", pt.p]);
  ok(pn.code === 0 && /^Próxima → #1 Base {2}\(faltam 3\/3\)\nOndas \(2\):\n {2}1\. #1\n {2}2\. #2\n {2}⚠ ciclo: #3\n {2}⚠ bloqueadas: #3 espera por #3\n$/.test(pn.out),
    "feature F3: next --waves in a PT feature — 'Ondas', the cycle and the blocked task in Portuguese (got " + JSON.stringify(pn.out) + ")");
};
