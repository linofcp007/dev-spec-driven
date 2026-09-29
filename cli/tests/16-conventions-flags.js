"use strict";
// Boolean switches read strictly, the CLI refuses what MCP refuses, --json refusals, localized PT / ES output.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = ({ ok, run, tmp, CLI, require, __dirname }) => {
  const b13 = path.join(tmp, "wp13-bool");
  run(["init", "core", "--project", b13]);
  run(["create", "Billing", "tdd", "--project", b13]);
  run(["create", "Other", "core", "--project", b13]);
  const t13 = path.join(b13, ".specs", "billing", "tasks.md");
  const ex13 = path.join(b13, ".specs", "billing", ".execution");
  fs.writeFileSync(t13, "# Tasks\n\n## Phase: Build\n- [ ] 1. [US1] First\n  - _Verify: node -e \"process.exit(0)\"_\n- [ ] 2. [US1] Second\n- [ ] 3. [US1] Third\n- [ ] 4. [US1] Fourth\n");
  const st13 = () => { try { return JSON.parse(fs.readFileSync(path.join(b13, ".specs", "billing", ".state.json"), "utf8")); } catch { return {}; } };
  const noRun13 = run(["done", "billing", "1", "--run=false", "--project", b13]);
  ok(noRun13.code === 0 && !/\$ node/.test(noRun13.out) && !(st13().evidence || {})["1"] && /Task 1 done\./.test(noRun13.out) && !/verified/.test(noRun13.out),
    "done --run=false runs no _Verify:_ command (a plain tick, no evidence recorded) — the string 'false' is not a switch");
  const addNoRm13 = run(["add-track", "other", "tdd", "--remove=false", "--project", b13]);
  ok(addNoRm13.code === 0 && /'other' now \[core \+tdd\]/.test(addNoRm13.out), "add-track --remove=false adds the track (removes nothing)");
  const briefNo13 = run(["brief", "billing", "--write=false", "--project", b13]);
  const finNo13 = run(["finish", "billing", "--write=false", "--project", b13]);
  const rmNo13 = run(["roadmap", "--write=false", "--html=false", "--project", b13]);
  let nb13 = null;
  try { nb13 = JSON.parse(run(["next", "billing", "--batch=false", "--json", "--project", b13]).out); } catch { /* not JSON */ }
  ok(briefNo13.code === 0 && !/Brief →/.test(briefNo13.out) && !/merge-summary/.test(finNo13.out) && !fs.existsSync(ex13) &&
    !/wrote/.test(rmNo13.out) && !fs.existsSync(path.join(b13, ".specs", "ROADMAP.html")) && nb13 && nb13.ok === true && !("batch" in nb13) &&
    /^Feature: billing/m.test(run(["status", "billing", "--json=false", "--project", b13]).out),
    "--write=false (brief, finish, roadmap), --html=false, --batch=false and --json=false are false, as over MCP");
  const maybe13 = run(["done", "billing", "2", "--run=maybe", "--project", b13]);
  const yes13 = run(["brief", "billing", "2", "--write=true", "--project", b13]);
  ok(maybe13.code === 1 && /--run must be a boolean \(true\/false\) \(got "maybe"\)/.test(maybe13.out) && !/- \[x\] 2\./.test(fs.readFileSync(t13, "utf8")) &&
    yes13.code === 0 && fs.existsSync(path.join(ex13, "task-2-brief.md")),
    "a boolean switch with any other =value (--run=maybe) exits 1 and ticks nothing; --write=true still writes");
  // The CLI refuses what MCP refuses: task numbers, --cap, --max, --kind, backlog actions.
  const br13 = [run(["brief", "billing", "3.9", "--write", "--project", b13]), run(["brief", "billing", "3abc", "--project", b13]), run(["brief", "billing", "1e21", "--project", b13])];
  ok(br13.every((r) => r.code === 1 && /number must be an integer/.test(r.out)) && !fs.existsSync(path.join(ex13, "task-3-brief.md")),
    "brief 3.9 / 3abc / 1e21 exit 1 (never task 3 or 1), like spec_task_brief — no brief written");
  fs.mkdirSync(path.join(b13, "src"), { recursive: true });
  fs.writeFileSync(path.join(b13, "src", "a.js"), "x\n");
  const cap13 = ["-3", "0", "abc", "2.9"].map((c) => run(["scan", "--cap", c, "--project", b13])).concat([run(["scan", "--cap=-3", "--project", b13])]);
  ok(cap13.every((r) => r.code === 1 && /--cap must be an integer ≥ 1/.test(r.out) && !/files:/.test(r.out)) && run(["scan", "--cap", "5", "--project", b13]).code === 0,
    "scan --cap -3 / 0 / abc / 2.9 (and --cap=-3) exit 1 like spec_scan (cap ≥ 1); --cap 5 scans");
  const max13 = ["1.5", "0", "abc"].map((m) => run(["next", "billing", "--batch", "--max", m, "--project", b13]));
  ok(max13.every((r) => r.code === 1 && /--max must be an integer ≥ 1/.test(r.out)) && run(["next", "billing", "--batch", "--max", "2", "--project", b13]).code === 0,
    "next --max 1.5 / 0 / abc exit 1 (spec_next_task: max is an integer ≥ 1)");
  const kind13 = run(["create", "Zed", "--kind", "bugfx", "--project", b13]);
  const kindOk13 = run(["create", "Zed", "--kind", "Bugfix", "--project", b13]);
  let zedKind = null;
  try { zedKind = JSON.parse(fs.readFileSync(path.join(b13, ".specs", "zed", ".state.json"), "utf8")).kind; } catch { /* missing */ }
  ok(kind13.code === 1 && /kind must be one of: feature, bugfix, spike \(got "bugfx"\)/.test(kind13.out) && kindOk13.code === 0 && zedKind === "bugfix",
    "create --kind bugfx exits 1 and scaffolds nothing (a typo can no longer fix the kind for good); --kind Bugfix works");
  const bl13 = run(["backlog", "delete", "Pay", "--project", b13]);
  // (1.14 full review S7: the list now names rm's alias remove — the spec_backlog enum.)
  ok(bl13.code === 1 && /action must be one of: add, rm, remove, list \(got "delete"\)/.test(bl13.out) && run(["backlog", "--project", b13]).code === 0 && run(["backlog", "list", "--project", b13]).code === 0,
    "backlog delete (an unknown action) exits 1 like spec_backlog; a bare backlog / backlog list still list");
  // --json on a refusal: the engine result on stdout (= the MCP tool's), exit 1.
  const runJ = (args) => {
    const r = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", env: { ...process.env, SPEC_PROJECT_DIR: tmp } });
    let j = null;
    try { j = JSON.parse(r.stdout); } catch { /* not JSON */ }
    return { j, code: r.status };
  };
  const dj13 = runJ(["done", "billing", "4", "--exit", "3", "--cmd", "x", "--json", "--project", b13]);
  const ij13 = runJ(["impact", "billing", "--json", "--project", b13]);
  const sj13 = runJ(["status", "nope", "--json", "--project", b13]);
  const S13 = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  ok(dj13.code === 1 && dj13.j && dj13.j.ok === false && dj13.j.recorded === true && /verification failed \(exit 3\)/.test(dj13.j.error) &&
    ij13.code === 1 && ij13.j && ij13.j.ok === false && ij13.j.neverApproved === true && JSON.stringify(ij13.j) === JSON.stringify(S13.impactReport(b13, "billing", {})) &&
    sj13.code === 1 && sj13.j && sj13.j.ok === false && typeof sj13.j.error === "string",
    "--json on a refusal prints the engine result on stdout (recorded / neverApproved kept, = MCP) and exits 1");
  // PT / ES: every line of status, doctor, depend, add-track, ears, usage and unknown command in the project/feature language.
  const pt13 = path.join(tmp, "wp13-pt");
  run(["init", "--lang", "pt", "--project", pt13]);
  run(["create", "Login", "tdd", "saas", "ai", "--project", pt13]);
  run(["create", "Other", "--project", pt13]);
  const ptSt13 = run(["status", "login", "--project", pt13]).out;
  const ptDoc13 = run(["doctor", "login", "--project", pt13]).out;
  const ptDep13 = run(["depend", "login", "other", "--order", "2", "--project", pt13]).out;
  const ptDep0 = run(["depend", "other", "--project", pt13]).out;
  const ptAdd13 = run(["add-track", "other", "tdd", "--project", pt13]).out;
  const ptEars13 = run(["ears", "login", "--project", pt13]).out;
  ok(/Secções de escala: /.test(ptSt13) && /Secções de IA: /.test(ptSt13) && !/Scale sections|AI sections/.test(ptSt13) &&
    /ears — critérios=\d+, erros=\d+, avisos=\d+/.test(ptDoc13) && !/criteria=/.test(ptDoc13) &&
    /login depende de: other {2}ordem=2/.test(ptDep13) && /other depende de: \(nenhuma\)/.test(ptDep0) &&
    /'other' agora \[core \+tdd\]/.test(ptAdd13) && /classification\.md \(Tracks Ativos\)/.test(ptAdd13) && !/now \[|Active Tracks|\+sections/.test(ptAdd13) &&
    /\[aviso\]/.test(ptEars13) && !/\[warn\]/.test(ptEars13),
    "PT: status section labels, doctor's ears detail, depend, add-track (+ its 'added' entries) and ears severities are Portuguese");
  const ptUse13 = run(["doctor", "--project", pt13]);
  const ptUnk13 = run(["wat", "--project", pt13]);
  ok(ptUse13.code === 1 && /uso: dev-spec doctor <feature>/.test(ptUse13.out) && ptUnk13.code === 1 && /comando desconhecido 'wat'/.test(ptUnk13.out) && /usage: dev-spec doctor <feature>/.test(run(["doctor", "--project", b13]).out),
    "PT: the usage prefix and 'unknown command' are Portuguese (the syntax stays as typed; EN unchanged)");
  const es13 = path.join(tmp, "wp13-es");
  run(["init", "--lang", "es", "--project", es13]);
  run(["create", "Pago", "saas", "--project", es13]);
  const esSt13 = run(["status", "pago", "--project", es13]).out;
  run(["roadmap", "--write", "--html", "--project", es13]);
  let esMd13 = "", esHtml13 = "";
  try { esMd13 = fs.readFileSync(path.join(es13, ".specs", "ROADMAP.md"), "utf8"); esHtml13 = fs.readFileSync(path.join(es13, ".specs", "ROADMAP.html"), "utf8"); } catch { /* missing */ }
  ok(/Secciones de escala: /.test(esSt13) && /\| requisitos \|/.test(esMd13) && !/\| requirements \|/.test(esMd13) && /<td>requisitos<\/td>/.test(esHtml13),
    "ES: status section label, and ROADMAP.md / ROADMAP.html show the localized phase (requisitos)");
};
