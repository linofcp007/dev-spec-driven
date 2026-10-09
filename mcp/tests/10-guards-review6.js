"use strict";
// Guards and hooks — 1.24 review 6: PowerShell's --%, merge-state / git restores / observed.jsonl as guard-downs, UTF-16 state in the hooks, the approval hook's projects and paths, track removal, the commands' front matter.
// (10-guards-hooks.js holds the findings of review 5; this file those of review 6 — the Claude Code integration.)

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

exports.run = async ({ ok, all, S, tmp, rpc, payload, __dirname, require }) => {
  const E = require("./lib/engine/index.js"); // engine internals (the lexer) — read through mcp/test.js's require
  let HU; // what the hooks share before the engine loads (hooks/hook-utils.js — no engine)
  try { HU = require("../hooks/hook-utils.js"); } catch { HU = { approvalProjects: () => [], editTargets: () => [], sessionFlagFile: () => path.join(os.tmpdir(), "none") }; }
  const js = JSON.stringify;
  const BS = String.fromCharCode(92);
  const WIN = process.platform === "win32";
  const hookEnv = (env) => ({ ...process.env, CLAUDE_PROJECT_DIR: "", SPEC_PROJECT_DIR: "", ...(env || {}) });
  const hookOut = (name, pl, env) => {
    const r = spawnSync(process.execPath, [path.join(__dirname, "..", "hooks", name + ".js")], { input: typeof pl === "string" ? pl : js(pl),
      encoding: "utf8", env: hookEnv(env), cwd: tmp, timeout: 20000 });
    let j = null;
    try { j = r.stdout ? JSON.parse(r.stdout) : null; } catch { j = { unparsed: r.stdout }; }
    return { status: r.status, json: j, stdout: r.stdout, stderr: r.stderr };
  };
  const decisionOf = (r) => (r.json && r.json.hookSpecificOutput ? r.json.hookSpecificOutput.permissionDecision : r.json ? "?" : "silent");
  const C = "C:/plugins/dev-spec-driven/cli/dev-spec.js";
  const dec = (tool, command, level, extra) => S.approvalGuardDecision({ hook_event_name: "PreToolUse", tool_name: tool, tool_input: { command }, ...(extra || {}) },
    level || "deny", { meta: {}, lang: "en" });
  const pre = (cwd, tool, ti) => ({ session_id: "s", hook_event_name: "PreToolUse", cwd, tool_name: tool, tool_input: ti });
  const utf16le = (t) => Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(t, "utf16le")]);
  const utf16be = (t) => { const b = Buffer.from(t, "utf16le"); b.swap16(); return Buffer.concat([Buffer.from([0xfe, 0xff]), b]); };
  const project = (name, lang, opts, features) => {
    const p = path.join(tmp, name);
    S.initProject(p, ["core"], lang || "en", opts || {});
    for (const f of features || []) S.createFeature(p, f, ["core"]);
    return p;
  };

  // C1 — PowerShell's stop-parsing token: after an unquoted `--%` the rest of the line (to a newline or an unquoted `|`) goes to the
  // program as raw words — `node '<cli>' --% approve …` approved at deny (the lexer read `--%` as the CLI's first word).
  {
    const p = project("r6-c1", "en", { approvalGuard: "deny" }, ["Alpha"]);
    const seg = E.shellCommandWords("node x --% a \"b c|d\" ; %X% 'e f' | Select-Object -First 1\nnode y", "ps").map((w) => w.slice());
    const a = dec("PowerShell", "node '" + C + "' --% approve alpha classification --force --reason \"accepted\"");
    const rm = dec("PowerShell", "& node \"" + C + "\" --% feature remove alpha --yes");
    const lower = dec("PowerShell", "node \"" + C + "\" --% init --approval-guard off");
    const pipe = dec("PowerShell", "node \"" + C + "\" --% status alpha | Select-Object -First 5");
    const next = dec("PowerShell", "node \"" + C + "\" --% status alpha\nnode \"" + C + "\" approve alpha tasks");
    const net = dec("PowerShell", "node \"" + C + "\" --% status \"alpha\" approve");
    const bash = dec("Bash", "echo --% approve");
    const hk = hookOut("approval-hook", pre(p, "PowerShell", { command: "node '" + C + "' --% approve alpha classification --force" }), { CLAUDE_PROJECT_DIR: p });
    all("1.24 r6 C1: PowerShell's --% passes the rest of the line (to a newline or an unquoted |) as raw words — `node <cli> --% approve …`, `feature remove … --yes`, `init --approval-guard off` are refused at deny (engine and hook), a pipe after it ends it, and the CLI followed by --% with an approval word it can't read asks (got " +
      js([seg, a.decision, rm.decision, lower.decision, pipe.decision, next.decision, net.decision, bash.decision, decisionOf(hk)]) + ")", [
      () => js(seg) === js([["node", "x", "a", "b c|d", ";", "%X%", "'e", "f'"], ["Select-Object", "-First", "1"], ["node", "y"]]),
      () => a.decision === "deny", () => a.actions[0].kind === "approve", () => a.actions[0].feature === "alpha",
      () => a.actions[0].phase === "classification", () => a.force === true, () => rm.decision === "deny", () => rm.actions[0].kind === "remove",
      () => lower.decision === "deny", () => lower.actions[0].setting === "approvalGuard", () => pipe.decision === "allow",
      () => next.decision === "deny", () => net.decision === "ask", () => net.actions[0].why === "unparsed", () => bash.decision === "allow",
      () => decisionOf(hk) === "deny",
    ]);
  }

  // C7 — fail closed: the CLI found where it runs, its subcommand a variable / substitution / ( expression / "$@" / nothing under
  // xargs, while the command holds an approval word — asked (never allowed) at ask and deny.
  {
    const asked = [["Bash", "A=approve; node \"" + C + "\" $A alpha tasks"], ["Bash", "node \"" + C + "\" $(echo approve) alpha tasks"],
      ["Bash", "node \"" + C + "\" ${X:-approve} alpha tasks"], ["Bash", "node \"" + C + "\" `echo approve` alpha tasks"],
      ["Bash", "set -- approve alpha tasks; node \"" + C + "\" \"$@\""], ["Bash", "echo approve alpha tasks | xargs node \"" + C + "\""],
      ["Bash", "printf 'approve" + BS + "nalpha" + BS + "ntasks' | xargs node \"" + C + "\""], ["Bash", "node \"" + C + "\" \"$(printf approve)\" alpha tasks"],
      ["Bash", "args=(approve alpha tasks); node \"" + C + "\" \"${args[@]}\""], ["Bash", "node \"" + C + "\" --project . $CMD alpha tasks # approve"],
      ["PowerShell", "$s = 'approve'; node '" + C + "' $s alpha tasks"], ["PowerShell", "node '" + C + "' ('appr' + 'ove') alpha tasks"],
      ["PowerShell", "node '" + C + "' \"$('approve')\" alpha tasks"], ["PowerShell", "$a = @('approve','alpha','tasks'); node '" + C + "' @a"]];
    const allowed = [["Bash", "node \"" + C + "\" status $F"], ["Bash", "A=x; node \"" + C + "\" $A"], ["Bash", "echo alpha | xargs node \"" + C + "\" status"],
      ["Bash", "node \"" + C + "\" next-action $(cat name.txt)"], ["PowerShell", "$f = 'alpha'; node '" + C + "' status $f"]];
    const wrong = asked.filter(([t, c]) => dec(t, c).decision !== "ask" || dec(t, c, "ask").decision !== "ask").map(([t, c]) => "not asked: " + t + " " + c)
      .concat(allowed.filter(([t, c]) => dec(t, c).decision !== "allow").map(([t, c]) => "not allowed: " + t + " " + c));
    const one = dec("Bash", "A=approve; node \"" + C + "\" $A alpha tasks");
    ok(!wrong.length && one.actions[0].kind === "unreadable" && one.actions[0].why === "unparsed" && one.command === null,
      "1.24 r6 C7: the CLI whose subcommand is a variable, a substitution, a PowerShell ( ) expression or splat, \"$@\" or missing under xargs — with an approval word in the command — asks at ask and deny; the same forms without an approval word stay allowed (wrong: " +
      js(wrong) + ")");
  }

  // C2 — `dev-spec merge-state <base> <ours> <theirs>` writes <ours>: a .state.json (its approvals) or .specs/roadmap.json (the guard
  // itself) named there is a guard-down with no command; git's in-place writers naming them (checkout / restore / merge-file / rm / mv).
  {
    const gd = (command) => { const d = dec("Bash", command); return d.decision === "allow" ? "allow" : d.decision + ":" + d.actions.map((a) => a.kind + "/" + (a.setting || "") + "/" + (a.source || "") + "/" + (a.feature || "")).join(","); };
    const want = {
      ["node \"" + C + "\" merge-state /tmp/b.json .specs/alpha/.state.json /tmp/t.json"]: "deny:guard-down/state/cli/alpha",
      ["node \"" + C + "\" merge-state /tmp/b.json .specs/roadmap.json /tmp/t.json .specs/roadmap.json"]: "deny:guard-down/roadmap/cli/",
      ["node \"" + C + "\" merge-state b.json ./.specs/x/../roadmap.json t.json"]: "deny:guard-down/roadmap/cli/",
      ["node \"" + C + "\" merge-state --install"]: "allow",
      ["node \"" + C + "\" merge-state --check"]: "allow",
      ["node \"" + C + "\" merge-state b.json ours.json t.json"]: "allow",
      "git checkout HEAD~1 -- .specs/roadmap.json": "deny:guard-down/roadmap/shell/",
      "git restore --source=HEAD~1 .specs/roadmap.json": "deny:guard-down/roadmap/shell/",
      "git restore --source HEAD~1 --worktree .specs/alpha/.state.json": "deny:guard-down/state/shell/alpha",
      "git merge-file .specs/roadmap.json /tmp/b.json /tmp/t.json": "deny:guard-down/roadmap/shell/",
      "git -C . checkout HEAD -- .specs": "deny:guard-down/roadmap/shell/",
      "git checkout main -- .specs/alpha": "deny:guard-down/state/shell/alpha",
      "git rm .specs/roadmap.json": "deny:guard-down/roadmap/shell/",
      "git mv .specs/roadmap.json old.json": "deny:guard-down/roadmap/shell/",
      "git restore --staged .specs/roadmap.json": "allow",
      "git rm --cached .specs/alpha/.state.json": "allow",
      "git merge-file -p .specs/roadmap.json b.json t.json": "allow",
      "git diff .specs/roadmap.json": "allow",
      "git log -- .specs": "allow",
      "git show HEAD:.specs/roadmap.json": "allow",
      "git add .specs && git commit -m \"approve the tasks\"": "allow",
      "git checkout -b feature/specs": "allow",
      "cat .specs/alpha/.state.json": "allow",
      "cp .specs/alpha/.state.json /tmp/backup.json": "allow",
      "cp /tmp/backup.json .specs/alpha/.state.json": "deny:guard-down/state/shell/alpha",
      "echo '{}' > .specs/alpha/.state.json": "deny:guard-down/state/shell/alpha",
    };
    const got = Object.fromEntries(Object.keys(want).map((c) => [c, gd(c)]));
    const bad = Object.keys(want).filter((c) => got[c] !== want[c]).map((c) => c + " → " + got[c]);
    const ms = dec("Bash", "node \"" + C + "\" merge-state /tmp/b.json .specs/alpha/.state.json /tmp/t.json");
    const p = project("r6-c2", "es", { approvalGuard: "deny" }, ["Pagos"]);
    const hk = hookOut("approval-hook", pre(p, "Bash", { command: "node \"" + C + "\" merge-state /tmp/b.json .specs/pagos/.state.json /tmp/t.json" }), { CLAUDE_PROJECT_DIR: p });
    const hkReason = (hk.json && hk.json.hookSpecificOutput && hk.json.hookSpecificOutput.permissionDecisionReason) || "";
    ok(!bad.length && ms.command === null && !/merge-state/.test(ms.userNote || "") && decisionOf(hk) === "deny" && /el \.state\.json de 'pagos' desde la shell/.test(hkReason),
      "1.24 r6 C2: merge-state writing a .state.json or .specs/roadmap.json (its <ours>) and git checkout / restore (worktree) / merge-file / rm / mv naming them or .specs/ are guard-downs with no command (localized: ES); merge-state --install / --check, another <ours>, git's read-only forms, restore --staged, rm --cached, merge-file -p and a copy FROM the state stay allowed (wrong: " +
      js(bad) + "; hook " + js([decisionOf(hk), hkReason.slice(0, 160)]) + ")");
  }

  // C6 — .specs/**/.execution/observed.jsonl is the harness's log of the runs it SAW: a Write / Edit of it, or a shell redirection /
  // cp / tee onto it, forges observed evidence — a guard-down. The implementer's reports beside it stay writable.
  {
    const p = project("r6-c6", "pt", { approvalGuard: "deny", evidence: "observed" }, ["Api"]);
    const log = path.join(p, ".specs", "api", ".execution", "observed.jsonl");
    const ed = (tool, fp) => S.approvalGuardDecision(pre(p, tool, { file_path: fp, content: "{}" }), "deny", { meta: {}, lang: "en" });
    const w1 = ed("Write", log), w2 = ed("Edit", path.join(p, ".specs", ".execution", "observed.jsonl")), rep = ed("Write", path.join(p, ".specs", "api", ".execution", "task-1-report.md"));
    const sh = ["echo '{\"command\":\"npm test\",\"exitCode\":0}' >> .specs/api/.execution/observed.jsonl", "cp /tmp/x.jsonl .specs/api/.execution/observed.jsonl",
      "echo x | tee -a .specs/.execution/observed.jsonl"].map((c) => dec("Bash", c));
    const reads = ["cat .specs/api/.execution/observed.jsonl", "tail -n 5 .specs/.execution/observed.jsonl"].map((c) => dec("Bash", c).decision);
    const hk = hookOut("approval-hook", pre(p, "Write", { file_path: log, content: "{}" }), { CLAUDE_PROJECT_DIR: p });
    const hkReason = (hk.json && hk.json.hookSpecificOutput && hk.json.hookSpecificOutput.permissionDecisionReason) || "";
    ok(w1.decision === "deny" && w1.actions[0].setting === "observed" && w1.actions[0].feature === "api" && w1.command === null && w2.decision === "deny" && w2.actions[0].feature == null &&
      /harness-observed run log/.test(w1.reason) && rep.decision === "allow" && sh.every((d) => d.decision === "deny" && d.actions[0].setting === "observed") &&
      js(reads) === js(["allow", "allow"]) && decisionOf(hk) === "deny" && /registo das execuções observadas/.test(hkReason),
      "1.24 r6 C6: a Write / Edit of .specs/<f>/.execution/observed.jsonl (or the project's) and a shell redirection / cp / tee onto it are guard-downs (localized: PT, no command); a task report beside it and reading the log stay allowed (got " +
      js([w1.decision, w1.actions, w2.decision, rep.decision, sh.map((d) => d.decision), reads, decisionOf(hk), hkReason.slice(0, 120)]) + ")");
  }

  // C3 + A4 — a roadmap.json / .state.json saved as UTF-16 (Windows PowerShell 5.1's Out-File / `>`): the engine decodes it, the hooks
  // read UTF-8 — the approval and edit guards read "off", the stop gate saw no activity. A BOM-less UTF-16 file (broken JSON) keeps the
  // strictest level its text names, NULs and all. The MCP server's approvalMeta decodes it too (an unchanged spec_init was refused).
  {
    const recode = (p, file, enc) => { const f = path.join(p, ".specs", file); fs.writeFileSync(f, enc(fs.readFileSync(f, "utf8"))); };
    const cmd = (p) => pre(p, "Bash", { command: "node \"" + C + "\" approve alpha classification --force" });
    const pLe = project("r6-c3-le", "en", { approvalGuard: "deny" }, ["Alpha"]);
    const pBe = project("r6-c3-be", "en", { approvalGuard: "deny" }, ["Alpha"]);
    const pNo = project("r6-c3-nobom", "en", { approvalGuard: "deny" }, ["Alpha"]);
    recode(pLe, "roadmap.json", utf16le); recode(pBe, "roadmap.json", utf16be); recode(pNo, "roadmap.json", (t) => Buffer.from(t, "utf16le"));
    const ap = [pLe, pBe, pNo].map((p) => decisionOf(hookOut("approval-hook", cmd(p), { CLAUDE_PROJECT_DIR: p })));
    const mcpHook = decisionOf(hookOut("approval-hook", pre(pLe, "mcp__plugin_dev-spec-driven_spec-driven__spec_approve", { name: "alpha", phase: "classification" }), { CLAUDE_PROJECT_DIR: pLe }));
    const eng = [S.approvalGuardLevel(pLe), S.approvalGuardLevel(pNo), E.rawApprovalGuard(Buffer.from("{\"meta\":{\"approvalGuard\":\"ask\"", "utf16le").toString("utf8"))];
    // the edit guard
    const pG = project("r6-c3-guard", "en", { guard: true }, ["Alpha"]);
    recode(pG, "roadmap.json", utf16le);
    const g = decisionOf(hookOut("guard-hook", pre(pG, "Write", { file_path: path.join(pG, "src", "a.ts"), content: "x" }), { CLAUDE_PROJECT_DIR: pG }));
    // the stop gate: a tick without evidence, recorded in a UTF-16 .state.json
    const pS = project("r6-c3-stop", "en", {}, []);
    const f = S.createFeature(pS, "Auth", ["core"], "", undefined, "en");
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Login\n  - _Requirements: US-1.AC-1_\n  - _Verify: node --test tests/login.test.js_\n");
    S.completeTask(pS, "auth", 1);
    recode(pS, path.join("auth", ".state.json"), utf16le);
    const st = hookOut("stop-hook", { session_id: "s", hook_event_name: "Stop", cwd: pS, stop_hook_active: false, last_assistant_message: "All tasks done — everything verified." });
    // the MCP server: spec_init leaving evidence as it is (reported) on a UTF-16 roadmap.json at deny — no guard-down
    const pM = project("r6-c3-mcp", "en", { approvalGuard: "deny", evidence: "reported" }, []);
    recode(pM, "roadmap.json", utf16le);
    const init = payload(await rpc("tools/call", { name: "spec_init", arguments: { evidence: "reported", projectDir: pM } }));
    ok(js(ap) === js(["deny", "deny", "deny"]) && mcpHook === "deny" && js(eng) === js(["deny", "deny", "ask"]) && g === "ask" &&
      st.json && st.json.decision === "block" && /auth: #1/.test(st.json.reason) && init.ok !== false && !init.humanRequired,
      "1.24 r6 C3 / A4: a UTF-16 roadmap.json (LE / BE with a BOM, or BOM-less: the fail-closed reading sees through its NULs) keeps the approval guard (hook: CLI and MCP) and the edit guard on; a UTF-16 .state.json's tick reaches the stop gate; the MCP server's approvalMeta decodes it (an unchanged spec_init is no guard-down) (got " +
      js([ap, mcpHook, eng, g, st.stdout.slice(0, 160), init.ok, init.error]) + ")");
  }

  // C4 — the projects the approval hook reads are the ones the CLI acts on: the nearest .specs/ at or above the session's cwd (a session
  // started in a subfolder), a `cd` / Set-Location / pushd target, SPEC_PROJECT_DIR= / $env:SPEC_PROJECT_DIR= in the command; the
  // session's own network folder is read, a network path the agent names never is.
  {
    const p = project("r6-c4", "en", { approvalGuard: "deny" }, ["Alpha"]);
    const src = path.join(p, "src");
    fs.mkdirSync(path.join(src, "deep"), { recursive: true });
    const q = path.join(tmp, "r6-c4-session");
    fs.mkdirSync(q, { recursive: true });
    const A = "node \"" + C + "\" approve alpha tasks";
    const sub = decisionOf(hookOut("approval-hook", pre(src, "Bash", { command: A }), { CLAUDE_PROJECT_DIR: src }));
    const forms = [["Bash", "cd \"" + p + "\" && " + A], ["Bash", "cd \"" + path.join(p, "src", "deep") + "\" && " + A], ["Bash", "SPEC_PROJECT_DIR=\"" + p + "\" " + A],
      ["Bash", "export SPEC_PROJECT_DIR='" + p + "'; " + A], ["Bash", "pushd \"" + p + "\" >/dev/null && " + A], ["PowerShell", "Set-Location \"" + p + "\"; " + A],
      ["PowerShell", "Push-Location -Path '" + p + "'; " + A], ["PowerShell", "$env:SPEC_PROJECT_DIR = \"" + p + "\"; " + A], ["Bash", "cd .. && cd \"" + path.basename(p) + "\" && " + A]];
    const got = forms.map(([t, c]) => decisionOf(hookOut("approval-hook", pre(q, t, { command: c }), { CLAUDE_PROJECT_DIR: q })));
    const quiet = decisionOf(hookOut("approval-hook", pre(q, "Bash", { command: A }), { CLAUDE_PROJECT_DIR: q }));
    // the candidates, without touching a network path the agent names (pure for those)
    const share = BS + BS + "fileserver" + BS + "team" + BS + "proj";
    const cands = HU.approvalProjects({ cwd: share, env: { CLAUDE_PROJECT_DIR: share }, named: [BS + BS + "evil" + BS + "x", share + BS + "sub"],
      command: "cd " + BS + BS + "evil2" + BS + "y && cd ..\\other" });
    const low = (xs) => xs.map((x) => x.toLowerCase());
    ok(sub === "deny" && got.every((d) => d === "deny") && quiet === "silent" && low(cands).includes(share.toLowerCase()) && low(cands).includes((share + BS + "sub").toLowerCase()) &&
      !cands.some((d) => /evil/i.test(d)),
      "1.24 r6 C4: the approval hook reads the project the CLI acts on — the nearest .specs/ above a subfolder session, cd / pushd / Set-Location / Push-Location targets (walked up), SPEC_PROJECT_DIR= / export / $env:SPEC_PROJECT_DIR= in the command; the session's own network folder (and paths under its share) are candidates, a network path the agent names is not (got " +
      js([sub, got, quiet, cands]) + ")");
  }

  // C5 — the Write / Edit check reads the path as the file system does: `./`, `..`, an NTFS stream (`::$DATA`) and, on Windows, an
  // 8.3 short name (ROADMA~1.JSO) all reach .specs/roadmap.json / a .state.json.
  {
    const p = project("r6-c5", "en", { approvalGuard: "deny" }, ["Alpha"]);
    const sp = path.join(p, ".specs");
    const ed = (tool, fp) => S.approvalGuardDecision(pre(p, tool, { file_path: fp, content: "{}", old_string: "a", new_string: "b" }), "deny", { meta: {}, lang: "en" });
    const forms = [["Write", p + "/.specs/./roadmap.json", "roadmap"], ["Write", p + "/.specs/alpha/../roadmap.json", "roadmap"], ["Edit", p + "/.specs/alpha/x/../.state.json", "state"],
      ["Write", "src/../.specs/roadmap.json", "roadmap"]];
    if (WIN) forms.push(["Write", p + "/.specs/roadmap.json::$DATA", "roadmap"], ["Edit", p + "/.specs/alpha/.state.json::$DATA", "state"]);
    // (an 8.3 short name exists only where the volume generates them — tested when it does)
    const short = (dir, name, long) => { try { const f = path.join(dir, name); return path.basename(fs.realpathSync.native(f)) === long ? name : null; } catch { return null; } };
    const shortRm = WIN ? short(sp, "ROADMA~1.JSO", "roadmap.json") : null, shortSt = WIN ? short(path.join(sp, "alpha"), "STATE~1.JSO", ".state.json") : null;
    if (shortRm) forms.push(["Write", path.join(sp, shortRm), "roadmap"]);
    if (shortSt) forms.push(["Edit", path.join(sp, "alpha", shortSt), "state"]);
    const bad = forms.filter(([t, fp, s]) => { const d = ed(t, fp); return d.decision !== "deny" || d.actions[0].setting !== s; }).map(([t, fp]) => t + " " + fp);
    const hookBad = forms.filter(([t, fp]) => decisionOf(hookOut("approval-hook", pre(p, t, { file_path: fp, content: "{}", old_string: "a", new_string: "b" }), { CLAUDE_PROJECT_DIR: p })) !== "deny").map(([t, fp]) => t + " " + fp);
    const other = [ed("Write", p + "/.specs/alpha/../alpha/tasks.md").decision, ed("Write", p + "/src/.specs-notes/roadmap.json").decision];
    // the hook's reading of a path and the engine's agree
    const pairs = [p + "/.specs/./roadmap.json", "src/../.specs/x/.state.json", p + "/a.ts::$DATA", "/c/Users/x/.specs/roadmap.json"];
    const engineTargets = E.approvalEditTargets || (() => ["(none)"]);
    const agree = pairs.every((fp) => HU.editTargets(fp, p).join("|") === engineTargets(fp, p).join("|"));
    ok(!bad.length && !hookBad.length && js(other) === js(["allow", "allow"]) && agree,
      "1.24 r6 C5: a Write / Edit target is read as the file system reads it — ./, .., a relative path from cwd, an NTFS ::$DATA stream and (Windows) an 8.3 short name reach roadmap.json / .state.json (engine and hook, the same reading); other files stay allowed (wrong: " +
      js([bad, hookBad, other, agree, shortRm, shortSt]) + ")");
  }

  // E3 — turning off a track that carries a gate (+tdd: the test plan and Phase 4's failing tests; +ai: the eval plan and its harness)
  // drops that gate: spec_add_track {remove: true} / `add-track --remove` naming tdd or ai is a guard-down; the human runs the CLI line.
  {
    const mcp = (ti, level) => S.approvalGuardDecision(pre(tmp, "mcp__plugin_dev-spec-driven_spec-driven__spec_add_track", ti), level || "deny", { meta: {}, lang: "en" });
    const r1 = mcp({ name: "export", track: "tdd", remove: true });
    const r2 = mcp({ name: "export", track: "+sec +AI", remove: true });
    const allowed = [mcp({ name: "export", track: "sec", remove: true }), mcp({ name: "export", track: "tdd" }), mcp({ name: "export", track: "tdd", remove: false })].map((d) => d.decision);
    const cli = ["node cli/dev-spec.js add-track export tdd sec --remove", "node cli/dev-spec.js add-track export ai --remove=true", "node cli/dev-spec.js add-track export --tracks tdd,sec --remove"].map((c) => dec("Bash", c));
    const cliOk = ["node cli/dev-spec.js add-track export tdd", "node cli/dev-spec.js add-track export sec privacy --remove", "node cli/dev-spec.js add-track export tdd --remove=false"].map((c) => dec("Bash", c).decision);
    const ask = mcp({ name: "export", track: "tdd", remove: true }, "ask");
    const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "hooks", "hooks.json"), "utf8")).hooks;
    const ap = (cfg.PreToolUse || []).find((e) => e.hooks.some((h) => /approval-hook/.test([h.command, ...(h.args || [])].join(" "))));
    const p = project("r6-e3", "en", { approvalGuard: "deny" }, ["Export"]);
    const hk = hookOut("approval-hook", pre(p, "mcp__plugin_dev-spec-driven_spec-driven__spec_add_track", { name: "export", track: "tdd", remove: true }), { CLAUDE_PROJECT_DIR: p });
    all("1.24 r6 E3: removing +tdd / +ai (spec_add_track {remove: true}, add-track --remove / --tracks) is a guard-down with the CLI line the human runs; other tracks, adding, remove: false stay allowed; hooks.json's matcher covers spec_add_track (got " +
      js([r1.decision, r1.actions, r1.command, r2.actions, allowed, cli.map((d) => d.decision), cliOk, ask.decision, decisionOf(hk)]) + ")", [
      () => r1.decision === "deny", () => r1.actions[0].kind === "guard-down", () => r1.actions[0].setting === "track",
      () => js(r1.actions[0].tracks) === js(["tdd"]), () => r1.actions[0].feature === "export",
      () => /add-track export tdd --remove/.test(r1.command), () => /turn off \+tdd on 'export'/.test(r1.reason),
      () => js(r2.actions[0].tracks) === js(["ai"]), () => js(allowed) === js(["allow", "allow", "allow"]),
      () => cli.every((d) => d.decision === "deny" && d.actions[0].setting === "track"), () => js(cli[0].actions[0].tracks) === js(["tdd"]),
      () => js(cliOk) === js(["allow", "allow", "allow"]), () => ask.decision === "ask",
      () => new RegExp(ap.matcher).test("mcp__plugin_dev-spec-driven_spec-driven__spec_add_track"),
      () => new RegExp(ap.matcher).test("spec_add_track"), () => decisionOf(hk) === "deny",
    ]);
  }

  // C-I10 — the hook's 2 s stdin safety net fired on a partial payload: it used to exit 0 (allowed). Partial input naming dev-spec /
  // .specs / spec_approve in a guarded project → ask; anything else → silent.
  {
    const p = project("r6-ci10", "en", { approvalGuard: "deny" }, ["Alpha"]);
    const pOff = project("r6-ci10-off", "en", {}, ["Alpha"]);
    const partial = (text, cwd) => new Promise((resolve) => {
      const kid = spawn(process.execPath, [path.join(__dirname, "..", "hooks", "approval-hook.js")], { env: hookEnv(), cwd, stdio: ["pipe", "pipe", "ignore"] });
      let out = "";
      kid.stdout.on("data", (d) => (out += d));
      const t = setTimeout(() => kid.kill(), 15000);
      kid.on("exit", () => { clearTimeout(t); let j = null; try { j = out ? JSON.parse(out) : null; } catch { j = { unparsed: out }; } resolve(j); });
      kid.stdin.write(text); // never ended: the safety net fires
    });
    const head = "{\"session_id\":\"s\",\"cwd\":" + js(p) + ",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"";
    const [cut, plain, off] = await Promise.all([partial(head + "node cli/dev-spec.js approve alpha tas", p), partial(head + "npm run build && npm te", p),
      partial(head.replace(js(p), js(pOff)) + "node cli/dev-spec.js approve alpha tas", pOff)]);
    const d = (j) => (j && j.hookSpecificOutput ? j.hookSpecificOutput.permissionDecision : j ? "?" : "silent");
    ok(d(cut) === "ask" && /only in part/.test(cut.hookSpecificOutput.permissionDecisionReason) && d(plain) === "silent" && d(off) === "silent",
      "1.24 r6 C-I10: when the approval hook's stdin safety net fires on a partial payload naming dev-spec in a guarded project it asks (localized reason); a partial payload naming nothing of dev-spec's, or in a project without the guard, stays silent (got " +
      js([d(cut), d(plain), d(off)]) + ")");
  }

  // C-I8 — the edit guard's "allowed by a FORCED approval" note was printed on EVERY code edit: once per session now (session_id).
  {
    const p = project("r6-ci8", "en", { guard: true }, []);
    const f = S.createFeature(p, "Forced", ["core"], "", undefined, "en");
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Do it\n  - _Requirements: US-1.AC-1_\n");
    S.approvePhase(p, "forced", undefined, "me", { force: true, through: "tasks" });
    const sid = "r6-ci8-" + process.pid + "-" + Date.now();
    const edit = (s) => hookOut("guard-hook", { session_id: s, hook_event_name: "PreToolUse", cwd: p, tool_name: "Write", tool_input: { file_path: path.join(p, "src", "a.ts"), content: "x" } }, { CLAUDE_PROJECT_DIR: p });
    const first = edit(sid), second = edit(sid), other = edit(sid + "-b"), none = edit(undefined), none2 = edit(undefined);
    const msg = (r) => (r.json && r.json.systemMessage) || "";
    ok(/FORCED/.test(msg(first)) && second.stdout === "" && /FORCED/.test(msg(other)) && /FORCED/.test(msg(none)) && /FORCED/.test(msg(none2)),
      "1.24 r6 C-I8: the guard hook's forced-approval note is shown once per session (keyed by session_id), again in another session, and every time when the payload has no session_id (got " +
      js([msg(first).slice(0, 40), second.stdout, msg(other).slice(0, 40), msg(none).slice(0, 40)]) + ")");
    for (const s of [sid, sid + "-b"]) try { fs.unlinkSync(HU.sessionFlagFile("forced-note", s)); } catch { /* gone */ }
  }

  // C-I1 + the listing budget — the human-only commands carry `disable-model-invocation: true` (Claude Code then never runs them on
  // its own); the command descriptions are short English lines (the PT / ES tails filled Claude Code's shared skill-listing budget:
  // 15 commands were listed with no description). The MCP prompts still list every command.
  {
    const PR = require("./lib/prompts-resources.js");
    const dir = path.join(__dirname, "..", "commands");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort();
    const fm = Object.fromEntries(files.map((f) => [f.slice(0, -3), PR.parseFrontMatter(fs.readFileSync(path.join(dir, f), "utf8")).data]));
    const human = ["approve", "ds", "dss", "dsx", "spec-ff", "spec-guard", "spec-statusline", "spec-superpowers", "spec-tour"];
    const marked = Object.keys(fm).filter((n) => fm[n]["disable-model-invocation"] === "true").sort();
    const descs = Object.values(fm).map((d) => d.description || "");
    const total = descs.reduce((n, d) => n + d.length, 0);
    const long = Object.keys(fm).filter((n) => (fm[n].description || "").length > 150 || !(fm[n].description || "").length);
    const tails = Object.keys(fm).filter((n) => / PT - | ES - |Atalho|Atajo/.test(fm[n].description || ""));
    const listed = PR.listPrompts({ lang: "en" }).map((x) => x.name);
    ok(js(marked) === js(human) && !long.length && !tails.length && total <= 6000 && human.every((n) => listed.includes(n)) && listed.length === files.length,
      "1.24 r6 C-I1: approve, spec-ff, spec-guard, spec-statusline, spec-superpowers, spec-tour and the aliases ds / dss / dsx carry disable-model-invocation: true (no other command); every description is one short English line (≤ 150 chars, no PT / ES tail, " +
      total + " chars in all ≤ 6000 — Claude Code's skill-listing budget); the MCP prompts list every command (got " + js([marked, long, tails]) + ")");
  }

  // C-I9 — the aliases hand over to the full command (its file, resolved by Claude Code and by the MCP prompt alike) instead of a lossy summary.
  {
    const PR = require("./lib/prompts-resources.js");
    const target = { ds: "spec", dss: "spec-status", dsx: "executeTask" };
    const root = PR.PLUGIN_ROOT.split(path.sep).join("/");
    const bad = Object.entries(target).filter(([a, full]) => {
      const body = fs.readFileSync(path.join(__dirname, "..", "commands", a + ".md"), "utf8");
      const got = PR.getPrompt(a, "billing", { lang: "en" });
      const text = got.ok ? got.messages[0].content.text : "";
      return !body.includes("${CLAUDE_PLUGIN_ROOT}/commands/" + full + ".md") || !text.includes(root + "/commands/" + full + ".md") ||
        !fs.existsSync(path.join(PR.PLUGIN_ROOT, "commands", full + ".md")) || !/billing/.test(text);
    });
    const dsx = fs.readFileSync(path.join(__dirname, "..", "commands", "dsx.md"), "utf8");
    ok(!bad.length && /_Depends:_/.test(dsx) && /scope/i.test(dsx) && /micro-cycle|red-green/.test(dsx),
      "1.24 r6 C-I9: /ds, /dss and /dsx follow the full command's file (${CLAUDE_PLUGIN_ROOT}/commands/<full>.md — resolved in the MCP prompt too) with their arguments; /dsx still names _Depends:_, the scope guard and the micro-cycle should the file be unreadable (wrong: " + js(bad) + ")");
  }

  // 1.24 r6 I-I1: the save hook (PostToolUse) leaves a stamp instead of refreshing ROADMAP.md / SPECS.md on every Write / Edit (~75 % of
  // the hook: 272 / 423 / 725 ms a save at 10 / 50 / 150 features); the lint stays on every save. The refresh runs ONCE — at the Stop
  // hook, at SessionStart, in the next engine mutation, in the pre-commit check; the specs:// resources render in memory meanwhile.
  {
    const p = project("r6-ii1", "en", {}, ["Alpha", "Beta"]);
    const specs = path.join(p, ".specs"), a = path.join(specs, "alpha");
    S.catalog(p, { write: true }); // SPECS.md exists: every refresh refreshes it too
    const rmFile = path.join(specs, "ROADMAP.md"), catFile = path.join(specs, "SPECS.md");
    const stamp = path.join(specs, ".execution", S.ROADMAP_STALE_FILE || "roadmap-stale");
    const read = (f) => { try { return fs.readFileSync(f, "utf8"); } catch { return null; } };
    const fresh = () => read(rmFile) === S.portableCli(S.renderRoadmapMd(p, "en")) && read(catFile) === S.portableCli(S.catalog(p).markdown);
    const tasks = (done) => fs.writeFileSync(path.join(a, "tasks.md"), "# Tasks\n\n" + [1, 2, 3].map((n) => `- [${n <= done ? "x" : " "}] ${n}. Step ${n}\n  - _Requirements: US-1.AC-1_\n`).join(""));
    const save = (file) => hookOut("spec-hook", { session_id: "s", hook_event_name: "PostToolUse", cwd: p, tool_name: "Edit", tool_input: { file_path: file } }, { CLAUDE_PROJECT_DIR: p });
    const before = [read(rmFile), read(catFile)];
    tasks(1);
    const tSave = save(path.join(a, "tasks.md"));
    const linted = !!(tSave.json && tSave.json.hookSpecificOutput && tSave.json.hookSpecificOutput.additionalContext);
    const afterSave = { roadmapKept: read(rmFile) === before[0], catalogKept: read(catFile) === before[1], stamp: fs.existsSync(stamp),
      ignore: read(path.join(specs, ".execution", ".gitignore")), staleApi: S.roadmapStale(p), stale: !fresh() };
    const cSave = save(path.join(a, "classification.md")); // no lint for this file: silent now (it printed "Roadmap updated → …")
    // the resource reads the stale file? No — while the stamp is there it renders in memory
    const PR = require("./lib/prompts-resources.js");
    const res = PR.readResource(p, "specs://roadmap"), resCat = PR.readResource(p, "specs://catalog");
    const resFresh = res.ok && res.contents[0].text === S.portableCli(S.renderRoadmapMd(p, "en")) && resCat.ok && resCat.contents[0].text === S.portableCli(S.catalog(p).markdown);
    // the Stop hook (any message, even a second stop in a row) refreshes once
    const stop = hookOut("stop-hook", { session_id: "s", hook_event_name: "Stop", cwd: p, stop_hook_active: true, last_assistant_message: "Here is the layout." }, { CLAUDE_PROJECT_DIR: p });
    const afterStop = { silent: stop.stdout === "", stamp: fs.existsSync(stamp), fresh: fresh() };
    // SessionStart (a session that ended before its Stop) refreshes too
    tasks(2);
    save(path.join(a, "tasks.md"));
    const midSession = { stamp: fs.existsSync(stamp), fresh: fresh() };
    const ss = hookOut("spec-hook", { session_id: "s2", hook_event_name: "SessionStart", cwd: p }, { CLAUDE_PROJECT_DIR: p });
    const afterSession = { out: /alpha/.test(ss.stdout), stamp: fs.existsSync(stamp), fresh: fresh() };
    // the next mutation refreshes (and clears the stamp); the engine's own calls
    tasks(3);
    const marked = S.markRoadmapStale(p);
    S.backlog(p, "add", "Later");
    const afterMutation = { marked, stamp: fs.existsSync(stamp), fresh: fresh() };
    const noop = S.refreshStaleRoadmap(p);
    S.markRoadmapStale(p);
    const did = S.refreshStaleRoadmap(p);
    // the hooks stat the stamp raw, before the engine loads: the same name
    const raw = ["stop-hook.js", "precommit-check.js"].filter((h) => !fs.readFileSync(path.join(__dirname, "..", "hooks", h), "utf8").includes('"' + S.ROADMAP_STALE_FILE + '"'));
    all("1.24 r6 I-I1: a spec save lints at once and leaves the stamp .specs/.execution/roadmap-stale (git-ignored) — ROADMAP.md / SPECS.md untouched; the Stop hook, SessionStart and the next mutation refresh them once and clear it; the specs:// resources render in memory meanwhile (got " +
      js({ linted, afterSave, cSave: [cSave.status, cSave.stdout.slice(0, 60)], resFresh, afterStop, midSession, afterSession, afterMutation, noop, did, raw }) + ")", [
      () => linted, () => afterSave.roadmapKept, () => afterSave.catalogKept, () => afterSave.stamp, () => afterSave.ignore === "*\n",
      () => afterSave.staleApi === true, () => afterSave.stale, () => cSave.status === 0, () => cSave.stdout === "", () => resFresh,
      () => afterStop.silent, () => !afterStop.stamp, () => afterStop.fresh, () => midSession.stamp, () => !midSession.fresh, () => afterSession.out,
      () => !afterSession.stamp, () => afterSession.fresh, () => afterMutation.marked === true, () => !afterMutation.stamp, () => afterMutation.fresh,
      () => noop.refreshed === false, () => did.refreshed === true, () => !raw.length,
    ]);
    // the pre-commit check: a stale roadmap is refreshed, and a generated file that was staged is staged again (the commit holds the fresh one)
    if (spawnSync("git", ["--version"], { encoding: "utf8" }).status !== 0) ok(true, "1.24 r6 I-I1 pre-commit: skipped — git not available");
    else {
      const git = (...g) => spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false", ...g], { cwd: p, encoding: "utf8" });
      git("init", "-q");
      git("add", "-A");
      git("commit", "-q", "-m", "init");
      tasks(2);
      S.backlog(p, "add", "Someday"); // a mutation: ROADMAP.md refreshed — the user stages it
      git("add", ".specs/ROADMAP.md");
      tasks(1);
      save(path.join(a, "tasks.md")); // a hand edit: stamped, ROADMAP.md (staged) is now one edit behind
      git("add", ".specs/alpha/tasks.md");
      const staleStaged = git("show", ":.specs/ROADMAP.md").stdout === read(rmFile);
      spawnSync(process.execPath, [path.join(__dirname, "..", "hooks", "precommit-check.js")], { cwd: p, encoding: "utf8", env: hookEnv() });
      const staged = git("show", ":.specs/ROADMAP.md").stdout;
      const names = git("diff", "--cached", "--name-only").stdout.split(/\r?\n/).filter(Boolean);
      ok(staleStaged && !fs.existsSync(stamp) && fresh() && staged === read(rmFile) && !names.includes(".specs/SPECS.md"),
        "1.24 r6 I-I1: the pre-commit check refreshes a stale roadmap and stages a generated file again only when it was staged (got " +
        js({ staleStaged, stamp: fs.existsSync(stamp), fresh: fresh(), stagedFresh: staged === read(rmFile), names }) + ")");
    }
  }

  // 1.24 r6 I-I4: the Stop hook's claim pre-filter — a message holding no claim pattern of any language (in its prose, as the engine
  // reads it) ends the hook before the engine loads (~100 ms at the end of a turn). The build writes the patterns and the prose
  // regexes into hooks/stop-claims.generated.json, stamped with the version and its sources' sizes; a missing or stale file → the
  // engine decides, as before.
  {
    const filterFile = path.join(__dirname, "..", "hooks", "stop-claims.generated.json");
    let f = null;
    try { f = JSON.parse(fs.readFileSync(filterFile, "utf8")); } catch { /* none yet */ }
    // (a) the hook's prose is the engine's, and no message the engine reads as a claim is filtered out — handwritten and generated
    const hand = ["All done — every task is complete and the tests pass.", "Here is a summary of the layout.", "Task 3 is done.", "Feito. Todos os testes passam.",
      "A tarefa 2 está concluída.", "Listo, todas las pruebas pasan.", "Hecho.", "**Status:** `DONE`", "`all tests pass`\nI ran it.", "```\nall tests pass\n```\nok",
      "> Done — all tests pass", "<!-- done -->ok", "x\r\nDone.\r\n", "~~~\nDone\n~~~\nDone", "Should I mark task 3 done?", "Not verified yet.", "✅ Done", "Done" + "x".repeat(25000),
      "```\n" + "a".repeat(30000) + "\n```\nAll tests pass.", "<!--" + "<!--".repeat(500) + " done", "`".repeat(3000) + "\nImplemented."];
    let seed = 7;
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    const frags = ["All done", "done", "Feito", "concluída", "Listo", "terminado", "tests pass", "Task 2 is complete", "verified", "implemented", "not", "?", ".", " ",
      "\n", "\r\n", "```", "~~~", "`", "<!--", "-->", "> ", "**", "Status: ", "DONE", "✅", "everything works", "x", "I've finished", "a tarefa 1 está feita", "y"];
    const gen = [];
    for (let i = 0; i < 2500; i++) { let m = ""; const n = 1 + Math.floor(rnd() * 12); for (let k = 0; k < n; k++) m += frags[Math.floor(rnd() * frags.length)] + (rnd() < 0.5 ? " " : ""); gen.push(m); }
    const msgs = hand.concat(gen);
    const proseDiff = f ? msgs.filter((m) => HU.claimProse(m, f.prose) !== E.stopProse(m)) : ["no filter file"];
    const missed = f ? msgs.filter((m) => E.stopClaims(m).claim && !HU.claimMatch(m, f)) : ["no filter file"];
    const filtered = f ? msgs.filter((m) => !HU.claimMatch(m, f)).length : 0;
    const fresh = (() => { try { return require("../scripts/build.js").buildStopClaims(E) === fs.readFileSync(filterFile, "utf8").replace(/\r\n/g, "\n"); } catch { return false; } })();
    ok(!proseDiff.length && !missed.length && filtered > 100 && fresh && f && js(f.claims) === js(E.stopClaimSources()),
      "1.24 r6 I-I4: the Stop hook's pre-filter reads the message's prose exactly as the engine does and lets through every message the engine reads as a claim (" +
      msgs.length + " messages, " + filtered + " sent away); hooks/stop-claims.generated.json is the build's (got " + js({ proseDiff: proseDiff.slice(0, 3), missed: missed.slice(0, 3), filtered, fresh }) + ")");

    // (b) the hook: no claim → silent without the engine; a claim → the engine's block. A copy of the clone whose filter is missing,
    // of another version or stamped with another source size → the engine decides (loaded) — the same answers.
    const probe = path.join(tmp, "r6-ii4-probe.js"), out = path.join(tmp, "r6-ii4-probe.out");
    fs.writeFileSync(probe, "process.on('exit', () => require('fs').writeFileSync(" + js(out) + ", String(Object.keys(require.cache).some((k) => /[\\\\/]mcp[\\\\/]lib[\\\\/]spec\\.js$/.test(k)))));\n");
    const p = project("r6-ii4", "en", {}, ["Alpha"]);
    fs.writeFileSync(path.join(p, ".specs", "alpha", "tasks.md"), "# Tasks\n\n- [x] 1. Build it\n  - _Requirements: US-1.AC-1_\n  - _Verify: `npm test`_\n");
    S.recordSpecEdit(p, "alpha"); // ticked by hand just now, no evidence: a claim is sent back
    const stopAt = (hooksDir, message) => {
      try { fs.unlinkSync(out); } catch { /* none */ }
      const r = spawnSync(process.execPath, ["-r", probe, path.join(hooksDir, "stop-hook.js")], { encoding: "utf8", env: hookEnv(), timeout: 30000,
        input: js({ session_id: "s", cwd: p, hook_event_name: "Stop", stop_hook_active: false, last_assistant_message: message }) });
      let block = false; try { block = JSON.parse(r.stdout).decision === "block"; } catch { /* silent */ }
      return (block ? "block" : r.stdout === "" ? "silent" : "?") + "/" + (fs.existsSync(out) ? fs.readFileSync(out, "utf8") : "?");
    };
    const realHooks = path.join(__dirname, "..", "hooks");
    const real = [stopAt(realHooks, "Here is a summary of the layout."), stopAt(realHooks, "All done — the tests pass.")];
    const clone = path.join(tmp, "r6-ii4-clone");
    fs.mkdirSync(path.join(clone, "mcp"), { recursive: true });
    fs.cpSync(realHooks, path.join(clone, "hooks"), { recursive: true });
    fs.cpSync(path.join(__dirname, "lib"), path.join(clone, "mcp", "lib"), { recursive: true, filter: (src) => path.basename(src) !== "spec.bundle.js" });
    fs.copyFileSync(path.join(__dirname, "..", "package.json"), path.join(clone, "package.json"));
    const cf = path.join(clone, "hooks", "stop-claims.generated.json"), cfText = fs.readFileSync(cf, "utf8");
    const variants = {};
    variants.copy = [stopAt(path.join(clone, "hooks"), "Here is a summary of the layout.")];
    fs.writeFileSync(cf, cfText.replace(/"version": "[^"]+"/, "\"version\": \"0.0.1\""));
    variants.version = [stopAt(path.join(clone, "hooks"), "Here is a summary of the layout."), stopAt(path.join(clone, "hooks"), "All done — the tests pass.")];
    fs.writeFileSync(cf, cfText);
    fs.appendFileSync(path.join(clone, "mcp", "lib", "engine", "guards.js"), "// edited\n");
    variants.size = [stopAt(path.join(clone, "hooks"), "Here is a summary of the layout."), stopAt(path.join(clone, "hooks"), "All done — the tests pass.")];
    fs.rmSync(cf);
    variants.missing = [stopAt(path.join(clone, "hooks"), "Here is a summary of the layout."), stopAt(path.join(clone, "hooks"), "All done — the tests pass.")];
    ok(js(real) === js(["silent/false", "block/true"]) && js(variants.copy) === js(["silent/false"]) &&
      ["version", "size", "missing"].every((k) => js(variants[k]) === js(["silent/true", "block/true"])),
      "1.24 r6 I-I4: the Stop hook sends a message with no claim away before the engine loads, and blocks a claim as the engine does; a copy of the clone reads its own filter; a filter of another version, stamped with another source size or missing → the engine decides, with the same answers (got " +
      js({ real, variants }) + ")");
  }

  // 1.24 r6 I2: the observe hook walked up only 12 folders from the payload cwd to the nearest .specs/ (the guard and stop hooks, the
  // approval hook's candidates and the engine's sessionProject: 40) — a _Verify:_ run 13+ levels below a nested project, with
  // CLAUDE_PROJECT_DIR the outer repository, was never logged as observed. Every hook's walk is SESSION_MAX_UP now.
  {
    const outer = path.join(tmp, "r6-i2-outer");
    const proj = path.join(outer, "services", "billing");
    fs.mkdirSync(proj, { recursive: true });
    S.initProject(proj, ["core"], "en");
    const f = S.createFeature(proj, "Probe", ["core"], "", undefined, "en");
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. Do it\n  - _Verify: `node --version`_\n");
    const log = path.join(f.dir, ".execution", "observed.jsonl");
    const runAt = (depth) => {
      let cwd = proj;
      for (let i = 0; i < depth; i++) cwd = path.join(cwd, "d" + i);
      fs.mkdirSync(cwd, { recursive: true });
      fs.rmSync(log, { force: true });
      hookOut("observe-hook", { session_id: "s", hook_event_name: "PostToolUse", tool_name: "Bash", cwd, tool_input: { command: "node --version" },
        tool_response: { stdout: "v24", exit_code: 0 } }, { CLAUDE_PROJECT_DIR: outer });
      return fs.existsSync(log);
    };
    const logged = [5, 12, 13, 20].map(runAt);
    const src = (h) => fs.readFileSync(path.join(__dirname, "..", "hooks", h), "utf8");
    const bounds = { guard: /for \(let i = 0; i < (\d+); i\+\+\)/.exec(src("guard-hook.js")), stop: /for \(let i = 0; i < (\d+); i\+\+\) \{\s*if \(isDevSpecProject/.exec(src("stop-hook.js")),
      observe: /const MAX_UP = (\d+);/.exec(src("observe-hook.js")), utils: /const MAX_UP = (\d+);/.exec(src("hook-utils.js")) };
    const nums = Object.fromEntries(Object.entries(bounds).map(([k, m]) => [k, m ? Number(m[1]) : null]));
    ok(js(logged) === js([true, true, true, true]) && Object.values(nums).every((n) => n === E.SESSION_MAX_UP),
      "1.24 r6 I2: the observe hook finds the project from a cwd 13 and 20 levels below it (it stopped at 12) — every hook walks up SESSION_MAX_UP (" + E.SESSION_MAX_UP + ") folders (got " +
      js({ logged, nums }) + ")");
  }
};
