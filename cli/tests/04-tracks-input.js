"use strict";
// Tracks on the CLI — track input, add-track --remove, status marks.

const fs = require("fs");
const path = require("path");

exports.run = ({ ok, run, tmp }) => {
  const w2 = path.join(tmp, "wp2-proj");
  run(["init", "core", "--project", w2]);
  const typo = run(["create", "Typo", "tdd,sass", "--project", w2]);
  const typoInit = run(["init", "ia", "--project", w2]);
  ok(typo.code === 1 && /did you mean 'saas'/.test(typo.out) && !fs.existsSync(path.join(w2, ".specs", "typo")) && typoInit.code === 1 && /did you mean 'ai'/.test(typoInit.out),
    "create/init with an unknown track exit 1 with a did-you-mean (nothing scaffolded)");
  const multi = run(["create", "Checkout", "+tdd", "+saas", "--project", w2]);
  ok(multi.code === 0 && /\[core \+tdd \+saas\]/.test(multi.out), "create accepts '+tdd +saas' style tracks");
  const st = run(["status", "checkout", "--project", w2]).out;
  ok(/phase=requirements/.test(st) && /◐ Performance Budget \(unfilled\)/.test(st) && !/✓/.test(st.split("Scale sections:")[1] || "✓"),
    "status: a fresh scaffold is in 'requirements' and its scale sections read ◐ (unfilled), never ✓");
  const des = path.join(w2, ".specs", "checkout", "design.md");
  fs.writeFileSync(des, fs.readFileSync(des, "utf8").replace(/(## \[SaaS\] Performance Budget\n)> \*\*TODO\*\*[^\n]*\n/, "$1P95 < 200 ms.\n"));
  ok(/✓ Performance Budget · ◐ Scale Design \(unfilled\)/.test(run(["status", "checkout", "--project", w2]).out), "status prints ✓ only for the filled section (same rule as doctor)");
  const addBoth = run(["add-track", "checkout", "ai", "--project", w2]);
  const rm = run(["add-track", "checkout", "saas", "--remove", "--project", w2]);
  const rmCore = run(["add-track", "checkout", "core", "--remove", "--project", w2]);
  ok(addBoth.code === 0 && /\[core \+tdd \+saas \+ai\]/.test(addBoth.out) && rm.code === 0 && /now \[core \+tdd \+ai\]/.test(rm.out) && /load-test\.md/.test(rm.out) &&
    fs.existsSync(path.join(w2, ".specs", "checkout", "load-test.md")) && rmCore.code === 1,
    "add-track --remove turns a track off (files kept, listed); 'core' can't be removed");
  ok(/add-track <feature> <track\.\.\.>/.test(run(["help"]).out) && /--remove/.test(run(["help"]).out), "help documents add-track --remove");
  // the marks' words and the removal note follow the feature language (PT)
  const ptp = path.join(tmp, "wp2-pt");
  run(["init", "core", "--lang", "pt", "--project", ptp]);
  run(["create", "Relatórios", "saas", "--project", ptp]);
  const ptSt = run(["status", "relatorios", "--project", ptp]).out;
  const ptRm = run(["add-track", "relatorios", "saas", "--remove", "--project", ptp]);
  ok(/Secções de escala: ◐ Orçamento de Desempenho \(por preencher\)/.test(ptSt) && !/Scale sections/.test(ptSt) && !/✓/.test(ptSt.split("Secções de escala:")[1] || "✓") && ptRm.code === 0 && /Tracks desativados: \+saas/.test(ptRm.out),
    "status (◐ … (por preencher)) and add-track --remove speak the feature language (PT)");
  // a bugfix given an extra track gets it on the first run, same as on a re-run
  const bug1 = run(["bugfix", "Login crash", "saas", "--project", w2]).out;
  const bug2 = run(["bugfix", "Login crash", "saas", "--project", w2]).out;
  ok(/\[core \+tdd \+saas\]/.test(bug1) && /\[core \+tdd \+saas\]/.test(bug2) && !/already existed/.test(bug2), "bugfix with a track gives the same track set on both runs");
  // `brief` (default: next open) agrees with `next` once a removed track's task block is all that's left open
  run(["create", "Chat", "ai", "--project", w2]);
  const chatTasks = path.join(w2, ".specs", "chat", "tasks.md");
  const chatRaw = fs.readFileSync(chatTasks, "utf8");
  const aiBlock = chatRaw.split("## Story US-1 — AI")[1].split(/\n## /)[0];
  const aiNums = [...aiBlock.matchAll(/- \[ \] (\d+)\./g)].map((m) => +m[1]);
  fs.writeFileSync(chatTasks, chatRaw.replace(/- \[ \] (\d+)\./g, (m, n) => (aiNums.includes(+n) ? m : `- [x] ${n}.`)));
  run(["add-track", "chat", "ai", "--remove", "--project", w2]);
  const chatBrief = run(["brief", "chat", "--project", w2]);
  const chatBriefN = run(["brief", "chat", String(aiNums[0]), "--project", w2]);
  ok(aiNums.length > 0 && /All tasks done/.test(run(["next", "chat", "--project", w2]).out) && chatBrief.code === 0 && /All tasks are done — nothing to brief\./.test(chatBrief.out) &&
    chatBriefN.code === 0 && new RegExp("task " + aiNums[0]).test(chatBriefN.out),
    "after add-track --remove, `brief` (no number) says all done like `next`; `brief <n>` still reaches the inactive task");
};
