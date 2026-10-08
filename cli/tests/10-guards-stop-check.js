"use strict";
// init --guard scope / --stop-check on|off, dev-spec stop-check (= spec.stopCheck, the Stop hook's decision).

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = ({ ok, tmp, CLI, require, __dirname }) => {
  const Sc1 = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const rc1 = (args, input) => {
    const r = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", env: { ...process.env, SPEC_PROJECT_DIR: tmp, CLAUDE_PROJECT_DIR: "" }, input });
    return { out: (r.stdout || "") + (r.stderr || ""), stdout: r.stdout || "", code: r.status };
  };
  const jc1 = (s) => { try { return JSON.parse(s); } catch { return null; } };
  const metaC1 = (p) => JSON.parse(fs.readFileSync(path.join(p, ".specs", "roadmap.json"), "utf8")).meta || {};

  // init --guard scope · --stop-check on|off (= spec_init {guard: "scope"}, {stopCheck}); bad values refused, localized.
  const p1 = path.join(tmp, "c1-init");
  const gs = rc1(["init", "--guard", "Scope", "--project", p1]);
  const gsJ = jc1(rc1(["init", "--json", "--project", p1]).stdout);
  const so = rc1(["init", "--stop-check", "off", "--project", p1]);
  const soOff = metaC1(p1).stopCheck;
  const sOn = rc1(["init", "--stop-check=on", "--json", "--project", p1]);
  const sOnJ = jc1(sOn.stdout);
  const sBad = rc1(["init", "--stop-check", "maybe", "--project", p1]);
  const gBad = rc1(["init", "--guard", "strict", "--project", p1]);
  const sPt = rc1(["init", "--lang", "pt", "--stop-check", "off", "--guard", "scope", "--project", path.join(tmp, "c1-init-pt")]);
  const sEs = rc1(["init", "--lang", "es", "--stop-check", "quizá", "--project", path.join(tmp, "c1-init-es")]);
  ok(gs.code === 0 && /Guard mode SCOPE/.test(gs.out) && metaC1(p1).guard === "scope" && gsJ && gsJ.guard === "scope" && gsJ.stopCheck === true && gsJ.guardNote === undefined &&
    so.code === 0 && /Evidence gate OFF/.test(so.out) && soOff === false && sOn.code === 0 && sOnJ && sOnJ.stopCheck === true && /Evidence gate ON/.test(sOnJ.stopCheckNote) && metaC1(p1).stopCheck === true &&
    sBad.code === 1 && /--stop-check takes on or off \(got 'maybe'\)/.test(sBad.out) && gBad.code === 1 && /--guard takes on, off or scope \(got 'strict'\)/.test(gBad.out) &&
    sPt.code === 0 && /Gate de evidência DESLIGADO/.test(sPt.out) && /Modo guarda SCOPE \(âmbito\)/.test(sPt.out) && sEs.code === 1 && /--stop-check admite on u off \(recibido 'quizá'\)/.test(sEs.out),
    "init --guard scope (any case) → meta.guard 'scope'; --stop-check off|on → meta.stopCheck (the result reports both; a note when set); bad values exit 1, localized (PT lines, ES error) (got " +
    JSON.stringify([gs.out.slice(-160), so.out.slice(-120), sBad.out.slice(0, 120)]) + ")");

  // stop-check = spec.stopCheck: the same result (--json), the reason and exit 1 when the turn would be sent back, a localized line and exit 0 otherwise.
  const p2 = path.join(tmp, "c1-stop");
  Sc1.initProject(p2, ["core"], "en");
  const f2 = Sc1.createFeature(p2, "Billing", ["core"], "", undefined, "en");
  fs.writeFileSync(path.join(f2.dir, "tasks.md"), "- [ ] 1. [US1] Charge\n  - _Verify: node -e \"process.exit(0)\"_\n- [ ] 2. [US1] Refund\n");
  Sc1.completeTask(p2, "billing", 1);
  const claim = "Done — all tests pass.";
  const sc = rc1(["stop-check", "--message", claim, "--project", p2]);
  const scJ = jc1(rc1(["stop-check", "--message", claim, "--json", "--project", p2]).stdout);
  const eng = Sc1.stopCheck(p2, { message: claim });
  const scIn = rc1(["stop-check", "-", "--project", p2], claim + "\n");
  const scInFlag = rc1(["stop-check", "--message", "-", "--project", p2], "Feito, todos os testes passam.");
  const scPos = rc1(["stop-check", "All", "done!", "--project", p2]);
  const scNo = rc1(["stop-check", "--message", "I renamed the variable.", "--project", p2]);
  const scAdm = rc1(["stop-check", "--message", "Done, but task 1 is not verified.", "--project", p2]);
  ok(sc.code === 1 && sc.stdout.trim() === eng.reason && /billing: #1 \(no evidence\)/.test(sc.out) && /read each listed task's _Verify:_ command/.test(sc.out) && !/--run/.test(sc.out) &&
    scJ && JSON.stringify(scJ) === JSON.stringify(eng) && scIn.code === 1 && scIn.stdout.trim() === eng.reason && scInFlag.code === 1 && scPos.code === 1 &&
    scNo.code === 0 && /^evidence gate: the message claims no completion or verification — allowed\./.test(scNo.stdout) &&
    scAdm.code === 0 && /says plainly what is not verified/.test(scAdm.stdout),
    "stop-check prints spec.stopCheck's reason and exits 1 when the turn would be sent back (--message, stdin via - or --message -, or the words after it); --json = the engine result; no claim / an admission → a line, exit 0 (got " +
    JSON.stringify([sc.code, sc.out.slice(0, 200), scNo.out.slice(0, 120)]) + ")");
  // Allow lines: verified, no recent activity, off, no .specs/; --agent spec-implementer checks the report; PT / ES lines.
  Sc1.completeTask(p2, "billing", 1, { command: "node -e \"process.exit(0)\"", exitCode: 0, summary: "1 passing" });
  const scVer = rc1(["stop-check", "--message", claim, "--project", p2]);
  const p3 = path.join(tmp, "c1-quiet");
  Sc1.initProject(p3, ["core"], "en");
  const f3 = Sc1.createFeature(p3, "Quiet", ["core"], "", undefined, "en");
  const old = (Date.now() - 9 * 3600 * 1000) / 1000;
  fs.utimesSync(path.join(f3.dir, "tasks.md"), old, old);
  const scOld = rc1(["stop-check", "--message", claim, "--project", p3]);
  rc1(["init", "--stop-check", "off", "--project", p3]);
  const scOff = rc1(["stop-check", "--message", claim, "--project", p3]);
  fs.mkdirSync(path.join(tmp, "c1-empty"), { recursive: true });
  const scNone = rc1(["stop-check", "--message", claim, "--project", path.join(tmp, "c1-empty")]);
  const ex = path.join(f2.dir, ".execution");
  fs.mkdirSync(ex, { recursive: true });
  fs.writeFileSync(path.join(f2.dir, "tasks.md"), "- [x] 1. [US1] Charge\n  - _Verify: node -e \"process.exit(0)\"_\n- [ ] 2. [US1] Refund\n  - _Verify: npm test -- refund_\n");
  fs.writeFileSync(path.join(ex, "task-2-report.md"), "# Task 2\nAll good.\n");
  const reply = "**Status:** DONE\nReport: .specs/billing/.execution/task-2-report.md";
  const scImp = rc1(["stop-check", "--message", reply, "--agent", "dev-spec-driven:spec-implementer", "--project", p2]);
  const scImpJ = jc1(rc1(["stop-check", "--message", reply, "--agent", "spec-implementer", "--json", "--project", p2]).stdout);
  fs.writeFileSync(path.join(ex, "task-2-report.md"), "# Task 2\n$ npm test -- refund\nexit 0 — 4 passing\n");
  const scImpOk = rc1(["stop-check", "--message", reply, "--agent", "spec-implementer", "--project", p2]);
  const p4 = path.join(tmp, "c1-pt");
  Sc1.initProject(p4, ["core"], "pt");
  Sc1.createFeature(p4, "Pagamentos", ["core"], "", undefined, "pt");
  const scPt = rc1(["stop-check", "--message", "Renomeei a variável.", "--project", p4]);
  const p5 = path.join(tmp, "c1-es");
  Sc1.initProject(p5, ["core"], "es");
  const scEs = rc1(["stop-check", "--message", "Listo.", "--project", p5]);
  ok(scVer.code === 0 && /every ticked task of the recently active features has passing evidence \(billing\) — allowed/.test(scVer.stdout) &&
    scOld.code === 0 && /no feature was active in the last 4 h/.test(scOld.stdout) && scOff.code === 0 && /evidence gate: off \(roadmap\.json meta\.stopCheck: false\)/.test(scOff.stdout) &&
    scNone.code === 0 && /no dev-spec \.specs\/ here/.test(scNone.stdout) &&
    scImp.code === 1 && /you report task 2 of 'billing' as DONE, but its report \(\.specs\/billing\/\.execution\/task-2-report\.md\) doesn't show the _Verify:_ run/.test(scImp.out) &&
    scImpJ && scImpJ.why === "implementer-evidence" && scImpJ.task === 2 && scImpOk.code === 0 && /the report of task 2 of 'billing' shows its _Verify:_ run — allowed/.test(scImpOk.stdout) &&
    scPt.code === 0 && /gate de evidência: a mensagem não afirma conclusão nem verificação — permitido/.test(scPt.stdout) &&
    scEs.code === 0 && /gate de evidencia: ninguna función tuvo actividad en las últimas 4 h/.test(scEs.stdout),
    "stop-check allow lines (verified, no recent activity, off, no .specs/), --agent spec-implementer checks the task report (exit 1 without the run, 0 with it), PT / ES lines (got " +
    JSON.stringify([scVer.out.slice(0, 140), scOld.out.slice(0, 120), scImp.out.slice(0, 160), scEs.out.slice(0, 120)]) + ")");

  // 1.22 --agent spec-simplifier: its simplification report must END with the passing project checks (exit 1 otherwise).
  const p6 = path.join(tmp, "c1-simplify");
  Sc1.initProject(p6, ["core"], "pt", { checks: { test: "npm test" } });
  const f6 = Sc1.createFeature(p6, "Carrinho", ["core"], "", undefined, "pt");
  const ex6 = path.join(f6.dir, ".execution");
  fs.mkdirSync(ex6, { recursive: true });
  const rep6 = path.join(ex6, "simplify-report.md");
  const reply6 = "**Status:** DONE\nCommits: a1b2c3d refactor(carrinho): guard clauses\nReport: .specs/" + f6.slug + "/.execution/simplify-report.md";
  fs.writeFileSync(rep6, "## Baseline\n- `npm test` → exit 0\n## Final runs\n- `npm test` → exit code 1 (1 failing)\n");
  const scSim = rc1(["stop-check", "--message", reply6, "--agent", "dev-spec-driven:spec-simplifier", "--project", p6]);
  const scSimJ = jc1(rc1(["stop-check", "--message", reply6, "--agent", "spec-simplifier", "--json", "--project", p6]).stdout);
  fs.writeFileSync(rep6, "## Baseline\n- `npm test` → exit 0\n## Final runs\n- `npm test` → código de saída 0 (212 a passar)\n");
  const scSimOk = rc1(["stop-check", "--message", reply6, "--agent", "spec-simplifier", "--project", p6]);
  const scSimNone = rc1(["stop-check", "--message", "**Status:** NO_CHANGES\nNada a simplificar.", "--agent", "spec-simplifier", "--project", p6]);
  ok(scSim.code === 1 && /reportas a passagem de simplificação de 'carrinho' como DONE, mas as execuções finais do relatório \(\.specs\/carrinho\/\.execution\/simplify-report\.md\) falham: `npm test` — uma simplificação tem de deixar todas as execuções a passar/.test(scSim.out) &&
    scSimJ && scSimJ.why === "simplifier-evidence" && scSimJ.feature === "carrinho" && scSimJ.lang === "pt" &&
    scSimOk.code === 0 && /o relatório de simplificação de 'carrinho' termina com as execuções com sucesso — permitido/.test(scSimOk.stdout) &&
    scSimNone.code === 0 && /o simplificador reporta NO_CHANGES/.test(scSimNone.stdout),
    "1.22 stop-check --agent spec-simplifier: a report whose final project-check run fails → exit 1 with the reason (PT); a final exit 0 ('código de saída 0') → exit 0 and the allow line; NO_CHANGES → allowed (got " +
    JSON.stringify([scSim.out.slice(0, 200), scSimOk.out.slice(0, 160), scSimNone.out.slice(0, 120)]) + ")");

  // help and the header docblock document stop-check, --stop-check and --guard scope.
  const hC1 = rc1(["help"]).out;
  const docC1 = fs.readFileSync(CLI, "utf8").split("*/")[0];
  ok(["stop-check [--message \"<text>\"|-] [--agent <type>]", "--stop-check on|off", "--guard on|off|scope"].every((w) => hC1.includes(w) && docC1.includes(w)),
    "help and the header docblock document stop-check, init --stop-check and init --guard scope");
};
