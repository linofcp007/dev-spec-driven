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
    // (fix round 1, S1-F1) a set's validity is read by hand now (guards.js globSetValid, no RegExp built to find it out): every body of up to
    // five of the characters a class reading turns on — a range's ends, `-`, the escaped `\` and `]`, a negation, `[`, a code unit past
    // ASCII — answers as the old builder's RegExp did, null or not, and on six names
    const BODY = ["a", "b", "z", "-", "\\", "]", "^", "!", "[", "ÿ"], SET_NAMES = ["a", "]", "-", "b", "ÿ", "z"];
    const setDiff = [];
    let bodies = 0;
    const walk = (body, left) => {
      if (body) {
        bodies++;
        const g = "[" + body + "]";
        if ((oldShellGlobRe(g, "ps") === null) !== (E.shellGlob(g, "ps") === null) || SET_NAMES.some((n) => oldShell(g, "ps", n) !== newShell(g, "ps", n))) setDiff.push(g);
      }
      if (left) for (const c of BODY) walk(body + c, left - 1);
    };
    walk("", 5);
    all("1.41.1 fix round 1 (S1-F1): a set's validity read by hand answers as the old builder's RegExp on every body of up to 5 characters (" + bodies + " sets, 6 names each; got " + js(setDiff.slice(0, 3)) + ")",
      { bodies: bodies === 111110, same: setDiff.length === 0 });
  }

  // 1.41.1 fix round 1 (review 1 of the glob fix: S1-F1 / F2 / F3, Q4) — the approval hook NEVER answers by timing out. As a process its
  // main thread arms the deadline (approval-hook.js DEADLINE_MS) at the process's start, reads stdin with a cap (MAX_INPUT) and runs the
  // pre-check alone; the projects, the roadmap reads, the engine and the decision run in a worker_threads worker with a heap limit. No
  // answer by the deadline, a worker error, an out-of-memory, an exit without an answer, a worker that can't start: ask. A preload (written
  // here, `node -r`) counts the workers the main thread starts — a property, never a time — and makes the worker slow, run out of memory,
  // throw, exit or print. Each hook run is a child process with a 20 s timeout: a hook that hangs fails its row, never the suite.
  {
    const AH = require("../hooks/approval-hook.js");
    const E = require("./lib/engine/index.js");
    const M = require("./lib/i18n.js");
    const pd = path.join(tmp, "r1411h-deadline");
    S.initProject(pd, ["core"], "pt", { approvalGuard: "deny" });
    const PRE = path.join(tmp, "r1411h-preload.js");
    fs.writeFileSync(PRE, [
      "const wt = require('worker_threads'), fs = require('fs');",
      "const spin = (ms) => { const end = Date.now() + ms; while (Date.now() < end); };",
      "if (wt.isMainThread) {",
      "  let n = 0;",
      "  const W = wt.Worker;",
      "  wt.Worker = class extends W { constructor(...a) { n++; if (process.env.R1411H_MAIN === 'ctor-throw') throw new Error('preload: no worker'); super(...a); } };",
      "  if (process.env.R1411H_COUNT) process.on('exit', () => fs.writeFileSync(process.env.R1411H_COUNT, String(n)));",
      "  if (process.env.R1411H_MAIN === 'delay') spin(800);",
      "} else {",
      "  if (process.env.R1411H_LIMITS) fs.writeFileSync(process.env.R1411H_LIMITS, JSON.stringify(wt.resourceLimits));",
      "  const mode = process.env.R1411H_WORKER;",
      "  if (mode === 'busy') spin(20000);",
      "  if (mode === 'oom') { const a = []; for (;;) a.push(new Array(1e6).fill(Math.random())); }",
      "  if (mode === 'throw') throw new Error('preload: boom');",
      "  if (mode === 'exit') process.exit(0);",
      "  if (mode === 'log') console.log('noise from the worker');",
      "  if (mode === 'afterlevel') { const pp = wt.parentPort, post = pp.postMessage.bind(pp); pp.postMessage = (m) => { post(m); if (m && m.known) spin(20000); }; }",
      "  if (mode === 'slowengine') {",
      "    const Module = require('module'), load = Module._load;",
      "    Module._load = function (request) { if (String(request).split(String.fromCharCode(92)).join('/').endsWith('/mcp/lib/spec.js')) spin(20000); return load.apply(this, arguments); };",
      "  }",
      "}",
    ].join("\n"));
    const COUNT = path.join(tmp, "r1411h-count.txt");
    const APPROVE = "node cli/dev-spec.js approve feat requirements";
    const bash = (command) => js({ session_id: "s", hook_event_name: "PreToolUse", cwd: pd, tool_name: "Bash", tool_input: { command } });
    const run = (input, env) => {
      try { fs.unlinkSync(COUNT); } catch { /* none yet */ }
      const t = Date.now();
      const r = spawnSync(process.execPath, ["-r", PRE, path.join(HOOKS, "approval-hook.js")], { input, encoding: "utf8", env: hookEnv({ CLAUDE_PROJECT_DIR: pd, R1411H_COUNT: COUNT, ...(env || {}) }),
        cwd: pd, timeout: 20000, maxBuffer: 1 << 26 });
      let o = null;
      try { o = JSON.parse(r.stdout).hookSpecificOutput; } catch { o = null; }
      let workers = null;
      try { workers = Number(fs.readFileSync(COUNT, "utf8")); } catch { workers = null; }
      const d = o ? o.permissionDecision : r.status === null ? "killed by " + r.signal : r.stdout ? "unparsed: " + r.stdout.slice(0, 60) : "silent";
      return { ms: Date.now() - t, d, reason: o ? o.permissionDecisionReason : null, workers };
    };
    const ask = (lang, why, seconds, level) => { const A = M.msg(lang).approvalGuard; return A.ask(A.action({ kind: "unreadable", why, seconds }), false, level); };
    const D = AH.DEADLINE_MS, secs = (ms) => Math.ceil(ms / 1000);
    const hooksJson = JSON.parse(fs.readFileSync(path.join(HOOKS, "hooks.json"), "utf8"));
    const T = hooksJson.hooks.PreToolUse.flatMap((e) => e.hooks).find((h) => (h.args || []).some((a) => /approval-hook\.js$/.test(a))).timeout * 1000;
    const big = (file) => js({ hook_event_name: "PreToolUse", tool_name: "Write", cwd: pd, tool_input: { file_path: path.join(pd, file), content: "x".repeat(AH.MAX_INPUT + 1024 * 1024) } });
    // (fix round 2) an unguarded session beside the guarded one: R2H-F3's Write of the GUARDED project's roadmap.json past MAX_INPUT; R2H-F7's
    // worker held after it said level 0; R2H-F1's candidate folders whose roadmap.json / ROADMAP.md is no regular file — a FOLDER in a
    // project with features (gone: ask), and on POSIX a FIFO (answered, the process ended, well before T; win32 makes none)
    const pu = path.join(tmp, "r1411h-open");
    S.initProject(pu, ["core"], "en");
    const inDir = (dir, tool, ti) => js({ session_id: "s", hook_event_name: "PreToolUse", cwd: dir, tool_name: tool, tool_input: ti });
    const pdir = path.join(tmp, "r1411h-dirmap");
    S.initProject(pdir, ["core"], "en", { approvalGuard: "deny" });
    S.createFeature(pdir, "Feat", ["core"], "", undefined, "en");
    fs.rmSync(path.join(pdir, ".specs", "roadmap.json"));
    fs.mkdirSync(path.join(pdir, ".specs", "roadmap.json"));
    const POSIX = process.platform !== "win32";
    const fifoAt = (dir, name) => { fs.mkdirSync(path.join(dir, ".specs"), { recursive: true }); return spawnSync("mkfifo", [path.join(dir, ".specs", name)]).status === 0; };
    const pf1 = path.join(tmp, "r1411h-fifo-map"), pf2 = path.join(tmp, "r1411h-fifo-md");
    const fifos = POSIX ? [fifoAt(pf1, "roadmap.json"), fifoAt(pf2, "ROADMAP.md")] : [];
    const LIMITS = path.join(tmp, "r1411h-limits.json");
    // (each sentence also read from its locale table: the expected text above is built by the same i18n.js the hook loads)
    const ACT = { en: require("./lib/i18n/en.js").text.approvalActions, pt: require("./lib/i18n/pt.js").text.approvalActions };
    const R = {
      approve: run(bash(APPROVE), { R1411H_LIMITS: LIMITS }),
      notCandidate: run(bash("ls -la src")),
      garbage: run("dev-spec approve feat requirements (not JSON)"),
      late: run(bash(APPROVE), { DEV_SPEC_TEST_APPROVAL_DEADLINE_MS: "1" }),
      lateNot: run(bash("ls -la src"), { DEV_SPEC_TEST_APPROVAL_DEADLINE_MS: "1" }),
      busy: run(bash(APPROVE), { R1411H_WORKER: "busy", DEV_SPEC_TEST_APPROVAL_DEADLINE_MS: "1500" }),
      slowEngine: run(bash(APPROVE), { R1411H_WORKER: "slowengine", DEV_SPEC_TEST_APPROVAL_DEADLINE_MS: "3000" }),
      raise: run(bash(APPROVE), { R1411H_WORKER: "busy", DEV_SPEC_TEST_APPROVAL_DEADLINE_MS: "60000" }),
      oom: run(bash(APPROVE), { R1411H_WORKER: "oom" }),
      thrown: run(bash(APPROVE), { R1411H_WORKER: "throw" }),
      exited: run(bash(APPROVE), { R1411H_WORKER: "exit" }),
      noWorker: run(bash(APPROVE), { R1411H_MAIN: "ctor-throw" }),
      printed: run(bash(APPROVE), { R1411H_WORKER: "log" }),
      startLate: run(bash(APPROVE), { R1411H_MAIN: "delay", R1411H_WORKER: "busy", DEV_SPEC_TEST_APPROVAL_DEADLINE_MS: "500" }),
      bigCandidate: run(big(".specs/roadmap.json")),
      bigNot: run(big("src/a.js")),
      bigOther: run(inDir(pu, "Write", { file_path: path.join(pd, ".specs", "roadmap.json"), content: "x".repeat(AH.MAX_INPUT + 1024 * 1024) }), { CLAUDE_PROJECT_DIR: pu }),
      huge: run(inDir(pu, "Write", { file_path: path.join(pu, "src", "a.js"), content: "x".repeat(AH.MAX_PAYLOAD + 1024) }), { CLAUDE_PROJECT_DIR: pu }),
      afterLevel: run(inDir(pu, "Bash", { command: APPROVE }), { CLAUDE_PROJECT_DIR: pu, R1411H_WORKER: "afterlevel", DEV_SPEC_TEST_APPROVAL_DEADLINE_MS: "1500" }),
      dirMap: run(inDir(pu, "Bash", { command: "cd " + JSON.stringify(pdir) + " && " + APPROVE }), { CLAUDE_PROJECT_DIR: pu }),
      fifoMap: POSIX ? run(bash("cd " + JSON.stringify(pf1) + "; cd " + JSON.stringify(pd) + "; " + APPROVE)) : null,
      fifoMd: POSIX ? run(bash("cd " + JSON.stringify(pf2) + "; cd " + JSON.stringify(pd) + "; " + APPROVE)) : null,
    };
    const brief = Object.fromEntries(Object.entries(R).map(([k, v]) => [k, v ? v.d + " " + v.ms + " ms, " + v.workers + " worker(s)" : "(win32: no FIFO)"]));
    all("1.41.1 fix round 1 (Q4): the approval hook answers by its deadline (" + D + " ms of hooks.json's " + T + ") — a worker only past the pre-check, ask on a late, failed, " +
      "out-of-memory, exited or absent worker, the deadline never raised by the test variable, a stdin past MAX_INPUT decided whole, past MAX_PAYLOAD asked; silent after a level-0 " +
      "report; a candidate folder's roadmap.json that is no regular file never opened (got " + js(brief) + ")", {
      "the margin: hooks.json's timeout − the deadline ≥ 3 s (measured past the deadline under 4 suites: ≤ 1.8 s with the process's start)": () => D < T && T - D >= 3000,
      "a normal approve at deny: deny, through one worker": () => R.approve.d === "deny" && R.approve.workers === 1,
      // (fix round 2, R2H-F6: the numbers themselves — compared with the hook's own export, a 4,096 MB limit passed)
      "…that worker runs under a 512 MB old space, 64 MB young, an 8 MB stack": () => { const l = JSON.parse(fs.readFileSync(LIMITS, "utf8")); return l.maxOldGenerationSizeMb === 512 && l.maxYoungGenerationSizeMb === 64 && l.stackSizeMb === 8; },
      "the deadline's and the failure's sentences, as their locale tables write them (en, pt)": () => R.late.reason.includes(ACT.en.timeout(1)) && R.slowEngine.reason.includes(ACT.pt.timeout(3)) &&
        R.thrown.reason.includes(ACT.en.error) && R.exited.reason.includes(ACT.en.error),
      "a call that can't be an approval: silent, no worker": () => R.notCandidate.d === "silent" && R.notCandidate.workers === 0,
      "a payload that is no JSON (stdin ended): silent, no worker": () => R.garbage.d === "silent" && R.garbage.workers === 0,
      "the deadline past before the pre-check: ask, no worker started": () => R.late.d === "ask" && R.late.workers === 0 && R.late.reason === ask("en", "timeout", 1),
      "…and a non-candidate then: silent": () => R.lateNot.d === "silent" && R.lateNot.workers === 0,
      "a worker past the deadline: ask, the timeout's sentence, before hooks.json's timeout": () => R.busy.d === "ask" && R.busy.workers === 1 && R.busy.reason === ask("en", "timeout", 2) && R.busy.ms < 1500 + (T - D),
      "…past it once it named the project: the project's language and level (pt, deny)": () => R.slowEngine.d === "ask" && R.slowEngine.reason === ask("pt", "timeout", 3, "deny"),
      "the test variable never raises the deadline: ask by the default one": () => R.raise.d === "ask" && R.raise.reason === ask("en", "timeout", secs(D)) && R.raise.ms < T,
      // (node 22+ ends the worker at its heap limit within ~0.4 s — the failure's sentence; node 18 kept it collecting past the deadline
      // in the Linux containers — the deadline's: either way an ask before hooks.json's timeout. The limits row above proves them passed.)
      "an out-of-memory worker: ask — the failure's sentence (its heap limit) or the deadline's — before hooks.json's timeout": () => R.oom.d === "ask" && R.oom.ms < T &&
        (R.oom.reason === ask("en", "error") || R.oom.reason === ask("en", "timeout", secs(D))),
      "a worker that throws: ask": () => R.thrown.d === "ask" && R.thrown.reason === ask("en", "error"),
      "a worker that exits without an answer: ask at once": () => R.exited.d === "ask" && R.exited.reason === ask("en", "error") && R.exited.ms < D / 2,
      "a worker that can't start: ask": () => R.noWorker.d === "ask" && R.noWorker.reason === ask("en", "error"),
      "a worker that prints: the hook's output stays one JSON object (deny)": () => R.printed.d === "deny",
      "the deadline counts from the process's start: a slow start past it starts no worker": () => R.startLate.d === "ask" && R.startLate.workers === 0,
      // (fix round 2, R2H-F3: past MAX_INPUT the main thread parses nothing — the worker decides on the payload whole, as on a small one)
      "a stdin past MAX_INPUT: decided whole in the worker — a Write of roadmap.json at deny is refused": () => R.bigCandidate.d === "deny" && R.bigCandidate.workers === 1,
      "…a Write of src/: silent (one worker read it)": () => R.bigNot.d === "silent" && R.bigNot.workers === 1,
      "…a Write of ANOTHER (guarded) project's roadmap.json from an unguarded session: deny, as ed680c92 (the 16 M head read only the session's)": () =>
        R.bigOther.d === "deny" && R.bigOther.workers === 1,
      "a stdin past MAX_PAYLOAD (not held): ask, the partial payload's sentence, no worker": () => R.huge.d === "ask" && R.huge.workers === 0 && R.huge.reason.includes(ACT.en.partial),
      "a worker held after it said level 0 (no project guarded): silent at the deadline (R2H-F7)": () => R.afterLevel.d === "silent" && R.afterLevel.workers === 1 && R.afterLevel.ms < 1500 + (T - D),
      "a cd target whose roadmap.json is a FOLDER, features in it: ask — no regular file reads as gone (R2H-F1)": () => R.dirMap.d === "ask",
      "(POSIX) a cd target whose roadmap.json / ROADMAP.md is a FIFO: never opened — deny, the process ended well before T": () => !POSIX ||
        (fifos.every(Boolean) && R.fifoMap.d === "deny" && R.fifoMap.ms < T - 3000 && R.fifoMd.d === "deny" && R.fifoMd.ms < T - 3000),
    });
    // in-process: the main thread's share (needsDecision), the deadline's test variable (deadlineMs), decide's onLevel
    const calls = [];
    const out = AH.decide(bash(APPROVE), { onLevel: (s) => calls.push({ level: s.level, lang: s.meta && s.meta.lang }) });
    const env = (v) => ({ DEV_SPEC_TEST_APPROVAL_DEADLINE_MS: v });
    all("1.41.1 fix round 1 (Q4): the hook's main-thread pre-check, its deadline's test variable and decide's onLevel (got " + js({ calls, out: out && out.hookSpecificOutput.permissionDecision }) + ")", {
      "needsDecision: an approve, a Write of roadmap.json, an MCP approval": () => AH.needsDecision(bash(APPROVE)) && AH.needsDecision(js({ tool_name: "Write", tool_input: { file_path: ".specs/roadmap.json" } })) &&
        AH.needsDecision(js({ tool_name: "mcp__x__spec_approve", tool_input: {} })),
      "needsDecision: not ls, not a Write of src/, not another event": () => !AH.needsDecision(bash("ls")) && !AH.needsDecision(js({ tool_name: "Write", tool_input: { file_path: "src/a.ts" } })) &&
        !AH.needsDecision(js({ hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: { command: APPROVE } })),
      "needsDecision: a payload that doesn't parse only when cut short and naming dev-spec": () => !AH.needsDecision("dev-spec {") && AH.needsDecision("dev-spec {", { timedOut: true }) &&
        !AH.needsDecision("ls {", { timedOut: true }),
      "deadlineMs: the default, a lower test value, never a higher or a malformed one": () => AH.deadlineMs({}) === D && AH.deadlineMs(env("500")) === 500 && AH.deadlineMs(env("0")) === 0 &&
        AH.deadlineMs(env(String(D * 10))) === D && AH.deadlineMs(env("")) === D && AH.deadlineMs(env("x")) === D && AH.deadlineMs(env("-1")) === D,
      "decide tells the strictest level once, before the engine (2, pt)": () => calls.length === 1 && calls[0].level === 2 && calls[0].lang === "pt" && out.hookSpecificOutput.permissionDecision === "deny",
      // (fix round 2, R2H-F1) judged by the fd's own fstat once opened: a device opens (NUL / /dev/null) and is no regular file
      "probe.js openRegular / readRegularText: a device is no regular file (null), a regular file opens": () => {
        const PR = require("./lib/probe.js"), BSL = String.fromCharCode(92);
        const dev = process.platform === "win32" ? BSL + BSL + "." + BSL + "NUL" : "/dev/null";
        const fd = PR.openRegular(path.join(pd, ".specs", "roadmap.json"));
        try { return PR.openRegular(dev) === null && PR.readRegularText(dev) === null && typeof fd === "number"; } finally { if (typeof fd === "number") fs.closeSync(fd); }
      },
    });
    // (fix round 3, review 3 — R3H-F3) an lstat that THROWS is no regular file either: through \\wsl.localhost\ a Linux FIFO's lstat
    // throws EISDIR, and win32 opens with no O_NONBLOCK — the open waited for a writer, the worker sat in that one call and the process
    // outlived hooks.json's timeout. Here fs.lstatSync throws EISDIR for one file (a stub, in-process: win32 makes no FIFO) and fs.openSync
    // counts the opens of it: rawLevel reads a candidate's roadmap.json as gone (its real meta says off — opened, it would read level 0)
    // and the rule's ROADMAP.md head reads "" (its real text carries the generated marker). A swap between the lstat and the open (a
    // regular file then, a FIFO at the open — on win32, where nothing opens without waiting) stays a documented race (R5, the known
    // limits: claude-code-integration.md → Human approval guard); POSIX opens with O_NONBLOCK and judges the fd.
    {
      const PR = require("./lib/probe.js"), BSL = String.fromCharCode(92);
      const pl = path.join(tmp, "r1411h-lstat-throws");
      S.initProject(pl, ["core"], "en");
      S.createFeature(pl, "Feat", ["core"], "", undefined, "en");
      const pm = path.join(tmp, "r1411h-lstat-md");
      fs.mkdirSync(path.join(pm, ".specs"), { recursive: true });
      fs.writeFileSync(path.join(pm, ".specs", "ROADMAP.md"), "<!-- AUTO-GENERATED by dev-spec — do not edit by hand. -->\n# Roadmap\n");
      const ends = (p, tail) => typeof p === "string" && p.split(BSL).join("/").toLowerCase().endsWith(tail);
      const stubbed = (tail, fn) => {
        const lstat0 = fs.lstatSync, open0 = fs.openSync;
        let opens = 0;
        fs.lstatSync = function (p) { if (ends(p, tail)) { const e = new Error("EISDIR: illegal operation on a directory, lstat"); e.code = "EISDIR"; throw e; } return lstat0.apply(fs, arguments); };
        fs.openSync = function (p) { if (ends(p, tail)) opens++; return open0.apply(fs, arguments); };
        try { return fn(() => opens); } finally { fs.lstatSync = lstat0; fs.openSync = open0; }
      };
      const lv = stubbed("/r1411h-lstat-throws/.specs/roadmap.json", (opens) => {
        const seen = [];
        const o = AH.decide(inDir(pu, "Bash", { command: "cd " + JSON.stringify(pl) + " && " + APPROVE }), { onLevel: (s) => seen.push({ level: s.level, opens: opens() }) });
        return { seen, d: o ? o.hookSpecificOutput.permissionDecision : "silent" };
      });
      const lvPlain = (() => { const seen = []; AH.decide(inDir(pu, "Bash", { command: "cd " + JSON.stringify(pl) + " && " + APPROVE }), { onLevel: (s) => seen.push(s.level) }); return seen; })();
      const md = stubbed("/r1411h-lstat-md/.specs/roadmap.md", (opens) => ({ is: PR.isDevSpecProject(pm), opens: opens() }));
      all("1.41.1 fix round 3 (R3H-F3): an lstat that throws (EISDIR, a Linux FIFO through \\\\wsl.localhost\\) never opens the file — rawLevel's roadmap.json reads as gone, the rule's ROADMAP.md head as \"\" (got " +
        js({ lv, lvPlain, md, mdPlain: PR.isDevSpecProject(pm) }) + ")", {
        "rawLevel: gone, features in it — level 1 (ask), the file never opened before the level is told": () => lv.seen.length === 1 && lv.seen[0].level === 1 && lv.seen[0].opens === 0 && lv.d === "ask",
        "…its lstat answering, the same roadmap.json is read: level 0 (its meta: off)": () => js(lvPlain) === js([0]),
        "probe.head: a ROADMAP.md whose lstat throws is never opened — not a dev-spec project by it": () => md.is === false && md.opens === 0,
        "…its lstat answering, the same ROADMAP.md names one (the generated marker)": () => PR.isDevSpecProject(pm) === true,
      });
    }
    // (fix round 3, review 3 — the owner's ruling) a command BUILT to be slow for the guard's readers may make the hook ask at the
    // deadline instead of deny — never allow, never silent, never past the timeout: the human refuses at the prompt. The tracking bounds
    // are not tuned to turn these into too-long. R3H-F1's brace expansions over a long tracked value (×18 / ×36) and R3H-F2's long cd
    // fold, through the hook process, the three at once: ask (the deadline's sentence) or deny, ended before T − 3 s. The deadline is
    // lowered to 3 s by the test variable, as the busy row: the bound is the deadline (4 s past it), never a ratio — the default
    // deadline's own exit is the raise row's.
    {
      const { spawn } = require("child_process");
      const runAsync = (input, env) => new Promise((resolve) => {
        const t = Date.now();
        let c;
        try { c = spawn(process.execPath, [path.join(HOOKS, "approval-hook.js")], { env: hookEnv({ CLAUDE_PROJECT_DIR: pd, ...(env || {}) }), cwd: pd, stdio: ["pipe", "pipe", "pipe"] }); }
        catch (e) { resolve({ ms: Date.now() - t, d: "no spawn: " + (e.code || e.message), reason: null }); return; }
        let out = "";
        c.stdout.on("data", (d) => { out += d; });
        c.stderr.on("data", () => { /* not read */ });
        c.stdin.on("error", () => { /* the hook ended first */ });
        const safety = setTimeout(() => c.kill(), 20000); // (as spawnSync's timeout above: a hook that hangs fails its row, never the suite)
        c.on("error", (e) => { clearTimeout(safety); resolve({ ms: Date.now() - t, d: "error: " + (e.code || e.message), reason: null }); });
        c.on("close", (code, signal) => {
          clearTimeout(safety);
          let o = null;
          try { o = JSON.parse(out).hookSpecificOutput; } catch { o = null; }
          resolve({ ms: Date.now() - t, d: o ? o.permissionDecision : signal ? "killed by " + signal : out ? "unparsed: " + out.slice(0, 60) : "silent", reason: o ? o.permissionDecisionReason : null });
        });
        c.stdin.end(input);
      });
      const dbl = (name, seed, k) => name + "=" + seed + "; " + (name + "=$" + name + "$" + name + "; ").repeat(k);
      const BRACES = "rm -f $A{a,b}{c,d}{e,f}{g,h}{i,j}; ";
      const SLOW = {
        braces18: "cd x; " + dbl("A", "abcde./", 13) + BRACES.repeat(18) + APPROVE,
        braces36: "cd x; " + dbl("A", "abcde./", 13) + BRACES.repeat(36) + APPROVE,
        fold: dbl("B", "yyyyyyy", 12) + "cd /$B$B; " + "cd x/..; ".repeat(6900) + APPROVE,
      };
      const names = Object.keys(SLOW);
      const res = await Promise.all(names.map((k) => runAsync(bash(SLOW[k]), { DEV_SPEC_TEST_APPROVAL_DEADLINE_MS: "3000" })));
      const SR = Object.fromEntries(names.map((k, i) => [k, res[i]]));
      const answered = (x) => x.ms < T - 3000 && (x.d === "deny" || (x.d === "ask" && !!x.reason && (x.reason.includes(ACT.pt.timeout(3)) || x.reason.includes(ACT.en.timeout(3)))));
      all("1.41.1 fix round 3 (the ruling on R3H-F1 / F2): a command built to be slow for the guard's readers is answered by the deadline — ask or deny, never allow or silent, " +
        "the process ended before T − 3 s (got " + js(Object.fromEntries(names.map((k) => [k, SR[k].d + " " + SR[k].ms + " ms, " + SLOW[k].length + " characters"]))) + ")",
        Object.fromEntries(names.map((k) => [k + " — ask (the deadline's sentence) or deny, before " + (T - 3000) + " ms", () => answered(SR[k])])));
    }
  }

  // …and the readers it turns into a prompt stay fast (the deadline makes a slow reader an ask, not a refusal): review 1's shapes and the
  // sweep's, through the hook process (deny at deny, ≤ 6 × a benign twin of the same length and tool — a ratio, never milliseconds;
  // 12 s child timeout: the parent ran each 7–42 s) and in-process (the decision, the action) — S1-F1 a set-heavy glob under brace
  // expansion (each set's RegExp built per call, per name), S1-F2 a run of `[` with no `]` (a scan from each), S1-F3 `A=$A$A` (a value
  // doubling past the read limit: too long to read), a long cd folder put before every path, a long renamed name and a slash run copied
  // into .specs/ (regexes rescanning from each character: /[^\\/]*$/, /[\\/]+$/).
  {
    const pr = path.join(tmp, "r1411h-shapes");
    S.initProject(pr, ["core"], "en", { approvalGuard: "deny" });
    const APPROVE = "node cli/dev-spec.js approve feat requirements";
    const B5 = "{a,b}{a,b}{a,b}{a,b}{a,b}";
    const distinct = (L) => { let s = ""; for (let i = 0; s.length < L; i++) s += "[" + String.fromCharCode(0x4e00 + (i % 20000)) + "s]"; return s; };
    const SHAPES = {
      "S1-F1 braces × distinct sets (.specs)": ["Bash", "cd x; cp x .specs/" + B5 + "*" + distinct(48000) + "; " + APPROVE],
      "S1-F1 braces × distinct sets (SPECS~1)": ["Bash", "cd x; cp x SPECS~1/" + B5 + "*" + distinct(32000) + "; " + APPROVE],
      "S1-F2 braces × a run of [ (.specs)": ["Bash", "cd x; cp x .specs/" + B5 + "[".repeat(16000) + "; " + APPROVE],
      "S1-F2 braces × a run of [ (SPECS~1)": ["Bash", "cd x; cp x SPECS~1/" + B5 + "[".repeat(16000) + "; " + APPROVE],
      "S1-F3 A=$A$A ×22, cd $A": ["Bash", "A=xxxxxxxx; " + "A=$A$A; ".repeat(22) + "cd $A; " + "cp a b; ".repeat(10) + APPROVE],
      "S1-F3 A=$A$A ×22, paths": ["Bash", "A=xxxxxxxx; " + "A=$A$A; ".repeat(22) + "cp $A/a $A/b; ".repeat(10) + APPROVE],
      "S1-F3 PowerShell $a = \"$a$a\" ×24": ["PowerShell", "$a = 'xxxxxxxx'; " + "$a = \"$a$a\"; ".repeat(24) + "Remove-Item $a\\x; ".repeat(10) + APPROVE],
      "sweep: a 27 K cd folder before 3,000 paths": ["Bash", "cd " + "d".repeat(27000) + "; " + "cp a b; ".repeat(3000) + APPROVE],
      "sweep: Rename-Item of a 60 K name": ["PowerShell", "Rename-Item " + "a".repeat(60000) + "/ -NewName x; " + APPROVE],
      "sweep: a 60 K slash run copied into .specs/": ["Bash", "cp " + "/".repeat(60000) + "x .specs/; " + APPROVE],
      // (fix round 2) R2H-F4 a -c script built from 16,000 positional parameters, the work bound's edge, a cd / cd .. chain ×2,000 folded
      "R2H-F4 sh -c '$1'×16,000 + a 30 K argument": ["Bash", "sh -c '" + "$1".repeat(16000) + " dev-spec' x " + "a".repeat(30000) + "; " + APPROVE],
      "R2H-F2 a 1,000-character value in 2,098 paths": ["Bash", "A=" + "a".repeat(1000) + "; " + "cp $A/x .specs/; ".repeat(2098) + APPROVE],
      "R2H-F2 cd x && rm -f y && cd .. ×2,000": ["Bash", "cd w && " + Array.from({ length: 2000 }, () => "cd x && rm -f y && cd ..").join(" && ") + " && " + APPROVE],
    };
    const twin = (tool, command) => (tool === "PowerShell" ? "Write-Output " : "echo ") + "a".repeat(Math.max(1, command.length - APPROVE.length - 20)) + "; " + APPROVE;
    const call = (tool, command) => {
      const t = Date.now();
      const r = spawnSync(process.execPath, [path.join(HOOKS, "approval-hook.js")], { encoding: "utf8", env: hookEnv({ CLAUDE_PROJECT_DIR: pr }), cwd: pr, timeout: 12000,
        input: js({ session_id: "s", hook_event_name: "PreToolUse", cwd: pr, tool_name: tool, tool_input: { command } }) });
      let d;
      try { d = JSON.parse(r.stdout).hookSpecificOutput.permissionDecision; } catch { d = r.status === null ? "killed by " + r.signal : "silent"; }
      return { d, ms: Date.now() - t };
    };
    const fast = (x) => x.d === "deny" && x.ms <= 6 * x.twin.ms;
    const got = {}, checks = {};
    for (const [name, [tool, command]] of Object.entries(SHAPES)) {
      const m = remeasure(() => ({ twin: call(tool, twin(tool, command)), ...call(tool, command) }), fast);
      got[name] = m.d + " " + m.ms + " ms / twin " + m.twin.d + " " + m.twin.ms + " ms (" + command.length + " characters, " + m.tries + " tries)";
      checks[name + " — deny, ≤ 6 × its twin"] = fast(m);
    }
    all("1.41.1 fix round 1 (S1-F1 / F2 / F3, the sweep): the approval hook answers each hostile shape at deny within 6 × a benign twin of its length (got " + js(got) + ")", checks);

    // in-process: the decision and what it says — the read limit hit by tracking is too-long (deny at deny; its own sentence), a twin under
    // it reads as before; review 1's S1-F4 (a 33 K-literal segment: 3d74db53's RegExp threw — the hook asked — on the approve after it);
    // the folder part and the trailing-slash trim the sweep replaced, on a backslash path (cmd's ren, Rename-Item) and a slash-ended source
    const E = require("./lib/engine/index.js");
    const M = require("./lib/i18n.js");
    const dec = (tool, command) => E.approvalGuardDecision({ hook_event_name: "PreToolUse", tool_name: tool, tool_input: { command } }, "deny", { meta: {}, lang: "en" });
    const acts = (r) => (r.actions || []).map((a) => a.kind + ":" + (a.setting || a.why || a.phase) + (a.expanded ? "+expanded" : ""));
    const A = M.msg("en").approvalGuard;
    const tooLongReason = A.deny(A.action({ kind: "unreadable", why: "too-long", expanded: "value", length: 64 * 1024 }), null);
    const dbl = (k, tail) => "A=xxxxxxxx; " + "A=$A$A; ".repeat(k) + tail;
    const IN = {
      dbl22: dec("Bash", dbl(22, "cat .specs/roadmap.json")),
      dbl5: dec("Bash", dbl(5, "cat .specs/roadmap.json")),
      ps24: dec("PowerShell", "$a = 'xxxxxxxx'; " + "$a = \"$a$a\"; ".repeat(24) + "Get-Content .specs\\roadmap.json"),
      cdLong: dec("Bash", "cd " + "d".repeat(30000) + "; " + "cp a b; ".repeat(3000) + "cat .specs/x"),
      cdShort: dec("Bash", "cd " + "d".repeat(300) + "; " + "cp a b; ".repeat(30) + "cat .specs/x"),
      f4: dec("Bash", "cp x .specs/*" + "a".repeat(33000) + "; " + APPROVE),
      ren: dec("Bash", "cmd /c ren .specs\\notes.md roadmap.json"),
      renamePs: dec("PowerShell", "Rename-Item .specs\\notes.md -NewName roadmap.json"),
      renameFwd: dec("PowerShell", "Rename-Item .specs/notes.md -NewName roadmap.json"),
      slashSrc: dec("Bash", "cp evil/roadmap.json/ .specs/"),
    };
    all("1.41.1 fix round 1 (S1-F3 / F4, the sweep): in-process, each shape's decision and action (got " + js(Object.fromEntries(Object.entries(IN).map(([k, r]) => [k, r.decision + " " + acts(r).join(",")]))) + ")", {
      "A=$A$A ×22 then a reader of .specs/: too long to read — deny, its own sentence": () => IN.dbl22.decision === "deny" && js(acts(IN.dbl22)) === js(["unreadable:too-long+expanded"]) && IN.dbl22.reason === tooLongReason &&
        IN.dbl22.reason.includes(require("./lib/i18n/en.js").text.approvalActions.tooLongExpanded("value", 64 * 1024)),
      "…×5 (under the limit): read as before — allow": () => IN.dbl5.decision === "allow",
      "PowerShell's $a = \"$a$a\" ×24: too long — deny": () => IN.ps24.decision === "deny" && acts(IN.ps24).includes("unreadable:too-long+expanded"),
      "a 30 K cd folder before 3,000 paths: too long — deny; a 300-character one before 30: allow": () => IN.cdLong.decision === "deny" && acts(IN.cdLong).includes("unreadable:too-long+expanded") && IN.cdShort.decision === "allow",
      "S1-F4: a 33 K-literal segment, then an approve: deny (3d74db53 asked)": () => IN.f4.decision === "deny" && acts(IN.f4).includes("approve:requirements"),
      "cmd's ren and Rename-Item onto roadmap.json, a backslash path and a slash one: deny (roadmap)": () => [IN.ren, IN.renamePs, IN.renameFwd].every((r) => r.decision === "deny" && js(acts(r)) === js(["guard-down:roadmap"])),
      "cp evil/roadmap.json/ .specs/: the file's name lands there — roadmap": () => IN.slashSrc.decision === "deny" && js(acts(IN.slashSrc)) === js(["guard-down:roadmap"]),
    });
    // (S1-F1) a set-heavy glob longer than every name it is asked builds no RegExp: the same count of RegExps made as a plain twin of its
    // length — the matcher fails it on the code units it takes, before any token (counted through the global constructor, in-process)
    const countRegExps = (fn) => {
      const R0 = globalThis.RegExp;
      let n = 0;
      globalThis.RegExp = new Proxy(R0, { construct(t, a) { n++; return Reflect.construct(t, a); }, apply(t, self, a) { n++; return Reflect.apply(t, self, a); } });
      try { fn(); } finally { globalThis.RegExp = R0; }
      return n;
    };
    const setsCmd = "cd x; cp x .specs/" + B5 + "*" + distinct(16000) + "; " + APPROVE, plainCmd = "cd x; cp x .specs/" + B5 + "a".repeat(distinct(16000).length + 1) + "; " + APPROVE;
    dec("Bash", setsCmd); dec("Bash", plainCmd); // (each once first: a literal's RegExp is made once per process)
    const nSets = countRegExps(() => dec("Bash", setsCmd)), nPlain = countRegExps(() => dec("Bash", plainCmd));
    // …and its glob is read once per path read, never once per name asked (guards.js shellSegReader; the engine's own counts,
    // globMayName.reads / shellPathFacts.reads — not enumerable): every path here holds that one glob segment
    E.globMayName.reads = 0; E.shellPathFacts.reads = 0;
    dec("Bash", setsCmd);
    const reads = { globs: E.globMayName.reads, paths: E.shellPathFacts.reads };
    all("1.41.1 fix round 1 (S1-F1): a glob of 5,300 distinct sets under 32 brace expansions makes no RegExp more than a plain twin, and is read once per path (got " + js({ nSets, nPlain, reads }) + ")",
      { noRegExp: nSets === nPlain, oncePerPath: reads.paths > 0 && reads.globs === reads.paths });
  }

  // 1.41.1 fix round 2 (review 2: R2H-F2 / F4 / F5) — what tracking BUILDS is bounded at the read limit (a value, a word with its variables
  // put in, the cd folder — `.` / `..` folded —, a `-c` script with its positional parameters), and what the PATHS are read with by a work
  // bound of its own (APPROVAL_TRACK_WORK). Round 1 counted every re-read against the 64 K read limit: monorepo commands of 3–4 K were
  // refused. The LEGIT corpus below answers exactly as ed680c92 (= 3d74db53) did — the four decisions (deny / ask × win32 / POSIX readings)
  // and the edit guard's targets (count + sha1 of the sorted, normalized list: R2H-F5, no target lost) pinned from it; the HOSTILE rows
  // answer too-long (the reason names the bound it passed) and deny at deny; the work bound is pinned from both sides.
  {
    const E = require("./lib/engine/index.js");
    const M = require("./lib/i18n.js");
    const crypto = require("crypto");
    const BS = String.fromCharCode(92);
    const pkg = (i, w = 2) => "pkg-" + String(i).padStart(w, "0");
    const times = (n, f, sep) => Array.from({ length: n }, (_, i) => f(i)).join(sep);
    const CI = ["set -euo pipefail", "export NODE_ENV=production CI=true FORCE_COLOR=0", "export ARTIFACTS=\"$PWD/artifacts\"", "mkdir -p \"$ARTIFACTS\" dist logs",
      "npm ci --no-audit --prefer-offline > logs/install.log 2>&1",
      times(40, (i) => "( cd packages/" + pkg(i) + " && npm run lint > ../../logs/lint-" + pkg(i) + ".log && npm test -- --ci --reporters=default > ../../logs/test-" + pkg(i) + ".log )", "\n"),
      times(40, (i) => "cp -r packages/" + pkg(i) + "/dist \"$ARTIFACTS/" + pkg(i) + "\"", "\n"), "tar -czf dist/artifacts.tgz -C \"$ARTIFACTS\" .",
      "find logs -name '*.log' -size +1M -exec gzip {} \\;", "node cli/dev-spec.js doctor --json > logs/doctor.json"].join("\n");
    const ALLOW = ["allow|", "allow|", "allow|", "allow|"];
    // [tool, command, the four decisions, targets, their sha1] — ed680c92's answers
    const LEGIT = {
      "append FLAGS ×300 then tsc": ["Bash", "FLAGS=\"\"; " + times(300, (i) => "FLAGS=\"$FLAGS --include=src/module" + i + "\"", "; ") + "; tsc $FLAGS > build.log; node cli/dev-spec.js status", ALLOW, 1, "6bed715518e0"],
      "append FLAGS ×500 then tsc": ["Bash", "FLAGS=\"\"; " + times(500, (i) => "FLAGS=\"$FLAGS --include=src/m" + i + "\"", "; ") + "; tsc $FLAGS > build.log; node cli/dev-spec.js status", ALLOW, 1, "6bed715518e0"],
      "cd ../next && build ×150": ["Bash", "cd packages/" + pkg(0) + " && " + times(150, (i) => "npm run build > build.log && cd ../" + pkg(i + 1), " && ") + " && node ../../cli/dev-spec.js status", ALLOW, 33, "40eb0179c0cf"],
      "cd pkg && rm -rf dist && cd .. ×300": ["Bash", "cd packages && " + times(300, (i) => "cd " + pkg(i, 3) + " && rm -rf dist && cd ..", " && ") + " && node ../cli/dev-spec.js status", ALLOW, 33, "e548c8ac3f16"],
      "a 70-character cd, then rm -f of 1,000 files": ["Bash", "cd services/billing-api-gateway/internal/handlers/v2/generated/protobuf && rm -f " + times(1000, (i) => "f" + String(i).padStart(4, "0") + ".pb.go", " ") +
        " && node ../../../../../../../cli/dev-spec.js status", ALLOW, 64, "9dbec889f913"],
      "ROOT=<60>; cp $ROOT/src/fN $ROOT/out/fN ×700": ["Bash", "ROOT=/home/ci/workspace/monorepo/packages/frontend-dashboard; " + times(700, (i) => "cp $ROOT/src/f" + i + ".ts $ROOT/out/f" + i + ".ts", "; ") + "; node cli/dev-spec.js status", ALLOW, 64, "cf6057296854"],
      "export PATH=\"$PATH:…\" ×200": ["Bash", times(200, (i) => "export PATH=\"$PATH:/opt/tools/bin" + i + "\"", "; ") + "; node cli/dev-spec.js doctor", ALLOW, 0, "da39a3ee5e6b"],
      "CFLAGS=\"$CFLAGS -I$INC/pkgN\" ×150 then make": ["Bash", "INC=/usr/local/include; CFLAGS=\"\"; " + times(150, (i) => "CFLAGS=\"$CFLAGS -I$INC/" + pkg(i) + "\"", "; ") + "; make CFLAGS=\"$CFLAGS\" > make.log; node cli/dev-spec.js status", ALLOW, 1, "006d8d8d5e2c"],
      "pushd pkg && build && popd ×200": ["Bash", times(200, (i) => "pushd packages/" + pkg(i, 3) + " && npm run build && popd", " && ") + " && node cli/dev-spec.js status", ALLOW, 0, "da39a3ee5e6b"],
      "cd /repo && git status && cd sub && … && cd .. ×150": ["Bash", times(150, (i) => "cd /repo && git status && cd sub-" + i + " && git status && cd ..", " && ") + " && node cli/dev-spec.js status", ALLOW, 0, "da39a3ee5e6b"],
      "a CI script of ~8 K": ["Bash", CI, ALLOW, 64, "7da8baf62a26"],
      "a PowerShell build script": ["PowerShell", "$root = 'C:" + BS + "repo'; Set-Location $root; $out = ''; " + times(200, (i) => "$out = \"$out;$root" + BS + "packages" + BS + pkg(i, 3) + BS + "dist\"", "; ") + "; " +
        times(50, (i) => "Set-Location \"$root" + BS + "packages" + BS + pkg(i, 3) + "\"; npm run build; Set-Location $root", "; ") + "; node cli" + BS + "dev-spec.js status", ALLOW, 0, "da39a3ee5e6b"],
      "sh -c 'cd \"$1\" && npm test' _ pkg ×50": ["Bash", times(50, (i) => "sh -c 'cd \"$1\" && npm test' _ packages/" + pkg(i), " && ") + " && node cli/dev-spec.js status", ALLOW, 0, "da39a3ee5e6b"],
      "cd pkg && … && cd .. ×200, then an approve": ["Bash", "cd packages && " + times(200, (i) => "cd " + pkg(i, 3) + " && rm -rf dist && cd ..", " && ") + " && node ../cli/dev-spec.js approve feat requirements",
        ["deny|approve:requirements", "deny|approve:requirements", "ask|approve:requirements", "ask|approve:requirements"], 33, "e548c8ac3f16"],
      "F=\"$F -Iinclude/pkg\" ×100, then a test write": ["Bash", "F=x; " + times(100, (i) => "F=\"$F -Iinclude/" + pkg(i, 3) + "\"", "; ") + "; D=tests; echo hi > $D/protected.test.js; node cli/dev-spec.js status", ALLOW, 1, "590079460ad3"],
      "git commit with a 3 K heredoc message": ["Bash", "git add -A && git commit -m \"$(cat <<'EOF'\nfeat: the monorepo build\n\n" + times(60, (i) => "- " + pkg(i) + ": the build script, the lint config and the test runner moved to the shared preset", "\n") +
        "\nEOF\n)\" && node cli/dev-spec.js status", ALLOW, 0, "da39a3ee5e6b"],
      "cp dist files ×400": ["Bash", times(400, (i) => "cp packages/" + pkg(i, 3) + "/dist/index.js dist/" + pkg(i, 3) + ".js", " && ") + " && node cli/dev-spec.js status", ALLOW, 64, "43c976b4ac72"],
      "cd ../../ chains (two up, one down) ×100": ["Bash", "cd apps/web/src && " + times(100, (i) => "cd ../../" + pkg(i) + "/src && npm run build", " && ") + " && node ../../../cli/dev-spec.js status", ALLOW, 0, "da39a3ee5e6b"],
      "a cd into .specs/ and out, reading": ["Bash", "cd .specs && cat roadmap.json && cd .. && " + times(100, (i) => "cat packages/" + pkg(i) + "/package.json", " && ") + " && node cli/dev-spec.js status", ALLOW, 0, "da39a3ee5e6b"],
    };
    const decide = (tool, command, level, win) => {
      const r = E.approvalGuardDecision({ hook_event_name: "PreToolUse", tool_name: tool, tool_input: { command }, cwd: "/work/mono" }, level, { meta: {}, lang: "en", win });
      return { s: r.decision + "|" + (r.actions || []).map((a) => a.kind + ":" + (a.why || a.setting || a.phase || "")).join(","), r };
    };
    const targets = (tool, command) => {
      const l = E.shellWriteTargets(command, tool === "Bash" ? "bash" : "ps", false).map((x) => path.posix.normalize(String(x).split(BS).join("/"))).sort();
      return [l.length, crypto.createHash("sha1").update(l.join("\n")).digest("hex").slice(0, 12)];
    };
    const legitGot = {}, legitRows = {};
    for (const [name, [tool, command, want, n, sha]] of Object.entries(LEGIT)) {
      const ds = [decide(tool, command, "deny", true).s, decide(tool, command, "deny", false).s, decide(tool, command, "ask", true).s, decide(tool, command, "ask", false).s];
      const tg = targets(tool, command);
      legitGot[name] = command.length + " characters: " + ds[0] + " / " + ds[2] + ", " + tg[0] + " target(s)";
      legitRows[name + " — as ed680c92: " + want[0] + " (" + n + " target(s))"] = js(ds) === js(want) && tg[0] === n && tg[1] === sha;
    }
    all("1.41.1 fix round 2 (R2H-F2 / F5): " + Object.keys(LEGIT).length + " legit monorepo / CI / PowerShell commands answer exactly as ed680c92 — the four decisions and the edit guard's targets (got " + js(legitGot) + ")", legitRows);

    const APPROVE = "node cli/dev-spec.js approve feat requirements";
    const A1K = "a".repeat(1000);
    const work = (n) => "A=" + A1K + "; " + "cp $A/x .specs/; ".repeat(n) + "cat .specs/x"; // each $A puts 1,000 characters in a path: 2,097 of them are 2,097,000
    const HOSTILE = {
      dbl22: ["Bash", "A=xxxxxxxx; " + "A=$A$A; ".repeat(22) + "cat .specs/roadmap.json", "deny", "value"],
      ps24: ["PowerShell", "$a = 'xxxxxxxx'; " + "$a = \"$a$a\"; ".repeat(24) + "Get-Content .specs" + BS + "roadmap.json", "deny", "value"],
      cd30k: ["Bash", "cd " + "d".repeat(30000) + "; " + "cp a b; ".repeat(3000) + "cat .specs/x", "deny", "total"],
      // (fix round 3, R3H-F4) the cd folder's own bound: two relative cd's of a 40 K value build an 80 K folder — past the read limit
      // (value); without it the folder kept growing and the path under it read as no .specs/ of the project (allow)
      cdPast: ["Bash", "A=" + "d".repeat(40000) + "; cd $A; cd $A; cat .specs/x", "deny", "value"],
      pos1: ["Bash", "sh -c '" + "$1".repeat(16000) + " dev-spec' x " + "a".repeat(30000) + "; " + APPROVE, "deny", "value"],
      posAt: ["Bash", "sh -c '" + "$@".repeat(16000) + " dev-spec' x " + "a ".repeat(15000) + "; " + APPROVE, "deny", "value"],
      over: ["Bash", work(2098), "deny", "total"],
      under: ["Bash", work(2097), "allow", null],
      cdChain: ["Bash", "cd w && " + times(2000, () => "cd x && rm -f y && cd ..", " && ") + " && cat .specs/x", "allow", null],
      psChain: ["PowerShell", "Set-Location w; " + times(1000, () => "Set-Location x" + BS + "y; Remove-Item z; Set-Location .." + BS + "..", "; ") + "; Get-Content .specs" + BS + "x", "allow", null],
    };
    const ACT = require("./lib/i18n/en.js").text.approvalActions;
    const hostileGot = {}, hostileRows = {};
    for (const [name, [tool, command, want, kind]] of Object.entries(HOSTILE)) {
      const t = Date.now();
      const { r } = decide(tool, command, "deny", process.platform === "win32");
      const ms = Date.now() - t;
      const tl = (r.actions || []).find((a) => a.why === "too-long");
      hostileGot[name] = command.length + " characters: " + r.decision + (tl ? " " + tl.expanded + " " + tl.length : "") + ", " + ms + " ms";
      hostileRows[name + " — " + want + (kind ? " (too-long: " + kind + ", the reason naming its bound)" : " (no too-long)")] = r.decision === want &&
        (kind ? !!tl && tl.expanded === kind && tl.length === (kind === "total" ? 2 * 1024 * 1024 : 64 * 1024) && r.reason.includes(ACT.tooLongExpanded(kind, tl.length)) : !tl);
    }
    // (fix round 3, R3H-F4) …and in Portuguese: each bound's reason holds pt.js's sentence for it (value: dbl22; total: cd30k), and that
    // sentence says what it is about — a variable that grows (value), the paths that add up (total): a table whose two sentences are
    // swapped reads the same from both sides, so the words are what pins them (en's too)
    const reasonIn = (lang, name) => E.approvalGuardDecision({ hook_event_name: "PreToolUse", tool_name: HOSTILE[name][0], tool_input: { command: HOSTILE[name][1] }, cwd: "/work/mono" }, "deny", { meta: {}, lang }).reason || "";
    const SAYS = { pt: { value: "em que uma variável", total: "cujos caminhos" }, en: { value: "in which a variable", total: "whose paths" } };
    const sentenceRows = {};
    for (const lang of ["pt", "en"]) {
      const T8 = require("./lib/i18n/" + lang + ".js").text.approvalActions;
      const r = { value: reasonIn(lang, "dbl22"), total: reasonIn(lang, "cd30k") };
      const own = { value: T8.tooLongExpanded("value", 64 * 1024), total: T8.tooLongExpanded("total", 2 * 1024 * 1024) };
      sentenceRows[lang] = ["value", "total"].every((k) => r[k].includes(own[k]) && own[k].includes(SAYS[lang][k]) && !own[k].includes(SAYS[lang][k === "value" ? "total" : "value"]));
    }
    hostileGot.sentences = sentenceRows;
    hostileRows["the value bound's sentence and the total bound's, each as its table writes it and about its own bound (pt, en)"] = sentenceRows.pt && sentenceRows.en;
    // (R2H-F5) a value built past the read limit stops growing there, the other variables are still read: the edit guard keeps
    // ed680c92's target after a doubling ×14 (`D=tests` — round 1 read every variable after the bound as unknown and lost it)
    const egCmd = "A=xxxxxxxx; " + "A=$A$A; ".repeat(14) + "D=tests; echo hi > $D/protected.test.js; cat .specs/x";
    hostileRows["the edit guard after a doubling ×14: tests/protected.test.js still a target (as ed680c92); the decision too-long (value)"] =
      E.shellWriteTargets(egCmd, "bash", false).includes("tests/protected.test.js") && decide("Bash", egCmd, "deny", false).s === "deny|unreadable:too-long";
    all("1.41.1 fix round 2 (R2H-F2 / F4): the hostile shapes are too long — a value built past 65,536 characters (A=$A$A, PowerShell's \"$a$a\", sh -c '$1' / '$@' ×16,000), the paths' work past 2,097,152 " +
      "(a 30 K cd folder before 3,000 paths, a 1,000-character value put in 2,098 paths — 2,097 still read), a cd / cd .. chain ×2,000 and PowerShell's ×1,000 folded, read (got " + js(hostileGot) + ")", hostileRows);
    // the cd folder folded reads every path as ed680c92 read it (the edit guard's targets, normalized as the path readers normalize):
    // the root, a drive, a leading `..`, `.`, both separators, PowerShell's backslashes
    const facts = (cmd, mode) => E.shellWriteTargets(cmd, mode || "bash", false).map((x) => path.posix.normalize(String(x).split(BS).join("/")));
    const FOLD_WANT = { root: ["b.ts", "/b.ts"], drive: ["b.ts", "b.ts"], lead: ["b.ts", "../../x/y/b.ts"], ps: ["d.ts", "a/c/d.ts"], deep: ["b.ts", "../b.ts"] }; // ed680c92's
    const FOLD = {
      root: ["cd /x/.. && echo a > b.ts", "bash", FOLD_WANT.root],
      drive: ["cd C:/a/../.. && echo a > b.ts", "bash", FOLD_WANT.drive],
      lead: ["cd ../.. && cd x/./y && echo a > b.ts", "bash", FOLD_WANT.lead],
      ps: ["Set-Location a" + BS + "b; Set-Location .." + BS + "c; Set-Content d.ts x", "ps", FOLD_WANT.ps],
      deep: ["cd a/b/c && cd ../../.. && cd .. && echo a > b.ts", "bash", FOLD_WANT.deep],
    };
    const foldGot = Object.fromEntries(Object.entries(FOLD).map(([k, [c, m]]) => [k, facts(c, m)]));
    all("1.41.1 fix round 2 (R2H-F2): the cd folder folded reads every path as ed680c92 did — the root, a drive, a leading `..`, `.`, PowerShell's backslashes (got " + js(foldGot) + ")",
      Object.fromEntries(Object.entries(FOLD).map(([k, [, , want]]) => [k, js(foldGot[k]) === js(want)])));
  }
};
