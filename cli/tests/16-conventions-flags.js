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
  ok(kind13.code === 1 && /kind must be one of: feature, bugfix, spike, change \(got "bugfx"\)/.test(kind13.out) && kindOk13.code === 0 && zedKind === "bugfix",
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
  // 1.22 review: --json where the output is text only — the help (help, no command, --help anywhere), rules, mcp-config, evals —
  // is a usage error (exit 1, nothing on stdout, localized): it printed the text on stdout with exit 0 (evals handed it on to
  // run-evals.js, which took it silently). --json=false still prints them.
  const raw22 = (args, project = b13) => spawnSync(process.execPath, [CLI, ...args, "--project", project], { encoding: "utf8", env: { ...process.env, SPEC_PROJECT_DIR: tmp } });
  const txt22 = [["help", "--json"], ["--json"], ["status", "--help", "--json"], ["rules", "agents", "--json"], ["mcp-config", "cursor", "--json"],
    ["evals", "billing", "--json"], ["evals", "--json", "billing"]].map((a) => raw22(a));
  const what22 = ["help", "help", "help", "rules", "mcp-config", "evals", "evals"];
  const pj22 = path.join(tmp, "wp22-json-pt");
  run(["init", "--lang", "pt", "--project", pj22]);
  const ptTxt22 = raw22(["mcp-config", "--json"], pj22);
  const off22 = [raw22(["help", "--json=false"]), raw22(["rules", "agents", "--json=false"]), raw22(["mcp-config", "cursor", "--json=false"])];
  ok(txt22.every((r, i) => r.status === 1 && r.stdout === "" && r.stderr.trim() === "dev-spec: --json is not available for '" + what22[i] + "': it prints text only. Run it without --json.") &&
    ptTxt22.status === 1 && ptTxt22.stdout === "" && /--json não está disponível para 'mcp-config': só imprime texto/.test(ptTxt22.stderr) &&
    off22.every((r) => r.status === 0 && r.stdout.length > 50),
    "1.22 review: --json on help / no command / --help, rules, mcp-config and evals exits 1 with a localized usage error and nothing on stdout (never their text as if it were JSON); --json=false prints them (got " +
    JSON.stringify(txt22.map((r) => [r.status, r.stdout.slice(0, 20), r.stderr.trim().slice(0, 60)]).concat([[ptTxt22.status, ptTxt22.stderr.trim().slice(0, 60)]], off22.map((r) => r.status))) + ")");
  // 1.22 review: evals exits 1 when the harness never ran (a spawn error) or was killed by a signal — `res.status || 0` made both
  // exit 0. Windows: a command line past CreateProcess's limit (32,767 characters) can't start run-evals.js (ENAMETOOLONG) while
  // the CLI's own — shorter by the `--project <dir>` it adds — still starts; elsewhere a preload kills the harness (SIGKILL).
  {
    let ev22;
    if (process.platform === "win32") {
      const q = (a) => (/[\s"]/.test(a) ? a.length + 2 : a.length); // libuv's quoting of a path (spaces, no quotes, no trailing backslash)
      const head = [process.execPath, CLI, "evals", "billing"].reduce((n, a) => n + q(a) + 1, 0);
      const filler = "x".repeat(32766 - 12 - head); // the CLI's command line: 12 characters under the limit
      ev22 = spawnSync(process.execPath, [CLI, "evals", "billing", filler], { encoding: "utf8", env: { ...process.env, SPEC_PROJECT_DIR: b13 } });
      ok(ev22.status === 1 && /ENAMETOOLONG/.test(ev22.stderr),
        "1.22 review: evals whose harness can't start (a spawn error: ENAMETOOLONG) exits 1, never 0 (got " + JSON.stringify([ev22.status, ev22.stderr.trim().slice(0, 120)]) + ")");
    } else {
      const kill22 = path.join(tmp, "kill-run-evals.js");
      fs.writeFileSync(kill22, "if (/run-evals\\.js$/.test(process.argv[1] || '')) process.kill(process.pid, 'SIGKILL');\n");
      ev22 = spawnSync(process.execPath, [CLI, "evals", "billing", "--dry-run", "--project", b13], { encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "--require \"" + kill22 + "\"" } });
      ok(ev22.status === 1,
        "1.22 review: evals whose harness is killed by a signal (SIGKILL) exits 1, never 0 (got " + JSON.stringify([ev22.status, ev22.signal, ev22.stderr.trim().slice(0, 120)]) + ")");
    }
  }
  // 1.22 review: a task number is an integer ≥ 0 (spec_task_brief / spec_complete_task's schema minimum; a hand-written "0."
  // task is one next serves) — done / undone / brief refuse -1 / 1.5 in the MCP validator's words, before anything runs.
  const num22 = [["done", "billing", "-1", "--run"], ["done", "billing", "1.5"], ["undone", "billing", "-1"], ["brief", "billing", "-1", "--write"], ["brief", "billing", "x"]]
    .map((a) => run([...a, "--project", b13]));
  const numJ22 = runJ(["done", "billing", "-1", "--json", "--project", b13]);
  ok(num22.every((r) => r.code === 1 && /Invalid argument\(s\): number must be an integer ≥ 0 \(got "(?:-1|1\.5|x)"\)/.test(r.out) && !/^\$ /m.test(r.out)) &&
    !fs.existsSync(path.join(ex13, "task--1-brief.md")) && numJ22.code === 1 && numJ22.j && numJ22.j.ok === false && /≥ 0 \(got "-1"\)/.test(numJ22.j.error),
    "1.22 review: done -1 --run / done 1.5 / undone -1 / brief -1 / brief x exit 1 — 'number must be an integer ≥ 0', as MCP refuses them; nothing runs or is written; --json prints the refusal (got " +
    JSON.stringify(num22.map((r) => [r.code, r.out.trim().slice(0, 80)])) + ")");
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

  // 1.23 review — each command reads its own options and at most its own arguments: a known flag it ignores, an extra word,
  // --shell / --timeout without --run and --run with --evidence are usage errors (they were ignored: `approve … --remove` meant
  // --revoke and approved, `done <f> 3 4` ticked 3 alone); nothing runs or changes. --json answers a usage error in JSON too.
  const p23 = path.join(tmp, "wp23-strict");
  run(["init", "--project", p23]);
  run(["create", "Login", "--project", p23]);
  const t23 = path.join(p23, ".specs", "login", "tasks.md");
  fs.writeFileSync(t23, "# Tasks\n\n## Phase: Build\n- [ ] 1. [US1] First\n  - _Verify: node -e \"process.exit(0)\"_\n- [ ] 2. [US1] Second\n");
  const before23 = fs.readFileSync(t23, "utf8") + fs.readFileSync(path.join(p23, ".specs", "login", ".state.json"), "utf8");
  const u23 = [["approve", "login", "classification", "--remove", "--force"], ["done", "login", "1", "2"], ["done", "login", "1", "--timeout", "5"],
    ["finish", "login", "--shell", "bash"], ["done", "login", "1", "--run", "--evidence", "ok"], ["status", "login", "--lang", "pt"], ["list", "extra"],
    ["backlog", "rm", "a", "b"], ["log", "login", "x"], ["brief", "login", ""]].map((a) => run([...a, "--project", p23]));
  const after23 = fs.readFileSync(t23, "utf8") + fs.readFileSync(path.join(p23, ".specs", "login", ".state.json"), "utf8");
  const want23 = [/--remove is not an option of 'approve' \(its options: --by, --force, --role, --through, --reason, --expires, --revoke\)/, /'done' got unexpected argument\(s\): 2\./,
    /--timeout only applies with --run/, /--shell only applies with --run/, /--run records the run it makes; --evidence \/ --exit \/ --cmd report a run made elsewhere/,
    /--lang is not an option of 'status' \(it takes none\)/, /'list' got unexpected argument\(s\): extra/, /'backlog rm' got unexpected argument\(s\): b/,
    /usage: dev-spec log <feature> \[--max N\] \[-\]/, /number must be an integer ≥ 0 \(got ""\)/];
  const j23 = runJ(["list", "extra", "--json", "--project", p23]), jMax23 = runJ(["next", "login", "--max", "0", "--json", "--project", p23]), jCmd23 = runJ(["frobnicate", "--json"]);
  const pt23 = path.join(tmp, "wp23-strict-pt");
  run(["init", "--lang", "pt", "--project", pt23]);
  const ptU23 = run(["roadmap", "--force", "--project", pt23]);
  ok(u23.every((r, i) => r.code === 1 && want23[i].test(r.out) && !/^\$ /m.test(r.out)) && after23 === before23 &&
    j23.code === 1 && j23.j && j23.j.ok === false && /'list' got unexpected argument/.test(j23.j.error) && jMax23.j && jMax23.j.ok === false && /--max must be an integer ≥ 1/.test(jMax23.j.error) &&
    jCmd23.j && jCmd23.j.ok === false && /unknown command 'frobnicate'/.test(jCmd23.j.error) && ptU23.code === 1 && /--force não é uma opção de 'roadmap'/.test(ptU23.out),
    "1.23 review: a known flag a command doesn't read, an extra argument, --shell / --timeout without --run, --run with --evidence and brief '' exit 1 with the reason, nothing changed; --json prints {ok: false, error} on stdout for usage errors too; PT (got " +
    JSON.stringify(u23.map((r) => [r.code, r.out.trim().slice(0, 70)]).concat([[j23.code, j23.j], [ptU23.code, ptU23.out.trim().slice(0, 60)]])) + ")");

  // 1.23 review (L14) — --project names an existing folder: empty, an unexpanded variable, a file or a missing folder is refused
  // (localized, --json too) and nothing is created — init alone creates it; Windows' `"C:\dir\"` quoting (a trailing ") is read.
  const miss23 = path.join(tmp, "wp23-typo", "deeper");
  const fileP23 = path.join(p23, ".specs", "roadmap.json");
  const pj23 = [["create", "X", "--project", miss23], ["list", "--project", fileP23], ["list", "--project="], ["list", "--project", "$HOME/x"], ["create", "X", "--project", "%APPDATA%\\x"]].map(run);
  const pjJ23 = runJ(["create", "X", "--json", "--project", miss23]);
  const newP23 = path.join(tmp, "wp23-new-by-init");
  const init23 = run(["init", "--project", newP23]);
  const quote23 = process.platform === "win32" ? run(["list", "--project", p23 + "\""]) : { code: 0, out: "login" };
  ok(pj23[0].code === 1 && /--project .*deeper: no such folder — check the path \(only init creates a project folder\)/.test(pj23[0].out) && !fs.existsSync(path.join(tmp, "wp23-typo")) &&
    pj23[1].code === 1 && /roadmap\.json is a file, not a folder/.test(pj23[1].out) && pj23[2].code === 1 && /--project is empty/.test(pj23[2].out) &&
    pj23.slice(3).every((r) => r.code === 1 && /holds a variable that was never expanded/.test(r.out)) &&
    pjJ23.code === 1 && pjJ23.j && pjJ23.j.ok === false && /no such folder/.test(pjJ23.j.error) &&
    init23.code === 0 && fs.existsSync(path.join(newP23, ".specs", "steering")) && quote23.code === 0 && /login/.test(quote23.out),
    "1.23 review: --project missing / a file / empty / $VAR / %VAR% exits 1 (localized, --json: ok false) and creates nothing; init --project <new> creates it; a trailing \" (Windows quoting) is dropped (got " +
    JSON.stringify(pj23.map((r) => [r.code, r.out.trim().slice(0, 90)]).concat([[init23.code], [quote23.code, quote23.out.slice(0, 40)]])) + ")");

  // 1.23 review (L24) — an engine exception (a FILE where .specs/ goes: ENOTDIR) is one line on stderr and, with --json, the
  // {ok: false, error, code} document on stdout (it was the raw message on stderr only).
  const ex23 = path.join(tmp, "wp23-exception");
  fs.mkdirSync(ex23, { recursive: true });
  fs.writeFileSync(path.join(ex23, ".specs"), "a file where the .specs folder goes");
  const exH23 = run(["create", "X", "--project", ex23]), exJ23 = runJ(["create", "X", "--json", "--project", ex23]);
  // 1.24 r6 G7: that FILE is no exception any more — the write gate answers it as a localized refusal ({ok: false, wrongKind: true,
  // path}) — still one stderr line and exit 1, the same {ok: false, error} document with --json.
  ok(exH23.code === 1 && /^dev-spec: \.specs is a file where dev-spec needs a folder/m.test(exH23.out) && !/E[A-Z]+:/.test(exH23.out) &&
    exJ23.code === 1 && exJ23.j && exJ23.j.ok === false && exJ23.j.wrongKind === true && exJ23.j.path === ".specs" && /\.specs is a file/.test(exJ23.j.error),
    "1.23 review → 1.24 r6 G7: a FILE where .specs/ goes exits 1 — one localized stderr line (no raw ENOTDIR), and with --json {ok: false, wrongKind, path, error} on stdout (got " + JSON.stringify([exH23.out.trim().slice(0, 60), exJ23.j]) + ")");

  // 1.23 review (M7 + L12 + M6) — from a SUBFOLDER (no --project, no env) the CLI works in the project above (it started a nested
  // .specs/ there); a path argument is read from that subfolder — and from the project when --project names it (scan / ears read
  // the working folder even then); scan reports in the project's language; stdin is decoded like a file (UTF-16 with a BOM).
  const env23 = { ...process.env };
  delete env23.SPEC_PROJECT_DIR;
  delete env23.CLAUDE_PROJECT_DIR;
  const inDir = (cwd, args, input) => {
    const r = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", cwd, env: env23, input });
    return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
  };
  const w23 = path.join(tmp, "wp23-walkup");
  run(["init", "--lang", "pt", "--project", w23]);
  const sub23 = path.join(w23, "src", "deep");
  fs.mkdirSync(sub23, { recursive: true });
  fs.mkdirSync(path.join(w23, "docs"), { recursive: true });
  fs.writeFileSync(path.join(w23, "docs", "req.md"), "- **US-1.AC-1** — QUANDO o utilizador entra O SISTEMA DEVE abrir a sessão\n");
  fs.writeFileSync(path.join(w23, "src", "app.js"), "app.get('/users', h);\n");
  const cr23 = inDir(sub23, ["create", "Beta"]), bl23w = inDir(sub23, ["backlog", "add", "later"]);
  const earsRel23 = inDir(sub23, ["ears", path.join("..", "..", "docs", "req.md")]);
  const elsewhere23 = path.join(tmp, "wp23-elsewhere");
  fs.mkdirSync(elsewhere23, { recursive: true });
  const earsP23 = inDir(elsewhere23, ["ears", "docs/req.md", "--project", w23]), scanP23 = inDir(elsewhere23, ["scan", "src", "--project", w23]);
  const u16 = (s) => Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(s, "utf16le")]);
  const earsU16 = inDir(w23, ["ears", "-"], u16("- **US-1.AC-1** — WHEN a user logs in THE SYSTEM SHALL create a session\r\n- **US-1.AC-2** — WHEN the password is wrong THE SYSTEM SHALL refuse it\r\n"));
  const planU16 = inDir(w23, ["import", "plan", "-", "--name", "Utf16 plan", "--json"], u16("# Plan: Dark mode\r\n\r\n## Steps\r\n1. Add the theme context in `src/theme.ts`\r\n2. Wire the toggle in `src/settings.tsx`\r\n"));
  let plan23 = null;
  try { plan23 = JSON.parse(planU16.out.slice(planU16.out.indexOf("{"))); } catch { /* not JSON */ }
  ok(cr23.code === 0 && fs.existsSync(path.join(w23, ".specs", "beta")) && bl23w.code === 0 && !fs.existsSync(path.join(sub23, ".specs")) &&
    earsRel23.code === 0 && /EARS: 1 critérios/.test(earsRel23.out) && earsP23.code === 0 && /EARS: 1 critérios/.test(earsP23.out) &&
    scanP23.code === 0 && /^Análise de .*src$/m.test(scanP23.out) && /GET {5}\/users/.test(scanP23.out) &&
    earsU16.code === 0 && /EARS: 2 critérios, 2 com verbo modal/.test(earsU16.out) && plan23 && plan23.ok === true && Object.keys(plan23.mapping).length === 3,
    "1.23 review: from a subfolder the CLI uses the project above (create / backlog add start no nested .specs/), a path is read from the subfolder — or from --project when named (ears, scan); scan in the project's language; UTF-16 stdin decoded (ears -, import plan -) (got " +
    JSON.stringify([cr23.code, bl23w.code, earsRel23.out.trim().slice(0, 50), earsP23.out.trim().slice(0, 50), scanP23.out.slice(0, 40), earsU16.out.trim().slice(0, 50), plan23 && plan23.mapping]) + ")");

  // 1.24 r6 B1: SPEC_PROJECT_DIR / CLAUDE_PROJECT_DIR are checked like --project when they chose the project — a missing folder
  // (init alone creates it) or a file is refused, the message names the variable; a folder without .specs/ is fine.
  {
    const neutral = path.join(tmp, "r6b1-cwd");
    fs.mkdirSync(neutral, { recursive: true });
    const envRun = (env, args) => {
      const e = { ...process.env };
      delete e.SPEC_PROJECT_DIR;
      delete e.CLAUDE_PROJECT_DIR;
      const r = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", cwd: neutral, env: { ...e, ...env } });
      let j = null;
      try { j = JSON.parse(r.stdout); } catch { /* not JSON */ }
      return { code: r.status, out: (r.stdout || "") + (r.stderr || ""), j };
    };
    const typo = path.join(tmp, "r6b1-typo", "deeper"), aFile = path.join(tmp, "r6b1-a-file.txt"), bare = path.join(tmp, "r6b1-bare");
    fs.writeFileSync(aFile, "not a folder\n");
    fs.mkdirSync(bare, { recursive: true });
    const r = [envRun({ SPEC_PROJECT_DIR: typo }, ["list"]), envRun({ SPEC_PROJECT_DIR: typo }, ["create", "X"]), envRun({ SPEC_PROJECT_DIR: aFile }, ["create", "X"]),
      envRun({ CLAUDE_PROJECT_DIR: typo }, ["backlog", "add", "later"]), envRun({ SPEC_PROJECT_DIR: typo }, ["create", "X", "--json"]),
      envRun({ CLAUDE_PROJECT_DIR: aFile }, ["list", "--json"])];
    const createdTypo = fs.existsSync(path.join(tmp, "r6b1-typo"));
    const okBare = envRun({ CLAUDE_PROJECT_DIR: bare }, ["list"]);
    const okFlag = envRun({ SPEC_PROJECT_DIR: typo }, ["list", "--project", bare]);
    const okFall = envRun({ SPEC_PROJECT_DIR: "$NOPE/x", CLAUDE_PROJECT_DIR: bare }, ["list"]);
    const newInit = path.join(tmp, "r6b1-new-by-init");
    const okInit = envRun({ SPEC_PROJECT_DIR: newInit }, ["init"]);
    const ptP = path.join(tmp, "r6b1-pt");
    run(["init", "--lang", "pt", "--project", ptP]);
    const ptMiss = envRun({ SPEC_PROJECT_DIR: path.join(ptP, "nope"), CLAUDE_PROJECT_DIR: ptP }, ["list"]);
    ok(r[0].code === 1 && /SPEC_PROJECT_DIR=.*deeper: no such folder/.test(r[0].out) && r[1].code === 1 && !createdTypo &&
      r[2].code === 1 && /SPEC_PROJECT_DIR=.*r6b1-a-file\.txt is a file, not a folder/.test(r[2].out) && !/ENOTDIR/.test(r[2].out) &&
      r[3].code === 1 && /CLAUDE_PROJECT_DIR=.*deeper: no such folder/.test(r[3].out) &&
      r[4].code === 1 && r[4].j && r[4].j.ok === false && /SPEC_PROJECT_DIR=/.test(r[4].j.error) && r[5].code === 1 && r[5].j && r[5].j.ok === false && /CLAUDE_PROJECT_DIR=/.test(r[5].j.error) &&
      okBare.code === 0 && /No features under/.test(okBare.out) && okFlag.code === 0 && okFall.code === 0 &&
      okInit.code === 0 && fs.existsSync(path.join(newInit, ".specs", "steering")) && ptMiss.code === 1 && /SPEC_PROJECT_DIR=.*nope/.test(ptMiss.out),
      "1.24 r6 B1: a SPEC_PROJECT_DIR / CLAUDE_PROJECT_DIR that chose the project is checked like --project — a missing folder or a file exits 1 naming the variable (--json: ok false), nothing created; a folder without .specs/, --project over it, an unexpanded value falling through and init (creates it) work (got " +
      JSON.stringify(r.map((x) => [x.code, x.out.trim().slice(0, 90)]).concat([[okBare.code, okFlag.code, okFall.code, okInit.code, createdTypo], [ptMiss.code, ptMiss.out.trim().slice(0, 80)]])) + ")");
  }

  // 1.24 r6 B7: --project (or the environment) naming a project's .specs/ folder is refused with the folder to name instead — it
  // created .specs/.specs/, which then won the walk-up.
  {
    const proj = path.join(tmp, "r6b7-proj");
    run(["init", "--project", proj]);
    const inner = path.join(proj, ".specs");
    const e = { ...process.env, SPEC_PROJECT_DIR: inner };
    delete e.CLAUDE_PROJECT_DIR;
    const viaEnv = spawnSync(process.execPath, [CLI, "create", "X"], { encoding: "utf8", env: e });
    const r = [run(["create", "X", "--project", inner]), run(["init", "--project", inner]), run(["list", "--project", inner + path.sep])];
    ok(r.every((x) => x.code === 1 && x.out.includes(proj) && /the \.specs folder of the project/.test(x.out)) && viaEnv.status === 1 && /SPEC_PROJECT_DIR/.test(viaEnv.stderr) &&
      !fs.existsSync(path.join(inner, ".specs")) && !fs.existsSync(path.join(inner, "x")),
      "1.24 r6 B7: --project / SPEC_PROJECT_DIR naming a dev-spec project's .specs/ exits 1 with the project folder to name instead; no .specs/.specs/ (got " +
      JSON.stringify(r.map((x) => [x.code, x.out.trim().slice(0, 100)]).concat([[viaEnv.status, String(viaEnv.stderr).trim().slice(0, 100)]])) + ")");
  }

  // 1.24 r6 B4: extra or contradictory inputs the 1.23 checks let through — feature archive / remove / restore with a word past
  // the name (and rename / flow past theirs), feature flow <name> <flow> with --flow, --flow on another action, merge-state's
  // file arguments with --install / --uninstall (or both switches), depend's deps with --clear, stop-check --message with words —
  // are usage errors; nothing changes.
  {
    const p = path.join(tmp, "r6b4-extra");
    run(["init", "--project", p]);
    run(["create", "Login", "--project", p]);
    run(["create", "Other", "--project", p]);
    run(["depend", "login", "other", "--project", p]);
    const snap = () => fs.readdirSync(path.join(p, ".specs")).sort().join(",") + "|" + fs.readFileSync(path.join(p, ".specs", "roadmap.json"), "utf8");
    const before = snap();
    const cases = [
      [["feature", "archive", "login", "extra"], /'feature archive' got unexpected argument\(s\): extra/],
      [["feature", "remove", "login", "extra", "--yes"], /'feature remove' got unexpected argument\(s\): extra/],
      [["feature", "restore", "login", "extra"], /'feature restore' got unexpected argument\(s\): extra/],
      [["feature", "rename", "login", "auth", "extra"], /'feature rename' got unexpected argument\(s\): extra/],
      [["feature", "flow", "login", "design-first", "--flow", "requirements-first"], /'feature flow' got unexpected argument\(s\): design-first/],
      [["feature", "flow", "login", "design-first", "extra"], /'feature flow' got unexpected argument\(s\): extra/],
      [["feature", "archive", "login", "--flow", "design-first"], /--flow is not an option of 'feature archive'/],
      [["merge-state", "a", "b", "c", "--install"], /usage: dev-spec merge-state/],
      [["merge-state", "--install", "--uninstall"], /usage: dev-spec merge-state/],
      [["depend", "login", "other", "--clear"], /usage: dev-spec depend/],
      [["stop-check", "all", "done", "--message", "done"], /usage: dev-spec stop-check/],
    ].map(([a, re]) => [run([...a, "--project", p]), re, a.join(" ")]);
    const after = snap();
    const ok2 = run(["feature", "flow", "other", "--flow", "design-first", "--project", p]);
    const okClear = run(["depend", "login", "--clear", "--project", p]);
    ok(cases.every(([r, re]) => r.code === 1 && re.test(r.out)) && after === before && ok2.code === 0 && okClear.code === 0 && /login depends on: \(none\)/.test(okClear.out),
      "1.24 r6 B4: feature archive/remove/restore/rename/flow past their arguments, a flow given twice or on another action, merge-state files with --install / both switches, depend deps + --clear and stop-check --message + words exit 1, nothing changed; feature flow --flow and depend --clear alone still work (got " +
      JSON.stringify(cases.filter(([r, re]) => !(r.code === 1 && re.test(r.out))).map(([r, , a]) => [a, r.code, r.out.trim().slice(0, 90)]).concat([[ok2.code, okClear.code]])) + ")");
  }

  // 1.24 r6 B5: a single-value flag given twice was last-wins — `approve … --role tech --role product` signed for product alone,
  // --by / --cmd / --summary / --through / --phase dropped the first — now a usage error; the repeatable ones (depend --add / --rm,
  // init --check, append-tasks --req / --implements / --makes-green / --depends, decide --affects / --supersedes) still add up.
  {
    const p = path.join(tmp, "r6b5-twice");
    run(["init", "--project", p]);
    run(["create", "Login", "--project", p]);
    run(["create", "Other", "--project", p]);
    run(["create", "Third", "--project", p]);
    const st = () => fs.readFileSync(path.join(p, ".specs", "login", ".state.json"), "utf8");
    const before = st();
    const cases = [["approve", "login", "classification", "--role", "tech", "--role", "product"], ["approve", "login", "classification", "--by", "a", "--by=b"],
      ["create", "Zed", "--summary", "a", "--summary", "b"], ["done", "login", "1", "--cmd", "a", "--cmd", "b", "--exit", "0"],
      ["impact", "login", "--phase", "design", "--phase", "tasks"], ["approve", "login", "--through", "design", "--through", "tasks"],
      ["list", "--project", p]].map((a) => [run([...a, "--project", p]), a.find((x) => x.startsWith("--")).replace(/=.*/, "")]);
    const pt = path.join(tmp, "r6b5-pt");
    run(["init", "--lang", "pt", "--project", pt]);
    const ptTwice = run(["roadmap", "--lang", "pt", "--lang", "es", "--project", pt]);
    const atTwice = run(["append-tasks", "login", "--task", "a", "--size", "S", "--size", "M", "--project", p]);
    const at2Tasks = run(["append-tasks", "login", "--task", "a", "--task", "b", "--project", p]);
    const dep = run(["depend", "login", "--add", "other", "--add", "third", "--project", p]);
    const reqs = run(["append-tasks", "login", "--task", "Wire it", "--implements", "src/a.js", "--implements", "src/b.js", "--json", "--project", p]);
    let rj = null;
    try { rj = JSON.parse(reqs.out); } catch { /* not JSON */ }
    ok(cases.every(([r, f]) => r.code === 1 && new RegExp(f + " was given more than once").test(r.out)) && st() === before && !fs.existsSync(path.join(p, ".specs", "zed")) &&
      ptTwice.code === 1 && /--lang foi indicada mais de uma vez/.test(ptTwice.out) &&
      atTwice.code === 1 && /append-tasks takes --size once per call/.test(atTwice.out) && at2Tasks.code === 1 && /one --task per call/.test(at2Tasks.out) &&
      dep.code === 0 && /login depends on: other, third/.test(dep.out) && rj && rj.ok === true && JSON.stringify(rj.appended[0].implements) === '["src/a.js","src/b.js"]',
      "1.24 r6 B5: a single-value flag given twice (--role, --by / --by=, --summary, --cmd, --phase, --through, --project, --lang) exits 1 naming it (PT too), nothing changed; append-tasks keeps its own messages; repeatable flags still add up (got " +
      JSON.stringify(cases.map(([r, f]) => [f, r.code, r.out.trim().slice(0, 80)]).concat([[ptTwice.code, ptTwice.out.trim().slice(0, 80)], [atTwice.code, at2Tasks.code, dep.out.trim(), rj && rj.appended]])) + ")");
  }

  // 1.24 r6 B9: messages that pointed the wrong way — `bugfix` without a name printed create's usage; `ears missing.md` answered
  // "Feature 'missing-md' not found"; create --question / --timebox named the MCP key (kind: "spike") where --root-cause names
  // the flag; and a change's create note gave only spec_approve {through} — the CLI user now gets the CLI line.
  {
    const p = path.join(tmp, "r6b9-msgs");
    run(["init", "--project", p]);
    run(["create", "Login", "--project", p]);
    const S = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
    const bug = run(["bugfix", "--project", p]);
    const ears = [run(["ears", "missing.md", "--project", p]), run(["ears", "docs/nope.md", "--project", p])];
    const earsJ = (() => { try { const o = run(["ears", "missing.md", "--json", "--project", p]).out; return JSON.parse(o.slice(0, o.lastIndexOf("}") + 1)); } catch { return null; } })();
    const earsFeature = run(["ears", "login", "--project", p]);
    const q = run(["create", "Zed", "--question", "Is it fast?", "--project", p]), tb = run(["create", "Zed", "--timebox", "3d", "--project", p]);
    const ch = run(["create", "Tiny fix", "--kind", "change", "--project", p]);
    const chMcp = S.createFeature(p, "Tiny two", undefined, undefined, undefined, undefined, "change", {});
    ok(bug.code === 1 && /usage: dev-spec bugfix "<name>"/.test(bug.out) && !/dev-spec create/.test(bug.out) &&
      ears.every((r) => r.code === 1 && /: no such file/.test(r.out) && !/not found under/.test(r.out)) && earsJ && earsJ.ok === false && earsFeature.code === 0 && /EARS: /.test(earsFeature.out) &&
      q.code === 1 && /--question only applies to a spike/.test(q.out) && /spike "<name>" --question/.test(q.out) && !/kind: "spike"/.test(q.out) &&
      tb.code === 1 && /--timebox only applies to a spike/.test(tb.out) && !fs.existsSync(path.join(p, ".specs", "zed")) &&
      ch.code === 0 && /cli\/dev-spec\.js" approve tiny-fix --through tasks/.test(ch.out) && !/spec_approve \{/.test(ch.out) &&
      chMcp.ok && /spec_approve \{name: "tiny-two", through: "tasks"\}/.test(chMcp.note),
      "1.24 r6 B9: bugfix's own usage; ears <missing file> says no such file (--json ok false; a feature name still works); create --question / --timebox name the flag and the spike command; a change's create note gives the CLI approve line on the CLI (spec_approve over MCP) (got " +
      JSON.stringify([bug.out.trim().slice(0, 80), ears.map((r) => r.out.trim().slice(0, 80)), q.out.trim().slice(0, 140), tb.out.trim().slice(0, 80), ch.out.slice(0, 400)]) + ")");
  }

  // 1.25.1 (review 7) — the CLI's own options. A process with its own env and cwd: { out, stdout, code }.
  const cliIn = (args, env, cwd) => {
    const e = { ...process.env, SPEC_PROJECT_DIR: "", CLAUDE_PROJECT_DIR: "", ...(env || {}) };
    const r = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", env: e, cwd: cwd || tmp });
    return { out: (r.stdout || "") + (r.stderr || ""), stdout: r.stdout || "", code: r.status };
  };
  const jsonOf = (s) => { try { return JSON.parse(s); } catch { return null; } };

  // 1.25.1 r7 (3): --project ~/zz (and SPEC_PROJECT_DIR=~/zz) is the home folder's zz — Windows PowerShell 5.1 passes ~ as typed: it
  // made a folder literally named "~" in the working folder.
  {
    const home = path.join(tmp, "r7-tilde-home"), cwd = path.join(tmp, "r7-tilde-cwd");
    for (const d of [home, cwd]) fs.mkdirSync(d, { recursive: true });
    const env = { HOME: home, USERPROFILE: home };
    const init = cliIn(["init", "--project", "~/zz"], env, cwd);
    const create = cliIn(["create", "Alpha", "core", "--project=~" + path.sep + "zz"], env, cwd);
    const list = cliIn(["list", "--json"], { ...env, SPEC_PROJECT_DIR: "~/zz" }, cwd);
    const missing = jsonOf(cliIn(["list", "--json", "--project", "~/nope"], env, cwd).stdout);
    const C = require(path.join(__dirname, "completion.js"));
    ok(init.code === 0 && fs.existsSync(path.join(home, "zz", ".specs", "steering")) && create.code === 0 && fs.existsSync(path.join(home, "zz", ".specs", "alpha")) &&
      list.code === 0 && /"alpha"/.test(list.out) && fs.readdirSync(cwd).length === 0 && missing && missing.ok === false && missing.error.includes(path.join(home, "nope")) &&
      C.expandHome("~user") === "~user",
      "1.25.1 r7: --project ~/zz / --project=~\\zz / SPEC_PROJECT_DIR=~/zz are the home folder's zz (init, create, list) — no '~' folder in the working folder; a missing one names the expanded path (got " +
      JSON.stringify([init.code, init.out.slice(0, 120), create.code, list.code, fs.readdirSync(cwd), missing]) + ")");
  }
};
