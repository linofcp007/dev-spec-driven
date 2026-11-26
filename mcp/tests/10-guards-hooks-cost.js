"use strict";
// Guards and hooks — what the hooks cost and how they run: the stop gate's work-shaped claims, the hooks' exec form, the observe hook's async run and its placeholder pre-filter, SessionStart's dev-spec probe.
// (10-guards-guard-downs.js holds the other hook pre-filters.)

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = async ({ ok, all, remeasure, S, tmp, __dirname, require, handRoadmap }) => {
  const js = JSON.stringify;
  const HOOKS = path.join(__dirname, "..", "hooks");
  // The runner may itself run inside Claude Code: its CLAUDE_PROJECT_DIR / SPEC_PROJECT_DIR never leak into the hooks.
  const hookEnv = (env) => ({ ...process.env, CLAUDE_PROJECT_DIR: "", SPEC_PROJECT_DIR: "", ...(env || {}) });
  // A hook run that could not start or finish (spawn refused under memory pressure, the 20 s timeout) has no output: its stdout /
  // stderr read "" and `spawnFailure` says why — the assertion fails naming it, never a TypeError that ends the file (r14).
  const hook = (name, pl, env, args, cwd) => {
    const r = spawnSync(process.execPath, [...(args || []), path.join(HOOKS, name + ".js")],
      { input: typeof pl === "string" ? pl : js(pl), encoding: "utf8", env: hookEnv(env), cwd: cwd || tmp, timeout: 20000 });
    const spawnFailure = r.error ? String(r.error.code || r.error.message) : r.status === null ? "killed by " + r.signal : null;
    return { ...r, stdout: String(r.stdout || ""), stderr: String(r.stderr || ""), spawnFailure };
  };
  const spawnFailures = (rs) => rs.filter((r) => r.spawnFailure).map((r) => r.spawnFailure);
  const project = (name, lang) => {
    const p = path.join(tmp, name);
    S.initProject(p, ["core"], lang || "en");
    return p;
  };

  // Finding 1 — the stop gate's claims are about the WORK. A bare verb or participle ("verified", "implemented", "completed", PT
  // "verifiquei" / "concluí" / "implementado", ES "verifiqué" / "terminé" / "implementada", a line-start "Listo," / "Done." before an
  // unrelated summary) sent the turn back while any feature active in the last 4 h had an unverified tick — one more model round-trip a
  // turn. First-person completion claims about the work stay; "Work complete — ready to merge." / "Pronto para merge" / "Listo para el
  // merge" claimed nothing.
  {
    const p = project("r7-claims");
    const f = S.createFeature(p, "Pay", ["core"], "", undefined, "en");
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "- [ ] 1. [US1] Charge\n  - _Verify: npm test_\n- [ ] 2. [US1] Refund\n");
    S.completeTask(p, "pay", 1); // ticked just now, no evidence: a claim is sent back
    const gate = (m) => S.stopCheck(p, { message: m });
    const claimed = (m) => { const r = S.stopClaims(m); return r.claim && !r.admitted; };
    // the review's 17 closing messages (none claims the work done), and more of their kind
    const NOT = ["The pay() function is implemented in src/pay.ts and called from api.ts.", "I verified that the bug is in the parser: line 42 drops the last token.",
      "According to the changelog, the migration was completed in 2023.", "I implemented task 3 but could not run npm test here, so it is not verified.",
      "Should I mark task 4 as done?", "Once the tests pass, I'll mark it done.", "Done. I updated the README wording as you asked.", "Here is the summary of the layout you asked about.",
      "Verifiquei o ficheiro e não encontrei o erro.", "Concluí que o problema está na configuração do proxy.", "O método está implementado em src/pay.ts.",
      "Pronto, aqui está o resumo do ficheiro.", "Acabei de ler o código; segue a análise.",
      "Verifiqué el archivo y el error está en la línea 20.", "Terminé de leer el código; aquí tienes el análisis.", "La función está implementada en src/pay.ts.",
      "Listo, aquí tienes el resumen.",
      "I've verified that the cache key includes the tenant id.", "I've finished reading the code; here is what I found.", "Validation is done in the controller, not in the model.",
      "This is done by the middleware before the handler runs.", "Here is how the retry is implemented: it wraps fetch.", "Implemented in 2019, the parser predates the tokenizer.",
      "Terminei de rever o código: o erro está no parser.", "A migração foi concluída em 2023.", "He verificado que el error está en el parser.", "La migración fue completada en 2023."];
    // first-person completion claims about the work (task / feature / everything / the tests), and the misses
    const YES = ["I've implemented task 3.", "I implemented task 3.", "All tasks are done.", "The feature is complete.", "Everything is done.", "Done.", "✅ Done",
      "Implemented and verified.", "Implemented the retry logic in src/pay.ts.", "Work complete — ready to merge.", "The branch is ready to merge.", "Good to go.",
      "Implementei a tarefa 3.", "Está tudo feito.", "A funcionalidade está concluída.", "Terminei.", "Pronto para merge", "Tarefa concluída.",
      "He terminado la tarea.", "Terminé la tarea 2.", "Se han implementado todos los cambios.", "Listo para el merge", "Trabajo terminado.", "Hecho."];
    const falseBlocks = NOT.filter((m) => claimed(m) || gate(m).block);
    const missed = YES.filter((m) => !claimed(m) || gate(m).block !== true || gate(m).why !== "unverified");
    // the Stop hook: a turn that claims nothing about the work ends silent (the claim pre-filter or the engine), a claim is sent back
    const stopPl = (m) => ({ session_id: "s", cwd: p, hook_event_name: "Stop", stop_hook_active: false, last_assistant_message: m });
    const hNot = ["Done. I updated the README wording as you asked.", "Listo, aquí tienes el resumen.", "I verified that the bug is in the parser."].map((m) => hook("stop-hook", stopPl(m)));
    const hYes = ["Work complete — ready to merge.", "Pronto para merge", "Listo para el merge"].map((m) => hook("stop-hook", stopPl(m)));
    const blockOf = (r) => { try { return JSON.parse(r.stdout).decision === "block"; } catch { return false; } };
    ok(!falseBlocks.length && !missed.length && hNot.every((r) => r.status === 0 && r.stdout === "") && hYes.every((r) => r.status === 0 && blockOf(r)),
      "1.25.1 (r7 finding 1): the stop gate claims the WORK only — no bare verb ('I verified that…', 'was completed in 2023', 'Verifiquei o ficheiro', 'Terminé de leer', 'Listo, aquí tienes…', 'Done. I updated the README') is sent back while a recent tick is unverified; first-person completion claims and 'ready to merge' / 'pronto para merge' / 'listo para el merge' are (false blocks: " +
      js(falseBlocks) + ", missed: " + js(missed) + ", hook: " + js(hNot.map((r) => r.stdout.slice(0, 40)).concat(hYes.map(blockOf))) +
      (spawnFailures(hNot.concat(hYes)).length ? ", hook runs that failed to run: " + js(spawnFailures(hNot.concat(hYes))) : "") + ")");
  }

  // Finding 2 — every hook ran in shell form (`node "${CLAUDE_PLUGIN_ROOT}/hooks/x.js"`): on Windows each spawn went through Git Bash
  // (+~40 ms) or, without it, PowerShell (+~300 ms) — three hooks a Write / Edit. Exec form (Claude Code 2.1.139+): `node` spawned
  // directly, the script its one argument, `${CLAUDE_PLUGIN_ROOT}` substituted as a plain string. Every entry, as Claude Code runs it.
  {
    const root = path.join(__dirname, "..");
    const cfg = JSON.parse(fs.readFileSync(path.join(HOOKS, "hooks.json"), "utf8")).hooks;
    const entries = Object.entries(cfg).flatMap(([ev, list]) => list.flatMap((e) => e.hooks.map((h) => ({ ev, h }))));
    const bad = entries.filter(({ h }) => !(h.type === "command" && h.command === "node" && Array.isArray(h.args) && h.args.length === 1 &&
      /^\$\{CLAUDE_PLUGIN_ROOT\}\/hooks\/[\w-]+\.js$/.test(h.args[0]) && fs.existsSync(path.join(root, h.args[0].slice("${CLAUDE_PLUGIN_ROOT}/".length))) && h.timeout === 10))
      .map(({ ev, h }) => ev + ": " + js(h));
    // spawned as Claude Code does in exec form: `node` + the substituted argument (a clone path with a space, unquoted), an irrelevant payload → exit 0, silent
    const spawned = entries.map(({ ev, h }) => spawnSync("node", h.args.map((a) => a.split("${CLAUDE_PLUGIN_ROOT}").join(root)), { input: js({ hook_event_name: ev, cwd: tmp, session_id: "s" }),
      encoding: "utf8", env: hookEnv(), cwd: tmp, timeout: 20000 }));
    const req = (t) => /Claude Code 2\.1\.139 (?:or later|ou posterior|o posterior)/.test(t);
    const install = fs.readFileSync(path.join(root, "INSTALL.md"), "utf8");
    // 1.26: one README per language, the requirement in its Requirements section (the quick start's first line until then)
    const quick = ["README.md", "README.pt.md", "README.es.md"].map((f) => fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/g, "\n"))
      .map((t) => { const m = t.match(/\n## (?:Requirements|Requisitos)\n/); return m ? t.slice(m.index, m.index + 400) : ""; });
    ok(entries.length >= 9 && !bad.length && spawned.every((r) => r.status === 0 && r.stdout === "") && req(install.slice(0, 600)) && quick.every(req),
      "1.25.1 (r7 finding 2): every hooks.json entry is exec form — command 'node', args [${CLAUDE_PLUGIN_ROOT}/hooks/<script>] (an existing script), timeout 10 — and runs as Claude Code spawns it (no shell); INSTALL.md and the Requirements of README.md / .pt.md / .es.md require Claude Code 2.1.139+ (got " +
      js({ n: entries.length, bad, spawned: spawned.map((r) => r.status + ":" + r.stdout.slice(0, 30)), quick: quick.map(req) }) + ")");
  }

  // Finding 3 — the observe hook prints nothing and decides nothing, yet ran synchronously after every Bash / PowerShell call: both of
  // its entries (PostToolUse, PostToolUseFailure — the docs exclude no event from `async`) run in the background now. Every other hook
  // answers something (a decision, context) and stays synchronous.
  {
    const cfg = JSON.parse(fs.readFileSync(path.join(HOOKS, "hooks.json"), "utf8")).hooks;
    const all = Object.entries(cfg).flatMap(([ev, list]) => list.flatMap((e) => e.hooks.map((h) => ({ ev, matcher: e.matcher, script: path.basename((h.args || [""])[0]), async: h.async }))));
    const obs = all.filter((x) => x.script === "observe-hook.js");
    const asyncOthers = all.filter((x) => x.script !== "observe-hook.js" && x.async !== undefined);
    const src = fs.readFileSync(path.join(HOOKS, "observe-hook.js"), "utf8");
    ok(js(obs.map((x) => x.ev + "/" + x.matcher + "/" + x.async)) === js(["PostToolUse/^(Bash|PowerShell)$/true", "PostToolUseFailure/^(Bash|PowerShell)$/true"]) && !asyncOthers.length &&
      !/process\.stdout\.write/.test(src),
      "1.25.1 (r7 finding 3): both observe-hook entries are async (PostToolUse and PostToolUseFailure, Bash|PowerShell) — it writes nothing to stdout; no other hook is async (got " +
      js({ obs, asyncOthers }) + ")");
  }

  // A probe preloaded into a hook (`node -r probe <hook>`): on exit it writes whether the engine (mcp/lib/spec.js) was loaded.
  const probe = path.join(tmp, "r7-probe.js"), probeOut = path.join(tmp, "r7-probe.out");
  fs.writeFileSync(probe, "process.on('exit', () => require('fs').writeFileSync(" + js(probeOut) + ", String(Object.keys(require.cache).some((k) => /[\\\\/]mcp[\\\\/]lib[\\\\/]spec\\.js$/.test(k)))));\n");
  const probed = (name, pl, env, cwd) => {
    try { fs.unlinkSync(probeOut); } catch { /* none */ }
    const r = hook(name, pl, env, ["-r", probe], cwd);
    return { status: r.status, stdout: r.stdout, engine: fs.existsSync(probeOut) ? fs.readFileSync(probeOut, "utf8") === "true" : null };
  };

  // Finding 1, its cost — the work-shaped claims are larger patterns (47, ~14 K characters): compiled all together the Stop hook's
  // pre-filter took ~50 ms (was ~14). Each language's trigger words (i18n stopGate.triggers) gate its patterns — in the engine
  // (stopClaims) and in the hook (the build's `triggers` groups): the same answers as running every pattern, on handwritten and
  // generated messages of the three languages; a message holding no trigger ends the hook before any claim pattern compiles.
  {
    const HU = require("../hooks/hook-utils.js");
    const f = JSON.parse(fs.readFileSync(path.join(HOOKS, "stop-claims.generated.json"), "utf8"));
    const gated = (m) => {
      const prose = HU.claimProse(m, f.prose), idx = new Set();
      for (const t of f.triggers || []) if (new RegExp(f.word.pre + t.source + f.word.post, "iu").test(prose)) t.claims.forEach((i) => idx.add(i));
      return idx.size > 0 && HU.claimMatch(m, { ...f, claims: [...idx].sort((a, b) => a - b).map((i) => f.claims[i]) });
    };
    const hand = ["All tasks done.", "I've implemented task 3.", "Feito. Todos os testes passam.", "La tarea 2 está terminada.", "Tudo funcionando.", "Os testes estão passando.",
      "Isso funciona.", "**Status:** DONE_WITH_CONCERNS", "Status: done", "Good to go.", "Ready for review.", "Pronto para merge", "Listo para el merge", "Todo probado.",
      "Hecho ✅", "✅ Feito", "Implementado e verificado.", "Se han implementado todos los cambios.", "14/14 passing", "Everything works now.", "Fully tested.",
      "Here is the summary of the layout.", "Done. I updated the README wording as you asked.", "I verified that the bug is in the parser."];
    let seed = 11;
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    const frags = ["All", "tasks", "task 3", "is", "are", "done", "complete", "implemented", "verified", "I", "I've", "we", "the feature", "everything", "works", "tests", "pass",
      "ready to merge", "good to go", "Status:", "DONE", "not", "?", ".", ",", "—", "\n", "✅", "a tarefa 2", "está", "foi", "feito", "concluída", "terminei", "implementei", "tudo",
      "pronto para merge", "os testes", "passam", "a passar", "verdes", "funciona", "la tarea", "están", "terminada", "hecho", "listo", "he", "se ha", "completado", "terminé",
      "las pruebas", "pasan", "en verde", "probado", "que", "de leer", "in src/a.ts", "x"];
    const gen = [];
    for (let i = 0; i < 2500; i++) { let m = ""; const n = 1 + Math.floor(rnd() * 10); for (let k = 0; k < n; k++) m += frags[Math.floor(rnd() * frags.length)] + (rnd() < 0.85 ? " " : ""); gen.push(m); }
    const all = hand.concat(gen);
    const differ = all.filter((m) => js(S.stopClaims(m)) !== js(S.stopClaims(m, { allPatterns: true })));
    const filtered = all.filter((m) => S.stopClaims(m).claim && !gated(m));
    const claims = all.filter((m) => S.stopClaims(m).claim).length;
    // the hook: no trigger → silent, no engine; a trigger but no claim → silent, no engine; a claim → the engine's block
    const p = project("r7-triggers");
    const fe = S.createFeature(p, "Pay", ["core"], "", undefined, "en");
    fs.writeFileSync(path.join(fe.dir, "tasks.md"), "- [ ] 1. [US1] Charge\n  - _Verify: npm test_\n");
    S.completeTask(p, "pay", 1);
    const stop = (m) => probed("stop-hook", { session_id: "s", cwd: p, hook_event_name: "Stop", stop_hook_active: false, last_assistant_message: m });
    const h = ["Here is the summary of the layout.", "Done. I updated the README wording as you asked.", "Tudo funcionando."].map(stop);
    const blocked = (r) => { try { return JSON.parse(r.stdout).decision === "block"; } catch { return false; } };
    ok(f.triggers && f.triggers.length === 3 && !differ.length && !filtered.length && claims > 300 &&
      h[0].stdout === "" && h[0].engine === false && h[1].stdout === "" && h[1].engine === false && blocked(h[2]) && h[2].engine === true,
      "1.25.1 (r7 finding 1): each language's trigger words gate its claim patterns — stopClaims answers as with every pattern, and the hook's gated pre-filter lets every claim through (" +
      all.length + " messages, " + claims + " claims); no trigger, or a trigger without a claim, ends the Stop hook before the engine loads (got " +
      js({ differ: differ.slice(0, 3), filtered: filtered.slice(0, 3), hook: h.map((r) => [r.engine, r.stdout.slice(0, 30)]) }) + ")");
  }

  // Finding 4 — SessionStart (every session of every project: startup, resume, clear, compact) loaded the engine before asking whether
  // a dev-spec project was there: 132 vs 49 ms (`node -e 0`) in a repository without one. The raw probe runs first — the nearest
  // dev-spec .specs/ at or above the cwd (≤ SESSION_MAX_UP levels), the anchors — and only a hit loads the engine.
  // Finding 6 — the context it prints stays bounded: ≤ 20 feature lines, then one "+N more" line.
  {
    const E = require("./lib/engine/index.js");
    const ss = (cwd) => ({ session_id: "s", cwd, hook_event_name: "SessionStart", source: "startup" });
    const none = path.join(tmp, "r7-ss-none", "a", "b", "c");
    fs.mkdirSync(none, { recursive: true });
    const other = path.join(tmp, "r7-ss-other");
    fs.mkdirSync(path.join(other, ".specs", "notes"), { recursive: true }); // another tool's .specs/
    const dev = project("r7-ss-dev");
    S.createFeature(dev, "Alpha", ["core"]);
    const deep = path.join(dev, "src", "a", "b");
    fs.mkdirSync(deep, { recursive: true });
    const big = handRoadmap(project("r7-ss-big")); // roadmap not under test here: its refresh skipped (harness handRoadmap) — 25 creates
    for (let i = 1; i <= 25; i++) S.createFeature(big, "Feature " + i, ["core"]);
    const r = {
      none: probed("spec-hook", ss(none)), other: probed("spec-hook", ss(other)), noCwd: probed("spec-hook", { session_id: "s", hook_event_name: "SessionStart" }, null, none),
      deep: probed("spec-hook", ss(deep)), anchor: probed("spec-hook", ss(none), { CLAUDE_PROJECT_DIR: dev }), big: probed("spec-hook", ss(big)),
    };
    const ctx = (x) => { try { return JSON.parse(x.stdout).hookSpecificOutput.additionalContext; } catch { return ""; } };
    const bigLines = ctx(r.big).split("\n");
    // 1.27: the walk is the project probe's (mcp/lib/probe.js sessionProjects — the one every hook runs), bounded by its SESSION_MAX_UP
    const bound = /probe\(\)|PR\.sessionProjects\(/.test(fs.readFileSync(path.join(HOOKS, "spec-hook.js"), "utf8")) ? require("./lib/probe.js").SESSION_MAX_UP : null;
    ok([r.none, r.other].every((x) => x.status === 0 && x.stdout === "" && x.engine === false) && r.noCwd.status === 0 && r.noCwd.stdout === "" && r.noCwd.engine === false &&
      [r.deep, r.anchor].every((x) => x.engine === true && /alpha/.test(ctx(x))) && bound === E.SESSION_MAX_UP &&
      bigLines.length <= 22 && bigLines.filter((l) => /^\s*\S.*\[core\]/.test(l)).length <= 20 && /\+5 more feature/.test(ctx(r.big)),
      "1.25.1 (r7 findings 4 + 6): SessionStart in a folder without a dev-spec .specs/ (none, another tool's) exits before the engine loads; a project 3 folders above the cwd or named by CLAUDE_PROJECT_DIR still gets its status; the walk is SESSION_MAX_UP; 25 features print ≤ 20 lines + '+5 more' (got " +
      js({ none: r.none, other: r.other, noCwd: r.noCwd.stdout, deep: [r.deep.engine, ctx(r.deep).slice(0, 60)], anchor: r.anchor.engine, bound, big: bigLines.length }) + ")");
  }

  // Finding 5 — the observe hook's pre-filter read a scaffold's untouched `_Verify: [command that proves it, e.g. npm test -- …]_`:
  // every `npm test` loaded the engine (152 vs 59 ms) to log nothing. A whole bracketed _Verify:_ value is a placeholder — out of the
  // text before the match; a real command (`[ -f a ] && npm test`, `npm test`) still passes it.
  {
    const p = project("r7-obs");
    const f = S.createFeature(p, "Login", ["core", "tdd"]); // the scaffold: _Verify: [command that proves it, e.g. npm test -- path/to/file.test.js]_
    const tasksFile = path.join(f.dir, "tasks.md");
    const scaffold = fs.readFileSync(tasksFile, "utf8");
    const log = path.join(f.dir, ".execution", "observed.jsonl");
    const run = (cmd) => probed("observe-hook", { session_id: "s", cwd: p, hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: { command: cmd },
      tool_response: { stdout: "ok", stderr: "", exit_code: 0 } });
    const lines = () => { try { return fs.readFileSync(log, "utf8").split("\n").filter(Boolean).length; } catch { return 0; } };
    const placeholder = run("npm test");
    fs.writeFileSync(tasksFile, scaffold + "\n- [ ] 9. [US1] Backticked placeholder\n  - _Verify: `[npm test]`_\n");
    const backticked = run("npm test");
    fs.writeFileSync(tasksFile, scaffold + "\n- [ ] 9. [US1] Shell test\n  - _Verify: [ -f package.json ] && npm test_\n");
    const shellTest = run("npm test");
    fs.writeFileSync(tasksFile, scaffold + "\n- [ ] 9. [US1] Real\n  - _Verify: npm test_\n");
    const before = lines();
    const real = run("npm test");
    ok(!/npm test/.test(scaffold.replace(/_Verify:[ \t]*`*[ \t]*\[[^\n]*?\][ \t]*`*[ \t]*_/gi, " ")) && /_Verify: \[[^\]\n]*npm test/.test(scaffold) &&
      [placeholder, backticked].every((x) => x.status === 0 && x.engine === false) && shellTest.engine === true && real.engine === true && lines() === before + 1,
      "1.25.1 (r7 finding 5): the observe hook's pre-filter skips a placeholder _Verify: [ … npm test … ]_ (bare or backticked) — the engine isn't loaded; `[ -f a ] && npm test` and a real `_Verify: npm test_` still pass it, and the real one is logged (got " +
      js({ placeholder: placeholder.engine, backticked: backticked.engine, shellTest: shellTest.engine, real: real.engine, logged: lines() - before }) + ")");
  }

  // Review 8 (ds-security finding 3) — the guards' pre-filters are LINEAR in the payload's text. A regex whose run class holds its own
  // start delimiter rescans the run from every start: `echo =.=.…` (120 K characters) cost the approval hook 16.7 s against its 10 s
  // timeout, and a timed-out PreToolUse hook doesn't block the call — the guard-down behind it went through. The same shape in the edit
  // guard's path words (`=a=a…`), its `find … -delete` pre-filter (`find find …`), the guarded-file regexes (`.specs/.specs/…` in a
  // Write path) and `[\\/]+$` trims. Timed by SHAPE, never by milliseconds: each reader on a hostile input of n and 4n characters — a
  // linear scan ~4×, the old ones ~16× (2.8 s at 64 K for the dot glob) — bounded at 12× + 20 ms, each size the fastest of up to five runs.
  {
    const E = require("./lib/engine/index.js");
    const PR = require("./lib/probe.js");
    const AH = require("../hooks/approval-hook.js"), GH = require("../hooks/guard-hook.js"), HU = require("../hooks/hook-utils.js");
    const BS = String.fromCharCode(92);
    const rep = (unit, n, tail) => unit.repeat(Math.ceil(n / unit.length)).slice(0, n) + (tail || "");
    const dec = (tool, ti) => E.approvalGuardDecision({ hook_event_name: "PreToolUse", tool_name: tool, tool_input: ti }, "deny", { meta: {}, lang: "en" });
    const READERS = [
      ["approvalCandidate (=.=.… then a glob)", (s) => E.approvalCandidate(s), "=.", " {*"],
      ["approvalCandidate ((.(.… then a glob)", (s) => E.approvalCandidate(s), "(.", " {*"],
      ["the approval hook's candidate", (s) => AH.candidate(s), "=.", " {*"],
      ["approvalGuardDecision, Bash", (s) => dec("Bash", { command: s }), "=.", " {; cp a .s*/b"],
      ["approvalGuardDecision, PowerShell", (s) => dec("PowerShell", { command: s }), "(.", " {*"],
      ["the edit guard's mayWrite (find find …)", (s) => GH.mayWrite(s), "find ", ""],
      ["the edit guard's pathWords (=a=a…)", (s) => GH.pathWords(s), "=a", ""],
      ["guardedFileOf (.specs/.specs/…)", (s) => PR.guardedFileOf(s), ".specs/", "x"],
      ["approvalGuardDecision, Write (.specs\\.specs\\…)", (s) => dec("Write", { file_path: s }), BS + ".specs", BS + ".state.json"],
      ["specsParentOf (////…)", (s) => PR.specsParentOf(s), "/", "x/.specs/roadmap.json"],
      ["trimSlashEnd (////…x)", (s) => PR.trimSlashEnd(s), "/", "x"],
      ["dotGlob (=.=.…)", (s) => PR.dotGlob(s), "=.", ""],
      // dev-guardian's rules (1.30 — engine/guardian.js through the hook points): its files, its pre-filter word, its shell reader
      ["guardedFileOf (.guardian/.guardian/…)", (s) => PR.guardedFileOf(s), ".guardian/", "baseline.json"],
      ["specsParentOf (////…/.guardian/)", (s) => PR.specsParentOf(s), "/", "x/.guardian/baseline.json"],
      ["approvalGuardDecision, Write (.guardian\\.guardian\\…)", (s) => dec("Write", { file_path: s }), BS + ".guardian", BS + "baseline.json"],
      ["approvalGuardDecision, Bash (guardian guardian …)", (s) => dec("Bash", { command: s }), "guardian ", " baseline update"],
      ["approvalGuardDecision, Bash (dev-guardian baseline update; …)", (s) => dec("Bash", { command: s }), "dev-guardian baseline update;", ""],
      ["approvalGuardDecision, Bash (DEV_GUARDIAN_CLI=x …)", (s) => dec("Bash", { command: s }), "DEV_GUARDIAN_CLI=x ", "node .specs/guardian.cjs scan"],
      ["the approval hook's decide, Write (.guardian\\.guardian\\…)", (s) => AH.decide(js({ hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: s } })),
        BS + ".guardian", BS + "baseline.json"],
      // review 9: .guardian/ as a whole (shellPathFacts' guardian segment), an MCP move onto it, the nested projects a command's path
      // words name (hook-utils approvalProjects — quoted words too) and the backticked _Implements:_ slot (placeholderReport)
      ["approvalGuardDecision, Bash (rm -rf .guardian/.guardian/…)", (s) => dec("Bash", { command: "rm -rf " + s }), ".guardian/", ""],
      ["approvalGuardDecision, Bash (cp -r x .guardian/… then .guardian)", (s) => dec("Bash", { command: "cp -r x " + s }), "x/.guardian/", ".guardian"],
      ["approvalGuardDecision, MCP move (.guardian\\.guardian\\…)", (s) => dec("mcp__fs__move_file", { source: "x", destination: s }), BS + ".guardian", ""],
      ["approvalProjects (a/.specs/x a/.specs/x …)", (s) => HU.approvalProjects({ cwd: tmp, command: s }), "a/.specs/x ", ""],
      ["approvalProjects ('\"'\"… then .guardian/)", (s) => HU.approvalProjects({ cwd: tmp, command: s }), "'\"", " sub/.guardian/"],
      ["placeholderReport (_Implements: `[x]`, `[x]`, …)", (s) => E.placeholderReport("- _Implements: " + s + "_"), "`[x]`, ", ""],
      // 1.30.1: Windows' own readings of a path — the 8.3 rule (a word that may be an alias, a path's aliases read, the folder holding
      // one), Win32's trailing dots / spaces, the engine's shell reading of them (its disk calls bounded: SHORT_DISK_PATHS paths, each
      // ≤ SHORT_DISK_UP levels — past them the rule alone) and the edit tools' (≤ EDIT_MAX_UP levels)
      ["mayShortName (SPECS~SPECS~…)", (s) => PR.mayShortName(s), "SPECS~", ""],
      ["mayShortName (SP1A2B SP1A2B …)", (s) => PR.mayShortName(s), "SP1A2B ", ""],
      ["shortNamesRead (SPECS~1/SPECS~1/…)", (s) => PR.shortNamesRead(s), "SPECS~1/", "ROADMA~1.JSO"],
      ["winPathTrim (a./a./…)", (s) => PR.winPathTrim(s), "a./", ". . "],
      ["winPathTrim (. . . … x)", (s) => PR.winPathTrim(s), ". ", "x"],
      ["winPathTrim (a::$I/a::$I/…)", (s) => PR.winPathTrim(s), "a::$I/", "roadmap.json."],
      ["specsParentOf (////…/SPECS~1/)", (s) => PR.specsParentOf(s, true), "/", "x/SPECS~1/guardian.cjs"],
      ["editTargets (SPECS~1\\SPECS~1\\…)", (s) => PR.editTargets(s, tmp, true), BS + "SPECS~1", BS + "STATE~1.JSO."],
      ["approvalGuardDecision, Bash (cp x SPECS~1/SPECS~1/…)", (s) => E.approvalGuardDecision({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "cp x " + s },
        cwd: tmp }, "deny", { meta: {}, lang: "en", win: true }), "SPECS~1/", "roadmap.json"],
      ["approvalGuardDecision, Bash (rm SPECS~1/a SPECS~1/a …)", (s) => E.approvalGuardDecision({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "rm " + s },
        cwd: tmp }, "deny", { meta: {}, lang: "en", win: true }), "SPECS~1/a ", ""],
      ["approvalGuardDecision, PowerShell (Set-Content a. a. …)", (s) => E.approvalGuardDecision({ hook_event_name: "PreToolUse", tool_name: "PowerShell",
        tool_input: { command: "Set-Content -Path " + s + " -Value x" }, cwd: tmp }, "deny", { meta: {}, lang: "en", win: true }), "a.\\", ".specs\\roadmap.json."],
      ["approvalProjects (a/SPECS~1/x a/SPECS~1/x …)", (s) => HU.approvalProjects({ cwd: tmp, command: s }), "a/SPECS~1/x ", ""],
      ["the approval hook's decide, Bash (echo x > GUARDI~1/… )", (s) => AH.decide(js({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "echo x > " + s } })),
        "GUARDI~1/", "BASELI~1.JSO"],
    ];
    // (1.35.4 review 1: ONE run of each size, bounded at max(50 ms, 8×), missed under the pre-push gate's parallel run — 6.1 ms at
    // 16 K, 97.9 ms at 64 K: a spike in the one 64 K run. Each size is now the FASTEST of its runs, the two sizes run in turns, a
    // pair more while the bound misses — five at most: a spike lengthens a run, never the fastest of five, and a loaded machine
    // slows both sizes alike. Linear is ×4, quadratic ×16; the old patterns took seconds at 64 K.)
    // (1.35.4 review 3: 8× + 5 ms still missed with the check and both suites run at once: approvalGuardDecision
    // passed by 0.04 ms, 22.29 → 183.28 ms against 183.32, and failed at 5.2 → 76.5 ms — over a natural ×6 unloaded, 7.2 → 43.8 ms.
    // The bound is 12× + 20 ms: a quadratic reader is ×16 and seconds at 64 K, past it by hundreds of ms.)
    const time = (f, s) => { const t = process.hrtime.bigint(); f(s); return Number(process.hrtime.bigint() - t) / 1e6; };
    const bound = (t1) => 12 * t1 + 20;
    const linear = (x) => x.t4 <= bound(x.t1);
    const shape = {};
    let slowest = null; // the reader nearest its bound: [name, ms at 16 K, ms at 64 K, runs]
    for (const [name, f, unit, tail] of READERS) {
      const small = rep(unit, 16000, tail), big = rep(unit, 64000, tail);
      f(small);
      const best = { t1: Infinity, t4: Infinity };
      const s = remeasure(() => { best.t1 = Math.min(best.t1, time(f, small)); best.t4 = Math.min(best.t4, time(f, big)); return { t1: best.t1, t4: best.t4 }; }, linear, 5);
      shape[name + " — " + s.t1.toFixed(1) + " ms at 16 K, " + s.t4.toFixed(1) + " ms at 64 K (the fastest of " + s.tries + ")"] = linear(s);
      if (!slowest || s.t4 / bound(s.t1) > slowest[2] / bound(slowest[1])) slowest = [name, +s.t1.toFixed(2), +s.t4.toFixed(2), s.tries];
    }
    all("review 8 (ds-security 3): every guard pre-filter scan is linear — 4× the input costs ≤ 12× the time + 20 ms (1.35.4 review 1: each size the fastest of up to five runs, the sizes in turns; 1.35.4 review 3: 12× + 20 ms, was 8× + 5 ms — passed by 0.04 ms under the pre-push shape) on the hostile inputs that ran the approval hook past its timeout (got, nearest its bound: " + js(slowest) + ")", shape);

    // …and each answers as the pattern it replaced (kept here, on short inputs only): the same answer on random texts of the characters
    // that matter — the path words a superset (an extra candidate only adds a check; none of the old ones is lost, at the 8-word cap too).
    {
      let seed = 8;
      const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
      const gen = (alpha, max) => { let s = ""; for (let i = rnd(max + 1); i > 0; i--) s += alpha[rnd(alpha.length)]; return s; };
      const OLD_DOT = /(?:^|[\s/\\'"=,(;&|])\.[^\s/\\'";&|]*[*?[{]/;
      const OLD_ROADMAP = /(?:^|[\\/])\.specs[\\/]+roadmap\.json$/i, OLD_STATE = /(?:^|[\\/])\.specs[\\/]+(?:[^\\/]+[\\/]+)+\.state\.json$/i,
        OLD_OBS = /(?:^|[\\/])\.specs[\\/]+(?:[^\\/]+[\\/]+)*\.execution[\\/]+observed\.jsonl$/i;
      // (and 1.30's dev-guardian files — guardian.js's two regexes before they joined guardedFileOf)
      const OLD_LAUNCHER = /(?:^|\/)\.specs\/+guardian\.cjs$/i, OLD_BASELINE = /(?:^|\/)\.guardian\/+baseline\.json$/i;
      const oldGuarded = (t) => {
        if (OLD_ROADMAP.test(t)) return { setting: "roadmap" };
        const segs = t.split("/");
        if (OLD_OBS.test(t)) { const f = segs[segs.length - 3]; return { setting: "observed", feature: f && f.toLowerCase() !== ".specs" ? f : null }; }
        if (OLD_STATE.test(t)) return { setting: "state", feature: segs[segs.length - 2] || null };
        if (OLD_LAUNCHER.test(t)) return { setting: "guardian-launcher" };
        if (OLD_BASELINE.test(t)) return { setting: "guardian-baseline" };
        return null;
      };
      const OLD_FIND = /(?:^|[^\w.-])(?:find[^|;&\n]*-(?:delete|exec|execdir|ok|okdir|fprint0?|fprintf|fls))(?![\w-])/i;
      const OLD_WORD = /(?:^|[\s'"=<>|;&(])[^\s'"<>|;&()]*[\\/][^\s'"<>|;&()]*/g;
      const oldWords = (s) => (s.match(OLD_WORD) || []).slice(0, 8).map((w) => w.replace(/^[\s'"=<>|;&(]+/, ""));
      const diff = { dotGlob: [], guardedFileOf: [], specsParentOf: [], mayWrite: [], pathWords: [] };
      const SEG = [".specs", ".SPECS", "a", ".execution", "observed.jsonl", ".state.json", "roadmap.json", "x.specs", ".guardian", "guardian.cjs", "baseline.json"];
      for (let i = 0; i < 20000; i++) {
        const d = gen([".", "=", "*", "?", "{", "[", "a", " ", "/", BS, "'", "\"", ",", "(", ";", "&", "|"], 14);
        if (OLD_DOT.test(d) !== PR.dotGlob(d)) diff.dotGlob.push(d);
        const segs = []; for (let k = 1 + rnd(5); k > 0; k--) segs.push(SEG[rnd(SEG.length)]);
        const g = (rnd(3) ? "" : "/") + segs.join("/");
        if (js(oldGuarded(g)) !== js(PR.guardedFileOf(g))) diff.guardedFileOf.push(g);
        const sp = gen(["/", BS, ".specs", ".SPECS", "a", "x.specs", ".guardian", "x.guardian"], 6);
        if (/(?:^|[\\/])\.(?:specs|guardian)(?:[\\/]|$)/i.test(sp) && (sp.replace(/[\\/]*\.(?:specs|guardian)(?:[\\/][\s\S]*)?$/i, "") || ".") !== PR.specsParentOf(sp)) diff.specsParentOf.push(sp);
        // (an alphabet no other writer's name can form: here mayWrite answers by its find branch alone)
        const fw = gen(["find", " ", "-delete", "-exec", "x", "|", ";", "&", "\n", "-", ".", "findstr", "-okdir"], 8);
        if (OLD_FIND.test(fw) !== GH.mayWrite(fw)) diff.mayWrite.push(fw);
        const pw = gen(["a", "/", BS, "=", " ", "'", "<", "|", ";", "(", ")", "b"], i % 2 ? 12 : 60);
        const nw = GH.pathWords(pw);
        if (oldWords(pw).some((w) => !nw.includes(w))) diff.pathWords.push(pw);
      }
      all("review 8 (ds-security 3): the linear readers answer as the patterns they replaced on 20,000 random texts each — dotGlob, guardedFileOf, specsParentOf and mayWrite's find branch the same, pathWords a superset (got " +
        js(Object.fromEntries(Object.entries(diff).map(([k, v]) => [k, v.slice(0, 2)]))) + ")", Object.fromEntries(Object.entries(diff).map(([k, v]) => [k, v.length === 0])));
    }

    // …and the process: the report's own payload at deny — answered (deny: a too-long command whose unread tail may name .specs/), well
    // inside the hook's 10 s (a short command's time × 10, at least 5 s — it took 16.7 s and timed out).
    const pg = path.join(tmp, "r8-redos");
    S.initProject(pg, ["core"], "en", { approvalGuard: "deny" });
    const pre = (command) => ({ session_id: "s", hook_event_name: "PreToolUse", cwd: pg, tool_name: "Bash", tool_input: { command } });
    const evil = "echo " + rep("=.", 120000) + " {; cp /tmp/x.json .s*/roadmap.jso?";
    const run = (command) => { const t = Date.now(); const r = hook("approval-hook", pre(command), { CLAUDE_PROJECT_DIR: pg }); return { r, ms: Date.now() - t }; };
    const decisionOf = (r) => { try { return JSON.parse(r.stdout).hookSpecificOutput.permissionDecision; } catch { return "silent"; } };
    const m = remeasure(() => ({ short: run("cp /tmp/x.json .s*/roadmap.jso?"), long: run(evil) }), (x) => x.long.ms <= Math.max(5000, 10 * x.short.ms));
    all("review 8 (ds-security 3): the approval hook answers the 120 K `=.=.…` payload at deny as the short command — deny, within max(5 s, 10 × the short command's time) (got " +
      m.short.ms + " ms / " + m.long.ms + " ms)", {
      shortDeny: () => decisionOf(m.short.r) === "deny", longDeny: () => decisionOf(m.long.r) === "deny",
      fast: () => m.long.ms <= Math.max(5000, 10 * m.short.ms),
    });
  }

  // 1.41.1 (R1) — the guard's globs were RegExps built from the glob (devSpecGlob: a `*` → `[^/\\]*`; shellGlobRe: `[\s\S]*`): a program
  // word, a path segment or the CLI's subcommand of k stars and a letter, tested against the short fixed names (the CLI's script, the
  // guarded files, the guarded subcommands), backtracked ~C(n + k, k) ways — 18 stars ran the approval hook past its 10 s timeout, and
  // the approve after it went through at deny. One linear matcher now (guards.js globMayName). The hook itself, in a CHILD process with
  // a 12 s timeout (the parent's cost at 40 stars is astronomic: a red run times out, never hangs the suite) — each payload answers as
  // its one-star twin (deny; an unreadable subcommand: ask) within max(5 s, 10 × the twin's time).
  {
    const pj = path.join(tmp, "r1411-glob");
    S.initProject(pj, ["core"], "en", { approvalGuard: "deny" });
    const APPROVE = "node cli/dev-spec.js approve feat requirements";
    const SHAPES = {
      "program word (devSpecGlob)": [(k) => "cli/" + "*".repeat(k) + "x approve; " + APPROVE, "deny"],
      "path segment (shellSegCould)": [(k) => "foo .specs/" + "*".repeat(k) + "q; " + APPROVE, "deny"],
      "CLI subcommand (cliSubcommandGlob)": [(k) => "node cli/dev-spec.js " + "*".repeat(k) + "x feat; A=approve; node cli/dev-spec.js $A feat requirements", "ask"],
    };
    const call = (command) => {
      const t = Date.now();
      const r = spawnSync(process.execPath, [path.join(HOOKS, "approval-hook.js")], { encoding: "utf8", env: hookEnv({ CLAUDE_PROJECT_DIR: pj }), cwd: pj, timeout: 12000,
        input: js({ session_id: "s", hook_event_name: "PreToolUse", cwd: pj, tool_name: "Bash", tool_input: { command } }) });
      let decision;
      try { decision = JSON.parse(r.stdout).hookSpecificOutput.permissionDecision; } catch { decision = r.status === null ? "killed by " + r.signal : "silent"; }
      return { decision, ms: Date.now() - t };
    };
    const within = (x) => x.ms <= Math.max(5000, 10 * x.twin.ms);
    const got = {}, checks = {};
    for (const [name, [make, want]] of Object.entries(SHAPES)) {
      const m = remeasure(() => ({ twin: call(make(1)), ...call(make(40)) }), within);
      got[name] = { twin: m.twin.decision + " " + m.twin.ms + " ms", stars40: m.decision + " " + m.ms + " ms", tries: m.tries };
      checks[name + " — the one-star twin: " + want] = m.twin.decision === want;
      checks[name + " — 40 stars: " + want] = m.decision === want;
      checks[name + " — 40 stars within max(5 s, 10 × the twin's time)"] = within(m);
    }
    all("1.41.1 (R1): the approval hook answers a glob of 40 stars — a program word, a path segment, the CLI's subcommand — at deny as its one-star twin, at once (got " + js(got) + ")", checks);
  }

  // …and the linear matcher matches what the RegExps matched — the parent's two builders, verbatim, as the oracle (short globs only: it
  // backtracks): a table of glob × name (case folded as RegExp folds it — the Kelvin sign is no k —, [!set] / [^set], `[!]` any one
  // character, an unclosed `[` itself, a range out of order null, Bash's leading dot, SHELL_VAR / SHELL_ANY) and 20,000 random globs.
  {
    const E = require("./lib/engine/index.js");
    const SV = "\u0001", SA = "\u0002";
    const DEVSPEC_NAMES = ["dev-spec", "dev-spec.js", "dev-spec.cjs", "dev-spec.mjs", "dev-spec.cmd", "dev-spec.ps1", "dev-spec.exe"];
    function oldDevSpecGlob(word) {
      const w = String(word);
      if (w.length > 200 || !/[*?[]/.test(w)) return false;
      const base = w.replace(/^.*[\\/]/, "");
      let re = "";
      for (let i = 0; i < base.length; i++) {
        const c = base[i];
        if (c === "*") re += "[^/\\\\]*";
        else if (c === "?") re += ".";
        else if (c === "[") {
          const end = base.indexOf("]", i + 2);
          if (end < 0) { re += "\\["; continue; }
          const set = base.slice(i + 1, end).replace(/^[!^]/, "^").replace(/[\\\]]/g, "\\$&");
          re += "[" + set + "]";
          i = end;
        } else re += c.replace(/[.+^${}()|\\]/g, "\\$&");
      }
      try { const r = new RegExp("^(?:" + re + ")$", "i"); return DEVSPEC_NAMES.some((n) => r.test(n)); } catch { return false; }
    }
    function oldShellGlobRe(seg, mode) {
      let re = "";
      for (let i = 0; i < seg.length; i++) {
        const c = seg[i];
        if (c === "*" || c === SV || c === SA) re += "[\\s\\S]*";
        else if (c === "?") re += "[\\s\\S]";
        else if (c === "[") {
          const end = seg.indexOf("]", i + 2);
          if (end < 0) { re += "\\["; continue; }
          re += "[" + seg.slice(i + 1, end).replace(/^[!^]/, "^").replace(/[\\\]]/g, "\\$&") + "]";
          i = end;
        } else re += c.replace(/[.+^${}()|\\]/g, "\\$&");
      }
      const lead = mode === "bash" && /^[*?[]/.test(seg) ? "(?!\\.)" : "";
      try { return new RegExp("^" + lead + re + "$", "i"); } catch { return null; }
    }
    const oldShell = (seg, mode, name) => { const re = oldShellGlobRe(seg, mode); return re ? re.test(name) : null; };
    const newShell = (seg, mode, name) => { const may = E.shellGlob(seg, mode); return may ? may(name) : null; };
    const DEV_ROWS = [["dev-sp?c.js", true], ["*.md", false], ["dev-spec.js", false], ["cli/dev-spe[c].js", true], ["cli/dev-spe[!c].js", false],
      ["cli/dev-spe[^x].js", true], ["DEV-SPEC.*", true], ["dev-spec.[jc]s", true], ["dev[-]spec", true], ["dev?spec", true], ["dev-spec[", false],
      ["dev-spec.[js", false], ["[]]ev-spec", false], ["[!]ev-spec", true], ["[z-a]ev-spec", false], ["*/dev-spec", true], ["cli\\dev-sp*", true],
      ["dev-spec.*" + "s".repeat(3), false], ["x*", false], ["dev-spec.e[x-z]e", true], ["dev-ſpec*", false], ["dev-spe" + SV + "*", false]];
    const SHELL_ROWS = [[".s*", "bash", ".specs", true], ["*", "bash", ".specs", false], ["*", "ps", ".specs", true], ["?specs", "bash", ".specs", false],
      ["?specs", "cmd", ".specs", true], ["[.]specs", "bash", ".specs", false], ["[.]specs", "ps", ".specs", true], [".SPEC[sS]", "bash", ".specs", true],
      ["road*.json", "bash", "roadmap.json", true], ["road*.jso[!n]", "bash", "roadmap.json", false], ["road*.jso[^x]", "bash", "roadmap.json", true],
      ["roadmap.jso[", "bash", "roadmap.json", false], ["x[", "ps", "x[", true], ["[z-a]*", "ps", "roadmap.json", null], [SV, "bash", ".specs", true],
      [SA + ".json", "bash", "observed.jsonl", false], [SA + "l", "bash", "observed.jsonl", true], ["*K", "bash", "add-track", false], ["*K", "bash", "add-track", true],
      ["[!]x", "ps", "ax", true], ["[]]", "ps", "]", true], ["[a-c]pprove", "bash", "approve", true], ["*e", "bash", "merge-state", true],
      ["*x", "bash", "merge-state", false], ["a*b*c", "ps", "a/b\\c", true], ["?", "bash", "\n", true], ["*.state.json", "bash", ".state.json", false]];
    const rows = {};
    for (const [w, want] of DEV_ROWS) rows["devSpecGlob(" + js(w) + ") " + want] = oldDevSpecGlob(w) === want && E.devSpecGlob(w) === want;
    for (const [g, mode, name, want] of SHELL_ROWS) rows["shellGlob(" + js(g) + ", " + mode + ")(" + js(name) + ") " + want] = oldShell(g, mode, name) === want && newShell(g, mode, name) === want;
    // (devSpecGlob's reading where no CLI name reaches it — the names hold no separator and no line terminator: its `*` is the old
    // `[^/\\]*`, never across / or \, its `?` RegExp's `.`, never a line terminator; the shell's cross both)
    const dev = (g, name) => E.globMayName(g, E.DEVSPEC_GLOB)(name), sh = (g, name) => newShell(g, "ps", name);
    Object.assign(rows, { "devSpecGlob's a*c: a/c false": dev("a*c", "a/c") === false, "devSpecGlob's a*c: a\\c false": dev("a*c", "a\\c") === false,
      "devSpecGlob's a*c: abbc true": dev("a*c", "abbc") === true, "devSpecGlob's a?c: a\\nc false": dev("a?c", "a\nc") === false,
      "devSpecGlob's a?c: a\\rc false": dev("a?c", "a\rc") === false, "devSpecGlob's a?c: a.c true": dev("a?c", "a.c") === true,
      "the shell's a*c: a/c true": sh("a*c", "a/c") === true, "the shell's a?c: a\\nc true": sh("a?c", "a\nc") === true });
    all("1.41.1 (R1): the linear glob matcher answers each row as the parent's RegExp builders do (a row false: the oracle or the matcher disagrees with it)", rows);
    // (a set no RegExp reads, where each reader takes it — a path segment then may be no guarded name, the CLI's subcommand is
    // unreadable, a program word is no glob of the CLI's script: the decisions the parent made, never a throw)
    const decide = (tool, command) => {
      try { return E.approvalGuardDecision({ hook_event_name: "PreToolUse", tool_name: tool, tool_input: { command } }, "deny", { meta: {}, lang: "en" }).decision; } catch (e) { return "threw: " + e.message; }
    };
    const INVALID = [["Bash", "cp x .specs/[z-a]*", "allow"], ["PowerShell", "Remove-Item .s[z-a]* -Recurse", "allow"],
      ["Bash", "node cli/dev-spec.js [z-a]pprove feat requirements", "ask"], ["Bash", "node cli/dev-spe[z-a].js approve feat requirements", "allow"]];
    const invalidGot = INVALID.map(([tool, command]) => decide(tool, command));
    all("1.41.1 (R1): a glob holding a range out of order answers as the parent did — a path segment no guarded name, the CLI's subcommand unreadable (ask), no glob of the CLI's script (got " + js(invalidGot) + ")",
      Object.fromEntries(INVALID.map(([tool, command, want], i) => [tool + " " + command + " → " + want, invalidGot[i] === want])));
    let seed = 1411;
    const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
    const ALPHA = ["*", "?", "[", "]", "!", "^", "-", ".", "d", "e", "v", "s", "p", "c", "j", "D", "S", "/", "\\", "a", "z", "x", "\n", SV, SA, "K", "k", "K", "{", "(", "+", "$", "|"];
    const NAMES = [".specs", "roadmap.json", ".state.json", "observed.jsonl", "guardian.cjs", ".execution", ".guardian", "baseline.json", "approve", "merge-state", "add-track", "", ".", "dev-spec", "k", "\n", "a]b", "["];
    const diff = { devSpecGlob: [], shellGlob: [] };
    for (let i = 0; i < 20000; i++) {
      let g = "";
      for (let n = rnd(i % 3 ? 8 : 12); n > 0; n--) g += ALPHA[rnd(ALPHA.length)];
      if (oldDevSpecGlob(g) !== E.devSpecGlob(g)) diff.devSpecGlob.push(g);
      for (const mode of ["bash", "ps", "cmd"]) for (const name of NAMES) if (oldShell(g, mode, name) !== newShell(g, mode, name)) diff.shellGlob.push([g, mode, name]);
    }
    all("1.41.1 (R1): the linear glob matcher answers as the parent's RegExp builders on 20,000 random globs (× 3 modes × " + NAMES.length + " names for the shell's) — got " +
      js({ devSpecGlob: diff.devSpecGlob.slice(0, 3), shellGlob: diff.shellGlob.slice(0, 3) }), { devSpecGlob: diff.devSpecGlob.length === 0, shellGlob: diff.shellGlob.length === 0 });
  }
};
