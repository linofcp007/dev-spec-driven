"use strict";
// Guards and hooks — 1.25.1 review 7 (the hooks): the stop gate's claims, the hooks' command form, the observe hook's async run and its placeholder pre-filter, SessionStart's dev-spec probe.
// (10-guards-review6.js holds the findings of review 6; this file those of review 7 on hooks/stop-, observe-, spec- and plan-hook.js.)

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = async ({ ok, S, tmp, __dirname }) => {
  const js = JSON.stringify;
  const HOOKS = path.join(__dirname, "..", "hooks");
  // The runner may itself run inside Claude Code: its CLAUDE_PROJECT_DIR / SPEC_PROJECT_DIR never leak into the hooks.
  const hookEnv = (env) => ({ ...process.env, CLAUDE_PROJECT_DIR: "", SPEC_PROJECT_DIR: "", ...(env || {}) });
  const hook = (name, pl, env, args) => spawnSync(process.execPath, [...(args || []), path.join(HOOKS, name + ".js")],
    { input: typeof pl === "string" ? pl : js(pl), encoding: "utf8", env: hookEnv(env), cwd: tmp, timeout: 20000 });
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
    const readme = fs.readFileSync(path.join(root, "README.md"), "utf8"), install = fs.readFileSync(path.join(root, "INSTALL.md"), "utf8");
    const quick = ["### Quick start", "### Começar rápido", "### Inicio rápido"].map((h) => readme.slice(readme.indexOf(h), readme.indexOf(h) + 400));
    ok(entries.length >= 9 && !bad.length && spawned.every((r) => r.status === 0 && r.stdout === "") && req(install.slice(0, 600)) && quick.every(req),
      "1.25.1 (r7 finding 2): every hooks.json entry is exec form — command 'node', args [${CLAUDE_PLUGIN_ROOT}/hooks/<script>] (an existing script), timeout 10 — and runs as Claude Code spawns it (no shell); INSTALL.md and the README's quick start (EN / PT / ES) require Claude Code 2.1.139+ (got " +
      js({ n: entries.length, bad, spawned: spawned.map((r) => r.status + ":" + r.stdout.slice(0, 30)), quick: quick.map(req) }) + ")");
  }
};
