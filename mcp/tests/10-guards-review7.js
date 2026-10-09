"use strict";
// Guards and hooks — 1.25.1 review 7: one reader of shell file operations (fed scripts, globbed / variable targets, links), MCP file tools, the shared projectDir parser, fail closed, the edit guard on the shell and in a monorepo, observed evidence without the approval guard.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = async ({ ok, S, tmp, __dirname, require }) => {
  const E = require("./lib/engine/index.js"); // engine internals (the reader) — read through mcp/test.js's require
  const HU = require("../hooks/hook-utils.js");
  const js = JSON.stringify;
  const BS = String.fromCharCode(92);
  const WIN = process.platform === "win32";
  const C = "C:/plugins/dev-spec-driven/cli/dev-spec.js";
  const A = "node '" + C + "' approve login-flow classification --force";
  const hookEnv = (env) => ({ ...process.env, CLAUDE_PROJECT_DIR: "", SPEC_PROJECT_DIR: "", ...(env || {}) });
  const hookOut = (file, pl, env) => {
    const r = spawnSync(process.execPath, [file], { input: typeof pl === "string" ? pl : js(pl), encoding: "utf8", env: hookEnv(env), cwd: tmp, timeout: 30000 });
    let j = null;
    try { j = r.stdout ? JSON.parse(r.stdout) : null; } catch { j = { unparsed: r.stdout }; }
    return { status: r.status, json: j, stdout: r.stdout };
  };
  const HOOKS = path.join(__dirname, "..", "hooks");
  const decisionOf = (r) => (r.json && r.json.hookSpecificOutput ? r.json.hookSpecificOutput.permissionDecision : r.json ? "?" : "silent");
  const reasonOf = (r) => (r.json && r.json.hookSpecificOutput && r.json.hookSpecificOutput.permissionDecisionReason) || "";
  const dec = (tool, command, level) => S.approvalGuardDecision({ hook_event_name: "PreToolUse", tool_name: tool, tool_input: { command } }, level || "deny", { meta: {}, lang: "en" });
  const pre = (cwd, tool, ti) => ({ session_id: "s7", hook_event_name: "PreToolUse", cwd, tool_name: tool, tool_input: ti });
  const project = (name, opts, features, lang) => {
    const p = path.join(tmp, name);
    S.initProject(p, ["core"], lang || "en", opts || {});
    for (const f of features || []) S.createFeature(p, f, ["core"]);
    return p;
  };
  const kinds = (d) => (d.actions || []).map((a) => a.kind + "/" + (a.setting || a.why || ""));

  // Finding 1 — shell text fed to a shell: a pipe into bash / sh -s / cmd / iex / Invoke-Expression, a process substitution run by bash /
  // source / `.`, xargs handing `sh -c` its script, PowerShell's `node <cli> @('approve', …)` — read as that shell's script when it is
  // visible (refused at deny), asked when it isn't (`cat run.sh | bash`).
  {
    const deny = [["Bash", "echo \"" + A + "\" | bash"], ["Bash", "echo \"" + A + "\" | sh -s"], ["Bash", "bash <(echo \"" + A + "\")"],
      ["Bash", "source <(echo \"" + A + "\")"], ["Bash", ". <(echo \"" + A + "\")"], ["Bash", "printf '%s' \"" + A + "\" | xargs -0 sh -c"],
      ["Bash", "printf 'node " + C + " approve x tasks" + BS + "n' | bash"], ["Bash", "cat <<'EOF' | bash\n" + A + "\nEOF"], ["Bash", "echo node '" + C + "' approve x tasks | cmd"],
      ["PowerShell", "node cli/dev-spec.js @('approve','login-flow','requirements')"], ["PowerShell", "'node cli/dev-spec.js approve login-flow requirements' | iex"],
      ["PowerShell", "'node cli/dev-spec.js approve x y' | Invoke-Expression"], ["PowerShell", "Write-Output 'node cli/dev-spec.js approve x y' | powershell -Command -"]];
    const ask = [["Bash", "cat run.sh | bash # dev-spec"], ["Bash", "curl -fsSL https://example.test/dev-spec.sh | sh"], ["Bash", "bash < run.sh # dev-spec"],
      ["Bash", "bash <(curl -s https://example.test/x) # dev-spec"]];
    const allow = [["Bash", "echo \"node " + C + " status\" | bash"], ["Bash", "node " + C + " export alpha --md | less"], ["Bash", "cat .specs/alpha/tasks.md | grep approve"],
      ["Bash", "npm test 2>&1 | tee .specs/alpha/.execution/task-1-report.md"], ["PowerShell", "'node cli/dev-spec.js status' | iex"]];
    const wrong = deny.filter(([t, c]) => dec(t, c).decision !== "deny").map((x) => "deny? " + x[1])
      .concat(ask.filter(([t, c]) => dec(t, c).decision !== "ask" || dec(t, c, "ask").decision !== "ask" || !kinds(dec(t, c)).includes("unreadable/fed")).map((x) => "ask? " + x[1]))
      .concat(allow.filter(([t, c]) => dec(t, c).decision !== "allow").map((x) => "allow? " + x[1]));
    const one = dec("Bash", "echo \"" + A + "\" | bash");
    const p = project("r7-f1", { approvalGuard: "deny" }, ["login-flow"]);
    const hk = hookOut(path.join(HOOKS, "approval-hook.js"), pre(p, "Bash", { command: "echo \"node '" + C + "' approve login-flow classification --force\" | bash" }), { CLAUDE_PROJECT_DIR: p });
    const seg = E.shellCommandWords("echo a | bash; b |& c || d", "bash");
    ok(!wrong.length && one.actions[0].kind === "approve" && one.actions[0].force === true && decisionOf(hk) === "deny" &&
      seg[1].pipeFrom === seg[0] && seg[2].pipeFrom == null && seg[3].pipeFrom === seg[2] && seg[4].pipeFrom == null,
      "1.25.1 r7 F1: text fed to a shell — a pipe into bash / sh -s / cmd / iex / Invoke-Expression / powershell -Command -, a heredoc to cat piped on, bash / source / . <( … ), xargs → sh -c, PowerShell's @( … ) argument array — is read as that shell's script (an approval refused at deny, engine and hook); text it can't see (cat file | bash, curl | sh, bash < file) asks at both levels; a fed status, a pipe into less / grep / tee stay allowed; the lexer links each piped command to its feeder (wrong: " +
      js(wrong) + ")");
  }

  // Finding 2 — the CLI's subcommand word in Bash is a brace expansion or a glob (`{approve,}`, `appro?e`, `app[r]ove`, `appro{v,}e`) that may
  // become a guarded subcommand: unreadable — asked at both levels; one that can't (`st?tus`) and the brace word kept whole by the lexer.
  {
    const asked = ["node cli/dev-spec.js {approve,} login-flow requirements", "node cli/dev-spec.js appro?e login-flow requirements",
      "node cli/dev-spec.js app[r]ove login-flow requirements --force", "node cli/dev-spec.js appro{v,}e login-flow requirements", "node cli/dev-spec.js fea*ure remove alpha --yes",
      "node cli/dev-spec.js --json {init,x} --approval-guard off"];
    const allowed = ["node cli/dev-spec.js st?tus alpha", "node cli/dev-spec.js {status,list}", "node cli/dev-spec.js next-action al*"];
    const wrong = asked.filter((c) => dec("Bash", c).decision !== "ask" || dec("Bash", c, "ask").decision !== "ask").map((c) => "ask? " + c)
      .concat(allowed.filter((c) => dec("Bash", c).decision !== "allow").map((c) => "allow? " + c));
    const words = E.shellCommandWords("node cli/dev-spec.js {approve,} x; { echo a; }; find . -exec rm {} +", "bash").map((w) => w.slice());
    ok(!wrong.length && js(words) === js([["node", "cli/dev-spec.js", "{approve,}", "x"], ["echo", "a"], ["find", ".", "-exec", "rm", "{}", "+"]]) &&
      js(E.braceExpand("{.specs,x}/roadmap.json")) === js([".specs/roadmap.json", "x/roadmap.json"]) && js(E.braceExpand("roadmap.json{,}")) === js(["roadmap.json", "roadmap.json"]),
      "1.25.1 r7 F2: a Bash subcommand word holding { } ? * [ that may expand to approve / feature / init / add-track / merge-state asks at ask and deny — one that can't stays allowed; in Bash `{` / `}` are separators only standing alone (`{ cmd; }`), a brace word stays whole (got " +
      js([wrong, words]) + ")");
  }

  // Finding 3 — writes / removes with globbed, brace-expanded, variable or relative-after-cd targets under .specs/, removers on folders
  // or globs under it, extractors / copiers into it, the editors and downloaders, PowerShell's file cmdlets by their parameters and pipes,
  // [IO.File]::…, an unknown program on .specs/ files (asked) — and the 33 legitimate commands of the review stay allowed.
  {
    const must = [["Bash", "cp t.json .specs/roadmap.jso[n]"], ["Bash", "cp t.json .specs/road*.json"], ["Bash", "cp t.json .spec?/roadmap.json"], ["Bash", "cp t {.specs,x}/roadmap.json"],
      ["Bash", "cp t .s*/road*.json"], ["Bash", "D=.specs; cp t $D/roadmap.json"], ["Bash", "cp t $DIR/roadmap.json"], ["Bash", "find .specs -name roadmap.json -delete"],
      ["Bash", "find .specs -name roadmap.json -exec rm {} +"], ["Bash", "find . -name roadmap.json -delete"], ["Bash", "git clean -fdx .specs"], ["Bash", "rm -rf .specs/login-flow"],
      ["Bash", "rm -rf .specs/*"], ["Bash", "rm -rf .s*"], ["Bash", "awk -i inplace '{gsub(/deny/,\"off\")}1' .specs/roadmap.json"], ["Bash", "ed -s .specs/roadmap.json <<< $',s/deny/off/" + BS + "nw'"],
      ["Bash", "ex -sc '%s/deny/off/|x' .specs/roadmap.json"], ["Bash", "vim -c '%s/deny/off/|wq' .specs/roadmap.json"], ["Bash", "curl -o .specs/roadmap.json file:///tmp/r.json"],
      ["Bash", "curl -sSLo .specs/roadmap.json https://x"], ["Bash", "wget -O .specs/roadmap.json http://x"], ["Bash", "wget -P .specs http://x/roadmap.json"], ["Bash", "echo {} | sponge .specs/roadmap.json"],
      ["Bash", "rsync -a x/ .specs/"], ["Bash", "tar -xf b.tar -C .specs"], ["Bash", "tar xzf b.tgz .specs/roadmap.json"], ["Bash", "unzip -o b.zip -d .specs"], ["Bash", "7z x b.7z -o.specs"],
      ["Bash", "cd .specs && echo {} > roadmap.json"], ["Bash", "echo {} 1<>.specs/roadmap.json"], ["Bash", "dos2unix .specs/roadmap.json"], ["Bash", "patch .specs/roadmap.json x.diff"],
      ["Bash", "find .specs -name roadmap.json | xargs rm"], ["Bash", "mv newfeature .specs/"], ["Bash", "cp -r backup/alpha .specs/"], ["Bash", "cmd //c \"rd /s /q .specs" + BS + "alpha\""],
      ["PowerShell", "robocopy C:" + BS + "x .specs roadmap.json"], ["PowerShell", "robocopy C:" + BS + "backup .specs /MIR"], ["PowerShell", "xcopy /y C:" + BS + "x" + BS + "roadmap.json .specs" + BS],
      ["PowerShell", "Remove-Item .specs" + BS + "* -Recurse"], ["PowerShell", "Get-ChildItem .specs -Filter roadmap.json | Remove-Item"], ["PowerShell", "Set-Content -Path .specs" + BS + "road*.json -Value '{}'"],
      ["PowerShell", "Copy-Item t.json .specs" + BS + "roadmap.js?n"], ["PowerShell", "Copy-Item t.json -Destination (Join-Path .specs roadmap.json)"],
      ["PowerShell", "[IO.File]::WriteAllText('.specs/roadmap.json','{}')"], ["PowerShell", "[System.IO.File]::Delete(\"$pwd" + BS + ".specs" + BS + "roadmap.json\")"],
      ["PowerShell", "$d='.specs'; Copy-Item t.json \"$d" + BS + "roadmap.json\""], ["PowerShell", "Get-ChildItem .specs -Recurse -Filter .state.json | Set-Content -Value '{}'"],
      ["PowerShell", "Remove-Item * -Recurse -Force"], ["PowerShell", "ri -r .specs" + BS + "roadmap.*"], ["PowerShell", "Expand-Archive b.zip -DestinationPath .specs -Force"]];
    const asks = [["Bash", "somebin .specs/roadmap.json"], ["Bash", "npx prettier --write .specs/roadmap.json"], ["PowerShell", "New-Object IO.StreamWriter('.specs/roadmap.json')"],
      ["PowerShell", "[IO.File]::Frobnicate('.specs/roadmap.json')"]];
    const fp = [["Bash", "cat .specs/roadmap.json"], ["Bash", "grep -rn approve .specs/"], ["Bash", "git add .specs && git commit -m \"approve tasks of login-flow\""],
      ["Bash", "git diff .specs/roadmap.json"], ["Bash", "git log -p .specs/roadmap.json"], ["Bash", "node cli/dev-spec.js status login-flow"], ["Bash", "node cli/dev-spec.js done login-flow 3 --run"],
      ["Bash", "node cli/dev-spec.js approve --help"], ["Bash", "node cli/dev-spec.js init --approval-guard deny"], ["Bash", "node cli/dev-spec.js init --guard scope"],
      ["Bash", "node cli/dev-spec.js init --check test=\"npm test\""], ["Bash", "node cli/dev-spec.js init --evidence observed"], ["Bash", "node cli/dev-spec.js feature archive login-flow"],
      ["Bash", "node cli/dev-spec.js merge-state --check"], ["Bash", "cp .specs/roadmap.json /tmp/backup.json"], ["Bash", "rm -rf .specs/login-flow/.execution"],
      ["Bash", "npm test 2>&1 | tee .specs/login-flow/.execution/task-3-report.md"], ["Bash", "echo \"remove the old approve button\" > notes.txt"], ["Bash", "ls .specs/*/tasks.md"],
      ["Bash", "sed -n 1,40p .specs/login-flow/tasks.md"], ["Bash", "sed -i 's/- " + BS + "[ " + BS + "] 3/- [x] 3/' .specs/login-flow/tasks.md"], ["Bash", "jq . .specs/roadmap.json"],
      ["Bash", "node -e \"console.log(require('./.specs/roadmap.json').meta)\""], ["Bash", "python -m json.tool .specs/roadmap.json"],
      ["PowerShell", "Get-Content .specs" + BS + "roadmap.json | ConvertFrom-Json"], ["PowerShell", "Select-String -Path .specs" + BS + "*" + BS + "tasks.md -Pattern approve"],
      ["PowerShell", "Copy-Item .specs" + BS + "roadmap.json $env:TEMP" + BS + "r.json"], ["Bash", "git checkout main"], ["Bash", "git stash"], ["Bash", "npm run lint -- --fix src/"],
      ["Bash", "rg -n \"dev-spec approve\" docs/"], ["Bash", "find .specs -name '*.md' -newer .specs/roadmap.json"], ["Bash", "wc -l .specs/*/tasks.md && echo approve"],
      // and more ordinary work on and beside .specs/
      ["Bash", "jq . < .specs/roadmap.json"], ["Bash", "cp notes.md .specs/alpha/"], ["Bash", "rm -f *.log && node cli/dev-spec.js status"], ["Bash", "cp -r .specs /tmp/specs-backup"],
      ["Bash", "tar -czf /tmp/specs.tgz .specs"], ["Bash", "zip -r /tmp/specs.zip .specs"], ["Bash", "rm .specs/.roadmap.lock"], ["Bash", "rm .specs/alpha/notes.md"],
      ["Bash", "find .specs -name '*.md' | xargs grep -l approve"], ["Bash", "for f in .specs/*/tasks.md; do wc -l $f; done"], ["Bash", "[[ -f .specs/roadmap.json ]] && echo yes"],
      ["PowerShell", "[IO.File]::ReadAllText('.specs/roadmap.json')"], ["PowerShell", "Get-ChildItem .specs | Format-Table"], ["Bash", "git stash push -m wip -- src/"]];
    const wrong = must.filter(([t, c]) => dec(t, c).decision !== "deny").map(([t, c]) => "deny? " + t + " " + c + " " + js(kinds(dec(t, c))))
      .concat(asks.filter(([t, c]) => dec(t, c).decision !== "ask" || !kinds(dec(t, c)).includes("unreadable/specs-arg")).map(([t, c]) => "ask? " + c))
      .concat(fp.filter(([t, c]) => dec(t, c).decision !== "allow").map(([t, c]) => "allow? " + c + " " + js(kinds(dec(t, c)))));
    const glob = dec("Bash", "cp t.json .specs/roadmap.jso[n]");
    ok(!wrong.length && glob.actions[0].setting === "specs" && glob.command === null && /change \.specs\/ from the shell — write, move or delete through a glob/.test(glob.reason),
      "1.25.1 r7 F3: a shell write or removal through a glob, a brace expansion, a variable (assigned in the command or not), a relative path after `cd .specs`, a folder or a glob under .specs/ (rm, find -delete / -exec rm, git clean, xargs rm, Remove-Item, a pipe from Get-ChildItem), an extractor or copier into it (rsync, tar -C, unzip -d, 7z -o, robocopy, xcopy, cp -r, mv, Expand-Archive), an editor or downloader (ed, ex, vim -c, awk -i inplace, curl -o, wget -O / -P, sponge), [IO.File]:: and Copy-Item -Destination (Join-Path …) is a guard-down (setting specs when no exact file — no command, localized); an unknown program on .specs/ files asks; the review's 33 legitimate commands and other ordinary work stay allowed (wrong: " +
      js(wrong) + ")");
  }

  // Finding 3 (decided) — a .specs/ that holds features but no roadmap.json (deleted: every engine write that makes a feature writes it)
  // FAILS CLOSED at ask, in the engine (approvalGuardLevel — the MCP server's) and in the hook; a .specs/ without a feature doesn't.
  {
    const p = project("r7-gone", { approvalGuard: "deny" }, ["alpha"]);
    fs.rmSync(path.join(p, ".specs", "roadmap.json"));
    const empty = path.join(tmp, "r7-gone-empty");
    fs.mkdirSync(path.join(empty, ".specs", "steering"), { recursive: true });
    const hk = hookOut(path.join(HOOKS, "approval-hook.js"), pre(p, "mcp__spec-driven__spec_approve", { name: "alpha", phase: "classification" }), { CLAUDE_PROJECT_DIR: p });
    const hkEmpty = hookOut(path.join(HOOKS, "approval-hook.js"), pre(empty, "mcp__spec-driven__spec_approve", { name: "alpha", phase: "classification" }), { CLAUDE_PROJECT_DIR: empty });
    ok(S.approvalGuardLevel(p) === "ask" && S.approvalGuardLevel(empty) === "off" && decisionOf(hk) === "ask" && hkEmpty.stdout === "",
      "1.25.1 r7 F3: a dev-spec .specs/ whose roadmap.json is missing while a feature's .state.json exists reads as approvalGuard ask (engine and hook) — a .specs/ without features stays off (got " +
      js([S.approvalGuardLevel(p), S.approvalGuardLevel(empty), decisionOf(hk), hkEmpty.stdout]) + ")");
  }

  // Finding 4 — links: making a link to .specs/ (or under it — a feature folder, roadmap.json) is a guard-down; a Write / Edit through a
  // folder already linked to .specs/ reaches the real file (its folder's real path, engine and hook alike).
  {
    const links = [["Bash", "ln -s .specs sx"], ["Bash", "ln -s .specs/alpha fx"], ["Bash", "ln .specs/roadmap.json r.json"], ["Bash", "ln -sfn ../.specs ../x"],
      ["PowerShell", "New-Item -ItemType Junction -Path sx -Target .specs"], ["PowerShell", "New-Item -ItemType SymbolicLink -Path sx -Value .specs"], ["PowerShell", "ni sx -ItemType HardLink -Target .specs" + BS + "roadmap.json"],
      ["PowerShell", "cmd /c mklink /J sx .specs"], ["Bash", "cmd //c mklink /D sx .specs"], ["PowerShell", "subst X: .specs"]];
    const wrong = links.filter(([t, c]) => { const d = dec(t, c); return d.decision !== "deny" || !kinds(d).includes("guard-down/link"); }).map(([t, c]) => t + " " + c)
      .concat(["ln -s ../shared/tool.js tool.js # dev-spec", "ln -s src lib # .specs"].filter((c) => dec("Bash", c).decision !== "allow"));
    const p = project("r7-link", { approvalGuard: "deny" }, ["alpha"]);
    let linked = false;
    try { fs.symlinkSync(path.join(p, ".specs"), path.join(p, "sx"), WIN ? "junction" : "dir"); linked = true; } catch { linked = false; }
    let got = "skipped (no link)";
    if (linked) {
      const w1 = hookOut(path.join(HOOKS, "approval-hook.js"), pre(p, "Write", { file_path: path.join(p, "sx", "roadmap.json"), content: "{}" }), { CLAUDE_PROJECT_DIR: p });
      const w2 = hookOut(path.join(HOOKS, "approval-hook.js"), pre(p, "Edit", { file_path: "sx/alpha/.state.json", old_string: "a", new_string: "b" }), { CLAUDE_PROJECT_DIR: p });
      const w3 = hookOut(path.join(HOOKS, "approval-hook.js"), pre(p, "Write", { file_path: path.join(p, "sx", "alpha", "notes.md"), content: "x" }), { CLAUDE_PROJECT_DIR: p });
      const eng = E.approvalEditTargets(path.join(p, "sx", "roadmap.json"), p), hu = HU.editTargets(path.join(p, "sx", "roadmap.json"), p);
      got = [decisionOf(w1), decisionOf(w2), w3.stdout, js(eng) === js(hu) && eng.some((t) => /[\\/]\.specs[\\/]roadmap\.json$/i.test(t))];
      if (!(got[0] === "deny" && got[1] === "deny" && got[2] === "" && got[3] === true)) wrong.push("through the link: " + js(got));
    }
    ok(!wrong.length, "1.25.1 r7 F4: ln (-s or hard), New-Item -ItemType Junction / SymbolicLink / HardLink (-Target / -Value), mklink (cmd /c, Git Bash's //c) and subst onto .specs/ or under it are guard-downs (link); a Write / Edit of sx/roadmap.json or sx/<f>/.state.json through a junction to .specs/ is refused at deny (the folder's real path — hook and engine read it alike), another file through it stays allowed (wrong: " +
      js(wrong) + "; " + js(got) + ")");
  }

  // Finding 5 — ONE projectDir reading (hooks/hook-utils.js parseProjectDir / fileUriToPath, which mcp/server.js now uses): a file:// URI is
  // its path in the hook too — spec_approve / spec_init {approvalGuard: off} on a guarded project named by URI from another session's
  // project ask; a URI that is no local path asks; HU.unexpandedVar is the engine's rule.
  {
    const a = project("r7-uri-a", { approvalGuard: "ask" }, ["alpha"]);
    const b = project("r7-uri-b", {}, []);
    const uri = "file://" + (WIN ? "/" : "") + a.split(path.sep).join("/");
    const call = (tool, ti) => decisionOf(hookOut(path.join(HOOKS, "approval-hook.js"), pre(b, tool, ti), { CLAUDE_PROJECT_DIR: b }));
    const got = [call("mcp__plugin_dev-spec-driven_spec-driven__spec_approve", { name: "alpha", phase: "classification", projectDir: uri, force: true }),
      call("mcp__plugin_dev-spec-driven_spec-driven__spec_init", { approvalGuard: "off", projectDir: uri }),
      call("mcp__spec-driven__spec_approve", { name: "alpha", phase: "classification", projectDir: "file://otherhost/share/x" }),
      call("mcp__spec-driven__spec_approve", { name: "alpha", phase: "classification", projectDir: "file:///" + (WIN ? "notadrive/x" : "x%00y") }),
      call("mcp__spec-driven__spec_approve", { name: "alpha", phase: "classification", projectDir: b }),
      call("mcp__spec-driven__spec_approve", { name: "alpha", phase: "classification", projectDir: path.relative(b, a) })];
    const parse = [HU.parseProjectDir(uri, b).dir === path.resolve(a), HU.parseProjectDir("", b).none === true, HU.parseProjectDir("${workspaceFolder}/x", b).none === true,
      HU.parseProjectDir("../x", b).code, HU.parseProjectDir(BS + BS + "host" + BS + "share", b).code, HU.parseProjectDir("file://host/x", b).code, HU.parseProjectDir("rel", b).dir === path.resolve(b, "rel"),
      HU.fileUriToPath(uri) === path.resolve(a)];
    const vars = ["$HOME", "${x}/y", "%CD%", "a$b", "C:" + BS + "x", "~/x", "x%y"].map((v) => HU.unexpandedVar(v) === S.unexpandedVar(v));
    const src = fs.readFileSync(path.join(__dirname, "server.js"), "utf8");
    ok(js(got) === js(["ask", "ask", "silent", "ask", "silent", "ask"]) && js(parse) === js([true, true, true, "project-dotdot", "project-network", "project-network", true, true]) &&
      vars.every(Boolean) && /HOOK_UTILS\.parseProjectDir\(/.test(src) && /HOOK_UTILS\.fileUriToPath\(/.test(src),
      "1.25.1 r7 F5: the approval hook reads an MCP projectDir as the MCP server does (hook-utils parseProjectDir — the server's own parser now): a local file:// URI to a guarded project asks (spec_approve --force, spec_init approvalGuard off) from another session's project, a file:// URI that is no local path asks, a network one (the server refuses it) and an unguarded project stay silent, a relative one resolves from CLAUDE_PROJECT_DIR (got " +
      js([got, parse, vars]) + ")");
  }

  // Findings 6 and 7 — a copy of the hooks whose engine (mcp/lib/spec.js) throws and stamps a marker when loaded: past the pre-check an
  // engine failure ASKS (a localized reason from the i18n tables), never a silent allow; calls that don't pass the pre-check never load it
  // (a Bash command naming nothing of dev-spec's, an MCP file tool on src/, a Write of src/a.ts).
  {
    const fake = path.join(tmp, "r7-fake");
    fs.mkdirSync(path.join(fake, "hooks"), { recursive: true });
    fs.mkdirSync(path.join(fake, "mcp", "lib", "i18n"), { recursive: true });
    for (const f of ["approval-hook.js", "hook-utils.js", "guard-hook.js"]) fs.copyFileSync(path.join(HOOKS, f), path.join(fake, "hooks", f));
    fs.copyFileSync(path.join(__dirname, "lib", "i18n.js"), path.join(fake, "mcp", "lib", "i18n.js"));
    for (const f of fs.readdirSync(path.join(__dirname, "lib", "i18n"))) fs.copyFileSync(path.join(__dirname, "lib", "i18n", f), path.join(fake, "mcp", "lib", "i18n", f));
    const mark = path.join(tmp, "r7-fake-loaded");
    fs.writeFileSync(path.join(fake, "mcp", "lib", "spec.js"), "require('fs').writeFileSync(process.env.R7_MARK, 'loaded');\nthrow new Error('engine broken');\n");
    const p = project("r7-fail", { approvalGuard: "deny", guard: true }, ["alpha"], "pt");
    const run = (hook, tool, ti) => { try { fs.rmSync(mark); } catch { /* none */ } const r = hookOut(path.join(fake, "hooks", hook), pre(p, tool, ti), { CLAUDE_PROJECT_DIR: p, R7_MARK: mark }); return [decisionOf(r), fs.existsSync(mark), reasonOf(r)]; };
    const approve = run("approval-hook.js", "Bash", { command: "node cli/dev-spec.js approve alpha tasks" });
    const plainBash = run("approval-hook.js", "Bash", { command: "npm test" });
    const mcpSrc = run("approval-hook.js", "mcp__filesystem__write_file", { path: path.join(p, "src", "a.ts"), content: "x" });
    const write = run("approval-hook.js", "Write", { file_path: path.join(p, "src", "a.ts"), content: "x" });
    const guardRead = run("guard-hook.js", "Bash", { command: "git status && npm test" });
    ok(approve[0] === "ask" && approve[1] === true && /não conseguiu verificar \(falhou\)/.test(approve[2]) && js([plainBash, mcpSrc, write, guardRead].map((x) => x.slice(0, 2))) === js([["silent", false], ["silent", false], ["silent", false], ["silent", false]]),
      "1.25.1 r7 F6: once a guarded project is found and the call may be an approval, an engine failure asks (localized: PT), never allows silently; a Bash command naming nothing of dev-spec's, an MCP file tool on src/, a Write of src/a.ts and (the edit guard) a read-only Bash command never load the engine (got " +
      js([approve, plainBash, mcpSrc, write, guardRead]) + ")");
  }

  // Finding 7 — another MCP server's file tools (by the verb in the tool's name, any server): a path argument that is .specs/roadmap.json,
  // a .state.json or an observed log is the same guard-down as an Edit there; a move / delete of .specs/ itself too; other files allowed.
  {
    const p = project("r7-mcp", { approvalGuard: "deny" }, ["alpha"], "es");
    const call = (tool, ti) => { const r = hookOut(path.join(HOOKS, "approval-hook.js"), pre(p, tool, ti), { CLAUDE_PROJECT_DIR: p }); return [decisionOf(r), reasonOf(r).slice(0, 200)]; };
    const rm = path.join(p, ".specs", "roadmap.json"), st = path.join(p, ".specs", "alpha", ".state.json");
    const got = [call("mcp__filesystem__write_file", { path: rm, content: "{}" }), call("mcp__desktop-commander__edit_block", { file_path: st, old_string: "a", new_string: "b" }),
      call("mcp__filesystem__move_file", { source: path.join(p, ".specs"), destination: path.join(p, "old") }),
      call("mcp__x__write_to_file", { target: { uri: "file://" + (WIN ? "/" : "") + rm.split(path.sep).join("/") }, text: "{}" }),
      call("mcp__filesystem__write_file", { path: path.join(p, "src", "a.ts"), content: "see .specs/roadmap.json" }),
      call("mcp__filesystem__write_file", { path: path.join(p, ".specs", "alpha", "requirements.md"), content: "x" }), call("mcp__filesystem__read_file", { path: rm }),
      call("mcp__spec-driven__spec_create", { name: "beta", projectDir: p })];
    const eng = S.approvalGuardDecision(pre(p, "mcp__fs__edit_file", { path: rm, edits: [{ oldText: "deny", newText: "off" }] }), "deny", { meta: {}, lang: "en" });
    ok(js(got.map((g) => g[0])) === js(["deny", "deny", "deny", "deny", "silent", "silent", "silent", "silent"]) && /editar a mano \.specs\/roadmap\.json/.test(got[0][1]) &&
      eng.decision === "deny" && eng.actions[0].source === "edit" && eng.actions[0].setting === "roadmap",
      "1.25.1 r7 F7: an MCP file tool of any server (write_file, edit_block, move_file, write_to_file with a file:// URI) on .specs/roadmap.json, a .state.json or .specs/ itself is refused at deny like an Edit there (localized: ES); its content naming .specs, another file, a read tool and dev-spec's own tools stay silent (got " +
      js(got) + ")");
  }

  // Finding 8 — the edit guard reads shell writes (Bash / PowerShell / Monitor): each file a command writes goes through guardCheck — the
  // approval guard's own reader (shellWriteTargets); read-only commands, test runs, builds and git never prompt. The hook's pre-filter
  // names every program the engine reads as a writer.
  {
    const g = project("r7-guard", { guard: true }, ["billing"]);
    const gh = (tool, command) => decisionOf(hookOut(path.join(HOOKS, "guard-hook.js"), pre(g, tool, { command }), { CLAUDE_PROJECT_DIR: g }));
    const asks = [["Bash", "sed -i s/a/b/ src/a.ts"], ["Bash", "cat > src/a.ts <<EOF\nx\nEOF"], ["PowerShell", "Set-Content src" + BS + "a.ts 'x'"], ["Bash", "echo x | tee src/a.ts"],
      ["Bash", "cp x src/a.ts"], ["Bash", "cd src && echo x > a.py"], ["Monitor", "perl -pi -e 's/a/b/' lib/x.rb"], ["PowerShell", "[IO.File]::WriteAllText('src/a.cs', 'x')"]];
    const silent = [["Bash", "echo x > notes.md"], ["Bash", "npm test 2>&1 | tee test.log"], ["Bash", "git status"], ["Bash", "cat src/a.ts"], ["Bash", "npm run build"],
      ["Bash", "git checkout -- src/a.ts"], ["Bash", "echo x > .specs/billing/notes.md"], ["PowerShell", "Get-Content src" + BS + "a.ts"], ["Bash", "node scripts/x.js > /dev/null 2>&1"],
      ["Bash", "cp src/a.ts /tmp/a.ts"]];
    const wrong = asks.filter(([t, c]) => gh(t, c) !== "ask").map((x) => "ask? " + x[1]).concat(silent.filter(([t, c]) => gh(t, c) !== "silent").map((x) => "silent? " + x[1]));
    const t1 = S.shellWriteTargets("D=src; sed -i x $D/a.ts; cat > b.js <<EOF\nx\nEOF\ncd lib && echo > c.rb; git checkout -- d.ts; echo x > $TMP/e.ts", "bash");
    const src = fs.readFileSync(path.join(HOOKS, "guard-hook.js"), "utf8");
    const reShell = new Function((/const RE_SHELL_WRITE = [\s\S]*?\n(?=\/\/)/.exec(src) || ["const RE_SHELL_WRITE = /$^/;\n"])[0] + "return RE_SHELL_WRITE;")();
    const progs = [...E.APPROVAL_WRITERS_ANY, ...E.APPROVAL_REMOVERS, ...E.APPROVAL_MOVERS, ...E.APPROVAL_WRITERS_TARGET, ...E.APPROVAL_WRITERS_INPLACE,
      ...E.APPROVAL_WRITERS_OTHER, ...E.PS_FILE_CMDLETS, ...Object.keys(E.PS_FILE_ALIASES)].filter((p) => !/^(?:git|find|cd|chdir|pushd|popd|sl|set-location|push-location|pop-location)$/.test(p));
    const missed = progs.filter((p) => !reShell.test(p + " x"));
    ok(!wrong.length && js(t1) === js(["src/a.ts", "b.js", "c.rb", "lib/c.rb"]) && !missed.length && reShell.test("find . -name x.ts -delete") && !reShell.test("git status && npm test"),
      "1.25.1 r7 F8: the edit guard (PreToolUse Bash|PowerShell|Monitor) asks for a code file a shell command writes (sed -i, cat > <<EOF, Set-Content, tee, cp, a redirect after cd, perl -pi, [IO.File]::WriteAllText) with no approved tasks; a write to a doc or .specs/, test runs, builds, reads, git and a copy out of the project stay silent; shellWriteTargets reads variables, heredocs and cd and leaves $TMP and git out; the hook's pre-filter names every writer the engine reads (wrong: " +
      js([wrong, t1, missed]) + ")");
  }

  // Finding 9 — a monorepo: the session at the repository's root, packages/app/.specs with the guard on — a Write (or a shell write) of
  // packages/app/src/a.ts asks (the nearest .specs/ above the edited file joins the candidates); a file outside the package stays silent.
  {
    const m = path.join(tmp, "r7-mono");
    const app = path.join(m, "packages", "app");
    fs.mkdirSync(app, { recursive: true });
    S.initProject(app, ["core"], "en", { guard: true });
    S.createFeature(app, "checkout", ["core"]);
    const gh = (tool, ti) => decisionOf(hookOut(path.join(HOOKS, "guard-hook.js"), pre(m, tool, ti), { CLAUDE_PROJECT_DIR: m }));
    const got = [gh("Write", { file_path: path.join(app, "src", "a.ts"), content: "x" }), gh("Bash", { command: "echo x > packages/app/src/a.ts" }),
      gh("Edit", { file_path: "packages/app/lib/b.py", old_string: "a", new_string: "b" }), gh("Write", { file_path: path.join(m, "README.md"), content: "x" }),
      gh("Write", { file_path: path.join(m, "other", "b.ts"), content: "x" })];
    ok(js(got) === js(["ask", "ask", "ask", "silent", "silent"]),
      "1.25.1 r7 F9: with the session at a monorepo's root, packages/app/.specs (guard on) guards packages/app's code — Write / Edit / a shell redirect ask; a file outside the package stays silent (got " + js(got) + ")");
  }

  // Finding 10 — observed evidence is only as strong as the approval guard: spec_init / init say so whenever evidence is observed and the
  // approval guard off (localized), the doctor warns (observed-unguarded), the observed note names the PowerShell-only limit; with the
  // approval guard on neither appears.
  {
    const o = path.join(tmp, "r7-obs");
    const r1 = S.initProject(o, ["core"], "en", { evidence: "observed" });
    S.createFeature(o, "Obs", ["core"]);
    const d1 = S.specDoctor(o, "obs");
    const r2 = S.initProject(o, ["core"], undefined, { approvalGuard: "ask" });
    const d2 = S.specDoctor(o, "obs");
    const pt = S.initProject(path.join(tmp, "r7-obs-pt"), ["core"], "pt", { evidence: "observed" });
    const chk = (d) => (d.checks || []).find((c) => c.id === "observed-unguarded");
    ok(/only as strong as the approval guard/.test(r1.observedWarning || "") && /PowerShell tool alone/.test(r1.evidenceNote || "") && chk(d1) && chk(d1).status === "warn" &&
      r2.observedWarning === undefined && !chk(d2) && /tão forte quanto o guarda de aprovações/.test(pt.observedWarning || "") && /ferramenta PowerShell/.test(pt.evidenceNote || ""),
      "1.25.1 r7 F10: evidence observed with the approval guard off — init reports observedWarning (EN / PT), the doctor warns observed-unguarded, the observed note names the PowerShell-only limit; with approvalGuard ask neither (got " +
      js([r1.observedWarning, r2.observedWarning, chk(d1), chk(d2), pt.observedWarning && pt.observedWarning.slice(0, 60)]) + ")");
  }
};
