"use strict";
// Conventions and source guards — enums and numbers on every surface, temp files, locks, the module rule.
// Localized fields, network paths, the cross-process feature lock, test-docker.js, regex literals, the engine's load time.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

exports.run = async ({ ok, rpc, payload, S, root, tmp, libSources, require, __dirname }) => {

  { // --- 1.13 batch 4: localized roadmap phase / doctor ears detail / add-track entries, guard code types, numbers & enums refused on every surface ---
    const call = (name, args) => rpc("tools/call", { name, arguments: args });
    // ROADMAP.md / .html: the Phase column in the roadmap's language (the JSON `phase` stays English-stable).
    const r13 = path.join(tmp, "proj-wp13-roadmap");
    S.initProject(r13, ["core"], "pt");
    S.createFeature(r13, "Other", ["core"]);
    const md13 = S.renderRoadmapMd(r13, "pt"), es13 = S.renderRoadmapMd(r13, "es"), html13 = S.renderRoadmapHtml(r13, "pt"), en13 = S.renderRoadmapMd(r13, "en");
    const empty13 = path.join(tmp, "proj-wp13-empty");
    fs.mkdirSync(empty13, { recursive: true });
    ok(/\| core \| requisitos \| /.test(md13) && !/\| requirements \|/.test(md13) && /\| core \| requisitos \| /.test(es13) && /<td>requisitos<\/td>/.test(html13) && !/<td>requirements<\/td>/.test(html13) &&
      /\| core \| requirements \| /.test(en13) && S.roadmapReport(r13, {}).features[0].phase === "requirements" && /<p class="sub">\(nenhuma\)<\/p>/.test(S.renderRoadmapHtml(empty13, "pt")),
      "ROADMAP.md / ROADMAP.html render the phase in the roadmap language (PT/ES 'requisitos', EN unchanged); JSON phase stays 'requirements'; the empty HTML table is '(nenhuma)', not '(none)'");

    // spec_doctor's ears detail and spec_add_track's `added` entries follow the feature language (EN byte-identical).
    const p13 = path.join(tmp, "proj-wp13-pt"), e13 = path.join(tmp, "proj-wp13-es"), n13en = path.join(tmp, "proj-wp13-en");
    S.initProject(p13, ["core"], "pt");
    S.initProject(e13, ["core"], "es");
    S.createFeature(p13, "Login", ["core"]);
    S.createFeature(e13, "Pago", ["core"]);
    S.createFeature(n13en, "Auth", ["core"]);
    const earsOf = (d, f) => (S.specDoctor(d, f).checks.find((c) => c.id === "ears") || {}).detail || "";
    const at13 = S.addTrack(p13, "login", ["saas"]);
    const mcpAt13 = payload(await call("spec_add_track", { name: "pago", track: "saas", projectDir: e13 }));
    const enAt13 = S.addTrack(n13en, "auth", ["saas"]);
    ok(/^critérios=\d+, erros=\d+, avisos=\d+$/.test(earsOf(p13, "login")) && /^criterios=\d+, errores=\d+, avisos=\d+$/.test(earsOf(e13, "pago")) && /^criteria=\d+, errors=\d+, warnings=\d+$/.test(earsOf(n13en, "auth")),
      "spec_doctor: the ears check detail is localized (critérios/erros/avisos · criterios/errores/avisos; EN criteria/errors/warnings unchanged)");
    ok(at13.added.includes("design.md (+secções)") && at13.added.includes("classification.md (Tracks Ativos)") && !at13.added.some((x) => /\+sections|\+tasks|Active Tracks/.test(x)) &&
      mcpAt13.added.includes("design.md (+secciones)") && mcpAt13.added.includes("classification.md (Tracks Activos)") &&
      enAt13.added.includes("design.md (+sections)") && enAt13.added.includes("classification.md (Active Tracks)"),
      "spec_add_track: the 'added' entries for files extended in place are in the feature language (PT/ES; EN unchanged), like the 'inactive' list (got " + JSON.stringify([at13.added, mcpAt13.added]) + ")");

    // Guard mode: every source language counts as code, not only the scanner's CODE_EXT list.
    const g13 = path.join(tmp, "proj-wp13-guard");
    S.initProject(g13, ["core"], undefined, { guard: true });
    S.createFeature(g13, "Billing", ["core"]);
    const code13 = ["src/a.ts", "src/a.mts", "src/a.cts", "src/a.cc", "src/a.cxx", "src/a.hpp", "src/a.hh", "src/a.scala", "src/a.dart", "src/a.fs", "src/a.groovy",
      "lib/a.ex", "lib/a.exs", "src/a.lua", "src/a.m", "scripts/a.sh", "scripts/a.ps1", "db/a.sql",
      // Windows batch and the other shells, Kotlin script, CoffeeScript, CUDA, Fortran, Pascal, assembly, Elm, Tcl, Nix,
      // Crystal, HDL, shaders and code-bearing templates — they used to pass silently as "not code"
      "scripts/a.bat", "scripts/A.CMD", "scripts/a.ksh", "scripts/a.fish", "build.gradle.kts", "src/a.coffee", "src/k.cu", "src/a.f90", "src/a.pas",
      "src/a.asm", "src/a.s", "src/Main.elm", "src/a.tcl", "flake.nix", "src/a.cr", "hw/a.v", "hw/a.sv", "gfx/a.glsl", "gfx/a.wgsl",
      "web/a.astro", "Pages/a.razor", "Views/a.cshtml", "web/a.jsp", "app/views/a.html.erb"];
    const text13 = ["README.md", "config/app.json", "web/site.css", "web/index.html", "docs/notes.txt", ".env", "config/app.yaml", "data/a.csv", "docs/a.rst", "a.toml"];
    const notAsked13 = code13.filter((f) => S.guardCheck(g13, path.join(g13, f)).decision !== "ask");
    const notText13 = text13.filter((f) => S.guardCheck(g13, path.join(g13, f)).why !== "not-code");
    ok(!notAsked13.length && !notText13.length,
      "guard: .mts/.cts, C++ .cc/.cxx/.hpp/.hh, Scala, Dart, F#, Groovy, Elixir, Lua, Objective-C, shell (Windows .bat/.cmd too), PowerShell, SQL, Kotlin script, CUDA, Fortran, HDL, shaders and code-bearing templates ask; docs/config/data/markup/styles stay silent (not asked: " +
      notAsked13.join(", ") + "; not 'not-code': " + notText13.join(", ") + ")");

    // Task numbers, kind, backlog action and scan cap: refused by the engine too, so the CLI and MCP agree.
    const n13 = path.join(tmp, "proj-wp13-numbers");
    S.createFeature(n13, "Billing", ["core"]);
    const tasks13 = path.join(n13, ".specs", "billing", "tasks.md");
    const tasksBefore13 = fs.readFileSync(tasks13, "utf8");
    const badNums13 = [S.taskBrief(n13, "billing", "1.9"), S.taskBrief(n13, "billing", "2abc"), S.taskBrief(n13, "billing", 1e21), S.taskBrief(n13, "billing", 1.9), S.taskBrief(n13, "billing", "-1"),
      S.completeTask(n13, "billing", "1.9"), S.completeTask(n13, "billing", "2abc"), S.completeTask(n13, "billing", 1e21)];
    ok(badNums13.every((r) => r.ok === false && /number must be an integer/.test(r.error)) && fs.readFileSync(tasks13, "utf8") === tasksBefore13 &&
      !fs.existsSync(path.join(n13, ".specs", "billing", ".execution")) && S.taskBrief(n13, "billing", " 01 ").task.number === 1 && S.taskBrief(n13, "billing", 2).task.number === 2,
      "task_brief / complete_task: '1.9', '2abc', 1e21, 1.9 and '-1' are refused (never read as task 1 or 2) — nothing ticked or written; '01' and 2 still resolve");
    const kind13 = S.createFeature(n13, "Zed", undefined, undefined, undefined, undefined, "bugfx");
    const kindEmpty13 = S.createFeature(n13, "Zed", undefined, undefined, undefined, undefined, "");
    const bl13 = S.backlog(n13, "delete", "X");
    fs.mkdirSync(path.join(n13, "src"), { recursive: true });
    fs.writeFileSync(path.join(n13, "src", "a.js"), "x\n");
    const sc13 = S.scanCodebase(n13, { cap: -3 });
    // (1.14 full review S7: the action list now names rm's alias remove — the spec_backlog enum.)
    ok(kind13.ok === false && /kind must be one of: feature, bugfix, spike \(got "bugfx"\)/.test(kind13.error) && kindEmpty13.ok === false && !fs.existsSync(path.join(n13, ".specs", "zed")) &&
      bl13.ok === false && /action must be one of: add, rm, remove, list \(got "delete"\)/.test(bl13.error) && S.backlog(n13).ok === true && S.backlog(n13, "LIST").ok === true &&
      sc13.filesScanned === 1 && !sc13.truncated,
      "createFeature refuses an unknown kind (nothing scaffolded), backlog an unknown action (= the MCP enums); scanCodebase with cap -3 falls back to the default (never 0 files)");
    const mx13 = await call("spec_next_task", { name: "billing", batch: true, max: 0, projectDir: n13 });
    const mxOk13 = await call("spec_next_task", { name: "billing", batch: true, max: 2, projectDir: n13 });
    ok(mx13.result.isError === true && /max must be an integer ≥ 1 \(got 0\)/.test(payload(mx13).error) && !mxOk13.result.isError,
      "spec_next_task {max: 0} is refused like the CLI's --max 0 (max is an integer ≥ 1)");
  }

  { // --- 1.13 batch 5: no stray .tmp files, network projectDir refused, SessionStart gate, BOM-only re-save, cross-process feature lock ---
    const call = (name, args) => rpc("tools/call", { name, arguments: args });
    const errText = (res) => { try { return JSON.parse(res.result.content[0].text).error || ""; } catch { return res.result.content[0].text; } };
    const hookJs = path.join(__dirname, "..", "hooks", "spec-hook.js");
    const specJs = path.join(__dirname, "lib", "spec.js");
    const tmpsIn = (d) => { try { return fs.readdirSync(d).filter((x) => /\.tmp$/i.test(x)); } catch { return ["<unreadable " + d + ">"]; } };
    const BOM = String.fromCharCode(0xfeff);

    // 1. writeFileAtomic never leaves its temp file behind: with ROADMAP.md a folder the rename AND the plain-write fallback
    // fail — the best-effort refreshes (mutators, the hook) swallow that, and each call used to leave a full-size
    // `.specs/ROADMAP.md.<pid>.<ts>.tmp`. A read-only generated ROADMAP.md does the same on Windows.
    const t14 = path.join(tmp, "proj-wp14-tmp");
    S.initProject(t14, ["core"], "en");
    const t14f = S.createFeature(t14, "Alpha", ["core"]);
    const specs14 = path.join(t14, ".specs");
    fs.rmSync(path.join(specs14, "ROADMAP.md"), { force: true });
    fs.mkdirSync(path.join(specs14, "ROADMAP.md"));
    const bl14a = S.backlog(t14, "add", "Later one");
    const bl14b = payload(await call("spec_backlog", { action: "add", name: "Later two", projectDir: t14 }));
    const post14 = (file, dir) => spawnSync(process.execPath, [hookJs], { input: JSON.stringify({ hook_event_name: "PostToolUse", tool_name: "Edit", tool_input: { file_path: file } }), encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: dir } });
    const hk14 = post14(path.join(t14f.dir, "tasks.md"), t14);
    let thrown14 = null;
    try { S.writeRoadmapMd(t14); } catch (e) { thrown14 = e; }
    const r14 = path.join(tmp, "proj-wp14-ro");
    S.initProject(r14, ["core"], "en");
    const r14f = S.createFeature(r14, "Beta", ["core"]);
    const ro14 = path.join(r14, ".specs", "ROADMAP.md");
    fs.chmodSync(ro14, 0o444);
    const blRo14 = S.backlog(r14, "add", "X");
    const hkRo14 = post14(path.join(r14f.dir, "tasks.md"), r14);
    fs.chmodSync(ro14, 0o644);
    ok(bl14a.ok && bl14b.ok && hk14.status === 0 && blRo14.ok && hkRo14.status === 0 && tmpsIn(specs14).length === 0 && tmpsIn(path.join(r14, ".specs")).length === 0 &&
      (thrown14 === null || !!thrown14.code),
      "writeFileAtomic: when ROADMAP.md can't be replaced (a folder; read-only on Windows) the backlog mutator, spec_backlog and the hook still succeed and no *.tmp is left in .specs/ (left: " +
      tmpsIn(specs14).concat(tmpsIn(path.join(r14, ".specs"))).join(", ") + ")");

    // 2. A network projectDir (UNC and its extended forms) is refused before any fs call — the server made SMB connections
    // to whatever host a call named and hung on an unreachable one. Argument errors don't read it either. Local extended
    // drive paths and WSL's own hosts are not network paths.
    const net14 = ["\\\\192.0.2.1\\share\\proj", "//192.0.2.1/share/proj", "\\\\?\\UNC\\192.0.2.1\\share\\proj", "\\\\.\\UNC\\192.0.2.1\\share", "\\\\.\\pipe\\dev-spec", " \\\\192.0.2.1\\share"];
    const t0net14 = Date.now();
    const netRes14 = [];
    for (const pd of net14) netRes14.push(await call("spec_list", { projectDir: pd }));
    const netArg14 = await call("spec_create", { name: 5, projectDir: net14[0] });
    const netMs14 = Date.now() - t0net14;
    const wsl14 = [await call("spec_classify", { description: "export invoices", projectDir: "\\\\wsl.localhost\\Ubuntu\\home\\me\\proj" }),
      await call("spec_classify", { description: "export invoices", projectDir: "\\\\wsl$\\Ubuntu\\home\\me\\proj" })];
    const ext14 = process.platform === "win32" ? payload(await call("spec_list", { projectDir: "\\\\?\\" + t14 })) : { exists: true, features: [{ name: "alpha" }] };
    ok(netRes14.every((r) => r.result.isError && /projectDir must be a local folder — a network or device path/.test(errText(r))) &&
      netArg14.result.isError && /name must be a string/.test(errText(netArg14)) && netMs14 < 5000 &&
      wsl14.every((r) => !r.result.isError) && ext14.exists === true && ext14.features.some((f) => f.name === "alpha"),
      "MCP refuses a network projectDir (\\\\host\\share, //host/share, \\\\?\\UNC\\…, \\\\.\\UNC\\…, device paths) before any fs call, argument errors don't touch it (" + netMs14 +
      " ms); \\\\wsl$ / \\\\wsl.localhost and \\\\?\\C:\\… stay accepted (got " +
      JSON.stringify([netRes14.map((r) => errText(r).slice(0, 60)), errText(netArg14), wsl14.map((r) => !!r.result.isError), ext14.exists, (ext14.features || []).length]) + ")");

    // 3. SessionStart stays silent in a project whose .specs/ belongs to another tool (the PostToolUse gate), and speaks once
    // dev-spec owns it.
    const f14 = path.join(tmp, "proj-wp14-foreign");
    ["auth", "billing"].forEach((n) => {
      const d = path.join(f14, ".specs", n);
      fs.mkdirSync(d, { recursive: true });
      fs.writeFileSync(path.join(d, "spec.md"), "# Spec\n");
      fs.writeFileSync(path.join(d, "tasks.md"), "- [x] 1. done thing\n- [ ] 2. open thing\n");
    });
    const sess14 = (dir, source) => spawnSync(process.execPath, [hookJs], { input: JSON.stringify({ hook_event_name: "SessionStart", cwd: dir, source }), encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: dir } });
    const fStart14 = sess14(f14, "startup"), fCompact14 = sess14(f14, "compact");
    const fList14 = fs.readdirSync(path.join(f14, ".specs")).sort().join();
    fs.writeFileSync(path.join(f14, ".specs", "auth", "classification.md"), "# Classification\n");
    const fOwned14 = sess14(f14, "startup");
    ok(fStart14.status === 0 && fStart14.stdout === "" && fCompact14.status === 0 && fCompact14.stdout === "" && fList14 === "auth,billing" &&
      /features in \.specs/.test(fOwned14.stdout) && /auth \[core\]/.test(fOwned14.stdout),
      "SessionStart: a foreign .specs/ (no roadmap.json, steering, generated ROADMAP.md, .state.json or classification.md) gets no status block and nothing written; a dev-spec feature brings it back");

    // 4. A BOM-only re-save (Windows PowerShell 5.1, 'UTF-8 with BOM' editors) is not a change after approval — it blocked
    // spec_finish while spec_impact showed nothing changed. An approval recorded over a BOM-prefixed file still matches.
    const b14 = path.join(tmp, "proj-wp14-bom");
    S.initProject(b14, ["core"], "en");
    const b14f = S.createFeature(b14, "Widget", ["core"]);
    const req14 = path.join(b14f.dir, "requirements.md");
    const tasks14 = path.join(b14f.dir, "tasks.md");
    S.approvePhase(b14, "widget", "requirements", "me", { force: true });
    S.approvePhase(b14, "widget", "tasks", "me", { force: true });
    const orig14 = fs.readFileSync(req14, "utf8");
    fs.writeFileSync(req14, BOM + orig14.replace(/\n/g, "\r\n"));
    fs.writeFileSync(tasks14, BOM + fs.readFileSync(tasks14, "utf8"));
    const changedOf14 = () => ({ na: S.nextAction(b14, "widget").changedSinceApproval.join(), doc: S.specDoctor(b14, "widget").checks.some((c) => c.id === "changed-since-approval"),
      fin: S.finishFeature(b14, "widget").blockers.some((b) => /changed after their approval/.test(b)), imp: S.impactReport(b14, "widget", { phase: "requirements" }) });
    const bom14 = changedOf14();
    const st14p = path.join(b14f.dir, ".state.json");
    const st14 = JSON.parse(fs.readFileSync(st14p, "utf8"));
    st14.approvals.requirements.fingerprint = require("crypto").createHash("sha1").update(BOM + orig14).digest("hex"); // as recorded over a BOM file before
    fs.writeFileSync(st14p, JSON.stringify(st14, null, 2));
    const legacyBom14 = S.nextAction(b14, "widget").changedSinceApproval.join();
    fs.writeFileSync(req14, orig14);
    const legacyNoBom14 = S.nextAction(b14, "widget").changedSinceApproval.join();
    fs.appendFileSync(req14, "\n## Assumptions\n- Admins are logged in.\n");
    const edited14 = S.nextAction(b14, "widget").changedSinceApproval.join();
    ok(bom14.na === "" && !bom14.doc && !bom14.fin && bom14.imp.changed === false && bom14.imp.baseline === "snapshot" &&
      legacyBom14 === "" && legacyNoBom14 === "" && edited14 === "requirements.md",
      "a BOM (+CRLF) re-save of approved requirements.md / tasks.md is not changed-since-approval (next_action, doctor, finish, impact); an older BOM fingerprint still matches; a real edit is still flagged (got " +
      JSON.stringify([bom14.na, bom14.doc, bom14.fin, bom14.imp.changed, legacyBom14, legacyNoBom14, edited14]) + ")");

    // 5. Cross-process feature lock: two processes completing tasks of one feature at the same moment lost ticks and
    // evidence while both answered ok (last writer won). Now every call that answers ok leaves its tick + evidence.
    const k14 = path.join(tmp, "proj-wp14-lock");
    S.initProject(k14, ["core"], "en");
    const k14f = S.createFeature(k14, "Race", ["core"]);
    const N14 = 16;
    fs.writeFileSync(path.join(k14f.dir, "tasks.md"), Array.from({ length: N14 }, (_, i) => `- [ ] ${i + 1}. task ${i + 1}`).join("\n") + "\n");
    const racer14 = (first, startAt) => new Promise((resolve) => {
      const code = `const S=require(${JSON.stringify(specJs)});` +
        `Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,Math.max(0,${startAt}-Date.now()));` +
        `const out=[];for(let n=${first};n<=${N14};n+=2)out.push(S.completeTask(${JSON.stringify(k14)},"race",n,{command:"npm test",exitCode:0}).ok);` +
        `process.stdout.write(JSON.stringify(out));`;
      let out = "";
      const kid = spawn(process.execPath, ["-e", code], { stdio: ["ignore", "pipe", "inherit"] });
      kid.stdout.on("data", (d) => (out += d));
      kid.on("close", () => { try { resolve(JSON.parse(out)); } catch { resolve([]); } });
    });
    const start14 = Date.now() + 700;
    const [odd14, even14] = await Promise.all([racer14(1, start14), racer14(2, start14)]);
    const kTasks14 = fs.readFileSync(path.join(k14f.dir, "tasks.md"), "utf8");
    const kEv14 = Object.keys(JSON.parse(fs.readFileSync(path.join(k14f.dir, ".state.json"), "utf8")).evidence || {});
    ok(odd14.length === N14 / 2 && even14.length === N14 / 2 && odd14.concat(even14).every(Boolean) && (kTasks14.match(/- \[x\]/g) || []).length === N14 && kEv14.length === N14 &&
      !fs.existsSync(path.join(k14f.dir, ".lock")) && tmpsIn(k14f.dir).length === 0 && tmpsIn(path.join(k14, ".specs")).length === 0,
      "two processes completing tasks of one feature at once: every ok call's tick and evidence is kept (" + (kTasks14.match(/- \[x\]/g) || []).length + "/" + N14 + " ticked, " +
      kEv14.length + " evidence records), no .lock or .tmp left");

    // A lock held by a live process makes a mutator wait, then answer a localized "busy" error with nothing changed; a
    // lock left by a dead process (or an old one from another host) is reclaimed; the lock is re-entrant in one process.
    const p14 = path.join(tmp, "proj-wp14-busy");
    S.initProject(p14, ["core"], "pt");
    const p14f = S.createFeature(p14, "Ocupada", ["core"]);
    const pTasks14 = path.join(p14f.dir, "tasks.md");
    fs.writeFileSync(pTasks14, "- [ ] 1. a\n- [ ] 2. b\n- [ ] 3. c\n");
    const lock14 = path.join(p14f.dir, ".lock");
    fs.writeFileSync(lock14, JSON.stringify({ pid: process.pid, host: os.hostname(), at: new Date().toISOString() }));
    const busyKid14 = spawnSync(process.execPath, ["-e", `const S=require(${JSON.stringify(specJs)});process.stdout.write(JSON.stringify(S.completeTask(${JSON.stringify(p14)},"ocupada",1,{command:"npm test",exitCode:0})))`],
      { encoding: "utf8", env: { ...process.env, DEV_SPEC_LOCK_WAIT_MS: "60" } });
    let busy14 = {};
    try { busy14 = JSON.parse(busyKid14.stdout); } catch { /* stays {} */ }
    const pState14 = () => JSON.parse(fs.readFileSync(path.join(p14f.dir, ".state.json"), "utf8"));
    const busyUntouched14 = /- \[ \] 1\./.test(fs.readFileSync(pTasks14, "utf8")) && !(pState14().evidence || {})["1"] && fs.existsSync(lock14);
    const ownPidFile14 = S.withFeatureLock(p14f.dir, () => "outer", { waitMs: 30, onBusy: () => "busy" });
    const deadPid14 = Number(spawnSync(process.execPath, ["-e", "process.stdout.write(String(process.pid))"], { encoding: "utf8" }).stdout);
    fs.writeFileSync(lock14, JSON.stringify({ pid: deadPid14, host: os.hostname(), at: new Date().toISOString() }));
    const dead14 = S.completeTask(p14, "ocupada", 1, { command: "npm test", exitCode: 0 });
    const deadGone14 = !fs.existsSync(lock14);
    fs.writeFileSync(lock14, JSON.stringify({ pid: 1, host: "some-other-host", at: "2020-01-01T00:00:00.000Z" }));
    const freshOther14 = S.withFeatureLock(p14f.dir, () => "ran", { waitMs: 40, onBusy: () => "busy" });
    const old14 = new Date(Date.now() - 3 * 60 * 1000);
    fs.utimesSync(lock14, old14, old14);
    const oldOther14 = S.completeTask(p14, "ocupada", 2);
    const oldGone14 = !fs.existsSync(lock14);
    const nested14 = S.withFeatureLock(p14f.dir, () => S.withFeatureLock(p14f.dir, () => S.completeTask(p14, "ocupada", 3).ok, { waitMs: 30, onBusy: () => "busy" }), { waitMs: 30, onBusy: () => "busy" });
    ok(busy14.ok === false && busy14.busy === true && /Outro processo dev-spec está a atualizar 'ocupada'/.test(busy14.error || "") && busyUntouched14 && ownPidFile14 === "busy" &&
      dead14.ok && deadGone14 && freshOther14 === "busy" && oldOther14.ok && oldGone14 && nested14 === true && !fs.existsSync(lock14),
      "feature lock: a live holder → the mutator waits DEV_SPEC_LOCK_WAIT_MS, then a localized busy error (PT) with nothing ticked or recorded; a dead holder's lock and an old foreign one are reclaimed; a fresh foreign one (or one naming this pid that this process does not hold) is respected; re-entrant (got " +
      JSON.stringify([busy14.ok, busy14.busy, (busy14.error || "").slice(0, 40), busyUntouched14, ownPidFile14, dead14.ok, deadGone14, freshOther14, oldOther14.ok, oldGone14, nested14]) + ")");
    // Mutual exclusion under contention: 4 processes × 200 increments of one counter under withFeatureLock. A waiter whose
    // stat of a just-released lock failed read it as stale and deleted the NEXT holder's fresh lock (and a holder's release
    // deleted whatever lock sat there): two holders at once, increments lost while every call answered ok (≈570/600, 183/600).
    const c14 = fs.mkdtempSync(path.join(tmp, "lock-counter-"));
    const cFile14 = path.join(c14, "counter.txt");
    fs.writeFileSync(cFile14, "0");
    const counter14 = (startAt) => new Promise((resolve) => {
      const code = `const S=require(${JSON.stringify(specJs)});const fs=require("fs");const f=${JSON.stringify(cFile14)};` +
        `Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,Math.max(0,${startAt}-Date.now()));` +
        `let ok=0;for(let i=0;i<200;i++)if(S.withFeatureLock(${JSON.stringify(c14)},()=>{fs.writeFileSync(f,String(Number(fs.readFileSync(f,"utf8"))+1));return true;},{waitMs:30000,onBusy:()=>false})===true)ok++;` +
        `process.stdout.write(String(ok));`;
      let out = "";
      const kid = spawn(process.execPath, ["-e", code], { stdio: ["ignore", "pipe", "inherit"] });
      kid.stdout.on("data", (d) => (out += d));
      kid.on("close", () => resolve(Number(out)));
    });
    const cStart14 = Date.now() + 600;
    const cOks14 = await Promise.all([0, 1, 2, 3].map(() => counter14(cStart14)));
    const cVal14 = Number(fs.readFileSync(cFile14, "utf8"));
    ok(cOks14.every((n) => n === 200) && cVal14 === 800 && fs.readdirSync(c14).join() === "counter.txt",
      "feature lock under contention: 4 processes × 200 locked increments end at exactly 800, every call ran, no .lock / .lock.reclaim left (got " + cVal14 + ", oks " + cOks14.join("/") + ")");
    // A holder releases only ITS lock: one taken over meanwhile (here: replaced by another process's note) is left alone.
    const tk14 = fs.mkdtempSync(path.join(tmp, "lock-takeover-"));
    const tkNote14 = JSON.stringify({ pid: 1, host: "other-host", at: new Date().toISOString(), token: "theirs" });
    const tkRan14 = S.withFeatureLock(tk14, () => { fs.writeFileSync(path.join(tk14, ".lock"), tkNote14); return "ran"; }, { waitMs: 30, onBusy: () => "busy" });
    const tkKept14 = fs.existsSync(path.join(tk14, ".lock")) && fs.readFileSync(path.join(tk14, ".lock"), "utf8") === tkNote14;
    // A stale lock that can't be removed (a folder named .lock, an hour old): the busy answer at the deadline — it spun at
    // 100% CPU forever (no deadline check, no sleep), freezing the whole MCP server. Localized, and it says to delete it.
    const u14 = path.join(tmp, "proj-wp14-stuck");
    S.initProject(u14, ["core"], "pt");
    const uf14 = S.createFeature(u14, "Presa", ["core"]);
    fs.writeFileSync(path.join(uf14.dir, "tasks.md"), "- [ ] 1. a\n");
    const uLock14 = path.join(uf14.dir, ".lock");
    fs.mkdirSync(path.join(uLock14, "x"), { recursive: true });
    const hourAgo14 = new Date(Date.now() - 3600e3);
    fs.utimesSync(uLock14, hourAgo14, hourAgo14);
    const uKid14 = spawnSync(process.execPath, ["-e", `const S=require(${JSON.stringify(specJs)});process.stdout.write(JSON.stringify(S.completeTask(${JSON.stringify(u14)},"presa",1)))`],
      { encoding: "utf8", timeout: 15000, env: { ...process.env, DEV_SPEC_LOCK_WAIT_MS: "300" } });
    let uRes14 = {};
    try { uRes14 = JSON.parse(uKid14.stdout); } catch { /* stays {} */ }
    const uT0 = Date.now();
    const uDirect14 = S.withFeatureLock(uf14.dir, () => "ran", { waitMs: 200, onBusy: (b) => b });
    const uMs14 = Date.now() - uT0;
    ok(tkRan14 === "ran" && tkKept14 && uKid14.status === 0 && uRes14.ok === false && uRes14.busy === true && uRes14.stuck === true &&
      /Um lock dev-spec abandonado \(\.specs\/presa\/\.lock\) não pôde ser removido/.test(uRes14.error || "") && /- \[ \] 1\./.test(fs.readFileSync(path.join(uf14.dir, "tasks.md"), "utf8")) &&
      uDirect14 && uDirect14.stuck === true && uMs14 < 3000 && !fs.existsSync(uLock14 + ".reclaim") &&
      ["en", "pt", "es"].every((l) => S.msg(l).err.lockStuck(".specs/f/.lock").includes(".specs/f/.lock")),
      "a lock taken over is never deleted by its old holder; a stale lock that can't be removed (a folder named .lock) → busy + stuck with a localized 'delete it by hand' error within DEV_SPEC_LOCK_WAIT_MS (nothing ticked, no spin), EN/PT/ES (got " +
      JSON.stringify([tkRan14, tkKept14, uKid14.status, uKid14.signal, uRes14.stuck, (uRes14.error || "").slice(0, 50), uMs14]) + ")");
    const l14 = ["en", "pt", "es"].map((l) => [S.msg(l).args.network("\\\\h\\s"), S.msg(l).err.featureBusy("f")]);
    ok(l14.every(([n, b]) => typeof n === "string" && n.includes("\\\\h\\s") && typeof b === "string" && b.includes(".specs/f/.lock")) &&
      /pasta local/.test(l14[1][0]) && /carpeta local/.test(l14[2][0]) && /Outro processo dev-spec/.test(l14[1][1]) && /Otro proceso de dev-spec/.test(l14[2][1]),
      "the network-projectDir refusal and the busy-lock error exist in EN, PT and ES");

    // Every op that read-modify-writes a feature or moves its folder takes that lock: spec_create re-run on an existing
    // feature (applyTracks — it used to write state.tracks / tasks.md unlocked and lose a concurrent tick's evidence, or be
    // lost to it), rename / archive / remove (they moved the folder away mid-write: a zombie .specs/<old>/ and progress split
    // between two folders) and restore (its archived folder's lock). And roadmap.json's read-modify-writes take
    // .specs/.roadmap.lock. A live holder → busy (localized), nothing changed.
    const m14 = path.join(tmp, "proj-wp14-movelock");
    S.initProject(m14, ["core"], "en");
    const mf14 = S.createFeature(m14, "Alpha", ["core"]);
    S.createFeature(m14, "Parked", ["core"]);
    S.manageFeature(m14, "archive", "parked");
    const mTasks14 = fs.readFileSync(path.join(mf14.dir, "tasks.md"), "utf8");
    const holdNote14 = JSON.stringify({ pid: process.pid, host: os.hostname(), at: new Date().toISOString() });
    const mLock14 = path.join(mf14.dir, ".lock"), aLock14 = path.join(m14, ".specs", "_archive", "parked", ".lock"), rLock14 = path.join(m14, ".specs", ".roadmap.lock");
    [mLock14, aLock14, rLock14].forEach((l) => fs.writeFileSync(l, holdNote14));
    const moveKid14 = spawnSync(process.execPath, ["-e", `const S=require(${JSON.stringify(specJs)});const p=${JSON.stringify(m14)};const pick=(r)=>({ok:r.ok,busy:r.busy,error:r.error});` +
      `process.stdout.write(JSON.stringify([S.createFeature(p,"Alpha",["saas"]),S.manageFeature(p,"rename","alpha","beta"),S.manageFeature(p,"archive","alpha"),` +
      `S.manageFeature(p,"remove","alpha",null,{confirm:true}),S.manageFeature(p,"restore","parked"),S.backlog(p,"add","Later"),S.setDependency(p,"alpha",["parked"]),S.initProject(p,["core"],"pt")].map(pick)))`],
      { encoding: "utf8", env: { ...process.env, DEV_SPEC_LOCK_WAIT_MS: "60" } });
    let mv14 = [];
    try { mv14 = JSON.parse(moveKid14.stdout); } catch { /* stays [] */ }
    const mSt14 = JSON.parse(fs.readFileSync(path.join(mf14.dir, ".state.json"), "utf8"));
    const mUntouched14 = fs.readFileSync(path.join(mf14.dir, "tasks.md"), "utf8") === mTasks14 && mSt14.tracks.join() === "core" && !fs.existsSync(path.join(mf14.dir, "load-test.md")) &&
      !fs.existsSync(path.join(m14, ".specs", "beta")) && fs.existsSync(path.join(m14, ".specs", "_archive", "parked")) && (S.readRoadmap(m14).backlog || []).length === 0 &&
      S.projectLang(m14) === "en";
    const featBusy14 = (r, slug, rel) => r && r.ok === false && r.busy === true && (r.error || "").includes(`Another dev-spec process is updating '${slug}' right now (${rel})`);
    const rmBusy14 = (r) => r && r.ok === false && r.busy === true && /updating \.specs\/roadmap\.json right now \(\.specs\/\.roadmap\.lock\)/.test(r.error || "");
    ok(mv14.length === 8 && mv14.slice(0, 4).every((r) => featBusy14(r, "alpha", ".specs/alpha/.lock")) && featBusy14(mv14[4], "parked", ".specs/_archive/parked/.lock") &&
      mv14.slice(5).every(rmBusy14) && mUntouched14,
      "a held feature lock makes create (existing feature) / rename / archive / remove wait, then answer busy; restore waits on its archived folder's lock; backlog / depend / init --lang wait on .specs/.roadmap.lock — nothing changed (got " +
      JSON.stringify(mv14.map((r) => [r.ok, r.busy, (r.error || "").slice(0, 60)])) + ")");
    [mLock14, aLock14, rLock14].forEach((l) => fs.rmSync(l, { force: true }));
    const cr14 = S.createFeature(m14, "Alpha", ["saas"]);
    const rn14 = S.manageFeature(m14, "rename", "alpha", "beta");
    const bDir14 = path.join(m14, ".specs", "beta");
    const ar14 = S.manageFeature(m14, "archive", "beta");
    const rs14 = S.manageFeature(m14, "restore", "beta");
    const leftLocks14 = [path.join(m14, ".specs", "alpha"), path.join(bDir14, ".lock"), path.join(m14, ".specs", "_archive", "beta", ".lock"), rLock14].filter((p) => fs.existsSync(p));
    ok(cr14.ok && (cr14.addedTracks || []).join() === "saas" && JSON.parse(fs.readFileSync(path.join(bDir14, ".state.json"), "utf8")).tracks.join() === "core,saas" &&
      rn14.ok && ar14.ok && rs14.ok && leftLocks14.length === 0 && tmpsIn(bDir14).length === 0 && S.manageFeature(m14, "remove", "beta", null, { confirm: true }).ok && !fs.existsSync(bDir14),
      "once free: create adds the track, rename / archive / restore move the folder and release the lock at its NEW place (no .lock, no zombie folder left); remove deletes it (left: " + leftLocks14.join(", ") + ")");
    // brief --write (spec_task_brief {write}) and metrics --write write into the feature folder: under its lock too. Resolved
    // before a rename and written after it, the brief recreated a zombie .specs/<old>/.execution/ — a phantom feature in
    // `list` that blocked renaming back. A held lock → busy with nothing written; a read-only brief / metrics never waits.
    const bw14 = path.join(tmp, "proj-wp14-briefwrite");
    S.initProject(bw14, ["core"], "en");
    const bwf14 = S.createFeature(bw14, "Alpha", ["core"]);
    const bwLock14 = path.join(bwf14.dir, ".lock");
    fs.writeFileSync(bwLock14, holdNote14);
    const bwKid14 = spawnSync(process.execPath, ["-e", `const S=require(${JSON.stringify(specJs)});const p=${JSON.stringify(bw14)};const pick=(r)=>({ok:r.ok,busy:r.busy,error:r.error});` +
      `process.stdout.write(JSON.stringify([S.taskBrief(p,"alpha",1,{write:true}),S.metrics(p,"alpha",{write:true}),S.taskBrief(p,"alpha",1),S.metrics(p,"alpha")].map(pick)))`],
      { encoding: "utf8", env: { ...process.env, DEV_SPEC_LOCK_WAIT_MS: "60" } });
    let bw14r = [];
    try { bw14r = JSON.parse(bwKid14.stdout); } catch { /* stays [] */ }
    const bwNothing14 = !fs.existsSync(path.join(bwf14.dir, ".execution")) && !fs.existsSync(path.join(bwf14.dir, "retro.md"));
    fs.rmSync(bwLock14, { force: true });
    const bwFree14 = S.taskBrief(bw14, "alpha", 1, { write: true });
    ok(bw14r.length === 4 && featBusy14(bw14r[0], "alpha", ".specs/alpha/.lock") && featBusy14(bw14r[1], "alpha", ".specs/alpha/.lock") && bw14r[2].ok === true && bw14r[3].ok === true &&
      bwNothing14 && bwFree14.ok && fs.existsSync(path.join(bwf14.dir, ".execution", "task-1-brief.md")) && !fs.existsSync(bwLock14),
      "brief --write and metrics --write wait on the feature lock (busy, nothing written, no zombie folder possible); the read-only brief / metrics don't; once free the brief is written (got " +
      JSON.stringify(bw14r.map((r) => [r.ok, r.busy])) + ")");
    // The lock files are git-ignored (.specs/.gitignore): a lock left by a killed process showed in `git status`, `git add -A`
    // committed it, and on a clone its fresh checkout mtime kept the feature "busy" (then its reclaim deleted a tracked file).
    // init / create write the rules and every lock acquisition restores them; an existing .specs/.gitignore only gains the
    // missing lines (its CRLF kept); a lock never creates .specs/ itself.
    const gi14 = path.join(tmp, "proj-wp14-gitignore");
    S.initProject(gi14, ["core"], "en");
    const giFile14 = path.join(gi14, ".specs", ".gitignore");
    const giInit14 = fs.readFileSync(giFile14, "utf8");
    fs.writeFileSync(giFile14, "# mine\r\n.lock\r\n");
    const gif14 = S.createFeature(gi14, "Alpha", ["core"]);
    const giMerged14 = fs.readFileSync(giFile14, "utf8");
    fs.rmSync(giFile14);
    const giTick14 = S.completeTask(gi14, "alpha", 1);
    const giBack14 = fs.existsSync(giFile14) ? fs.readFileSync(giFile14, "utf8") : null;
    const giNone14 = path.join(tmp, "proj-wp14-nospecs");
    fs.mkdirSync(giNone14);
    const giNoneRan14 = S.withFeatureLock(path.join(giNone14, ".specs", "x"), () => "ran", { waitMs: 10, onBusy: () => "busy" });
    let giGit14 = "skipped (no git)";
    const g14 = (args) => spawnSync("git", args, { cwd: gi14, encoding: "utf8" });
    if (g14(["--version"]).status === 0 && g14(["init", "-q"]).status === 0) {
      fs.writeFileSync(path.join(gif14.dir, ".lock"), holdNote14); // left by a killed process
      // …and the temp files a killed process leaves (writeFileAtomic's, the lock's note) and a failed remove's tombstone.
      const leftovers14 = [path.join(gif14.dir, "tasks.md.4242.1790000000000.tmp"), path.join(gif14.dir, ".lock.4242.1790000000000.77.tmp"),
        path.join(gi14, ".specs", ".removing-beta-0a1b2c3d", "tasks.md")];
      for (const p of leftovers14) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, "x"); }
      const probe14 = [".specs/alpha/.lock", ".specs/alpha/.lock.reclaim", ".specs/_archive/old/.lock", ".specs/.roadmap.lock", ".specs/.roadmap.lock.reclaim",
        ".specs/alpha/tasks.md.4242.1790000000000.tmp", ".specs/alpha/.lock.4242.1790000000000.77.tmp", ".specs/roadmap.json.1.2.tmp"];
      const ignored14 = (g14(["check-ignore", "--", ...probe14]).stdout || "").split(/\r?\n/).filter(Boolean);
      const status14 = g14(["status", "--porcelain", "--untracked-files=all"]).stdout || "";
      giGit14 = ignored14.length === probe14.length && !/\.lock|\.tmp|\.removing-/.test(status14) && /\.specs\/\.gitignore/.test(status14) && /\.specs\/alpha\/tasks\.md/.test(status14)
        ? "ok" : JSON.stringify([ignored14, status14]);
      fs.rmSync(path.join(gif14.dir, ".lock"), { force: true });
      for (const p of leftovers14) fs.rmSync(p, { force: true });
      fs.rmSync(path.join(gi14, ".specs", ".removing-beta-0a1b2c3d"), { recursive: true, force: true });
    }
    // L1 — remove renames the folder to a dot tombstone BEFORE deleting it: when fs.rmSync runs, the feature path (and its
    // .lock) is already gone, so a waiter can't create a fresh lock in a half-deleted folder and bring the feature back.
    const rmPLk = path.join(tmp, "proj-wp14-remove");
    S.initProject(rmPLk, ["core"], "en");
    const rmFLk = S.createFeature(rmPLk, "Gone soon", ["core"]);
    const oldTombLk = path.join(rmPLk, ".specs", ".removing-old-feature-00000000");
    fs.mkdirSync(oldTombLk, { recursive: true });
    fs.writeFileSync(path.join(oldTombLk, "tasks.md"), "x");
    const pastLk = new Date(Date.now() - 5 * 60 * 1000);
    fs.utimesSync(oldTombLk, pastLk, pastLk);
    const freshTombLk = path.join(rmPLk, ".specs", ".removing-busy-11111111");
    fs.mkdirSync(freshTombLk, { recursive: true });
    const listedTombLk = !S.listFeatures(rmPLk).features.some((f) => f.name.startsWith(".removing-")) && !S.roadmap(rmPLk).features.some((f) => f.name.startsWith(".removing-")) &&
      !S.catalog(rmPLk).features.some((f) => String(f.feature).startsWith(".removing-"));
    const realRmLk = fs.rmSync;
    const rmCallsLk = [];
    fs.rmSync = function (p, o) { rmCallsLk.push({ target: path.basename(String(p)), featureGone: !fs.existsSync(rmFLk.dir) }); return realRmLk.call(fs, p, o); };
    let rmResLk;
    try { rmResLk = S.manageFeature(rmPLk, "remove", "gone-soon", null, { confirm: true }); } finally { fs.rmSync = realRmLk; }
    const rmCallLk = rmCallsLk.find((c) => c.target.startsWith(".removing-gone-soon-"));
    ok(rmResLk.ok && rmCallLk && rmCallLk.featureGone === true && !fs.existsSync(rmFLk.dir) && !fs.readdirSync(path.join(rmPLk, ".specs")).some((n) => n.startsWith(".removing-gone-soon-")) &&
      !fs.existsSync(oldTombLk) && fs.existsSync(freshTombLk) && listedTombLk,
      "remove: the folder is renamed to a .removing-* tombstone first (the feature path is gone before any delete — no half-deleted folder to lock), then deleted; a stale tombstone is swept, a fresh one (another remove in flight) kept; list / roadmap / catalog never show one (got " + JSON.stringify(rmCallsLk) + ")");
    // L4 — a folder another program holds open: the rename is retried, then answered with a localized "folder in use", never a
    // raw EPERM (archive / rename / restore / remove share it).
    const inUseFLk = S.createFeature(rmPLk, "Held open", ["core"]);
    const realRenLk = fs.renameSync;
    let renCallsLk = 0, failFor = Infinity;
    fs.renameSync = function (a, b) {
      if (path.resolve(String(a)) === path.resolve(inUseFLk.dir) && renCallsLk++ < failFor) { const e = new Error("EBUSY: resource busy or locked, rename"); e.code = "EBUSY"; throw e; }
      return realRenLk.call(fs, a, b);
    };
    let archLk, rmBusyLk, archCallsLk;
    try {
      archLk = S.manageFeature(rmPLk, "archive", "held-open"); // held for good: every retry fails
      archCallsLk = renCallsLk;
      renCallsLk = 0; failFor = 2; // a brief hold (a scanner): the retried rename then succeeds (Windows only retries)
      rmBusyLk = S.manageFeature(rmPLk, "remove", "held-open", null, { confirm: true });
    } finally { fs.renameSync = realRenLk; }
    const win = process.platform === "win32";
    ok(archLk.ok === false && archLk.busy && archLk.inUse && /^The folder \.specs\/held-open is in use by another program/.test(archLk.error) && !/EBUSY|EPERM/.test(archLk.error) &&
      archCallsLk === (win ? 10 : 1) && (win ? rmBusyLk.ok === true && !fs.existsSync(inUseFLk.dir) : rmBusyLk.ok === false && rmBusyLk.inUse && fs.existsSync(inUseFLk.dir)) &&
      /A pasta \.specs\/x está a ser usada por outro programa/.test(S.msg("pt").err.folderInUse(".specs/x")) && /La carpeta \.specs\/x está en uso/.test(S.msg("es").err.folderInUse(".specs/x")),
      "a folder held open by another program: the rename is retried (Windows — a brief hold then succeeds), a lasting one answers a localized 'folder in use' (EN/PT/ES) with nothing moved, never a raw EBUSY/EPERM (got " + JSON.stringify([archLk.error, archCallsLk, rmBusyLk.ok, rmBusyLk.error]) + ")");
    // L3 — the lock's note is written into place with the lock (no empty-lock window); a noteless lock older than a few
    // seconds (left by a killed process) is stale, a fresh one is still respected.
    const nlFLk = S.createFeature(rmPLk, "Noteless", ["core"]);
    const nlLockLk = path.join(nlFLk.dir, ".lock");
    let heldNoteLk = null;
    S.withFeatureLock(nlFLk.dir, () => { heldNoteLk = fs.readFileSync(nlLockLk, "utf8"); });
    const leftTmpLk = fs.readdirSync(nlFLk.dir).filter((n) => /\.tmp$/.test(n));
    fs.writeFileSync(nlLockLk, "");
    const freshEmptyLk = S.withFeatureLock(nlFLk.dir, () => "ran", { waitMs: 60, onBusy: () => "busy" });
    const oldLk = new Date(Date.now() - 20 * 1000);
    fs.utimesSync(nlLockLk, oldLk, oldLk);
    const oldEmptyLk = S.withFeatureLock(nlFLk.dir, () => "ran", { waitMs: 2000, onBusy: () => "busy" });
    let noteLk = null;
    try { noteLk = JSON.parse(heldNoteLk); } catch { /* not JSON */ }
    ok(noteLk && noteLk.pid === process.pid && /^[0-9a-f]{24}$/.test(noteLk.token) && !leftTmpLk.length && freshEmptyLk === "busy" && oldEmptyLk === "ran" && !fs.existsSync(nlLockLk),
      "the lock is created with its note in place (pid + token readable while held, no temp file left); an empty lock older than a few seconds is reclaimed, a fresh one still waits (got " + JSON.stringify([heldNoteLk, leftTmpLk, freshEmptyLk, oldEmptyLk]) + ")");
    // L5 — a lock taken inside another waits only for what is left of the outer budget (at least ~0.5 s), never a second full wait.
    const nestALk = S.createFeature(rmPLk, "Nest outer", ["core"]);
    const nestBLk = S.createFeature(rmPLk, "Nest inner", ["core"]);
    fs.writeFileSync(path.join(nestBLk.dir, ".lock"), JSON.stringify({ pid: process.pid, host: os.hostname(), at: new Date().toISOString(), token: "someone-else" }));
    const tNestLk = Date.now();
    const nestLk = S.withFeatureLock(nestALk.dir, () => S.withFeatureLock(nestBLk.dir, () => "inner ran", { onBusy: () => "inner busy" }), { waitMs: 100 });
    const nestMsLk = Date.now() - tNestLk;
    fs.rmSync(path.join(nestBLk.dir, ".lock"), { force: true });
    ok(nestLk === "inner busy" && nestMsLk < 3000, "a nested lock waits for the outer budget's remainder (~0.5 s floor), not a second full DEV_SPEC_LOCK_WAIT_MS (" + nestMsLk + " ms)");
    const giLines14 = ".lock\n.lock.reclaim\n.roadmap.lock\n.roadmap.lock.reclaim\n*.[0-9]*.[0-9]*.tmp\n.removing-*/\n";
    ok(giInit14 === giLines14 && giMerged14 === "# mine\r\n.lock\r\n.lock.reclaim\r\n.roadmap.lock\r\n.roadmap.lock.reclaim\r\n*.[0-9]*.[0-9]*.tmp\r\n.removing-*/\r\n" &&
      giTick14.ok && giBack14 === giInit14 && giNoneRan14 === "ran" && !fs.existsSync(path.join(giNone14, ".specs")) && (giGit14 === "ok" || giGit14 === "skipped (no git)"),
      "the lock files are git-ignored: init writes .specs/.gitignore, create only adds the missing lines to one that exists (CRLF kept), a locked tick restores it, a lock never creates .specs/; git ignores a leaked .lock / .roadmap.lock / reclaim guard, a killed process's <file>.<pid>.<ts>.tmp / lock note temp file, and a failed remove's .removing-* tombstone (git: " + giGit14 + ")");
    // Two processes adding backlog items at once: every ok add is kept (last-writer-wins used to drop about a third).
    const bl14r = path.join(tmp, "proj-wp14-roadmaprace");
    S.initProject(bl14r, ["core"], "en");
    const blRacer14 = (tag, startAt) => new Promise((resolve) => {
      const code = `const S=require(${JSON.stringify(specJs)});Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,Math.max(0,${startAt}-Date.now()));` +
        `let n=0;for(let i=0;i<20;i++)if(S.backlog(${JSON.stringify(bl14r)},"add","${tag}-"+i).ok)n++;process.stdout.write(String(n));`;
      let out = "";
      const kid = spawn(process.execPath, ["-e", code], { stdio: ["ignore", "pipe", "inherit"] });
      kid.stdout.on("data", (d) => (out += d));
      kid.on("close", () => resolve(Number(out)));
    });
    const blStart14 = Date.now() + 600;
    const [blA14, blB14] = await Promise.all([blRacer14("a", blStart14), blRacer14("b", blStart14)]);
    const blN14 = (S.readRoadmap(bl14r).backlog || []).length;
    ok(blA14 === 20 && blB14 === 20 && blN14 === 40 && !fs.existsSync(path.join(bl14r, ".specs", ".roadmap.lock")),
      "two processes adding backlog items at once: all " + blN14 + "/40 kept (roadmap.json is read-modify-written under .specs/.roadmap.lock), no lock left");
    const rb14 = ["en", "pt", "es"].map((l) => S.msg(l).err.roadmapBusy);
    ok(rb14.every((m) => typeof m === "string" && m.includes(".specs/.roadmap.lock")) && /Outro processo/.test(rb14[1]) && /Otro proceso/.test(rb14[2]),
      "the roadmap-busy error exists in EN, PT and ES");
  }

  { // A4.1 — scripts/test-docker.js (`npm run test:docker`): zero-dependency, offline-checkable parts — no Docker needed here.
    const dockerJs = path.join(root, "scripts", "test-docker.js");
    const src = fs.readFileSync(dockerJs, "utf8");
    const mods = [...src.matchAll(/require\("([^"]+)"\)/g)].map((m) => m[1]);
    const help = spawnSync(process.execPath, [dockerJs, "--help"], { encoding: "utf8" });
    const badArg = spawnSync(process.execPath, [dockerJs, "--suite", "nope"], { encoding: "utf8" });
    const noPathEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^path$/i.test(k)));
    const noDocker = spawnSync(process.execPath, [dockerJs], { encoding: "utf8", env: { ...noPathEnv, PATH: path.join(tmp, "no-such-bin-dir") } });
    ok(mods.length && mods.every((m) => ["child_process", "fs", "os", "path"].includes(m)) && require(path.join(root, "package.json")).scripts["test:docker"] === "node scripts/test-docker.js" &&
      help.status === 0 && /--network none/.test(help.stdout) && /read-only/.test(help.stdout) && /node:18-alpine/.test(help.stdout) &&
      badArg.status === 2 && /unknown suite 'nope'/.test(badArg.stderr) &&
      noDocker.status === 2 && /Docker is not available: the docker command was not found/.test(noDocker.stderr) && /npm test/.test(noDocker.stderr) &&
      /"--network", "none"/.test(src) && /:\/repo:ro/.test(src) && !/\.github|workflow/i.test(src),
      "scripts/test-docker.js: Node core only, wired as npm run test:docker; --help names the read-only mount, --network none and the default images; a bad argument and a missing docker exit 2 with a clear message (got " +
      JSON.stringify([mods, help.status, badArg.status, noDocker.status, (noDocker.stderr || "").slice(0, 120)]) + ")");
  }

  // 1.17: no regex literal lost its backslashes (a heredoc'd edit once turned /^\s*status\s*:/i into /^s*statuss*:/i in
  // the BMAD importer — it matched only the exact "status:" form). A class letter quantified right after an anchor, a group
  // opener or an alternation, with no backslash, is the tell.
  {
    const srcFiles = [...libSources().map((f) => path.relative(root, f)), "mcp/server.js", "cli/dev-spec.js",
      "hooks/guard-hook.js", "hooks/stop-hook.js", "hooks/spec-hook.js", "hooks/observe-hook.js", "hooks/approval-hook.js",
      "hooks/plan-hook.js", "hooks/precommit-check.js"].filter((f) => fs.existsSync(path.join(root, f)));
    const lit = /(^|[=(,:!&|?;{}\s])\/((?:\\.|\[(?:\\.|[^\]\\\n])*\]|[^/\\\n[])+)\/([dgimsuvy]*)/gm;
    const stripped = /(^|[(|^?:])(?:s[*+?]|d[+*]|w[+*])|[^\\\p{L}](?:s[*+])(?:[\p{L}:$)]|$)/u;
    const bad = [];
    for (const f of srcFiles) {
      const src = fs.readFileSync(path.join(root, f), "utf8");
      const lines = src.split("\n");
      for (const m of src.matchAll(lit)) {
        if (!stripped.test(m[2])) continue;
        const ln = src.slice(0, m.index).split("\n").length;
        const t = lines[ln - 1].trim();
        if (!t.startsWith("//") && !t.startsWith("*")) bad.push(f + ":" + ln + " /" + m[2].slice(0, 60) + "/");
      }
    }
    ok(srcFiles.length >= 10 && bad.length === 0,
      "1.17: no regex literal in the engine, server, CLI or hooks looks backslash-stripped (got " + JSON.stringify(bad) + ")");
  }

  // 1.18: the engine as modules — mcp/lib/spec.js and i18n.js are facades over mcp/lib/engine/ and mcp/lib/i18n/. Every
  // engine module is loaded (listed in engine/index.js MODULES: a module left out would leave its names undefined behind
  // __link), and every mcp/lib source stays zero-dependency: Node core (fs, path, os, crypto, module) or a relative file.
  {
    const engDir = path.join(__dirname, "lib", "engine");
    const idxSrc = fs.existsSync(path.join(engDir, "index.js")) ? fs.readFileSync(path.join(engDir, "index.js"), "utf8") : "";
    const listed = [...((idxSrc.match(/const MODULES = \[([\s\S]*?)\];/) || ["", ""])[1]).matchAll(/"\.\/([^"]+)"/g)].map((m) => m[1]).sort();
    const onDisk = libSources().map((f) => path.relative(engDir, f).split(path.sep).join("/"))
      .filter((f) => !f.startsWith("..") && f !== "index.js" && f !== "ctx.js").sort();
    const core = new Set(["fs", "path", "os", "crypto", "module"]);
    const badReq = [];
    for (const f of libSources()) for (const m of fs.readFileSync(f, "utf8").matchAll(/\brequire\(\s*(["'])([^"']+)\1\s*\)/g))
      if (!core.has(m[2].replace(/^node:/, "")) && !/^\.\.?\//.test(m[2])) badReq.push(path.relative(root, f) + ": " + m[2]);
    ok(listed.length > 0 && JSON.stringify(listed) === JSON.stringify(onDisk) && badReq.length === 0 && typeof S.withReadCache === "function",
      "1.18: every engine module is listed in engine/index.js MODULES (and only those), and every mcp/lib source requires Node core or a relative file only (got " +
      JSON.stringify([listed.length, onDisk.filter((f) => !listed.includes(f)), listed.filter((f) => !onDisk.includes(f)), badReq]) + ")");
  }

  // 1.18 module rule (review), read from the sources — no parser, zero dependencies. Per engine / i18n module: its bare
  // top-level `let` list (the names __link assigns; a private cache is a `let` WITH an initializer) and its __link
  // destructure name the same names; each exists in the namespace __link receives (engine: engine/index.js's E; a language
  // file: the tables i18n.js passes) and none is the __link parameter itself — `({ …, E } = E)` assigns the parameter and
  // leaves the module's own E undefined (E is a real name: trace.js's word-boundary fragment). The load-time requires of
  // mcp/lib form an acyclic graph (a cycle hands out a half-built module.exports), and every module in MODULES is loaded.
  {
    const libDir = path.join(__dirname, "lib");
    const engDir = path.join(libDir, "engine"), i18nDir = path.join(libDir, "i18n");
    const rel = (f) => path.relative(libDir, f).split(path.sep).join("/");
    const E = require("./lib/engine/index.js"); // the instance spec.js loaded (module cache): every name the modules export
    const engineNames = new Set(Object.keys(E));
    const i18nNames = new Set(((fs.readFileSync(path.join(libDir, "i18n.js"), "utf8").match(/\.__link\(\{([^}]*)\}\)/) || ["", ""])[1])
      .split(",").map((s) => s.trim()).filter(Boolean));
    const inside = (f, d) => f.startsWith(d + path.sep);
    const bad = [];
    let linkedModules = 0, linkedNames = 0;
    for (const f of libSources().filter((x) => inside(x, engDir) || inside(x, i18nDir))) {
      const src = fs.readFileSync(f, "utf8");
      const bare = [];
      for (const m of src.matchAll(/^let ([^;]*);/gm)) {
        const eq = m[1].indexOf("=");
        if (eq < 0) bare.push(...m[1].split(",").map((s) => s.trim()).filter(Boolean));
        else if (m[1].slice(0, eq).includes(",")) bad.push(rel(f) + ": a `let` mixing bare and initialized names");
      }
      const link = /function __link\(\s*([A-Za-z_$][\w$]*)\s*\)\s*\{\s*\(\{([^}]*)\}\s*=\s*([A-Za-z_$][\w$]*)\s*\);\s*\}/.exec(src);
      if (!link && !bare.length) continue; // ctx.js, index.js, i18n/common.js, i18n/pt-br.js: nothing linked
      if (!link) { bad.push(rel(f) + ": a bare `let` list but no __link"); continue; }
      const [, param, list, from] = link;
      const names = list.split(",").map((s) => s.trim()).filter(Boolean);
      linkedModules++;
      linkedNames += names.length;
      const ns = inside(f, i18nDir) ? i18nNames : engineNames;
      const dups = [...bare.filter((n, i) => bare.indexOf(n) !== i), ...names.filter((n, i) => names.indexOf(n) !== i)];
      const onlyLet = bare.filter((n) => !names.includes(n)), onlyLink = names.filter((n) => !bare.includes(n));
      const unknown = names.filter((n) => !ns.has(n));
      const shadow = names.filter((n) => n === param || n === "arguments" || n === "eval" || !/^[A-Za-z_$][\w$]*$/.test(n));
      if (from !== param) bad.push(rel(f) + ": __link(" + param + ") destructures " + from);
      if (dups.length) bad.push(rel(f) + ": named twice " + dups.join(", "));
      if (onlyLet.length) bad.push(rel(f) + ": in the `let` list, not linked " + onlyLet.join(", "));
      if (onlyLink.length) bad.push(rel(f) + ": linked, not in the `let` list " + onlyLink.join(", "));
      if (unknown.length) bad.push(rel(f) + ": no module exports " + unknown.join(", "));
      if (shadow.length) bad.push(rel(f) + ": shadows the __link parameter / not a plain name " + shadow.join(", "));
      if (!/module\.exports = \{[^}]*\b__link\b[^}]*\}/.test(src)) bad.push(rel(f) + ": links names but exports no __link");
    }
    ok(linkedModules >= 30 && linkedNames > 500 && bad.length === 0,
      "1.18 module rule: each engine / i18n module's bare `let` list names exactly its __link destructure, every name exists in the namespace __link receives, none shadows the __link parameter (got " +
      JSON.stringify({ linkedModules, linkedNames, bad }) + ")");

    // The load-time graph: every top-level `const … = require("./…")` of mcp/lib, plus index.js → each module in MODULES.
    // An engine → engine or i18n → i18n require (ctx.js aside) is marked `// load time`, as the rule says.
    const modules = [...((fs.readFileSync(path.join(engDir, "index.js"), "utf8").match(/const MODULES = \[([\s\S]*?)\];/) || ["", ""])[1])
      .matchAll(/"\.\/([^"]+)"/g)].map((m) => path.join(engDir, m[1]));
    const graph = new Map();
    const unmarked = [];
    for (const f of libSources()) {
      const deps = [];
      for (const m of fs.readFileSync(f, "utf8").matchAll(/^(?:const|let|var)\s+(?:\{[^}]*\}|[A-Za-z_$][\w$]*)\s*=\s*require\((["'])(\.\.?\/[^"']+)\1\);?(.*)$/gm)) {
        const to = path.resolve(path.dirname(f), m[2]);
        deps.push(to);
        const sameTree = (inside(f, engDir) && inside(to, engDir)) || (inside(f, i18nDir) && inside(to, i18nDir));
        if (sameTree && path.basename(to) !== "ctx.js" && !/\/\/ load time/.test(m[3])) unmarked.push(rel(f) + " → " + rel(to));
      }
      if (f === path.join(engDir, "index.js")) deps.push(...modules);
      graph.set(f, deps);
    }
    const state = new Map(), cycles = [];
    for (const start of graph.keys()) { // iterative DFS: 1 = on the stack, 2 = done
      if (state.get(start)) continue;
      const stack = [[start, 0]];
      state.set(start, 1);
      while (stack.length) {
        const top = stack[stack.length - 1];
        const deps = graph.get(top[0]) || [];
        if (top[1] >= deps.length) { state.set(top[0], 2); stack.pop(); continue; }
        const next = deps[top[1]++];
        if (state.get(next) === 1) cycles.push(stack.slice(stack.findIndex((x) => x[0] === next)).map((x) => rel(x[0])).concat(rel(next)).join(" → "));
        else if (!state.get(next)) { state.set(next, 1); stack.push([next, 0]); }
      }
    }
    const loadTimeEdges = [...graph.values()].reduce((n, d) => n + d.length, 0);
    ok(loadTimeEdges > modules.length && cycles.length === 0 && unmarked.length === 0,
      "1.18 module rule: the load-time requires of mcp/lib form an acyclic graph, and every engine → engine / i18n → i18n one is marked // load time (got " +
      JSON.stringify({ loadTimeEdges, cycles, unmarked }) + ")");
    const notLoaded = [...modules, path.join(engDir, "ctx.js")].filter((f) => !require.cache[f]).map(rel);
    ok(modules.length >= 20 && notLoaded.length === 0,
      "1.18 module rule: every module in engine/index.js MODULES is loaded once the facade is (got " + JSON.stringify({ modules: modules.length, notLoaded }) + ")");
  }

  // 1.18 load time (review): the facade turns on Node's module compile cache where Node has it (22.8+; NODE_DISABLE_COMPILE_CACHE
  // turns it off), and an English process never loads the pt-BR derivation — the stop gate's claim scan reads pt-BR's raw
  // patterns (pt's plus the Brazilian forms) without deriving one string of that group.
  {
    const Mod = require("module");
    const ccOn = typeof Mod.enableCompileCache !== "function" || !!process.env.NODE_DISABLE_COMPILE_CACHE || !!Mod.getCompileCacheDir();
    const probe = spawnSync(process.execPath, ["-e", [
      "const s = require(" + JSON.stringify(path.join(__dirname, "lib", "spec.js")) + ");",
      "const br = () => Object.keys(require.cache).some((k) => /[\\\\/]i18n[\\\\/]pt-br\\.js$/.test(k));",
      "s.msg('en').err; const afterEn = br();",
      "const claim = s.stopClaims('All tasks done.').claim;",
      "const g = s.msg('pt-BR').stopGate, pt = s.msg('pt').stopGate;",
      "const lazy = Object.keys(g).filter((k) => !['claims', 'negators', 'admissions', 'fixed'].includes(k) && Object.getOwnPropertyDescriptor(g, k).get).length;",
      "process.stdout.write(JSON.stringify({ afterEn, claim, lazy, extra: g.claims.length - pt.claims.length, head: typeof g.head }));",
    ].join("\n")], { encoding: "utf8", timeout: 60000 });
    let got = null;
    try { got = JSON.parse(probe.stdout); } catch { got = { stdout: probe.stdout, stderr: String(probe.stderr).slice(0, 300) }; }
    ok(ccOn && got && got.afterEn === false && got.claim === true && got.lazy > 3 && got.extra > 0 && got.head !== "undefined",
      "1.18 load time: the facade enables Node's module compile cache (where Node has it), an English process loads no pt-BR, and the stop gate reads pt-BR's raw claim patterns without deriving its messages (got " +
      JSON.stringify({ ccOn, got }) + ")");
  }

  { // 1.21 F3 — the runnable CLI line (S.DEV_SPEC, i18n/common.js) is safe to paste: quoted for bash AND PowerShell (double quotes,
    // single quotes when the path holds " $ ` !, a placeholder when it also holds a '), forward slashes; it RUNS as printed in the
    // platform shell, in bash and in PowerShell where they exist; a committed file (UPGRADE.md here) gets `dev-spec` instead.
    const I = require("./lib/i18n.js");
    const quoting = [I.cliPrefix("C:\\Users\\Ana Sá\\dev-spec-driven\\cli\\dev-spec.js"), I.cliPrefix("/home/x$y/cli/dev-spec.js"), I.cliPrefix("/it's/$HOME/cli/dev-spec.js"),
      I.cliPrefix("/opt/bang!/cli/dev-spec.js")];
    const quoteOk = quoting[0] === 'node "C:/Users/Ana Sá/dev-spec-driven/cli/dev-spec.js"' && quoting[1] === "node '/home/x$y/cli/dev-spec.js'" &&
      quoting[2] === 'node "<dev-spec-driven>/cli/dev-spec.js"' && quoting[3] === "node '/opt/bang!/cli/dev-spec.js'";
    const line = S.DEV_SPEC + " help";
    const cwd = os.tmpdir();
    const heads = (r) => (r && !r.error && r.status === 0 && /^dev-spec — /.test(String(r.stdout || ""))) ? "ok" : r && r.error ? "absent" : "failed:" + (r && r.status) + " " + String(r && r.stderr || "").slice(0, 200);
    const viaShell = heads(spawnSync(line, { shell: true, encoding: "utf8", cwd }));
    const bashBin = (process.platform === "win32" ? [process.env.DEV_SPEC_TEST_BASH, "C:\\Program Files\\Git\\bin\\bash.exe"] : [process.env.DEV_SPEC_TEST_BASH, "bash"])
      .filter(Boolean).find((b) => { try { return spawnSync(b, ["--version"], { encoding: "utf8" }).status === 0; } catch { return false; } });
    const viaBash = bashBin ? heads(spawnSync(bashBin, ["-c", line], { encoding: "utf8", cwd })) : "absent";
    const psBin = process.platform === "win32" ? "powershell.exe" : "pwsh";
    const viaPs = heads(spawnSync(psBin, ["-NoProfile", "-NonInteractive", "-Command", line], { encoding: "utf8", cwd, timeout: 60000 }));
    // UPGRADE.md (committed) gets the portable `dev-spec` line; the audit's `lines` (read in the terminal) the runnable one.
    const pu = path.join(tmp, "proj-121-portable");
    S.initProject(pu, ["core"], "en");
    const fu = S.createFeature(pu, "Csv export", ["core"], "x");
    fs.writeFileSync(path.join(fu.dir, "tasks.md"), "# Tasks\n\n- [x] 1. [US1] Do it\n  - _Requirements: US-1.AC-1_\n  - _Verify: node -e \"process.exit(0)\"_\n");
    const rmp = path.join(pu, ".specs", "roadmap.json"), rmj = JSON.parse(fs.readFileSync(rmp, "utf8"));
    delete rmj.meta.specVersion;
    fs.writeFileSync(rmp, JSON.stringify(rmj, null, 2));
    const up = S.specUpgrade(pu, { apply: true });
    const upMd = fs.readFileSync(path.join(pu, ".specs", "UPGRADE.md"), "utf8");
    const portOk = up.ok && !upMd.includes(S.DEV_SPEC) && upMd.includes("dev-spec done csv-export <n> --run") && up.lines.some((l) => l.includes(S.DEV_SPEC + " done csv-export <n> --run")) &&
      S.portableCli("run " + S.DEV_SPEC.replace(/"/g, "&quot;") + " drift x") === "run dev-spec drift x" && S.portableCli(S.DEV_SPEC + " done x 1 --run") === "dev-spec done x 1 --run";
    ok(quoteOk && viaShell === "ok" && viaBash !== "failed" && !/^failed/.test(viaBash) && !/^failed/.test(viaPs) && portOk,
      "1.21 F3: the runnable CLI line is quoted for bash AND PowerShell (double quotes; single quotes around \" $ ` !; a placeholder when a ' joins them; forward slashes) and runs as printed in the platform shell" +
      " (and bash / PowerShell where present); a committed UPGRADE.md keeps `dev-spec`, the audit's lines the runnable form (got " +
      JSON.stringify({ quoting, viaShell, viaBash, viaPs, portOk, upMd: (upMd.match(/.*dev-spec done.*/) || [])[0] }) + ")");
  }
};
