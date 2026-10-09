"use strict";
// Guards and hooks — what the hooks cost and how they run: the stop gate's work-shaped claims, the hooks' exec form, the observe hook's async run and its placeholder pre-filter, SessionStart's dev-spec probe.
// (10-guards-guard-downs.js holds the other hook pre-filters.)

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = async ({ ok, S, tmp, __dirname, require }) => {
  const js = JSON.stringify;
  const HOOKS = path.join(__dirname, "..", "hooks");
  // The runner may itself run inside Claude Code: its CLAUDE_PROJECT_DIR / SPEC_PROJECT_DIR never leak into the hooks.
  const hookEnv = (env) => ({ ...process.env, CLAUDE_PROJECT_DIR: "", SPEC_PROJECT_DIR: "", ...(env || {}) });
  const hook = (name, pl, env, args, cwd) => spawnSync(process.execPath, [...(args || []), path.join(HOOKS, name + ".js")],
    { input: typeof pl === "string" ? pl : js(pl), encoding: "utf8", env: hookEnv(env), cwd: cwd || tmp, timeout: 20000 });
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
      js(falseBlocks) + ", missed: " + js(missed) + ", hook: " + js(hNot.map((r) => r.stdout.slice(0, 40)).concat(hYes.map(blockOf))) + ")");
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
    const big = project("r7-ss-big");
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
};
