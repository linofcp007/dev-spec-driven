"use strict";
// Claude Code integration — the status line, DEV_SPEC_* defaults, annotations / completion, the plan-mode bridge.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

exports.run = async ({ ok, rpc, payload, S, root, tmp, SERVER, abort, require }) => {

  // 1.16 package (C) — Claude Code integration: status line, user defaults (DEV_SPEC_*), annotations / completion, plan-mode bridge.

  {
    const cRoot = path.join(tmp, "p16c");
    fs.mkdirSync(cRoot, { recursive: true });
    const cRead = (f) => fs.readFileSync(f, "utf8");
    const cMeta = (d) => (JSON.parse(cRead(path.join(d, ".specs", "roadmap.json"))).meta || {});
    const OPT_KEYS = ["DEV_SPEC_DEFAULT_LANG", "CLAUDE_PLUGIN_OPTION_DEFAULT_LANG", "DEV_SPEC_STOP_CHECK", "CLAUDE_PLUGIN_OPTION_STOP_CHECK",
      "DEV_SPEC_GUARD_DEFAULT", "CLAUDE_PLUGIN_OPTION_GUARD_DEFAULT"];
    // The user's defaults for one in-process engine call (restored after it); unset keys are removed. The CLAUDE_PLUGIN_OPTION_*
    // names are cleared too: the engine must ignore them (the plugin declares no userConfig).
    const withOpts = (vars, fn) => {
      const saved = OPT_KEYS.map((k) => [k, process.env[k]]);
      for (const k of OPT_KEYS) { if (vars[k] == null) delete process.env[k]; else process.env[k] = vars[k]; }
      try { return fn(); } finally { for (const [k, v] of saved) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
    };
    // A child's environment: no DEV_SPEC_* default and no project folder from this process unless given.
    const childEnv = (env) => {
      const e = { ...process.env };
      for (const k of OPT_KEYS.concat(["SPEC_PROJECT_DIR", "CLAUDE_PROJECT_DIR"])) delete e[k];
      return { ...e, ...(env || {}) };
    };
    // Every file under a folder with its size, date and content — a read-only call leaves it identical.
    const cSnap = (d) => {
      const out = [];
      const walk = (p) => {
        for (const e of fs.readdirSync(p, { withFileTypes: true })) {
          const f = path.join(p, e.name);
          if (e.isDirectory()) walk(f);
          else { const st = fs.statSync(f); out.push(path.relative(d, f) + "|" + st.size + "|" + st.mtimeMs + "|" + cRead(f)); }
        }
      };
      walk(d);
      return out.sort().join("\n");
    };
    // An MCP session of its own (its env and default project).
    const cServer = (projectDir, env) => {
      const kid = spawn(process.execPath, [SERVER], { env: { ...childEnv(env), SPEC_PROJECT_DIR: projectDir }, stdio: ["pipe", "pipe", "inherit"] });
      const waiting = new Map();
      let b = "";
      let n = 0;
      kid.stdout.on("data", (d) => {
        b += d.toString();
        let nl;
        while ((nl = b.indexOf("\n")) >= 0) {
          const line = b.slice(0, nl).trim();
          b = b.slice(nl + 1);
          if (!line) continue;
          const m = JSON.parse(line);
          if (waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
        }
      });
      const req = (method, params) => new Promise((resolve) => {
        const id = "c-" + ++n;
        const t = setTimeout(() => abort("1.16 C: no reply to " + method + " (" + id + ") within 15s"), 15000);
        waiting.set(id, (m) => { clearTimeout(t); resolve(m); });
        kid.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
      });
      const stop = () => new Promise((resolve) => { kid.on("exit", resolve); kid.stdin.end(); });
      return { req, stop };
    };
    const hook = (script, input, env) => spawnSync(process.execPath, [path.join(root, "hooks", script)],
      { input: typeof input === "string" ? input : JSON.stringify(input), encoding: "utf8", env: childEnv(env), timeout: 30000 });
    const jsonOut = (r) => { try { return JSON.parse(r.stdout); } catch { return null; } };
    const none = fs.mkdtempSync(path.join(os.tmpdir(), "p16c-none-")); // no .specs/ at or above it
    // A core feature whose planning chain is filled (every gate through tasks passes — approvals need no force; a FORCED approval
    // whose gate still fails is a `fix` for next_action and the status line alike).
    const cFill = (dir, name) => {
      const w = (rel, txt) => fs.writeFileSync(path.join(dir, rel), txt);
      w("classification.md", `# Classification: ${name}\n\n## Mode\nSpec\n\n## Active Tracks\ncore\n\n## Signals\n- none, plain feature\n\n## Blast Radius\nLow; one module.\n\n## Compliance Tags\nnone\n`);
      w("requirements.md", `# Feature: ${name}\n\n## Summary\nUsers log in with email and password.\n\n## User Stories (prioritized — each independently testable)\n\n### US-1 (P1 — MVP): Log in\n` +
        "**As a** user, **I want** to log in, **so that** I see my account.\n**Why P1:** nothing works without it.\n**Independent Test:** Can be fully tested by logging in and delivers access, without the other stories.\n\n" +
        "#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN the user submits valid credentials THE SYSTEM SHALL open a session\n2. **US-1.AC-2** — IF the credentials are wrong THEN THE SYSTEM SHALL show an error\n\n" +
        "## Success Criteria (measurable, technology-agnostic)\n- **SC-001** — 95% of logins complete in under 2 seconds\n\n## Edge Cases & Error Handling\n- **EC-1** — Locked account: show the lock message\n\n" +
        "## Non-Functional Requirements\n- **NFR-1** — p95 latency under 300 ms\n\n## Out of Scope\n- Social login\n\n## Assumptions\n- Users already have accounts\n");
      w("design.md", `# Design: ${name}\n\n## Overview\nA form posts to /login; the server checks the hash.\n\n## Architecture\nThe web app calls the auth service.\n\n## Data Models\nUser { id, email, hash }\n\n` +
        "## API Contracts\nPOST /login returns 200 or 401.\n\n## Security Considerations\nHashes use bcrypt.\n\n## Error Handling\nWrong credentials give 401.\n\n## Testing Strategy\n- Unit tests for the handler.\n\n" +
        "## Constitution Check\n- [x] Simplicity — complies\n\n## Complexity Tracking\nNone.\n");
    };

    // --- C1: the status line (engine) ---
    const sl = path.join(cRoot, "status");
    withOpts({}, () => {
      S.initProject(sl, ["core"], "en");
      const bill = S.createFeature(sl, "Billing", ["core"], "Invoices", undefined, "en");
      cFill(bill.dir, "Billing");
      fs.writeFileSync(path.join(sl, ".specs", "billing", "tasks.md"), ["# Tasks: Billing", "", "## Phase 1", "",
        "- [ ] 1. Charge the card", "  - _Requirements: US-1.AC-1_", "  - _Verify: node -e \"process.exit(0)\"_",
        "- [ ] 2. Send the invoice", "  - _Requirements: US-1.AC-2_", "  - _Verify: node -e \"process.exit(0)\"_",
        "- [ ] 3. Refund", "  - _Requirements: US-1.AC-1_", "- [ ] 4. Report", "  - _Requirements: US-1.AC-2_", ""].join("\n"));
      S.approvePhase(sl, "billing", null, "t", { through: "tasks" });
      S.completeTask(sl, "billing", 1, { command: "node -e \"process.exit(0)\"", exitCode: 0, summary: "ok" });
      S.completeTask(sl, "billing", 2, { summary: "sent by hand" }); // a note on a runnable _Verify:_ — ticked, not verified
      S.createFeature(sl, "Auth", ["core"], "Login", undefined, "en"); // newer, nothing under way
    });
    const slBefore = cSnap(path.join(sl, ".specs"));
    const sl1 = S.statusLine(sl);
    ok(sl1.ok && sl1.found && sl1.feature === "billing" && sl1.kind === "feature" && sl1.tasks.done === 2 && sl1.tasks.total === 4 && sl1.unverified === 1 &&
      sl1.next && sl1.next.step === "implement" && sl1.next.task === 3 && sl1.features === 2 && sl1.line === "◆ billing · 2/4 tasks · 1 unverified · next: task 3" &&
      cSnap(path.join(sl, ".specs")) === slBefore,
      "1.16 C1: statusLine shows the feature with work under way (not the newer planning one) — tasks, unverified ticks, the next task — and writes nothing (got " + JSON.stringify(sl1) + ")");
    // Planning features: the first unapproved phase — fill its artifact while it is a template, approve it once filled; PT line.
    const sl2 = path.join(cRoot, "status-pt");
    withOpts({}, () => { S.initProject(sl2, ["core"], "pt"); S.createFeature(sl2, "Auth", ["core"], "Login", undefined, "pt"); });
    const sl2a = S.statusLine(sl2);
    const cls2 = path.join(sl2, ".specs", "auth", "classification.md");
    fs.writeFileSync(cls2, cRead(cls2).replace(/\[[^\]\n]*\]/g, (m) => (/^\[(?:US\d+|P|shared|x| )\]$/.test(m) ? m : "o login com e-mail")));
    const sl2b = S.statusLine(sl2);
    ok(sl2a.next.step === "fill" && sl2a.next.file === "classification.md" && /^◆ auth · 0\/\d+ tarefas · a seguir: preencher classification\.md$/.test(sl2a.line) &&
      sl2b.next.step === "approve" && sl2b.next.phase === "classification" && /· a seguir: aprovar classification$/.test(sl2b.line),
      "1.16 C1: a planning feature — fill the first unapproved phase's template, then approve it (its gate passes); the line in the project language (got " +
      JSON.stringify([sl2a.line, sl2b.line, sl2b.next]) + ")");
    // No feature yet · no .specs/ · the project found by walking up · the width cut.
    const sl3 = path.join(cRoot, "status-es");
    withOpts({}, () => S.initProject(sl3, ["core"], "es"));
    const sl3r = S.statusLine(sl3);
    const slNone = S.statusLine(none);
    const cut = S.statusLine(sl, { columns: 24 }).line;
    ok(sl3r.found && sl3r.feature === null && sl3r.line === "◆ dev-spec · aún no hay funciones — /spec" && slNone.found === false && slNone.line === "" &&
      S.statusLineProject([path.join(sl, "src", "deep", "er")]) === path.resolve(sl) && S.statusLineProject(["${CLAUDE_PROJECT_DIR}", 42, "", none]) === null &&
      S.statusLineProject([none, path.join(sl2, "lib")]) === path.resolve(sl2) && [...cut].length === 24 && cut.endsWith("…"),
      "1.16 C1: no feature → a hint line; no .specs/ → nothing; the project is the nearest dev-spec .specs/ at or above the folder (unexpanded / empty candidates skipped); cut to the width (got " +
      JSON.stringify([sl3r.line, slNone, cut]) + ")");
    // Bounded: 50 features read in well under a second once the engine is warm. 1.20 review: relative to a 5-feature project
    // measured just before (the absolute bounds shared the machine with the parallel runner — warm 730 ms against 1 s): linear
    // is ~10× it, so 20× (or the old 3 s / 1 s floors, which hold on an idle machine) still catches a big slowdown; a
    // timing-only miss is measured once more.
    const slProject = (name, n) => {
      const dir = path.join(cRoot, name);
      withOpts({}, () => { S.initProject(dir, ["core"], "en"); S.createFeature(dir, "Feature 0", ["core"], "x", undefined, "en"); });
      for (let i = 1; i < n; i++) fs.cpSync(path.join(dir, ".specs", "feature-0"), path.join(dir, ".specs", "feature-" + i), { recursive: true });
      return dir;
    };
    const sl5 = slProject("status-5", 5), sl50 = slProject("status-50", 50);
    const slTimes = (dir) => { // warm = the best of 3 calls: a slowdown shows in every call, a busy machine's spike in one
      const t0 = Date.now();
      const r = S.statusLine(dir);
      const first = Date.now() - t0;
      const warm = [0, 1, 2].map(() => { const t1 = Date.now(); S.statusLine(dir); return Date.now() - t1; });
      return { r, first, warm: Math.min(...warm) };
    };
    const slMeasure = () => {
      const base = slTimes(sl5), big = slTimes(sl50);
      const bounds = { first: Math.max(3000, 20 * Math.max(base.first, 5)), warm: Math.max(1000, 20 * Math.max(base.warm, 1)) };
      return { base, big, bounds, fast: big.first < bounds.first && big.warm < bounds.warm };
    };
    let sl50m = slMeasure();
    if (!sl50m.fast) sl50m = slMeasure(); // a timing-only miss: measured once more
    const r50 = sl50m.big.r;
    ok(r50.features === 50 && typeof r50.line === "string" && r50.line.startsWith("◆ feature-") && sl50m.base.r.features === 5 && sl50m.fast,
      "1.16 C1: a 50-feature project — one line, bounded time (first " + sl50m.big.first + " ms, warm " + sl50m.big.warm + " ms per call — best of 3; 5 features: " +
      sl50m.base.first + " / " + sl50m.base.warm + " ms; bounds " + JSON.stringify(sl50m.bounds) + ")");

    // --- C2: the user's defaults (DEV_SPEC_<KEY> environment variables) — fallbacks only; the project's meta wins ---
    const u1 = path.join(cRoot, "opts-fresh");
    const u1r = withOpts({ DEV_SPEC_DEFAULT_LANG: "pt", DEV_SPEC_STOP_CHECK: "false", DEV_SPEC_GUARD_DEFAULT: "scope" }, () => S.initProject(u1, ["core"]));
    const u1m = cMeta(u1);
    ok(u1r.lang === "pt" && u1m.lang === "pt" && u1r.stopCheck === false && u1r.guard === "scope" && JSON.stringify(u1r.userDefaults) === '{"lang":"pt","stopCheck":false,"guard":"scope"}' &&
      !("stopCheck" in u1m) && !("guard" in u1m) && withOpts({}, () => S.stopCheckEnabled(u1) === true && S.guardLevel(u1) === false && S.projectLang(u1) === "pt"),
      "1.16 C2: a new project takes the user's options — DEV_SPEC_DEFAULT_LANG seeded into meta.lang (kept without the variable), DEV_SPEC_STOP_CHECK / DEV_SPEC_GUARD_DEFAULT as fallbacks only, reported in userDefaults (got " +
      JSON.stringify([u1r.lang, u1r.userDefaults, u1m]) + ")");
    const u2 = path.join(cRoot, "opts-meta");
    const u2r = withOpts({ DEV_SPEC_DEFAULT_LANG: "pt", DEV_SPEC_STOP_CHECK: "off", DEV_SPEC_GUARD_DEFAULT: "on" },
      () => [S.initProject(u2, ["core"], "es", { stopCheck: true, guard: "off" }), S.stopCheckEnabled(u2), S.guardLevel(u2)]);
    const u2m = cMeta(u2);
    ok(u2r[0].lang === "es" && u2m.lang === "es" && u2m.stopCheck === true && u2m.guard === false && u2r[1] === true && u2r[2] === false && !u2r[0].userDefaults,
      "1.16 C2: the project wins — an explicit lang, stopCheck on (written where the user's option says off) and guard off beat the options (got " + JSON.stringify([u2m, u2r.slice(1), u2r[0].userDefaults]) + ")");
    const prec = [
      withOpts({ DEV_SPEC_STOP_CHECK: "off" }, () => S.stopCheckEnabled(sl)),
      withOpts({ CLAUDE_PLUGIN_OPTION_STOP_CHECK: "off" }, () => S.stopCheckEnabled(sl)),
      withOpts({ DEV_SPEC_STOP_CHECK: "${DEV_SPEC_STOP}" }, () => S.stopCheckEnabled(sl)),
      withOpts({ DEV_SPEC_STOP_CHECK: "maybe" }, () => S.stopCheckEnabled(sl)),
      withOpts({ DEV_SPEC_GUARD_DEFAULT: "scope" }, () => S.guardLevel(sl)),
      withOpts({ CLAUDE_PLUGIN_OPTION_GUARD_DEFAULT: "on" }, () => S.guardLevel(sl)),
      withOpts({ DEV_SPEC_STOP_CHECK: "off" }, () => S.stopCheck(sl, { message: "All tasks are done." }).why),
      withOpts({}, () => S.stopCheck(sl, { message: "All tasks are done." }).block),
    ];
    ok(JSON.stringify(prec) === '[false,true,true,true,"scope",false,"off",true]',
      "1.16 C2: meta unset → DEV_SPEC_<KEY> decides; CLAUDE_PLUGIN_OPTION_<KEY> (no userConfig), an unexpanded ${X} or an invalid value changes nothing; the stop gate answers 'off' (got " + JSON.stringify(prec) + ")");
    // DEV_SPEC_DEFAULT_LANG never re-labels an existing project; the first spec_create of a new one takes it (and seeds meta.lang).
    const u4 = path.join(cRoot, "opts-legacy");
    withOpts({}, () => S.createFeature(u4, "Old", ["core"], "x", undefined, "en"));
    const u4r = withOpts({ DEV_SPEC_DEFAULT_LANG: "es" }, () => [S.initProject(u4, ["core"]).lang, S.createFeature(u4, "New", ["core"], "y").lang]);
    const u5 = path.join(cRoot, "opts-create");
    const u5r = withOpts({ DEV_SPEC_DEFAULT_LANG: "es" }, () => S.createFeature(u5, "Pagos", ["core"], "cobros con tarjeta"));
    const u6 = path.join(cRoot, "opts-explicit");
    const u6r = withOpts({ DEV_SPEC_DEFAULT_LANG: "es" }, () => S.createFeature(u6, "Pay", ["core"], "cards", undefined, "pt-BR"));
    ok(JSON.stringify(u4r) === '["en","en"]' && !("lang" in cMeta(u4)) && u5r.ok && u5r.lang === "es" && cMeta(u5).lang === "es" && u5r.userDefaults && u5r.userDefaults.lang === "es" &&
      /^## Historias de Usuario/m.test(cRead(path.join(u5r.dir, "requirements.md"))) && u6r.lang === "pt-BR" && !("lang" in cMeta(u6)) && !u6r.userDefaults,
      "1.16 C2: DEV_SPEC_DEFAULT_LANG — never for a project that has features; a new project's first spec_create takes it and seeds meta.lang; an explicit lang wins (got " +
      JSON.stringify([u4r, u5r.lang, cMeta(u5).lang, u6r.lang]) + ")");
    // The variables reach the MCP server and the hooks (Claude Code's settings.json `env` sets them for every subprocess).
    const u7 = path.join(cRoot, "opts-mcp");
    const u7s = cServer(u7, { DEV_SPEC_DEFAULT_LANG: "pt-BR" });
    await u7s.req("initialize", { protocolVersion: "2025-06-18", capabilities: {} });
    const u7r = payload(await u7s.req("tools/call", { name: "spec_init", arguments: { tracks: ["core"] } }));
    await u7s.stop();
    const u8 = path.join(cRoot, "opts-mcp-literal");
    const u8s = cServer(u8, { DEV_SPEC_DEFAULT_LANG: "${DEV_SPEC_LANG}", DEV_SPEC_STOP_CHECK: "${STOP}", CLAUDE_PLUGIN_OPTION_DEFAULT_LANG: "es", CLAUDE_PLUGIN_OPTION_STOP_CHECK: "off" });
    await u8s.req("initialize", { protocolVersion: "2025-06-18", capabilities: {} });
    const u8r = payload(await u8s.req("tools/call", { name: "spec_init", arguments: { tracks: ["core"] } }));
    await u8s.stop();
    const stopPayload = { hook_event_name: "Stop", cwd: sl, last_assistant_message: "All tasks are done and verified." };
    const guardPayload = { hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: path.join(sl2, "src", "login.js") }, cwd: sl2 };
    const hStop = [hook("stop-hook.js", stopPayload), hook("stop-hook.js", stopPayload, { DEV_SPEC_STOP_CHECK: "false" })];
    const hGuard = [hook("guard-hook.js", guardPayload), hook("guard-hook.js", guardPayload, { DEV_SPEC_GUARD_DEFAULT: "on" })];
    const hg = jsonOut(hGuard[1]);
    ok(u7r.lang === "pt-BR" && cMeta(u7).lang === "pt-BR" && u8r.lang === "en" && u8r.stopCheck === true && !u8r.userDefaults &&
      (jsonOut(hStop[0]) || {}).decision === "block" && hStop[1].status === 0 && hStop[1].stdout === "" &&
      hGuard[0].status === 0 && hGuard[0].stdout === "" && hg && hg.hookSpecificOutput.permissionDecision === "ask",
      "1.16 C2: the variables reach the MCP server (a literal ${X} and the CLAUDE_PLUGIN_OPTION_* names are ignored) and the hooks — DEV_SPEC_STOP_CHECK off silences the Stop gate, DEV_SPEC_GUARD_DEFAULT on makes the guard ask (got " +
      JSON.stringify([u7r.lang, u8r.lang, hStop.map((h) => h.stdout.slice(0, 40)), hGuard.map((h) => h.stdout.slice(0, 60))]) + ")");
    // The manifest declares NO userConfig (a configuration dialog on every install, and an older Claude Code validating option
    // fields strictly would refuse the plugin) and mcp/servers.json passes no ${user_config.*}; still no hooks key.
    const man = JSON.parse(cRead(path.join(root, ".claude-plugin", "plugin.json")));
    const srv = JSON.parse(cRead(path.join(root, "mcp", "servers.json"))).mcpServers["spec-driven"];
    const srvEnv = srv.env;
    // 1.21 F1b: + SPEC_MCP_APPROVAL_HOOK=on — in Claude Code the plugin's approval hook guards spec_approve (no elicitation there).
    // 1.23 review 5 (L22): no `cwd` — Claude Code substitutes ${…} in a plugin stdio server's command / args / env only, and no
    // `cwd` field is documented: an unexpanded "${CLAUDE_PROJECT_DIR}" honoured as the spawn folder would stop the server.
    ok(!("userConfig" in man) && !("hooks" in man) && Object.keys(srvEnv).sort().join() === "SPEC_MCP_APPROVAL_HOOK,SPEC_MCP_PROMPTS,SPEC_PROJECT_DIR" &&
      srvEnv.SPEC_MCP_APPROVAL_HOOK === "on" && srvEnv.SPEC_PROJECT_DIR === "${CLAUDE_PROJECT_DIR}" && !/user_config|CLAUDE_PLUGIN_OPTION/.test(JSON.stringify(srvEnv)) &&
      Object.keys(srv).sort().join() === "args,command,env",
      "1.16 C2: plugin.json declares no userConfig and no hooks key; mcp/servers.json passes only SPEC_PROJECT_DIR / SPEC_MCP_PROMPTS / SPEC_MCP_APPROVAL_HOOK=on and sets only command / args / env (1.23: no cwd) (got " +
      JSON.stringify([Object.keys(man), Object.keys(srv), srvEnv]) + ")");

    // --- C3: MCP tool annotations and completion/complete ---
    const tl = (await rpc("tools/list", {})).result.tools;
    const roTools = tl.filter((t) => t.annotations && t.annotations.readOnlyHint === true).map((t) => t.name).sort();
    ok(tl.every((t) => t.annotations && t.annotations.openWorldHint === false && typeof t.annotations.readOnlyHint === "boolean" &&
      (t.annotations.readOnlyHint || (typeof t.annotations.destructiveHint === "boolean" && typeof t.annotations.idempotentHint === "boolean"))) &&
      // 1.25.1 (review 7): destructiveHint on every tool one of whose arguments removes or overwrites a record (it was spec_feature alone)
      tl.filter((t) => t.annotations.destructiveHint === true).map((t) => t.name).sort().join() === ["spec_feature", "spec_export", "spec_approve", "spec_complete_task",
        "spec_impact", "spec_backlog", "spec_milestone", "spec_depend", "spec_add_track", "spec_init", "spec_tracks"].sort().join() &&
      roTools.join() === ["ears_validate", "spec_classify", "spec_clarify", "spec_coverage", "spec_doctor", "spec_drift", "spec_list", "spec_next_action", "spec_next_task",
        "spec_scan", "spec_status", "trace_check", "spec_stop_check", "spec_log"].sort().join() &&
      ["spec_complete_task", "spec_approve", "spec_append_tasks", "spec_decide", "spec_finish"].every((n) => tl.find((t) => t.name === n).annotations.idempotentHint === false) &&
      ["spec_roadmap", "spec_catalog", "spec_export", "spec_upgrade", "spec_init"].every((n) => tl.find((t) => t.name === n).annotations.idempotentHint === true),
      "1.16 C3: every tool carries annotations — openWorldHint false everywhere, readOnlyHint only for the 14 tools no argument makes write, destructiveHint on the 11 whose arguments remove or overwrite (1.25.1 r7 — it was spec_feature alone), idempotentHint per tool (got " +
      JSON.stringify(tl.filter((t) => !t.annotations || t.annotations.destructiveHint === true).map((t) => t.name).concat(roTools)) + ")");
    const roBefore = cSnap(path.join(sl, ".specs"));
    const roCalls = [];
    const roArgs = { name: "billing", description: "billing invoices", code: true, matrix: true, message: "All done.", gitLog: "commit 0123456789abcdef0123456789abcdef01234567", projectDir: sl };
    for (const n of roTools) {
      // each tool gets the arguments its schema lists (1.24 r6 A1: another one is refused — unknown-argument)
      const props = tl.find((t) => t.name === n).inputSchema.properties || {};
      roCalls.push(await rpc("tools/call", { name: n, arguments: Object.fromEntries(Object.entries(roArgs).filter(([k]) => Object.prototype.hasOwnProperty.call(props, k))) }));
    }
    ok(roCalls.every((m) => m.result && !m.result.isError) && cSnap(path.join(sl, ".specs")) === roBefore,
      "1.16 C3: the read-only tools leave .specs/ exactly as it was — every file, size and date (got " + JSON.stringify(roCalls.filter((m) => !m.result || m.result.isError).map((m) => JSON.stringify(m).slice(0, 120))) + ")");
    const cs = cServer(sl, { SPEC_MCP_PROMPTS: "" });
    const csInit = await cs.req("initialize", { protocolVersion: "2025-06-18", capabilities: {} });
    const comp = async (params) => cs.req("completion/complete", params);
    const vals = (m) => (m.result && m.result.completion) || null;
    const pr = { ref: { type: "ref/prompt", name: "spec-status" }, argument: { name: "args", value: "bi" } };
    const cp = [await comp(pr), await comp({ ...pr, ref: { type: "ref/prompt", name: "spec-doctor" }, argument: { name: "args", value: "" } }),
      await comp({ ...pr, argument: { name: "args", value: "billing x" } }), await comp({ ref: { type: "ref/prompt", name: "classify" }, argument: { name: "args", value: "a" } }),
      await comp({ ...pr, argument: { name: "args", value: "ILL" } })];
    ok(JSON.stringify(csInit.result.capabilities.completions) === "{}" && JSON.stringify(vals(cp[0])) === '{"values":["billing"],"total":1,"hasMore":false}' &&
      vals(cp[1]).values.join() === "auth,billing" && vals(cp[2]).values.length === 0 && vals(cp[3]).values.length === 0 && vals(cp[4]).values.join() === "billing",
      "1.16 C3: completion/complete on a prompt whose argument names a feature → the active features' slugs (prefix, then substring, case-insensitive; a second word → none); a prompt taking a description → none (got " +
      JSON.stringify(cp.map(vals)) + ")");
    const tpl = "specs://feature/{slug}/{artifact}";
    const cr = [await comp({ ref: { type: "ref/resource", uri: tpl }, argument: { name: "slug", value: "AU" } }),
      await comp({ ref: { type: "ref/resource", uri: tpl }, argument: { name: "artifact", value: "t" }, context: { arguments: { slug: "billing" } } }),
      await comp({ ref: { type: "ref/resource", uri: tpl }, argument: { name: "artifact", value: "spi" } }),
      await comp({ ref: { type: "ref/resource", uri: "specs://steering/{file}" }, argument: { name: "file", value: "con" } })];
    const billFiles = fs.readdirSync(path.join(sl, ".specs", "billing"));
    ok(vals(cr[0]).values.join() === "auth" && vals(cr[1]).values[0] === "tasks.md" && vals(cr[1]).values.every((a) => billFiles.includes(a)) &&
      vals(cr[2]).values.join() === "spike.md" && vals(cr[3]).values.join() === "constitution.md",
      "1.16 C3: completion/complete on the specs:// templates — {slug} → features, {artifact} → the artifacts context.arguments.slug has (else every allowlisted one), {file} → steering files (got " +
      JSON.stringify(cr.map(vals)) + ")");
    const ce = [await comp({ ref: { type: "ref/prompt", name: "nope" }, argument: { name: "args", value: "" } }),
      await comp({ ref: { type: "ref/resource", uri: "specs://other/{x}" }, argument: { name: "x", value: "" } }),
      await comp({ ref: { type: "ref/resource", uri: "specs://steering/{file}" }, argument: { name: "slug", value: "" } }),
      await comp({ argument: { name: "args", value: "" } }), await comp({ ...pr, argument: { name: "feature", value: "" } }),
      await comp({ ref: { type: "ref/other" }, argument: { name: "args", value: "" } }), await cs.req("completion/complete", null)];
    await cs.stop();
    const code = (m) => (m.error ? m.error.code : null);
    ok(ce.every((m) => code(m) === -32602 && !m.result) && /Unknown prompt 'nope'/.test(ce[0].error.message) && /Unknown resource template 'specs:\/\/other\/\{x\}'/.test(ce[1].error.message) &&
      /Unknown argument 'slug' — one of: file/.test(ce[2].error.message) && /needs `ref`/.test(ce[3].error.message) && /Unknown argument 'feature' — one of: args/.test(ce[4].error.message),
      "1.16 C3: completion/complete errors are JSON-RPC Invalid params (-32602): an unknown prompt, template, argument or ref type, a request without ref / params (got " + JSON.stringify(ce.map((m) => [code(m), m.error && m.error.message.slice(0, 50)])) + ")");
    const cOff = cServer(sl, { SPEC_MCP_PROMPTS: "off" });
    const cOffInit = await cOff.req("initialize", { protocolVersion: "2025-06-18", capabilities: {} });
    const cOffP = await cOff.req("completion/complete", pr);
    const cOffR = await cOff.req("completion/complete", { ref: { type: "ref/resource", uri: tpl }, argument: { name: "slug", value: "" } });
    await cOff.stop();
    const capRoot = path.join(cRoot, "cap");
    for (let i = 0; i < 120; i++) fs.mkdirSync(path.join(capRoot, ".specs", "f" + String(i).padStart(3, "0")), { recursive: true });
    const capR = require("./lib/prompts-resources.js").complete(capRoot, { ref: { type: "ref/resource", uri: tpl }, argument: { name: "slug", value: "f" } }, { lang: "en" });
    ok(!("prompts" in cOffInit.result.capabilities) && JSON.stringify(cOffInit.result.capabilities.completions) === "{}" && code(cOffP) === -32602 && /SPEC_MCP_PROMPTS=off/.test(cOffP.error.message) &&
      vals(cOffR).values.join() === "auth,billing" && capR.ok && capR.completion.values.length === 100 && capR.completion.total === 120 && capR.completion.hasMore === true,
      "1.16 C3: with SPEC_MCP_PROMPTS=off (the Claude Code plugin) a ref/prompt is refused and the resource completions stay; at most 100 values, with total / hasMore (got " +
      JSON.stringify([cOffP.error, vals(cOffR), capR.completion && [capR.completion.values.length, capR.completion.total, capR.completion.hasMore]]) + ")");

    // --- C4: the plan-mode bridge — spec_import {text} and the ExitPlanMode hook ---
    const planMd = ["# Plan: Dark mode", "", "## Summary", "Let users switch the app to a dark theme.", "", "## Goals",
      "- WHEN the user picks dark mode THE SYSTEM SHALL apply the dark palette", "- The choice survives a reload", "", "## Steps",
      "1. Add the theme context in `src/theme.ts`", "2. Wire the toggle in `src/settings.tsx`", "", "## Approach", "CSS variables per theme.", ""].join("\n");
    const pa = path.join(cRoot, "plan-file");
    const pb = path.join(cRoot, "plan-text");
    fs.mkdirSync(path.join(pa, "plans"), { recursive: true });
    fs.writeFileSync(path.join(pa, "plans", "dark-mode.md"), planMd);
    const ia = withOpts({}, () => S.importSpec(pa, "plan", "plans/dark-mode.md", { lang: "en" }));
    const ib = withOpts({}, () => S.importSpec(pb, "plan", undefined, { text: planMd, lang: "en" }));
    const noteless = (t) => t.replace(/^> Imported from plan .*$/gm, "> NOTE");
    const same = ["requirements.md", "design.md", "tasks.md", "classification.md"].filter((f) => noteless(cRead(path.join(ia.dir, f))) !== noteless(cRead(path.join(ib.dir, f))));
    ok(ia.ok && ib.ok && ia.feature === "dark-mode" && ib.feature === "dark-mode" && same.length === 0 && JSON.stringify(ia.mapping) === JSON.stringify(ib.mapping) &&
      JSON.stringify(ia.warnings) === JSON.stringify(ib.warnings) && ia.tracks.join() === ib.tracks.join() && JSON.stringify(ia.files) === JSON.stringify(ib.files) &&
      ib.inline === true && ib.source === null && ia.source === "plans/dark-mode.md" && !("inline" in ia) &&
      /^> Imported from plan \(inline text\) on \d{4}-\d\d-\d\d\.$/m.test(cRead(path.join(ib.dir, "requirements.md"))),
      "1.16 C4: spec_import {text} = the file import — same requirements, design, tasks, classification (only the note differs: 'inline text'), mapping, warnings and tracks; inline: true, source: null (got " +
      JSON.stringify([ia.ok ? ia.feature : ia.error, ib.ok ? ib.feature : ib.error, same]) + ")");
    const call16 = async (args) => { const m = await rpc("tools/call", { name: "spec_import", arguments: args }); return { isError: m.result && m.result.isError, body: m.result ? JSON.parse(m.result.content[0].text) : m }; };
    const ic = [await call16({ tool: "plan", text: planMd, name: "Dark Mode MCP", projectDir: pb }), await call16({ tool: "kiro", text: "# x", projectDir: pb }),
      await call16({ tool: "plan", path: "plans/dark-mode.md", text: planMd, projectDir: pa }), await call16({ tool: "plan", projectDir: pb }),
      await call16({ tool: "plan", text: 42, projectDir: pb }), await call16({ tool: "plan", text: "<!-- only a comment -->\n", projectDir: pb }),
      await call16({ tool: "plan", path: "~/.claude/plans/x.md", projectDir: pb })];
    ok(!ic[0].isError && ic[0].body.feature === "dark-mode-mcp" && ic[0].body.inline === true && ic.slice(1).every((r) => r.isError) &&
      /`text` imports a single document — tool plan, execplan, fluidplan; 'kiro' reads a folder/.test(ic[1].body.error) && /either `path` or `text`, not both/.test(ic[2].body.error) &&
      /Missing required argument\(s\): path/.test(ic[3].body.error) && /text/.test(ic[4].body.error) && /The plan text is empty/.test(ic[5].body.error) &&
      /outside the project/.test(ic[6].body.error) && /pass its markdown as `text`/.test(ic[6].body.error) && !fs.existsSync(path.join(pb, ".specs", "x")),
      "1.16 C4: spec_import {tool: 'plan', text} over MCP; text for a folder tool, path + text, neither, a non-string, an empty text are refused; a plan outside the project names the text way (got " +
      JSON.stringify(ic.map((r) => (r.isError ? String(r.body.error).slice(0, 60) : r.body.feature))) + ")");
    const plain = path.join(cRoot, "plain");
    fs.mkdirSync(plain, { recursive: true });
    const exit = { hook_event_name: "PostToolUse", tool_name: "ExitPlanMode", tool_input: { plan: planMd }, tool_response: {} };
    const hp = [hook("plan-hook.js", { ...exit, cwd: sl }),
      hook("plan-hook.js", { ...exit, tool_input: { plan: planMd, planFilePath: path.join(sl, "docs", "plan.md") }, cwd: sl }),
      hook("plan-hook.js", { ...exit, cwd: sl2 }),
      hook("plan-hook.js", { ...exit, cwd: plain }), hook("plan-hook.js", "{not json"), hook("plan-hook.js", { ...exit, tool_name: "Write", cwd: sl }),
      hook("plan-hook.js", { ...exit, hook_event_name: "PreToolUse", cwd: sl }), hook("plan-hook.js", { ...exit, cwd: none }, { CLAUDE_PROJECT_DIR: sl })];
    const hpj = hp.map(jsonOut);
    const ctx = (j) => (j && j.hookSpecificOutput && j.hookSpecificOutput.hookEventName === "PostToolUse" ? j.hookSpecificOutput.additionalContext : "");
    const hooksCfg16 = JSON.parse(cRead(path.join(root, "hooks", "hooks.json"))).hooks;
    // (1.25.1: exec form — `node` + the script as its one argument)
    const planCfg = (hooksCfg16.PostToolUse || []).find((e) => e.hooks.some((h) => /plan-hook\.js/.test((h.args || []).join(" ")))) || {};
    ok(hp.every((h) => h.status === 0) && /\/spec-import — spec_import \{tool: "plan", text: <the approved plan's markdown>\}/.test(ctx(hpj[0])) && Object.keys(hpj[0]).join() === "hookSpecificOutput" &&
      /spec_import \{tool: "plan", path: "docs\/plan\.md"\}/.test(ctx(hpj[1])) && /o utilizador aprovou este plano/.test(ctx(hpj[2])) &&
      hp.slice(3, 7).every((h) => h.stdout === "") && /spec_import/.test(ctx(hpj[7])) &&
      planCfg.matcher === "ExitPlanMode" && planCfg.hooks[0].command === "node" && JSON.stringify(planCfg.hooks[0].args) === JSON.stringify(["${CLAUDE_PLUGIN_ROOT}/hooks/plan-hook.js"]) && planCfg.hooks[0].timeout === 10 &&
      !cRead(path.join(root, "hooks", "plan-hook.js")).includes(String.fromCharCode(0xfeff)),
      "1.16 C4: hooks/plan-hook.js (PostToolUse, matcher ExitPlanMode, timeout 10) adds one line of context in a dev-spec project — the plan's text, or its path when the file is inside the project, in the project language — and is silent (exit 0) elsewhere, on a malformed payload, another tool or event (got " +
      JSON.stringify(hp.map((h) => [h.status, h.stdout.slice(0, 50)])) + ")");

    // --- 1.16 C review: the status line agrees with spec_next_action; UNC, user defaults, import language, config guidance ---
    // PARITY: the status line's step against next_action's, over the states a feature goes through. The mapping (spec.js statusNext):
    // blocked → fix; tests → fix | approve; sign-off / finished → finished; every other code is next_action's own — and an end state
    // (finish, verify, sign-off, finished) may be next_action's `drift` (the status line never hashes the recorded files).
    const PARITY = { "re-review": ["re-review"], fill: ["fill"], fix: ["fix"], approve: ["approve"], tests: ["fix", "approve"], tasks: ["tasks"],
      implement: ["implement"], blocked: ["fix"], verify: ["verify", "drift"], decide: ["decide"], promote: ["promote"], archive: ["archive"],
      pivot: ["pivot"], finish: ["finish", "drift"], "sign-off": ["finished", "drift"], finished: ["finished", "drift"] };
    const pRoot = path.join(cRoot, "parity");
    const pRun = 'node -e "process.exit(0)"';
    let pSeq = 0;
    const pNew = () => { const p = path.join(pRoot, "p" + ++pSeq); fs.mkdirSync(p, { recursive: true }); return p; };
    const pWrite = (p, rel, txt) => { fs.mkdirSync(path.dirname(path.join(p, rel)), { recursive: true }); fs.writeFileSync(path.join(p, rel), txt); };
    const pTasks = "# Tasks: login\n\n## Story US-1 (P1 — MVP)\n- [ ] 1. [US1] Implement the login handler\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/login.js_\n" +
      "  - _Verify: " + pRun + "_\n- [ ] 2. [US1] Show the error message\n  - _Requirements: US-1.AC-2_\n  - _Verify: " + pRun + "_\n**Checkpoint:** US-1 works.\n";
    // A new project with one filled feature `login` (its tasks implement src/login.js); o.tracks, o.checks (meta.checks).
    const pProj = (o = {}) => withOpts({}, () => {
      const p = pNew();
      S.initProject(p, ["core"], "en", o.checks ? { checks: o.checks } : undefined);
      const r = S.createFeature(p, "login", o.tracks || ["core"], "Users log in", undefined, "en");
      cFill(r.dir, "login");
      pWrite(p, "src/login.js", "module.exports = 1;\n");
      pWrite(r.dir, "tasks.md", pTasks);
      return { p, f: "login", dir: r.dir };
    });
    const pApprove = (x) => S.approvePhase(x.p, x.f, null, "t", { through: "tasks" });
    const pDone = (x, n) => S.completeTask(x.p, x.f, n, { command: pRun, exitCode: 0, summary: "ok" });
    const pFinished = (o) => { const x = pProj(o); pApprove(x); pDone(x, 1); pDone(x, 2); x.fin = S.finishFeature(x.p, x.f, { write: true, ...(o && o.evidence ? { evidence: o.evidence } : {}) }); return x; };
    const parity = [];
    const pCase = (label, x, want) => {
      const na = S.nextAction(x.p, x.f);
      const r = S.statusLine(x.p);
      const step = r.next ? r.next.step : null;
      parity.push({ label, want, sl: step, na: na.step, ok: r.feature === x.f && step === want && (PARITY[step] || []).includes(na.step), line: r.line });
      return r;
    };
    // Planning.
    { const p = pNew(); withOpts({}, () => { S.initProject(p, ["core"], "en"); S.createFeature(p, "Billing", ["core"], "Invoices", undefined, "en"); }); pCase("fresh scaffold", { p, f: "billing" }, "fill"); }
    pCase("filled, nothing approved", pProj(), "approve");
    { const x = pProj(); pApprove(x); fs.appendFileSync(path.join(x.dir, "requirements.md"), "- Sessions last 8 hours\n"); pCase("requirements edited after approval", x, "re-review"); }
    { const x = pProj(); pApprove(x); S.approvePhase(x.p, x.f, "design", "t", { revoke: true, reason: "rework" }); pCase("design approval revoked", x, "approve"); }
    const forcedX = pProj();
    fs.appendFileSync(path.join(forcedX.dir, "requirements.md"), "- [NEEDS CLARIFICATION: how long does a session last?]\n");
    for (const ph of ["classification", "requirements", "design", "tasks"]) S.approvePhase(forcedX.p, forcedX.f, ph, "t", { force: true });
    const forcedR = pCase("forced approvals, a gate still failing", forcedX, "fix");
    { const x = pProj(); pWrite(x.dir, "design.md", cRead(path.join(x.dir, "design.md")).replace("- [x] Simplicity — complies\n", ""));
      S.approvePhase(x.p, x.f, "classification", "t"); S.approvePhase(x.p, x.f, "requirements", "t"); S.approvePhase(x.p, x.f, "design", "t", { force: true }); S.approvePhase(x.p, x.f, "tasks", "t");
      pCase("forced design, only a doctor warning left", x, "implement"); }
    { const p = pNew(); withOpts({}, () => { S.initProject(p, ["core"], "en"); S.createFeature(p, "Port", ["core"], "Port the API", undefined, "en", "feature", { flow: "design-first" }); });
      const d = path.join(p, ".specs", "port"); const des = cRead(path.join(d, "design.md")); cFill(d, "port"); pWrite(d, "design.md", des);
      S.approvePhase(p, "port", "classification", "t"); pCase("design-first, classification approved", { p, f: "port" }, "fill"); }
    // Phase 4 (+tdd): the planned T-IDs in the test file their plan row names → approve tests; not written yet → write, then approve.
    const tddX = pProj({ tracks: ["tdd"] });
    pWrite(tddX.dir, "test-plan.md", "# Test Plan: login\n\n## Traceability Matrix\n\n| Test ID | Covers | Level | Kind | File | Description |\n|---|---|---|---|---|---|\n" +
      "| T-01 | US-1.AC-1 | unit | example | test/login.test.js | opens a session |\n| T-02 | US-1.AC-2 | unit | example | test/login.test.js | shows the error |\n");
    S.approvePhase(tddX.p, tddX.f, null, "t", { through: "test-plan" });
    const tddR1 = pCase("+tdd, tests not written yet", tddX, "tests");
    pWrite(tddX.p, "test/login.test.js", "test('T-01 opens a session', () => {});\ntest('T-02 shows the error', () => {});\n");
    const tddR2 = pCase("+tdd, the planned tests in their file", tddX, "approve");
    // Execution.
    { const x = pProj(); pApprove(x); pDone(x, 1); pCase("executing", x, "implement"); }
    { const x = pProj(); pApprove(x); pDone(x, 1); S.completeTask(x.p, x.f, 2, { summary: "by hand" }); pCase("every task ticked, one unverified", x, "verify"); }
    { const x = pProj(); pApprove(x); pDone(x, 1); pDone(x, 2); pCase("every task verified", x, "finish"); }
    // A bugfix whose design (bug.md) was approved by force with Root Cause empty, tasks 1-2 ticked: the bugfix gate refuses task 3.
    const bugX = (() => {
      const p = pNew();
      let dir;
      withOpts({}, () => { S.initProject(p, ["core"], "en"); dir = S.createFeature(p, "Crash on save", undefined, "the app crashes on save", undefined, "en", "bugfix").dir; });
      cFill(dir, "crash-on-save");
      fs.rmSync(path.join(dir, "classification.md")); // a bugfix has no classification gate
      pWrite(dir, "bug.md", "# Bug: Crash on save\n\n## Summary\nThe app crashes on save.\n\n## Reproduction\n1. Open a new document and press Ctrl+S.\n2. The app exits with a TypeError.\n\n" +
        "## Expected vs Actual\n- **Expected:** the document is saved.\n- **Actual:** TypeError: doc is undefined.\n\n## Root Cause\n\n## Fix\nGuard the unsaved document.\n");
      pWrite(dir, "test-plan.md", "# Test Plan: crash-on-save\n\n## Traceability Matrix\n\n| Test ID | Covers | Level | Kind | File | Description |\n|---|---|---|---|---|---|\n" +
        "| T-01 | US-1.AC-1 | unit | example | test/save.test.js | saves a new document |\n| T-02 | US-1.AC-2 | unit | example | test/save.test.js | shows the error |\n");
      pWrite(dir, "tasks.md", "# Tasks: Crash on save\n\n## Global Constraints\n- Node >= 18\n\n## Phase: Fix\n" +
        "- [ ] 1. [shared] Reproduce the bug reliably and write the steps in bug.md → Reproduction\n  - _Requirements: US-1.AC-1_\n" +
        "- [ ] 2. [shared] Find the root cause with evidence; fill bug.md → Root Cause (no fix yet)\n  - _Requirements: US-1.AC-1_\n" +
        "- [ ] 3. [US1] Write regression test T-01 and watch it fail\n  - _Requirements: US-1.AC-1_\n  - _Verify: node -e \"process.exit(1)\"_\n  - _Expect: fail_\n" +
        "- [ ] 4. [US1] Fix the root cause\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n  - _Makes green: T-01_\n  - _Verify: " + pRun + "_\n**Checkpoint:** fixed.\n");
      S.approvePhase(p, "crash-on-save", "requirements", "t");
      S.approvePhase(p, "crash-on-save", "design", "t", { force: true });
      S.approvePhase(p, "crash-on-save", "test-plan", "t");
      S.approvePhase(p, "crash-on-save", "tasks", "t");
      S.completeTask(p, "crash-on-save", 1, { summary: "reproduced" });
      S.completeTask(p, "crash-on-save", 2, { summary: "looked into it" });
      return { p, f: "crash-on-save", dir };
    })();
    const bugR = pCase("bugfix, Root Cause empty (design forced), tasks 1-2 ticked", bugX, "fix");
    const bug3 = S.completeTask(bugX.p, bugX.f, 3, { command: 'node -e "process.exit(1)"', exitCode: 1, summary: "red" });
    // Finish, sign-off, reopened work, drift, project checks.
    const finX = pFinished();
    const finR1 = pCase("finished, not signed off", finX, "sign-off");
    S.approvePhase(finX.p, finX.f, "execution", "t");
    const finR2 = pCase("finished and signed off", finX, "finished");
    const undoX = pFinished();
    S.approvePhase(undoX.p, undoX.f, "execution", "t");
    S.completeTask(undoX.p, undoX.f, 2, undefined, { undo: true, reason: "rework" });
    pCase("finished, task 2 undone", undoX, "implement");
    pDone(undoX, 2);
    const undoR = pCase("finished, task 2 undone and re-ticked", undoX, "finish");
    const revX = pFinished();
    S.approvePhase(revX.p, revX.f, "execution", "t");
    S.approvePhase(revX.p, revX.f, "execution", "t", { revoke: true });
    const revR = pCase("execution sign-off revoked", revX, "sign-off");
    { // (1.22 review: the same content approved again changes nothing — still finished; an edit re-approved makes it stale)
      const x = pFinished(); S.approvePhase(x.p, x.f, "execution", "t"); S.approvePhase(x.p, x.f, "design", "t"); pCase("design re-approved unchanged after the finish", x, "finished");
      pWrite(x.dir, "design.md", fs.readFileSync(path.join(x.dir, "design.md"), "utf8") + "\nOne more note on the session cookie.\n");
      S.approvePhase(x.p, x.f, "design", "t"); pCase("design edited and re-approved after the finish", x, "finish");
    }
    const driftX = pFinished();
    S.approvePhase(driftX.p, driftX.f, "execution", "t");
    pWrite(driftX.p, "src/login.js", "module.exports = 2;\n");
    const driftR = pCase("finished, then src/login.js drifted", driftX, "finished");
    const suiteX = pFinished({ checks: { unit: pRun }, evidence: [{ name: "unit", command: pRun, exitCode: 0 }] });
    S.approvePhase(suiteX.p, suiteX.f, "execution", "t");
    await new Promise((res) => setTimeout(res, 30)); // the re-run below is later than the check run
    pDone(suiteX, 2);
    const suiteR = pCase("finished, a task re-run after the project checks", suiteX, "verify");
    // Spikes: next_action's own steps.
    const spikeP = (o = {}) => {
      const p = pNew();
      let dir;
      withOpts({}, () => { S.initProject(p, ["core"], "en"); dir = S.createFeature(p, "Try Redis", undefined, undefined, undefined, "en", "spike", { question: "Is Redis fast enough for sessions?", timebox: "3d" }).dir; });
      if (o.tasks) pWrite(dir, "tasks.md", o.tasks);
      else if (o.done) pWrite(dir, "tasks.md", cRead(path.join(dir, "tasks.md")).replace(/- \[ \]/g, "- [x]"));
      if (o.decision) {
        pWrite(dir, "spike.md", cRead(path.join(dir, "spike.md")).replace("> **TODO** — go / no-go / pivot, and why: the evidence that decided it.", "Redis answered in 0.2 ms at p99 under 5k rps, within the budget.")
          .replace("_Outcome: [go | no-go | pivot]_", o.outcome ? "_Outcome: " + o.outcome + "_" : ""));
      }
      return { p, f: "try-redis", dir };
    };
    pCase("spike, a _Depends:_ cycle", spikeP({ tasks: "# Tasks\n\n- [ ] 1. Measure reads\n  - _Depends: 2_\n- [ ] 2. Measure writes\n  - _Depends: 1_\n" }), "blocked");
    pCase("spike, investigation done, no decision", spikeP({ done: true }), "decide");
    const spikeNo = pCase("spike, a decision without its _Outcome:_", spikeP({ done: true, decision: true }), "decide");
    pCase("spike, go", spikeP({ done: true, decision: true, outcome: "go" }), "promote");
    pCase("spike, no-go", spikeP({ done: true, decision: true, outcome: "no-go" }), "archive");
    pCase("spike, pivot", spikeP({ done: true, decision: true, outcome: "pivot" }), "pivot");
    ok(parity.length === 28 && parity.every((c) => c.ok),
      "1.16 C review (parity): the status line's step maps to spec_next_action's in 28 states — scaffold, pending / forced / revoked approvals, design-first, Phase 4, executing, unverified, bugfix gate, finish, sign-off, undo, drift, project checks, spikes (got " +
      JSON.stringify(parity.filter((c) => !c.ok).map((c) => [c.label, "want " + c.want, "sl " + c.sl, "na " + c.na])) + ")");
    ok(bugR.next.phase === "design" && bugR.next.file === "bug.md" && bugR.line.endsWith("next: write the root cause in bug.md") && !/task 3/.test(bugR.line) &&
      bug3.ok === false && bug3.gated === "root-cause" && forcedR.next.phase === "requirements" && forcedR.next.failing.includes("clarifications"),
      "1.16 C review 1: a bugfix with bug.md → Root Cause empty says 'write the root cause in bug.md', never the task the bugfix gate refuses; a forced approval whose gate still fails (a doctor failure) says fix, naming the phase (got " +
      JSON.stringify([bugR.line, bug3.gated, forcedR.next]) + ")");
    const allLines = parity.map((c) => c.line);
    const finishedTexts = ["en", "pt", "pt-BR", "es"].map((l) => require("./lib/i18n.js").msg(l).claudeCode.statusLine.steps.finished({}));
    ok(finR1.line.endsWith("next: approve execution (sign-off)") && finR2.line.endsWith("next: finished") && undoR.next.again === true && undoR.line.endsWith("next: /spec-finish again") &&
      revR.next.step === "sign-off" && driftR.line.endsWith("next: finished") && suiteR.next.suite.join() === "unit" && suiteR.line.endsWith("next: run the project checks (unit)") &&
      !allLines.some((l) => l.includes("✓")) && !finishedTexts.some((t) => t.includes("✓")),
      "1.16 C review 2: finished → sign off the execution, then 'finished' (never ✓ — drift is not checked); an undo + re-tick or a later re-approval → /spec-finish again; a revoked sign-off → sign off; a project check without a passing run since the last task → run it (got " +
      JSON.stringify([finR1.line, undoR.line, revR.line, driftR.line, suiteR.line]) + ")");
    ok(spikeNo.next.outcome === true && /add the _Outcome:_ line/.test(spikeNo.line) && parity.filter((c) => /^spike, (go|no-go|pivot)$/.test(c.label)).map((c) => c.sl).join() === "promote,archive,pivot",
      "1.16 C review 3: a spike's decision without _Outcome:_ → decide (the outcome line); go / no-go / pivot → promote / archive / pivot, as next_action (got " +
      JSON.stringify(parity.filter((c) => /^spike/.test(c.label)).map((c) => c.line)) + ")");
    ok(tddR1.next.step === "tests" && /write the tests, then approve them/.test(tddR1.line) && tddR2.next.step === "approve" && tddR2.next.phase === "tests",
      "1.16 C review 4: Phase 4 — the planned T-IDs found in the test file their plan row names → approve tests (as next_action); otherwise 'write the tests, then approve them' (got " +
      JSON.stringify([tddR1.line, tddR2.line]) + ")");
    // UNC: never stat'ed — the pure rule, then the plan hook on a TEST-NET address in a child process with a timeout (no network).
    const netForms = ["\\\\192.0.2.1\\share\\proj", "//192.0.2.1/share", "\\\\?\\UNC\\192.0.2.1\\share", "\\\\.\\UNC\\192.0.2.1\\share", "\\\\.\\pipe\\x"];
    const localForms = ["\\\\?\\C:\\work", "\\\\.\\C:\\work", "\\\\wsl$\\Ubuntu\\home", "\\\\wsl.localhost\\Ubuntu\\home", "C:\\work", "/home/me/x", "relative\\dir"];
    const tUnc = Date.now();
    const uncHook = spawnSync(process.execPath, [path.join(root, "hooks", "plan-hook.js")], { input: JSON.stringify({ ...exit, cwd: "\\\\192.0.2.1\\share\\proj" }),
      encoding: "utf8", env: childEnv(), timeout: 20000 });
    const uncMs = Date.now() - tUnc;
    ok(netForms.every((p) => S.isNetworkPath(p)) && !localForms.some((p) => S.isNetworkPath(p)) && !uncHook.error && uncHook.status === 0 && uncHook.stdout === "" && uncMs < 10000,
      "1.16 C review 5: a network path (UNC, //host, \\\\?\\UNC, device paths — spec.isNetworkPath) is skipped before any fs call by the plan hook (TEST-NET cwd: silent, " + uncMs + " ms; the status line: cli/test-cli.js); \\\\?\\C:, WSL hosts stay local (got " +
      JSON.stringify([netForms.map((p) => S.isNetworkPath(p)), localForms.map((p) => S.isNetworkPath(p)), uncHook.status, uncHook.error && uncHook.error.code]) + ")");
    // spec_import in a brand-new project takes DEV_SPEC_DEFAULT_LANG for its own text too (spec_create's resolution).
    const execPlan = "# ExecPlan: Cache layer\n\n## Purpose / Big Picture\nAdd a read-through cache in front of the orders API.\n\n## Progress\n- [x] Draft the design\n- [ ] Implement the cache in src/cache.js\n\n" +
      "## Validation and Acceptance\n- Run `npm test` and expect all tests to pass.\n\n## Decision Log\n- Decision: use an LRU. Rationale: bounded memory.\n";
    const impL = path.join(cRoot, "import-lang");
    const impR = withOpts({ DEV_SPEC_DEFAULT_LANG: "pt" }, () => S.importSpec(impL, "execplan", undefined, { text: execPlan }));
    const impDesign = impR.ok ? cRead(path.join(impR.dir, "design.md")) : "";
    ok(impR.ok && impR.lang === "pt" && impR.userDefaults && impR.userDefaults.lang === "pt" && cMeta(impL).lang === "pt" && /^## Decisões$/m.test(impDesign) &&
      impR.warnings.length > 0 && impR.warnings.every((w) => !/^(?:not converted|the imported tasks)/i.test(w)) && impR.warnings.some((w) => /não/.test(w)),
      "1.16 C review 6: spec_import in a new project follows DEV_SPEC_DEFAULT_LANG for its own output — design.md's Decisions heading and the warnings in PT — and reports userDefaults (got " +
      JSON.stringify([impR.lang, impR.userDefaults, impR.warnings && impR.warnings.map((w) => w.slice(0, 40))]) + ")");
    // DEV_SPEC_STOP_CHECK=off also holds while roadmap.json doesn't parse (engine and hook).
    const stopB = path.join(cRoot, "stop-broken");
    withOpts({}, () => { S.initProject(stopB, ["core"], "en"); S.createFeature(stopB, "Billing", ["core"], "Invoices", undefined, "en"); });
    pWrite(stopB, ".specs/billing/tasks.md", "# Tasks\n\n## Phase 1\n\n- [ ] 1. Charge\n  - _Requirements: US-1.AC-1_\n  - _Verify: " + pRun + "_\n");
    S.completeTask(stopB, "billing", 1, { summary: "did it by hand" });
    pWrite(stopB, ".specs/roadmap.json", '{ "meta": { "lang": "en", }');
    const stopMsg = { hook_event_name: "Stop", cwd: stopB, last_assistant_message: "All tasks are done and verified." };
    const stopH = [hook("stop-hook.js", stopMsg, { DEV_SPEC_STOP_CHECK: "off" }), hook("stop-hook.js", stopMsg)];
    ok(withOpts({ DEV_SPEC_STOP_CHECK: "off" }, () => S.stopCheckEnabled(stopB)) === false && withOpts({}, () => S.stopCheckEnabled(stopB)) === true &&
      stopH[0].status === 0 && stopH[0].stdout === "" && (jsonOut(stopH[1]) || {}).decision === "block",
      "1.16 C review 7: a roadmap.json that doesn't parse — DEV_SPEC_STOP_CHECK=off still turns the stop gate off (engine and hook); unset, the gate stays on (got " +
      JSON.stringify([stopH.map((h) => h.stdout.slice(0, 30))]) + ")");
    // statusline --print-config guidance: a project's .claude/settings.local.json (the path is this machine's), never the committed file.
    const heads = ["en", "pt", "pt-BR", "es"].map((l) => require("./lib/i18n.js").msg(l).claudeCode.statusLine.config.head);
    ok(heads.every((h) => h.includes("~/.claude/settings.json") && h.includes(".claude/settings.local.json") && /nunca|never/.test(h)),
      "1.16 C review 8: the --print-config guidance names ~/.claude/settings.json or a project's .claude/settings.local.json — never the committed .claude/settings.json (EN / PT / pt-BR / ES) (got " + JSON.stringify(heads) + ")");
    // DEV_SPEC_GUARD_DEFAULT in a project made before roadmap.json (a dev-spec .specs/ without it): the engine and the hook agree.
    const gLegacy = path.join(cRoot, "guard-legacy");
    withOpts({}, () => S.createFeature(gLegacy, "Old", ["core"], "x", undefined, "en"));
    fs.rmSync(path.join(gLegacy, ".specs", "roadmap.json"), { force: true });
    const gOther = path.join(cRoot, "guard-other"); // another tool's .specs/ (no steering/, no feature state)
    pWrite(gOther, ".specs/notes.md", "# notes\n");
    const gBroken = path.join(cRoot, "guard-broken");
    withOpts({}, () => S.initProject(gBroken, ["core"], "en"));
    pWrite(gBroken, ".specs/roadmap.json", "{ broken");
    const gPay = (dir) => ({ hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: path.join(dir, "src", "a.js") }, cwd: dir });
    const gOn = { DEV_SPEC_GUARD_DEFAULT: "on" };
    const gH = [hook("guard-hook.js", gPay(gLegacy), gOn), hook("guard-hook.js", gPay(gLegacy)), hook("guard-hook.js", gPay(gOther), gOn), hook("guard-hook.js", gPay(gBroken), gOn)];
    const gE = withOpts(gOn, () => [S.guardLevel(gLegacy), S.guardLevel(gOther), S.guardLevel(gBroken), S.guardLevel(none)]);
    ok(((jsonOut(gH[0]) || {}).hookSpecificOutput || {}).permissionDecision === "ask" && gH.slice(1).every((h) => h.status === 0 && h.stdout === "") &&
      JSON.stringify(gE) === "[true,false,false,false]" && withOpts({}, () => S.guardLevel(gLegacy)) === false,
      "1.16 C review 10: DEV_SPEC_GUARD_DEFAULT=on reaches a dev-spec project without roadmap.json (the hook asks, guardLevel true); never a folder without .specs/, another tool's .specs/ or a roadmap.json that doesn't parse (got " +
      JSON.stringify([gH.map((h) => h.stdout.slice(0, 40)), gE]) + ")");
    try { fs.rmSync(none, { recursive: true, force: true }); } catch { /* best-effort */ }

    // --- 1.16 verify NEW-3: the guard never stats a network path the AGENT names — a Write target, an absolute _Implements:_ — (an SMB
    // connection to that host before the permission prompt: a hang on an unreachable host, the user's NTLM credentials on Windows);
    // nor does the save hook. TEST-NET-1 (192.0.2.1) is never routed; each hook runs in a child process with a timeout. Inside /
    // outside is decided on the text (spec.networkPathInside) — a project living on that share keeps its guard.
    const vUnc = "\\\\192.0.2.1\\share\\proj";
    const vG = path.join(cRoot, "verify-guard-unc");
    withOpts({}, () => { S.initProject(vG, ["core"], "en"); S.createFeature(vG, "Billing", ["core"], "x", undefined, "en"); });
    const vRmj = JSON.parse(cRead(path.join(vG, ".specs", "roadmap.json")));
    pWrite(vG, ".specs/roadmap.json", JSON.stringify({ ...vRmj, meta: { ...vRmj.meta, guard: "scope" } }, null, 2));
    pWrite(vG, ".specs/billing/tasks.md", "# Tasks\n\n## Phase 1\n\n- [ ] 1. Charge\n  - _Requirements: US-1.AC-1_\n  - _Implements: " + vUnc + "\\lib\\pay.js, src/pay.js_\n");
    const vSt = JSON.parse(cRead(path.join(vG, ".specs", "billing", ".state.json")));
    pWrite(vG, ".specs/billing/.state.json", JSON.stringify({ ...vSt, approvals: { tasks: { at: "2026-01-01T00:00:00Z", by: "t" } } }, null, 2));
    const vRun = (script, input) => {
      const t = Date.now();
      const r = spawnSync(process.execPath, [path.join(root, "hooks", script)], { input: JSON.stringify(input), encoding: "utf8", env: childEnv({ CLAUDE_PROJECT_DIR: vG }), timeout: 20000 });
      return { status: r.status, stdout: r.stdout || "", err: r.error && r.error.code, ms: Date.now() - t };
    };
    const vPre = (file) => ({ hook_event_name: "PreToolUse", tool_name: "Write", cwd: vG, tool_input: { file_path: file, content: "x" } });
    const vH = [vRun("guard-hook.js", vPre(vUnc + "\\src\\a.js")), vRun("guard-hook.js", vPre(path.join(vG, "src", "other.js"))), vRun("guard-hook.js", vPre(path.join(vG, "src", "pay.js"))),
      vRun("spec-hook.js", { hook_event_name: "PostToolUse", tool_name: "Write", cwd: vG, tool_input: { file_path: vUnc + "\\.specs\\billing\\tasks.md" } })];
    let vAsk = null;
    try { vAsk = JSON.parse(vH[1].stdout).hookSpecificOutput.permissionDecision; } catch { /* no decision */ }
    const vPairs = [[vUnc, vUnc + "\\src\\a.js"], [vUnc, "//192.0.2.1/share/proj/src/a.js"], [vUnc, "\\\\?\\UNC\\192.0.2.1\\share\\proj\\a.js"], ["\\\\?\\UNC\\192.0.2.1\\share\\proj", vUnc + "\\a.js"],
      [vUnc, "\\\\192.0.2.1\\SHARE\\Proj\\a.js"], [vUnc, vUnc], [vUnc, "\\\\192.0.2.1\\share\\projX\\a.js"], [vUnc, vUnc + "\\..\\other\\a.js"], [vUnc, "\\\\192.0.2.2\\share\\proj\\a.js"],
      ["C:\\work", vUnc + "\\a.js"], [vUnc, "C:\\work\\a.js"], ["\\\\?\\C:\\work", "\\\\?\\C:\\work\\a.js"]];
    const vIn = vPairs.map(([a, b]) => S.networkPathInside(a, b));
    ok(JSON.stringify(vIn) === JSON.stringify(["src\\a.js", "src\\a.js", "a.js", "a.js", "a.js", "", null, null, null, null, null, null]) &&
      // On Linux / macOS `\\192.0.2.1\share\…` is no network path — a relative file name inside the project (no SMB): the scope
      // guard may ask about it there, as for any unplanned file.
      vH.every((h) => h.status === 0 && !h.err) && (process.platform !== "win32" || vH[0].stdout === "") && vAsk === "ask" && vH[2].stdout === "" && vH[3].stdout === "" &&
      (process.platform !== "win32" || vH.every((h) => h.ms < 10000)),
      "1.16 verify NEW-3: a network path the agent names is decided on its text — the guard hook allows a Write to \\\\192.0.2.1\\share\\… outside the project, an open task's absolute \\\\host _Implements:_ is never stat'ed at the scope level, the save hook skips a network .specs/ file outside the session's folders — each silent / exit 0, fast on Windows (" +
      vH.map((h) => h.ms + " ms").join(", ") + "); networkPathInside: same \\\\host\\share prefix (\\\\?\\UNC, //, case folded) only (got " + JSON.stringify([vIn, vH.map((h) => [h.status, h.err, h.stdout.slice(0, 60)])]) + ")");
  }
};
