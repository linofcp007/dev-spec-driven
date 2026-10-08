"use strict";
// Guards and hooks — 1.23 review 5: the approval guard's tools and forms (Monitor, Write / Edit of the state files, launchers, fail closed), the edit guard's paths, worktree-aware hooks, the subagent gates' reports.
// (10-guards.js holds the area's earlier tests, 10-guards-review.js the 1.22 review's; this file the findings of review 5.)

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = async ({ ok, S, tmp, __dirname, require }) => {
  const E = require("./lib/engine/index.js"); // engine internals (the lexer, the candidates) — read through mcp/test.js's require
  const js = JSON.stringify;
  const BS = String.fromCharCode(92);
  const hookOut = (name, payload, env) => {
    const r = spawnSync(process.execPath, [path.join(__dirname, "..", "hooks", name + ".js")], { input: typeof payload === "string" ? payload : js(payload),
      encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: "", SPEC_PROJECT_DIR: "", ...(env || {}) }, timeout: 20000 });
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
    const ap = (cfg.PreToolUse || []).find((e) => e.hooks.some((h) => /approval-hook/.test(h.command)));
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
  {
    const src = fs.readFileSync(path.join(__dirname, "..", "hooks", "approval-hook.js"), "utf8");
    const enc = Buffer.from("node cli/dev-spec.js approve a b", "utf16le").toString("base64");
    const texts = ["node cli/dev-spec.js approve a b", "node (\"cli/dev\" + \"-spec.js\") approve a b", "node cli/dev-sp?c.js approve a b", "ls *.md",
      "npm test", "powershell -enc " + enc, "cat .specs/x", "echo hello"];
    const hookCand = new Function("const RE_CANDIDATE = /dev-?spec|\\.specs/i;\n" + (/const RE_VERB = [^\n]+\n/.exec(src) || [""])[0] +
      (/const candidate = \(c\) => \{[\s\S]*?\n\};/.exec(src) || ["const candidate = () => null;"])[0] + "\nreturn candidate;")();
    const bad = texts.filter((t) => E.approvalCandidate(t) && !hookCand(t));
    ok(!bad.length && hookCand("ls *.md") === false && E.approvalCandidate("powershell -enc " + enc) === true,
      "1.23 review 5: the approval hook's pre-check lets through every command the engine's approvalCandidate would read (joined strings, globs with an approval word, -EncodedCommand) (missed: " + js(bad) + ")");
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
    if (!hasGit) ok(true, "1.23 review 5 (M8): worktree-aware hooks — skipped: no git");
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
      const pre = (cwd, fp) => ({ session_id: "s", hook_event_name: "PreToolUse", cwd, tool_name: "Edit", tool_input: { file_path: fp, old_string: "a", new_string: "b" } });
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
};
