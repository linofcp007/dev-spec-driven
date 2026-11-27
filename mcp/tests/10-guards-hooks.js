"use strict";
// Guards and hooks — the approval guard's tools and forms (Monitor, Write / Edit of the state files, launchers, fail closed), the edit guard's paths, worktree-aware hooks, the subagent gates' reports.
// (10-guards.js holds the area's main tests, 10-guards-stop-gate.js the stop gate's.)

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = async ({ ok, skip, all, S, tmp, hookIn, __dirname, require }) => {
  const E = require("./lib/engine/index.js"); // engine internals (the lexer, the candidates) — read through mcp/test.js's require
  const js = JSON.stringify;
  const BS = String.fromCharCode(92);
  // the hook's decision in this process (harness hookIn, review 8)
  const hookOut = (name, payload, env) => {
    const r = hookIn(path.join(__dirname, "..", "hooks", name + ".js"), { input: typeof payload === "string" ? payload : js(payload),
      env: { ...process.env, CLAUDE_PROJECT_DIR: "", SPEC_PROJECT_DIR: "", ...(env || {}) } });
    let j = null;
    try { j = r.stdout ? JSON.parse(r.stdout) : null; } catch { j = { unparsed: r.stdout }; }
    return { status: r.status, json: j, stdout: r.stdout, stderr: r.stderr };
  };
  const decisionOf = (r) => (r.json && r.json.hookSpecificOutput ? r.json.hookSpecificOutput.permissionDecision : r.json ? "?" : "silent");

  // P4 — the Monitor tool runs a shell command with the Bash permission rules: `node cli/dev-spec.js approve …` through it went past a
  // deny-level approval guard (hooks.json's matcher left it out, and the engine read only Bash / PowerShell).
  {
    const p = path.join(tmp, "r5-p4-monitor");
    S.initProject(p, ["core"], "en", { approvalGuard: "deny" });
    const pre = (tool, command) => ({ session_id: "s", hook_event_name: "PreToolUse", cwd: p, tool_name: tool, tool_input: { command, description: "watch" } });
    const eng = S.approvalGuardDecision(pre("Monitor", "node cli/dev-spec.js approve alpha tasks"), "deny", { meta: {} });
    const hk = hookOut("approval-hook", pre("Monitor", "node cli/dev-spec.js approve alpha tasks"));
    const tail = hookOut("approval-hook", pre("Monitor", "tail -f build.log"));
    const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "hooks", "hooks.json"), "utf8")).hooks;
    const ap = (cfg.PreToolUse || []).find((e) => e.hooks.some((h) => /approval-hook/.test([h.command, ...(h.args || [])].join(" "))));
    ok(eng.decision === "deny" && eng.actions[0].kind === "approve" && decisionOf(hk) === "deny" && tail.stdout === "" && tail.status === 0 &&
      new RegExp(ap.matcher).test("Monitor") && E.APPROVAL_SHELL_TOOLS.has("Monitor"),
      "1.23 review 5 (P4): an approval run through the Monitor tool is refused at deny (engine and hook, bash syntax); a Monitor command that runs no approval stays silent; hooks.json's matcher covers Monitor (got " +
      js([eng.decision, decisionOf(hk), tail.stdout, ap.matcher]) + ")");
  }

  // L20 — forms the lexer missed at deny: cmd //c (Git Bash), cmd.exe through $env:ComSpec / %ComSpec%, more launchers, a POSIX -c
  // script with its positional parameters, powershell -EncodedCommand, the CLI fed to node on stdin, a glob naming the script, trap.
  {
    const A = "cli/dev-spec.js approve alpha tasks";
    const dec = (tool, command, level) => S.approvalGuardDecision({ hook_event_name: "PreToolUse", tool_name: tool, tool_input: { command } }, level || "deny", { meta: {} });
    const enc = (s) => Buffer.from(s, "utf16le").toString("base64");
    const denied = [
      ["Bash", "cmd //c node cli" + BS + "dev-spec.js approve alpha tasks"], ["PowerShell", "& $env:ComSpec /c \"node cli" + BS + "dev-spec.js approve alpha tasks\""],
      ["Bash", "%ComSpec% /c node cli" + BS + "dev-spec.js approve alpha tasks"],
      ["Bash", "strace -f node " + A], ["Bash", "strace -o /tmp/t.log node " + A], ["Bash", "unbuffer node " + A], ["Bash", "chronic node " + A],
      ["Bash", "builtin command node " + A], ["Bash", "coproc node " + A], ["Bash", "tsx " + A], ["Bash", "ts-node " + A],
      ["Bash", "nodemon --exec node " + A], ["Bash", "parallel node cli/dev-spec.js approve ::: alpha ::: tasks"],
      ["Bash", "sh -c 'node \"$0\" approve alpha tasks' cli/dev-spec.js"], ["Bash", "bash -c 'node cli/dev-spec.js \"$@\"' _ approve alpha tasks"],
      ["Bash", "powershell -enc " + enc("node " + A)], ["PowerShell", "pwsh -NoProfile -EncodedCommand " + enc("node " + A)],
      ["Bash", "cat cli/dev-spec.js | node - approve alpha tasks"], ["Bash", "node - approve alpha tasks < cli/dev-spec.js"],
      ["Bash", "node cli/dev-sp?c.js approve alpha tasks"], ["Bash", "node cli/dev-spe*.js approve alpha tasks"], ["Bash", "node cli/[d]ev-spec.js approve alpha tasks"],
      ["Bash", "trap 'node " + A + "' EXIT"],
    ];
    const allowed = [["Bash", "cmd //c node cli" + BS + "dev-spec.js status alpha"], ["Bash", "strace -f node cli/dev-spec.js next alpha"],
      ["Bash", "sh -c 'node \"$0\" status' cli/dev-spec.js"], ["Bash", "powershell -enc " + enc("Get-ChildItem")], ["Bash", "cat cli/dev-spec.js | node - status"],
      ["Bash", "ls *.md"], ["Bash", "git add * && git commit -m \"approve the design\""], ["Bash", "node < cli/dev-spec.js"]];
    const wrong = denied.filter(([t, c]) => dec(t, c).decision !== "deny").map(([t, c]) => "not denied: " + t + " " + c)
      .concat(allowed.filter(([t, c]) => dec(t, c).decision !== "allow").map(([t, c]) => "not allowed: " + t + " " + c));
    const sh = dec("Bash", "sh -c 'node \"$0\" approve alpha tasks --force' cli/dev-spec.js");
    ok(!wrong.length && sh.actions[0].feature === "alpha" && sh.actions[0].phase === "tasks" && sh.force === true && E.devSpecGlob("dev-sp?c.js") && !E.devSpecGlob("*.md") &&
      !E.devSpecGlob("dev-spec.js"),
      "1.23 review 5 (L20): cmd //c, $env:ComSpec / %ComSpec%, strace / unbuffer / chronic / builtin / coproc / tsx / ts-node / nodemon --exec / parallel, sh -c '…$0…' cli/dev-spec.js, bash -c '…\"$@\"', powershell -enc / -EncodedCommand, cat … | node -, node - … < cli/dev-spec.js, a glob naming the script and trap '…' are refused at deny; their status / next twins and plain globs stay allowed (wrong: " +
      js(wrong) + ")");
  }

  // L20 — a command past the 64 KB read limit: an approval after it went through at deny. The unread tail naming dev-spec is refused
  // (localized "too long to read"); a long command whose tail names nothing of dev-spec's is read as before (its head).
  {
    const p = path.join(tmp, "r5-l20-long");
    S.initProject(p, ["core"], "pt", { approvalGuard: "deny" });
    const pad = "#" + "x".repeat(70 * 1024);
    const long = "true " + pad + "\nnode cli/dev-spec.js approve alpha tasks";
    const d = S.approvalGuardDecision({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: long } }, "deny", { lang: "pt", meta: {} });
    const dEs = S.approvalGuardDecision({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: long } }, "ask", { lang: "es", meta: {} });
    const hk = hookOut("approval-hook", { session_id: "s", hook_event_name: "PreToolUse", cwd: p, tool_name: "Bash", tool_input: { command: long } });
    const echo = S.approvalGuardDecision({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "echo dev-spec " + "a ".repeat(400000) } }, "deny", { meta: {} });
    const headApprove = S.approvalGuardDecision({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "node cli/dev-spec.js approve a b; echo " + "z".repeat(70 * 1024) } }, "deny", { meta: {} });
    ok(d.decision === "deny" && d.actions[0].kind === "unreadable" && d.actions[0].why === "too-long" && /demasiado longo/.test(d.reason) && d.command === null &&
      dEs.decision === "ask" && /demasiado largo/.test(dEs.reason) && decisionOf(hk) === "deny" && /demasiado longo/.test(hk.json.hookSpecificOutput.permissionDecisionReason) &&
      echo.decision === "allow" && headApprove.decision === "deny" && headApprove.actions[0].kind === "approve",
      "1.23 review 5 (L20): a command over 64 KB whose unread tail names dev-spec is refused at deny / asked at ask with a localized 'too long to read' reason and no command to suggest (engine and hook); a long echo is read as before, and an approval in the head is still one (got " +
      js([d.decision, d.actions, dEs.decision, decisionOf(hk), echo.decision, headApprove.decision]) + ")");
  }

  // Fail closed — the CLI named with an approval word in a form the lexer can't follow (a joined string, a variable, a substitution,
  // an unknown launcher, an alias, a script given the CLI as its arguments) asks the user at either level — never allowed, never refused.
  {
    const dec = (tool, command, level) => S.approvalGuardDecision({ hook_event_name: "PreToolUse", tool_name: tool, tool_input: { command } }, level || "deny", { meta: {}, lang: "en" });
    const asked = [["PowerShell", "node (\"cli/dev\" + \"-spec.js\") approve alpha tasks"], ["PowerShell", "$p = 'cli/dev-spec.js'; node $p approve alpha tasks"],
      ["Bash", "node $(echo cli/dev-spec.js) approve alpha tasks"], ["Bash", "node `echo cli/dev-spec.js` approve alpha tasks"],
      ["Bash", "alias a='node cli/dev-spec.js'; a approve alpha tasks"], ["Bash", "foo-runner node cli/dev-spec.js approve alpha tasks"],
      ["Bash", "pwsh -File run.ps1 node cli/dev-spec.js approve alpha tasks"]];
    const allowed = [["Bash", "echo dev-spec approve x"], ["Bash", "git commit -m \"dev-spec approve flow\""], ["Bash", "grep -rn \"dev-spec.js approve\" ."],
      ["PowerShell", "Write-Host 'dev-spec approve'"], ["Bash", "cat <<'EOF'\nnode cli/dev-spec.js approve alpha tasks\nEOF"], ["Bash", "node cli/dev-spec.js approve alpha tasks --help"],
      ["Bash", "node cli/dev-spec.js feature remove alpha"], ["Bash", "cat .specs/a/tasks.md | grep approve"], ["Bash", "ls dev-spec-approve/"]];
    const wrong = asked.filter(([t, c]) => dec(t, c).decision !== "ask" || dec(t, c, "ask").decision !== "ask").map(([t, c]) => "not asked: " + t + " " + c)
      .concat(allowed.filter(([t, c]) => dec(t, c).decision !== "allow").map(([t, c]) => "not allowed: " + t + " " + c));
    const one = dec("PowerShell", "$p = 'cli/dev-spec.js'; node $p approve alpha tasks");
    ok(!wrong.length && one.actions[0].kind === "unreadable" && one.actions[0].why === "unparsed" && one.command === null && /in a form the approval guard can't read/.test(one.reason) && !one.userNote,
      "1.23 review 5 (fail closed): the CLI named with an approval word where the lexer finds no action (a joined string, a variable, a substitution, an unknown launcher, an alias, pwsh -File) asks at ask AND deny, with a localized reason and no command; echo / git / grep / a heredoc / the CLI's help or preview stay allowed (wrong: " +
      js(wrong) + ")");
  }

  // Improvement — a hand edit of the approvals: Write / Edit of .specs/<f>/.state.json or .specs/roadmap.json is a guard-down action (ask /
  // deny per meta.approvalGuard, the reason localized; the project the file lives in is the one read). Other files stay silent.
  {
    const p = path.join(tmp, "r5-edit-state");
    S.initProject(p, ["core"], "es", { approvalGuard: "deny" });
    S.createFeature(p, "Pagos", ["core"]);
    const pAsk = path.join(tmp, "r5-edit-state-ask");
    S.initProject(pAsk, ["core"], "en", { approvalGuard: "ask" });
    const pre = (cwd, tool, file) => ({ session_id: "s", hook_event_name: "PreToolUse", cwd, tool_name: tool, tool_input: { file_path: file, content: "{}" } });
    const st = hookOut("approval-hook", pre(p, "Edit", path.join(p, ".specs", "pagos", ".state.json")));
    const rm = hookOut("approval-hook", pre(p, "Write", path.join(p, ".specs", "roadmap.json")));
    const other = hookOut("approval-hook", pre(p, "Write", path.join(p, ".specs", "pagos", "tasks.md")));
    const code = hookOut("approval-hook", pre(p, "Write", path.join(p, "src", ".state.json")));
    // the file's own project is read even when the session's cwd is elsewhere
    const named = hookOut("approval-hook", pre(tmp, "Write", path.join(pAsk, ".specs", "roadmap.json")));
    const off = hookOut("approval-hook", pre(tmp, "Write", path.join(tmp, "r5-none", ".specs", "x", ".state.json")));
    const multi = S.approvalGuardDecision(pre(p, "MultiEdit", path.join(p, ".specs", "pagos", ".state.json")), "deny", { meta: {}, lang: "pt" });
    ok(decisionOf(st) === "deny" && /editar a mano el \.state\.json de 'pagos'/.test(st.json.hookSpecificOutput.permissionDecisionReason) &&
      decisionOf(rm) === "deny" && /editar a mano \.specs\/roadmap\.json/.test(rm.json.hookSpecificOutput.permissionDecisionReason) &&
      other.stdout === "" && code.stdout === "" && decisionOf(named) === "ask" && /edit \.specs\/roadmap\.json by hand/.test(named.json.hookSpecificOutput.permissionDecisionReason) &&
      off.stdout === "" && multi.decision === "deny" && /editar à mão o \.state\.json de 'pagos'/.test(multi.reason) && multi.command === null,
      "1.23 review 5: a Write / Edit (MultiEdit in the engine) of a feature's .state.json or of .specs/roadmap.json is refused at deny / asked at ask, localized (ES / EN / PT), the edited file's project read; tasks.md, a .state.json outside .specs/ and a project without the guard stay silent (got " +
      js([decisionOf(st), decisionOf(rm), other.stdout, code.stdout, decisionOf(named), off.stdout, multi.decision]) + ")");
  }

  // The hook's pre-check and the engine's approvalCandidate agree (the hook's is a superset: an encoded-looking pwsh call goes on).
  // (review 8: ONE test — the probe's approvalMayBe — no copy of its patterns in the hook; the hook exports its candidate.)
  {
    const src = fs.readFileSync(path.join(__dirname, "..", "hooks", "approval-hook.js"), "utf8");
    const hookCand = require("../hooks/approval-hook.js").candidate;
    const enc = Buffer.from("node cli/dev-spec.js approve a b", "utf16le").toString("base64");
    const texts = ["node cli/dev-spec.js approve a b", "node (\"cli/dev\" + \"-spec.js\") approve a b", "node cli/dev-sp?c.js approve a b", "ls *.md",
      "npm test", "powershell -enc " + enc, "cat .specs/x", "echo hello", "cp /tmp/x.json .s*/roadmap.jso?", "x=.spec?/roadmap.json", "Remove-Item * -Recurse",
      "echo " + "=.".repeat(50) + " {; cp a .s*/b"];
    const bad = texts.filter((t) => E.approvalCandidate(t) && !hookCand(t));
    all("1.23 review 5 / review 8: the approval hook's pre-check lets through every command the engine's approvalCandidate would read (joined strings, globs with an approval word, a dot-led glob, -EncodedCommand) — the probe's one test, no copy of its patterns in the hook", {
      missed: () => !bad.length, plainLs: () => hookCand("ls *.md") === false, encoded: () => E.approvalCandidate("powershell -enc " + enc) === true,
      dotGlob: () => E.approvalCandidate("cp /tmp/x.json .s*/roadmap.jso?") === true && E.approvalCandidate("x=.spec?/roadmap.json") === true,
      noCopy: () => !/const RE_(?:CANDIDATE|VERB|DOT_GLOB|WRITE_WORD) =/.test(src) && /approvalMayBe\(/.test(src),
    });
  }

  // L21 — the edit guard's target as the Windows file system reads it: an NTFS stream suffix (`a.ts::$DATA` IS a.ts) and Git Bash's
  // `/c/…` were read as no code / outside the project and allowed. Elsewhere ':' is a name character and /c/ a folder.
  {
    const T = E.guardTargetPath;
    const unit = [T("C:/p/src/a.ts::$DATA", true), T("C:/p/src/a.ts:x", true), T("C:" + BS + "p" + BS + "a.ts:x:$DATA", true), T("/c/Users/p/a.ts", true), T("/c", true),
      T("C:a.ts", true), T("C:a.ts:s", true), T("//host/share/a.ts", true), T("C:/p/src/a.ts", true), T("/c/Users/p/a.ts", false), T("src/a.ts:x", false)];
    const want = ["C:/p/src/a.ts", "C:/p/src/a.ts", "C:" + BS + "p" + BS + "a.ts", "C:/Users/p/a.ts", "C:/", "C:a.ts", "C:a.ts", "//host/share/a.ts", "C:/p/src/a.ts",
      "/c/Users/p/a.ts", "src/a.ts:x"];
    let hookOk = true, hookGot = "posix";
    if (process.platform === "win32") {
      const p = path.join(tmp, "r5-l21-guard");
      S.initProject(p, ["core"], "en", { guard: true });
      S.createFeature(p, "Billing", ["core"]);
      const pre = (fp) => ({ session_id: "s", hook_event_name: "PreToolUse", cwd: p, tool_name: "Write", tool_input: { file_path: fp, content: "x" } });
      const msys = "/" + p[0].toLowerCase() + p.slice(2).split(BS).join("/") + "/src/a.ts";
      hookGot = [decisionOf(hookOut("guard-hook", pre(path.join(p, "src", "a.ts::$DATA")))), decisionOf(hookOut("guard-hook", pre(msys))),
        S.guardCheck(p, path.join(p, "src", "a.ts:extra")).decision];
      hookOk = hookGot.every((d) => d === "ask");
    }
    ok(js(unit) === js(want) && hookOk,
      "1.23 review 5 (L21): guardTargetPath drops an NTFS stream suffix and maps Git Bash's /c/… on Windows (a drive-relative C:a.ts keeps its drive; //host untouched; nothing changes elsewhere) — the guard hook asks for `src/a.ts::$DATA` and `/c/…/src/a.ts` (got " +
      js([unit, hookGot]) + ")");
  }

  // M8 — worktrees. The MCP server records in the checkout Claude Code started in (CLAUDE_PROJECT_DIR); the hooks read the payload's
  // cwd first — in a git worktree its own copy of .specs/. sessionProject maps it (an anchor's checkout of the same repository, else
  // the main checkout) for the guard, the stop gate, the spec-hook's stamp, the observe hook and the status line; the subagent gates
  // read the report at the absolute path the reply names when it lies in the project or another checkout of its repository.
  {
    const hasGit = spawnSync("git", ["--version"], { encoding: "utf8" }).status === 0;
    if (!hasGit) skip("1.23 review 5 (M8): worktree-aware hooks", "no git");
    else {
      const p = path.join(tmp, "r5-m8-main");
      S.initProject(p, ["core"], "en", { guard: true });
      const f = S.createFeature(p, "Auth", ["core"], "", undefined, "en");
      fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n## Story US1\n\n- [ ] 1. [US1] Login\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/login.ts_\n  - _Verify: node --test tests" + BS + "login.test.js_\n- [ ] 2. [US1] Docs\n  - _Requirements: US-1.AC-1_\n");
      const git = (args, cwd) => spawnSync("git", args, { cwd: cwd || p, encoding: "utf8" });
      git(["init", "-q"]); git(["config", "user.email", "t@example.com"]); git(["config", "user.name", "t"]); git(["config", "core.autocrlf", "false"]);
      git(["add", "-A"]); git(["commit", "-qm", "init"]);
      const wt = path.join(p, ".claude", "worktrees", "w1");
      const sib = path.join(tmp, "r5-m8-sibling");
      git(["worktree", "add", "-q", wt, "-b", "w1"]); git(["worktree", "add", "-q", sib, "-b", "sib"]);
      const made = fs.existsSync(path.join(wt, ".specs", "roadmap.json")) && fs.existsSync(path.join(sib, ".specs", "roadmap.json"));
      // the resolver itself
      const sIn = S.sessionProject({ cwd: path.join(wt, "src"), anchors: [p] });
      const sSib = S.sessionProject({ cwd: sib, anchors: [] }); // no anchor: the main checkout
      const sMain = S.sessionProject({ cwd: path.join(p, "src", "deep"), anchors: [p] }); // a cd'd subfolder walks up
      const other = path.join(tmp, "r5-m8-other");
      S.initProject(other, ["core"], "en");
      const sOther = S.sessionProject({ cwd: other, anchors: [p] }); // an unrelated project stays itself
      // (one folder, however spelled: tmp may be an 8.3 short name while git writes the worktree's gitdir with the long one)
      const real = (x) => { try { const r = fs.realpathSync.native(x); return process.platform === "win32" ? r.toLowerCase() : r; } catch { return x; } };
      const same = (a, b) => !!a && !!b && real(a) === real(b);
      const p2 = path.join(p, "src");
      fs.mkdirSync(path.join(p2, "deep"), { recursive: true });
      fs.mkdirSync(path.join(wt, "src"), { recursive: true });
      const resolver = made && same(sIn.project, p) && same(sIn.root, wt) && sIn.worktree && same(sSib.project, p) && same(sSib.root, sib) && same(sMain.project, p) &&
        !sMain.worktree && same(sOther.project, other) && !sOther.worktree && same(path.dirname(S.sessionPath(sIn, path.join(wt, "src", "login.ts"), wt)), p2);
      // the edit guard: tasks approved in the main checkout (forced — the gates' checks aside) cover an edit made in the worktree
      S.approvePhase(p, "auth", undefined, "me", { force: true, through: "tasks" });
      // its own session id, its once-a-session marker (1.24 C-I8, in the OS temp folder) cleared first: a previous run of the
      // suite — or 10-guards.js, running in parallel with session "s" — would otherwise have shown the FORCED note already
      try { fs.unlinkSync(require("../hooks/hook-utils.js").sessionFlagFile("forced-note", "s-m8")); } catch { /* none */ }
      const pre = (cwd, fp) => ({ session_id: "s-m8", hook_event_name: "PreToolUse", cwd, tool_name: "Edit", tool_input: { file_path: fp, old_string: "a", new_string: "b" } });
      const gWt = hookOut("guard-hook", pre(wt, path.join(wt, "src", "login.ts")), { CLAUDE_PROJECT_DIR: p });
      const gSib = hookOut("guard-hook", pre(sib, path.join(sib, "src", "login.ts")), {});
      const guardOk = decisionOf(gWt) !== "ask" && /FORCED/.test((gWt.json || {}).systemMessage || "") && decisionOf(gSib) !== "ask";
      // the stop gate: a tick without evidence in the main checkout is seen from a worktree session
      S.completeTask(p, "auth", 1);
      const stopP = (cwd, extra) => ({ session_id: "s", hook_event_name: "Stop", cwd, stop_hook_active: false, last_assistant_message: "All tasks done — everything verified.", ...(extra || {}) });
      const stWt = hookOut("stop-hook", stopP(wt), { CLAUDE_PROJECT_DIR: p });
      const stSib = hookOut("stop-hook", stopP(sib), {});
      const stopOk = stWt.json && stWt.json.decision === "block" && /auth: #1/.test(stWt.json.reason) && stSib.json && stSib.json.decision === "block";
      // the implementer's report: written in the main checkout (the protocol), in a sibling worktree (named absolute), or outside the repo
      const ex = path.join(f.dir, ".execution");
      fs.mkdirSync(ex, { recursive: true });
      const good = "# Task 1\n## Verification evidence\n- `node --test tests/login.test.js` → exit code 0\n";
      fs.writeFileSync(path.join(ex, "task-1-report.md"), good);
      const sub = (cwd, reply) => ({ session_id: "s", hook_event_name: "SubagentStop", cwd, agent_type: "dev-spec-driven:spec-implementer", stop_hook_active: false, last_assistant_message: reply });
      const replyMain = "**Status:** DONE\nCommits: abc123\nReport: " + path.join(ex, "task-1-report.md");
      const subWt = hookOut("stop-hook", sub(wt, replyMain), { CLAUDE_PROJECT_DIR: p });
      fs.rmSync(path.join(ex, "task-1-report.md"));
      const sibEx = path.join(sib, ".specs", "auth", ".execution");
      fs.mkdirSync(sibEx, { recursive: true });
      fs.writeFileSync(path.join(sibEx, "task-1-report.md"), good);
      const sibReply = "**Status:** DONE\nReport: " + path.join(sibEx, "task-1-report.md");
      const fromSib = S.stopCheck(p, { message: sibReply, agent: "spec-implementer" });
      const outEx = path.join(other, ".specs", "auth", ".execution");
      fs.mkdirSync(outEx, { recursive: true });
      fs.writeFileSync(path.join(outEx, "task-1-report.md"), good);
      const fromOut = S.stopCheck(p, { message: "**Status:** DONE\nReport: " + path.join(outEx, "task-1-report.md"), agent: "spec-implementer" });
      const subOk = subWt.stdout === "" && subWt.status === 0 && fromSib.why === "report-ok" && fromOut.why === "implementer-evidence" && /does not exist/.test(fromOut.reason);
      // the spec-hook: a tasks.md saved in the worktree stamps lastEditAt in the main checkout's state
      const before = (JSON.parse(fs.readFileSync(path.join(f.dir, ".state.json"), "utf8")).lastEditAt) || null;
      hookOut("spec-hook", { session_id: "s", hook_event_name: "PostToolUse", cwd: wt, tool_name: "Edit", tool_input: { file_path: path.join(wt, ".specs", "auth", "tasks.md") } }, { CLAUDE_PROJECT_DIR: p });
      const after = JSON.parse(fs.readFileSync(path.join(f.dir, ".state.json"), "utf8")).lastEditAt || null;
      const stampOk = !!after && after !== before;
      // the status line: Claude Code's payload from a worktree (current_dir) shows the main checkout's feature
      const sl = S.statusLineProject([wt, path.join(wt, "src"), p]);
      const slSib = S.statusLineProject([sib]);
      const slOk = same(sl, p) && same(slSib, p);
      ok(resolver && guardOk && stopOk && subOk && stampOk && slOk,
        "1.23 review 5 (M8): sessionProject maps a worktree (inside the project or beside it, with or without CLAUDE_PROJECT_DIR) to the checkout the MCP server writes in, walks up from a cd'd subfolder, leaves an unrelated project alone; the guard covers a worktree edit with the main checkout's approval, the stop gate sees its ticks, the implementer's report is read where the reply names it (the main checkout, a sibling worktree — never another repository), a worktree tasks.md save stamps the main state, the status line shows the main checkout (got " +
        js([made, resolver, sIn, sSib.project === p, guardOk, decisionOf(gWt), decisionOf(gSib), stopOk, subWt.stdout.slice(0, 120), fromSib.why, fromOut.why, stampOk, sl, slSib]) + ")");
    }
  }

  // M16 + L8 — the subagent gates read a report's runs with the evidence gate's matcher (a `\` vs `/`, quotes), and a UTF-16 report.
  {
    const p = path.join(tmp, "r5-m16-report");
    S.initProject(p, ["core"], "en", { checks: { lint: "node scripts" + BS + "lint.js" } });
    const f = S.createFeature(p, "Auth", ["core"], "", undefined, "en");
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "- [ ] 1. [US1] Login\n  - _Verify: node --test tests" + BS + "login.test.js_\n");
    const ex = path.join(f.dir, ".execution");
    fs.mkdirSync(ex, { recursive: true });
    const rep = path.join(ex, "task-1-report.md");
    const reply = "**Status:** DONE\nReport: .specs/auth/.execution/task-1-report.md";
    const im = (text, enc) => { fs.writeFileSync(rep, enc ? enc(text) : text); return S.stopCheck(p, { message: reply, agent: "spec-implementer" }).why; };
    const utf16le = (t) => Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(t, "utf16le")]);
    const utf16be = (t) => { const b = Buffer.from(t, "utf16le"); b.swap16(); return Buffer.concat([Buffer.from([0xfe, 0xff]), b]); };
    const slash = im("# Task 1\n- `node --test tests/login.test.js` → exit 0\n");
    const quoted = im("# Task 1\n- `node --test \"tests/login.test.js\"` → exit code 0\n");
    const other = im("# Task 1\n- `node --test tests/other.test.js` → exit 0\n");
    const le = im("# Task 1\r\n- `node --test tests/login.test.js` → exit 0\r\n", utf16le);
    const be = im("# Task 1\n- `node --test tests/login.test.js` → exit 0\n", utf16be);
    const leRed = im("# Task 1\n- `node --test tests/login.test.js` → exit code 1\n", utf16le);
    // the simplifier: its check `node scripts\lint.js` run as `node scripts/lint.js`; a longer command is still another run; a big UTF-16 report read from its end
    const srep = path.join(ex, "simplify-report.md");
    const sReply = "**Status:** DONE\nReport: .specs/auth/.execution/simplify-report.md";
    const si = (text, enc) => { fs.writeFileSync(srep, enc ? enc(text) : text); return S.stopCheck(p, { message: sReply, agent: "spec-simplifier" }).why; };
    const sSlash = si("## Final runs\n- `node scripts/lint.js` → exit 0\n");
    const sLonger = si("## Final runs\n- `node scripts/lint.js --fix` → exit 0\n");
    const pad = "## Changes\n" + "- refactor: line\n".repeat(12000); // ~200 KB of text → ~400 KB in UTF-16: the tail window starts inside it
    const sBig = si(pad + "## Final runs\n- `node scripts/lint.js` → exit 0\n", utf16le);
    const sBigOdd = (() => { fs.writeFileSync(srep, Buffer.concat([utf16le(pad + "## Final runs\n- `node scripts/lint.js` → exit 0\n"), Buffer.from([0x0a])])); return S.stopCheck(p, { message: sReply, agent: "spec-simplifier" }).why; })();
    const readBack = E.readStopReport(srep, true);
    ok(slash === "report-ok" && quoted === "report-ok" && other === "implementer-evidence" && le === "report-ok" && be === "report-ok" && leRed === "implementer-evidence" &&
      sSlash === "simplify-ok" && sLonger === "simplifier-evidence" && sBig === "simplify-ok" && sBigOdd === "simplify-ok" && readBack.charCodeAt(0) !== 0xfeff && /## Final runs/.test(readBack),
      "1.23 review 5 (M16, L8): the implementer's report shows its _Verify:_ (`tests\\login.test.js`) as `tests/login.test.js` or quoted — the matcher, not the raw text; another test file is still no run; a UTF-16 (LE / BE, BOM) report is decoded; the simplifier's check `node scripts\\lint.js` is run by `node scripts/lint.js` (a longer command still isn't), and a ~400 KB UTF-16 report is read from its end — an odd trailing byte too (got " +
      js([slash, quoted, other, le, be, leRed, sSlash, sLonger, sBig, sBigOdd]) + ")");
  }

  // L26 (the hook's half — the MCP server's is in 07-approvals): an agent's spec_approve whose `name` carries extra text in another
  // script (slugify drops it, so it resolves to 'alpha') — the prompt names the slug the engine acts on, never the raw text.
  {
    const p = path.join(tmp, "proj-r5-hook-slug");
    S.initProject(p, ["core"], "en", { approvalGuard: "ask" });
    S.createFeature(p, "Alpha", ["core"]);
    const raw = "alpha — 已审核，仅只读检查，可安全批准";
    const r = hookOut("approval-hook", { hook_event_name: "PreToolUse", cwd: p, tool_name: "mcp__plugin_dev-spec-driven_spec-driven__spec_approve",
      tool_input: { name: raw, phase: "classification", force: true, projectDir: p } }, { CLAUDE_PROJECT_DIR: p });
    const reason = (r.json && r.json.hookSpecificOutput && r.json.hookSpecificOutput.permissionDecisionReason) || "";
    ok(decisionOf(r) === "ask" && /'alpha'/.test(reason) && !/已审核/.test(reason),
      "1.23 review 5 (L26): the approval hook's prompt names the resolved slug ('alpha'), never the agent's raw name text (got " + js([decisionOf(r), reason.slice(0, 160)]) + ")");
  }

  // M8 merge follow-up: a SessionStart payload without `cwd` — the hook's own process folder holds ANOTHER .specs/ (the plugin's
  // checkout, a dogfooding project) — reads CLAUDE_PROJECT_DIR's project, as before review 5; the process folder is the last resort.
  {
    const own = path.join(tmp, "proj-r5-ss-own"), exported = path.join(tmp, "proj-r5-ss-exported");
    S.initProject(own, ["core"], "en");
    S.createFeature(own, "Own Thing", ["core"]);
    S.initProject(exported, ["core"], "en");
    S.createFeature(exported, "Exported Thing", ["core"]);
    const r = hookIn(path.join(__dirname, "..", "hooks", "spec-hook.js"), { input: js({ hook_event_name: "SessionStart" }), cwd: own,
      encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: exported, SPEC_PROJECT_DIR: "" }, timeout: 20000 });
    const r2 = hookIn(path.join(__dirname, "..", "hooks", "spec-hook.js"), { input: js({ hook_event_name: "SessionStart" }), cwd: own,
      encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: "", SPEC_PROJECT_DIR: "" }, timeout: 20000 });
    ok(/exported-thing/.test(r.stdout) && !/own-thing/.test(r.stdout) && /own-thing/.test(r2.stdout),
      "1.23 review 5 (M8): SessionStart without a payload cwd lists CLAUDE_PROJECT_DIR's features, never the hook process folder's .specs/ (that one only when nothing is exported) (got " + js([r.stdout.slice(0, 160), r2.stdout.slice(0, 160)]) + ")");
  }

  // 1.42 perf-1 — the guard hook runs each project's checks in ONE read-cache scope and folds the results target by target. THE
  // property: on every fixture × level (on / scope / tests) × command, the hook prints exactly what the 1.41.2 loop printed — a
  // REFERENCE written here from it: target by target, the session's project then the file's own, one guardCheck call each (its own
  // scope), the strictest wins (deny > a protected test's ask > any ask), the first among equals, the first note. The commands: the
  // review's legit commands and the monorepo / CI corpus (mcp/tests/guard-commands.js), the controller's package and detector writes
  // ([INT-3]: allowed at every level), and edits real-shaped for the fixtures — covering, forced, pending, stale, a spike, a test plan,
  // protected tests with a lift, a folder of code, a glob at level tests, an outside path, README.md, a monorepo whose package is a
  // project of its own (one that asks, one forced-only).
  {
    const CMD = require("./tests/guard-commands.js");
    const PR = require("./lib/probe.js");
    const guardJs = path.join(__dirname, "..", "hooks", "guard-hook.js");
    const HOOK = require(guardJs);
    const put = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
    const state = (dir, slug, patch) => { const sp = path.join(dir, ".specs", slug, ".state.json"); const st = JSON.parse(fs.readFileSync(sp, "utf8")); fs.writeFileSync(sp, js({ ...st, ...patch }, null, 2)); };
    const AT = "2026-01-01T00:00:00Z";
    const feature = (dir, name, impl, approvals, extra) => {
      const f = S.createFeature(dir, { name, tracks: ["core"], lang: "en", ...(extra || {}) });
      put(f.dir, "tasks.md", "# Tasks\n\n" + impl.map((x, i) => "- [ ] " + (i + 1) + ". [US1] Do " + x + "\n  - _Requirements: US-1.AC-1_\n  - _Implements: " + x + "_\n").join(""));
      if (approvals) state(dir, f.slug, { approvals });
      return f.slug;
    };
    const project = (name, guard) => { const d = path.join(tmp, "proj-perf1-" + name); S.initProject(d, ["core"], "en", { guard }); fs.writeFileSync(path.join(d, ".specs", "ROADMAP.md"), "# Roadmap\n\nHand-written.\n"); return d; };
    const setLevel = (dir, guard, approvalGuard = "off") => { const f = path.join(dir, ".specs", "roadmap.json"); const rm = JSON.parse(fs.readFileSync(f, "utf8")); rm.meta = { ...(rm.meta || {}), guard, approvalGuard }; fs.writeFileSync(f, js(rm, null, 2)); };
    // P1: one project with every kind of feature
    const P1 = project("one", "scope");
    for (const f of ["src/pay/a.js", "src/pay/b.js", "src/lib/u.js", "src/gen/x.js", "src/other.js", "test/pay.test.js", "test/old.test.js", "test/lifted.test.js", "test/unit/a.test.js", "tmpl.js"]) put(P1, f, "x\n");
    const co = feature(P1, "Checkout", ["src/pay/a.js", "src/pay/b.js", "src/lib/", "src/gen/*.js", "test/pay.test.js"], { tasks: { at: AT, by: "t" } });
    state(P1, co, { protectedTests: { at: AT, via: "approval", files: { "test/pay.test.js": "0123456789abcdef", "test/old.test.js": "0123456789abcdef", "test/lifted.test.js": "0123456789abcdef", "test/unit/a.test.js": "0123456789abcdef" },
      lifts: [{ file: "test/lifted.test.js", at: AT, by: "me", reason: "rewritten on purpose" }] } });
    feature(P1, "Invoices", ["src/invoices/pdf.js"], { tasks: { at: AT, by: "t", forced: true } });
    feature(P1, "Draft", ["src/draft/x.js"], null);
    feature(P1, "Stale", ["src/stale/y.js"], { tasks: { at: AT, by: "t", fingerprint: "0000000000000000" } });
    feature(P1, "Plan", ["src/plan/z.js"], { "test-plan": { at: AT, by: "t" } });
    S.createFeature(P1, { name: "Research", kind: "spike", lang: "en" });
    // P2: a monorepo — the root at the level, packages/app a project of its own (guard on) whose feature waits for its tasks approval
    const P2 = project("mono", "scope");
    feature(P2, "Web", ["packages/app/src/t1.js", "src/root.js"], { tasks: { at: AT, by: "t" } });
    const P2app = path.join(P2, "packages", "app");
    fs.mkdirSync(P2app, { recursive: true });
    S.initProject(P2app, ["core"], "en", { guard: "on" });
    feature(P2app, "App", ["src/t1.js"], null);
    // P3: the same layout, both projects forced-only (two notes: the first is printed)
    const P3 = project("mono-forced", "scope");
    feature(P3, "Web", ["packages/app/src/t1.js", "src/t2.js"], { tasks: { at: AT, by: "t", forced: true } });
    const P3app = path.join(P3, "packages", "app");
    fs.mkdirSync(P3app, { recursive: true });
    S.initProject(P3app, ["core"], "en", { guard: "on" });
    feature(P3app, "App", ["src/t1.js"], { tasks: { at: AT, by: "t", forced: true } });
    const W = (dir, rel) => ["Write", null, path.isAbsolute(rel) ? rel : path.join(dir, rel)];
    const EDITS1 = [["Bash", "sed -i 's/a/b/' src/pay/a.js src/pay/b.js src/lib/u.js src/gen/x.js src/other.js"], ["Bash", "rm -rf src/lib"],
      ["Bash", "cp tmpl.js src/invoices/pdf.js && cp tmpl.js src/draft/x.js"], ["Bash", "echo x > test/old.test.js"],
      ["Bash", "sed -i s/x/y/ src/other.js test/old.test.js test/pay.test.js test/lifted.test.js"], ["Bash", "rm -rf tes?/unit"],
      ["PowerShell", "Set-Content -Path src" + BS + "pay" + BS + "a.js -Value x; Copy-Item tmpl.js src" + BS + "stale" + BS + "y.js"],
      W(P1, "src/pay/a.js"), W(P1, "src/other.js"), W(P1, "README.md"), W(P1, ".specs/checkout/tasks.md"), W(P1, "test/old.test.js"), W(P1, "test/lifted.test.js"),
      W(P1, path.join(tmp, "perf1-outside", "x.js"))];
    const N4 = ["Bash", "sed -i 's/a/b/' packages/app/src/t1.js src/t2.js"], N5 = ["Bash", "sed -i 's/a/b/' packages/app/src/t1.js"];
    const EDITS2 = [N4, ["Bash", "sed -i s/a/b/ src/root.js packages/app/src/t1.js"], W(P2, "packages/app/src/t1.js")];
    const EDITS3 = [N5, ["Bash", "sed -i 's/a/b/' src/t2.js packages/app/src/t1.js"]];
    const payload = (dir, [tool, command, file]) => ({ hook_event_name: "PreToolUse", cwd: dir, tool_name: tool, tool_input: command !== null ? { command } : { file_path: file, content: "x" } });
    // THE reference: the 1.41.2 loop over single guardCheck calls (each the facade's own read-cache scope)
    const rank = (r) => (r.decision === "deny" ? 3 : r.decision === "ask" ? (r.why === "protected-test" ? 2 : 1) : 0);
    const reference = (pl) => {
      const ti = pl.tool_input, cwd = pl.cwd;
      const command = pl.tool_name === "Bash" || pl.tool_name === "PowerShell" ? ti.command : null;
      if (command !== null && !HOOK.mayWrite(command)) return null;
      const local = (p) => typeof p === "string" && p.trim() && !PR.isNetwork(p);
      const targets = command === null ? [ti.file_path] : S.shellWriteTargets(command, pl.tool_name === "PowerShell" ? "ps" : "bash");
      const s0 = S.sessionProject({ cwd, anchors: [] });
      let best = null, note = null;
      for (const t of targets) {
        const abs = local(t) ? S.sessionPath(s0 || { root: cwd }, t, cwd) : null;
        const own = abs ? S.sessionProject({ cwd: path.dirname(abs), anchors: [] }) : null;
        const seen = new Set();
        for (const s of [s0, own]) {
          if (!s || seen.has(s.project)) continue;
          seen.add(s.project);
          const r = S.guardCheck(s.project, S.sessionPath(s, t, cwd), s.project);
          if (rank(r) > (best ? rank(best) : 0)) best = r;
          if (r.note && !note) note = r.note;
        }
      }
      if (best) return Object.assign({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: best.decision, permissionDecisionReason: best.reason } }, best.userNote ? { systemMessage: best.userNote } : {});
      return note ? { systemMessage: note } : null;
    };
    const hooked = (pl) => { const r = hookIn(guardJs, { input: js(pl), env: { ...process.env, CLAUDE_PROJECT_DIR: "", SPEC_PROJECT_DIR: "", DEV_SPEC_GUARD_DEFAULT: "" }, encoding: "utf8" }); try { return r.stdout ? JSON.parse(r.stdout) : null; } catch { return { unparsed: r.stdout }; } };
    const legitMono = Object.values(CMD.legitMonorepo()).map(([tool, command]) => [tool, command]);
    const RUNS = [[P1, [...CMD.LEGIT_REVIEW, ...CMD.controllerWrites("checkout", 3), ...EDITS1]], [P2, [...legitMono, ...EDITS2]], [P3, EDITS3]];
    const differ = [], seenAnswers = new Map(), ctrl = [];
    let compared = 0;
    // (tests + approvalGuard deny: a protected test is refused — the strictest answer)
    for (const level of [true, "scope", "tests", "tests+deny"]) {
      for (const d of [P1, P2, P3]) setLevel(d, level === "tests+deny" ? "tests" : level, level === "tests+deny" ? "deny" : "off");
      for (const [dir, cmds] of RUNS) {
        for (const c of cmds) {
          const pl = payload(dir, c);
          const got = hooked(pl), want = reference(pl);
          compared++;
          const key = got ? (got.hookSpecificOutput ? got.hookSpecificOutput.permissionDecision + (/protected/.test(js(got)) ? "-protected" : "") : "note") : "silent";
          seenAnswers.set(key, (seenAnswers.get(key) || 0) + 1);
          if (js(got) !== js(want)) differ.push(String(level) + " " + path.basename(dir) + " " + c[0] + " " + String(c[1] || c[2]).slice(0, 80) + " → " + js(got).slice(0, 160) + " ≠ " + js(want).slice(0, 160));
          if (CMD.controllerWrites("checkout", 3).some((w) => w[1] === c[1])) ctrl.push(got);
        }
      }
    }
    // the fold's order and its notes, named: own's ask on t1 before s0's on t2 (both plain asks — the first among equals), the first note
    setLevel(P2, "scope"); setLevel(P3, "scope");
    const n4 = hooked(payload(P2, N4)), n5 = hooked(payload(P3, N5));
    all("1.42 perf-1: the guard hook (one read-cache scope per project, folded target by target) prints exactly what the 1.41.2 loop over single guardCheck calls printed — " +
      "every fixture × level (on / scope / tests / tests at approvalGuard deny) × command, the legit corpora and the controller's writes allowed (got " + js({ compared, answers: Object.fromEntries(seenAnswers), differ: differ.slice(0, 6), more: Math.max(0, differ.length - 6),
        n4: n4 && n4.hookSpecificOutput && n4.hookSpecificOutput.permissionDecisionReason.slice(0, 120), n5: n5 && n5.systemMessage && n5.systemMessage.slice(0, 120) }) + ")", {
      "the same printed object everywhere": () => compared >= 360 && differ.length === 0,
      "not vacuous: silent, notes, plain asks, protected-test asks and denies all met": () => ["silent", "ask", "note", "ask-protected", "deny-protected"].every((k) => (seenAnswers.get(k) || 0) > 0),
      "[INT-3] the controller's package and detector writes: allowed at every level": () => ctrl.length === 28 && ctrl.every((x) => x === null),
      "the fold's order: own's ask on t1 (packages/app awaits its tasks approval) before the root's scope ask on t2": () => !!n4 && n4.hookSpecificOutput.permissionDecision === "ask" && /\bapp\b/.test(n4.hookSpecificOutput.permissionDecisionReason) &&
        js(n4) === js(reference(payload(P2, N4))),
      "the first note: the root's forced note before the package's": () => !!n5 && typeof n5.systemMessage === "string" && /\bweb\b/.test(n5.systemMessage) && !/\bapp\b/.test(n5.systemMessage) && js(n5) === js(reference(payload(P3, N5))),
    });
  }

  // 1.42 S9-c — the plugin agents' cost, Claude Code's side: on SubagentStop the observe hook reads the finished agent's OWN transcript
  // (agent_transcript_path — never the parent session's transcript_path; a regular file only; bounded) and hands its COUNTS to
  // spec.recordAgentRun (.specs/.execution/agents.jsonl). Real-shaped JSONL — the structure of 4,440 local dev-spec agent transcripts,
  // synthetic text: one line per content block, each repeating its message's usage (output_tokens growing within an id), tool_result
  // lines between, a line without a timestamp, a fallback model, and an API error Claude Code wrote itself last (<synthetic>,
  // isApiErrorMessage). (The FIFO rows — POSIX — are in 10-guards-hooks-cost.js; the matcher's property in 09-evidence-agents.js.)
  {
    const OH = require("../hooks/observe-hook.js");
    const tdir = path.join(tmp, "s9c-transcripts");
    fs.mkdirSync(tdir, { recursive: true });
    let seq = 0;
    const stamp = () => "2026-11-20T10:" + String(10 + (seq % 50)).padStart(2, "0") + ":0" + (seq % 10) + ".000Z";
    const env0 = () => ({ isSidechain: true, agentId: "a91f2c3d4e5b6a7c8", cwd: "/work/app", sessionId: "6f1c2a3b-0d4e-4f5a-9b6c-7d8e9f0a1b2c", version: "2.1.300", gitBranch: "main", userType: "external", entrypoint: "cli" });
    const user = (content) => js({ parentUuid: seq ? "x-" + seq : null, ...env0(), type: "user", message: { role: "user", content }, uuid: "u-" + ++seq, timestamp: stamp() });
    const result = (id) => user([{ tool_use_id: id, type: "tool_result", content: "     1\tconst total = 1; // ação concluída ✓ — 価格\n" }]);
    const asst = (id, block, [i, o, cr, cw], model, extra) => js({ parentUuid: "x-" + seq, ...env0(), message: { model: model || "claude-opus-4-5", id, type: "message", role: "assistant",
      content: [block], stop_reason: null, stop_sequence: null, usage: { input_tokens: i, cache_creation_input_tokens: cw, cache_read_input_tokens: cr, output_tokens: o, service_tier: "standard" } },
      requestId: "req_011" + id.slice(-6), type: "assistant", uuid: "a-" + ++seq, timestamp: stamp(), ...(extra || {}) });
    const call = (name) => ({ type: "tool_use", id: "toolu_01" + String(++seq).padStart(6, "0"), name, input: { file_path: "/work/app/src/total.js" } });
    const synthetic = () => js({ parentUuid: "x-" + seq, ...env0(), type: "assistant", uuid: "a-" + ++seq, timestamp: stamp(), message: { id: "0b7c2e9a-41d3-4c5e-8f6a-9b0c1d2e3f4a", container: null,
      model: "<synthetic>", role: "assistant", stop_reason: "stop_sequence", stop_sequence: "", type: "message", usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0, server_tool_use: { web_search_requests: 0 }, service_tier: null }, content: [{ type: "text", text: "API Error: 529 Overloaded" }] }, error: "unknown", isApiErrorMessage: true });
    const write = (name, lines) => { const f = path.join(tdir, name); fs.writeFileSync(f, lines.length ? lines.join("\n") + "\n" : ""); return f; };
    const t1Calls = [call("Read"), call("Grep"), call("Read")];
    const T1 = write("agent-a91f2c3d4e5b6a7c8.jsonl", [
      user("Review task 3 of the billing feature — the package is .specs/billing/.execution/review-3.md. Ação: ler o diff ✓"),
      js({ type: "attachment", attachment: { type: "skill_listing", content: "" }, uuid: "t-0", isSidechain: true }), // a line with no timestamp
      asst("msg_01AAAAAAAAAAAAAAAAAAAAAA", { type: "thinking", thinking: "Reading the diff first.", signature: "c2ln" }, [3, 8, 12000, 4000]),
      asst("msg_01AAAAAAAAAAAAAAAAAAAAAA", t1Calls[0], [3, 210, 12000, 4000]), // the same message, its output_tokens grown
      result(t1Calls[0].id),
      asst("msg_01BBBBBBBBBBBBBBBBBBBBBB", t1Calls[1], [1, 95, 16000, 900]),
      asst("msg_01BBBBBBBBBBBBBBBBBBBBBB", t1Calls[2], [1, 95, 16000, 900]), // two tool calls in one message: two lines
      result(t1Calls[1].id), result(t1Calls[2].id),
      asst("msg_01DDDDDDDDDDDDDDDDDDDDDD", { type: "text", text: "Checking the totals — ação ✓" }, [9, 20, 5000, 100]), // (per field the max: input
      asst("msg_01DDDDDDDDDDDDDDDDDDDDDD", { type: "text", text: "and the rounding." }, [4, 60, 5000, 100]), //  larger first, output last)
      asst("msg_01CCCCCCCCCCCCCCCCCCCCCC", { type: "text", text: "**Status:** DONE — no finding. Relatório ✓" }, [2, 400, 17000, 300], "claude-sonnet-4-5"), // a fallback model
      synthetic(),
    ]);
    const WANT1 = { turns: 4, tools: 3, tokens: { in: 15, out: 765, cacheRead: 50000, cacheWrite: 5300 }, model: "claude-sonnet-4-5", truncated: false };
    const r1 = OH.agentRunOf(T1);
    const chunks = [1, 2, 7, 64, 4096].map((chunk) => js(OH.agentRunOf(T1, { chunk })));
    // the bound — a COUNT of bytes: 400 dispatch-shaped messages (~230 KB) read with a 64 KB max
    const big = write("agent-b00000000000000001.jsonl", Array.from({ length: 400 }, (_, k) => asst("msg_01" + String(k).padStart(22, "E"), call("Read"), [2, 150, 20000 + k, 500])));
    const bigSize = fs.statSync(big).size;
    const cut = OH.agentRunOf(big, { max: 64 * 1024 }), whole = OH.agentRunOf(big);
    all("1.42 S9-c: the SubagentStop reader (observe-hook agentRunOf) counts a transcript's assistant lines — turns the distinct message ids, tokens per id the per-field MAX of its lines (a grown output_tokens, never the first line nor a sum) summed, tool calls per LINE, the last model; an API error Claude Code wrote itself (<synthetic>, isApiErrorMessage) neither a turn nor the model; every chunk size the same (a line carried across a chunk's end); bounded by max — a COUNT of the bytes read, `truncated` past it (got " +
      js({ r1, chunks: [...new Set(chunks)].length, cut, whole: whole && { ...whole, size: bigSize }, max: OH.TRANSCRIPT_MAX }) + ")", {
      "the counts": () => !!r1 && js({ turns: r1.turns, tools: r1.tools, tokens: r1.tokens, model: r1.model, truncated: r1.truncated }) === js(WANT1) && r1.read === fs.statSync(T1).size,
      "every chunk size the same counts": () => chunks.every((c) => c === js(r1)),
      "past max: the bytes read stop there, truncated, a lower bound": () => !!cut && cut.read <= 64 * 1024 && cut.read > 32 * 1024 && cut.truncated === true && cut.turns > 0 && cut.turns < 400,
      "within the default bound: the whole file": () => !!whole && whole.read === bigSize && whole.truncated === false && whole.turns === 400 && whole.tools === 400 && bigSize > 128 * 1024,
      "the default bound: 32 MB (the largest local dev-spec agent transcript: 26.8 MB)": () => OH.TRANSCRIPT_MAX === 32 * 1024 * 1024,
    });

    // decide: one record per dispatch in the session's project; never the parent's transcript; the id the transcript's name, always
    const p = path.join(tmp, "s9c-proj");
    S.initProject(p, ["core"], "en");
    const PARENT = write("6f1c2a3b-0d4e-4f5a-9b6c-7d8e9f0a1b2c.jsonl", [user("Plan the billing feature"), ...Array.from({ length: 6 }, (_, k) => asst("msg_01" + String(k).padStart(22, "P"), call("Bash"), [5, 300, 40000, 2000]))]);
    const EMPTY = write("agent-e00000000000000001.jsonl", []);
    const USERS = write("agent-e00000000000000002.jsonl", [user("Review task 1"), result("toolu_01000001")]);
    const FOLDER = path.join(tdir, "agent-e00000000000000003.jsonl");
    fs.mkdirSync(FOLDER, { recursive: true });
    const logOf = (d) => path.join(d, ".specs", ".execution", "agents.jsonl");
    const lines = (d) => { try { return fs.readFileSync(logOf(d), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };
    const sub = (over, cwd) => { const pl = { session_id: "6f1c2a3b-0d4e-4f5a-9b6c-7d8e9f0a1b2c", transcript_path: PARENT, cwd: cwd || p, permission_mode: "default", hook_event_name: "SubagentStop",
      stop_hook_active: false, agent_type: "dev-spec-driven:spec-reviewer", agent_transcript_path: T1, last_assistant_message: "**Status:** DONE — no finding.", ...(over || {}) };
      for (const k of Object.keys(pl)) if (pl[k] === undefined) delete pl[k];
      return hookOut("observe-hook", pl); };
    const runs = {
      own: sub(), withAgentId: sub({ agent_id: "a91f2c3d4e5b6a7c8" }), writer: sub({ agent_type: "spec-writer" }), general: sub({ agent_type: "general-purpose" }),
      noType: sub({ agent_type: undefined }), parentOnly: sub({ agent_transcript_path: undefined }), blank: sub({ agent_transcript_path: "  " }), empty: sub({ agent_transcript_path: EMPTY }),
      usersOnly: sub({ agent_transcript_path: USERS }), missing: sub({ agent_transcript_path: path.join(tdir, "agent-e00000000000000009.jsonl") }), folder: sub({ agent_transcript_path: FOLDER }),
    };
    const plain = path.join(tmp, "s9c-plain");
    fs.mkdirSync(plain, { recursive: true });
    runs.noProject = sub({}, plain);
    const got = lines(p);
    const WANT_LINE = { agent: "spec-reviewer", id: "agent-a91f2c3d4e5b6a7c8", model: "claude-sonnet-4-5", turns: 4, tools: 3, tokens: WANT1.tokens, truncated: false };
    all("1.42 S9-c: on SubagentStop the observe hook records ONE line of the agent's own counts — never from transcript_path (the parent session's, also when it is the only path), the id the transcript's name with or without an agent_id (one dispatch), nothing for another agent, a payload without agent_type, an empty / user-only / missing / folder transcript or a folder with no dev-spec project; silent, exit 0 (got " +
      js({ got, costs: S.agentCosts(p), out: Object.fromEntries(Object.entries(runs).filter(([, r]) => r.status !== 0 || r.stdout !== "").map(([k, r]) => [k, r.stdout.slice(0, 80)])) }) + ")", {
      "the agent's own counts, the plugin prefix dropped, the id its transcript's name": () => got.length >= 1 && js(got[0]) === js(WANT_LINE),
      "with an agent_id: the same id — one dispatch": () => got.length === 2 && js(got[1]) === js(WANT_LINE) && S.agentCosts(p).dispatches === 1,
      "nothing else recorded (another agent, no agent_type, the parent's path alone, no readable turn, no project)": () => got.length === 2 && !fs.existsSync(path.join(plain, ".specs")),
      "silent, exit 0, every run": () => Object.values(runs).every((r) => r.status === 0 && r.stdout === ""),
    });
    // a transcript path that is a LINK (to a real transcript) is no file (lstat first — openRegular alone would follow it)
    const LINKED = path.join(tdir, "agent-l00000000000000001.jsonl");
    let linked = false;
    try { fs.symlinkSync(T1, LINKED, "file"); linked = fs.lstatSync(LINKED).isSymbolicLink(); } catch { linked = false; }
    if (!linked) skip("1.42 S9-c: a linked transcript is no file", "file links not creatable here");
    else {
      const before = lines(p).length;
      const r = sub({ agent_transcript_path: LINKED });
      ok(OH.agentRunOf(LINKED) === null && r.stdout === "" && lines(p).length === before,
        "1.42 S9-c: a transcript path that is a LINK (to a real transcript) is no regular file — nothing read, nothing recorded (got " + js({ run: OH.agentRunOf(LINKED), n: lines(p).length - before }) + ")");
    }

    // the project: the session's — a git worktree's copy maps to the main checkout (spec.sessionProject), never the first raw candidate
    const hasGit = spawnSync("git", ["--version"], { encoding: "utf8" }).status === 0;
    if (!hasGit) skip("1.42 S9-c: a worktree session records in the main checkout", "no git");
    else {
      const m = path.join(tmp, "s9c-main");
      S.initProject(m, ["core"], "en");
      const git = (args, cwd) => spawnSync("git", args, { cwd: cwd || m, encoding: "utf8" });
      git(["init", "-q"]); git(["config", "user.email", "t@example.com"]); git(["config", "user.name", "t"]); git(["config", "core.autocrlf", "false"]);
      git(["add", "-A"]); git(["commit", "-qm", "init"]);
      const wt = path.join(m, ".claude", "worktrees", "w1");
      git(["worktree", "add", "-q", wt, "-b", "w1"]);
      const made = fs.existsSync(path.join(wt, ".specs", "roadmap.json"));
      sub({}, wt); // no anchor: the linked worktree → its main checkout
      hookOut("observe-hook", { session_id: "s", hook_event_name: "SubagentStop", cwd: wt, agent_type: "spec-implementer", agent_transcript_path: big }, { CLAUDE_PROJECT_DIR: m });
      const inMain = lines(m), inWt = lines(wt);
      all("1.42 S9-c: a dispatch whose session runs in a git worktree is recorded in the main checkout (where the MCP server records), never in the worktree's copy of .specs/ — with and without CLAUDE_PROJECT_DIR (got " +
        js({ made, inMain: inMain.map((x) => x.agent + "/" + x.id), inWt: inWt.length }) + ")", {
        made: () => made,
        "both in the main checkout": () => js(inMain.map((x) => x.agent + "/" + x.id)) === js(["spec-reviewer/agent-a91f2c3d4e5b6a7c8", "spec-implementer/agent-b00000000000000001"]),
        "none in the worktree": () => inWt.length === 0,
      });
    }
  }
};
