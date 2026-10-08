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
};
