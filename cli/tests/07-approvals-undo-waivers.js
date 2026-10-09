"use strict";
// Undo / revoke, waivers, stop-check / log on the CLI.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = ({ ok, all, run, tmp, CLI, require, __dirname }) => {
  const SU = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const js = (x) => JSON.stringify(x);
  const RUN = 'node -e "process.exit(0)"';
  // stdout only (a --json result is the one document there), optional stdin
  const runJ = (args, input) => {
    const r = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", input, env: { ...process.env, SPEC_PROJECT_DIR: tmp } });
    let j = null;
    try { j = JSON.parse(r.stdout); } catch { /* stays null */ }
    return { j, out: r.stdout || "", err: r.stderr || "", code: r.status };
  };
  const mk = (name, lang) => {
    const p = path.join(tmp, "p16u-" + name);
    run(["init", "core", ...(lang ? ["--lang", lang] : []), "--project", p]);
    run(["create", "Login", "core", "--project", p]);
    fs.writeFileSync(path.join(p, ".specs", "login", "tasks.md"), "- [ ] 1. first\n  - _Verify: " + RUN + "_\n- [ ] 2. second\n");
    return p;
  };
  const stOf = (p) => JSON.parse(fs.readFileSync(path.join(p, ".specs", "login", ".state.json"), "utf8"));
  const omit = (o, k) => { const c = { ...(o || {}) }; delete c[k]; return c; };

  // U1 — `dev-spec undone <feature> <n> [--reason "…"]` = spec_complete_task {undo: true, reason}.
  const pe = mk("en");
  run(["done", "login", "1", "--run", "--project", pe]);
  const u1 = run(["undone", "login", "1", "--reason", "wrong task", "--project", pe]);
  const u2 = run(["undone", "login", "1", "--project", pe]);
  const u3 = run(["undone", "login", "7", "--project", pe]);
  const u4 = run(["undone", "login", "--project", pe]);
  const d5 = run(["done", "login", "2", "--reason", "x", "--project", pe]);
  const st1 = stOf(pe);
  ok(u1.code === 0 && /^Task 1 unticked\. 0\/2  next → #1 first\n  ⚠ Task 1 is open again \(unticked\)\. Its recorded evidence no longer counts/.test(u1.out) &&
    u2.code === 0 && /^Task 1 was not ticked\. 0\/2  next → #1 first\n  Task 1 is not ticked — nothing to undo\./.test(u2.out) &&
    u3.code === 1 && /Task 7 not found in tasks\.md/.test(u3.out) && u4.code === 1 && /dev-spec undone <feature> <task-number>/.test(u4.out) &&
    d5.code === 1 && /reason goes with undo/.test(d5.out) && st1.unticks.length === 1 && st1.unticks[0].reason === "wrong task" && st1.evidence["1"].staleBy === "undo" &&
    !/- \[x\] 2\./.test(fs.readFileSync(path.join(pe, ".specs", "login", "tasks.md"), "utf8")),
    "1.16 U1: `undone` unticks (exit 0, the note in the feature's language), an open task is a no-op with a note, an unknown task / a missing number exit 1, and `done --reason` is refused as spec_complete_task {reason} is (got " +
    js([u1.out, u2.out, u3.out.trim(), d5.out.trim()]) + ")");
  // MCP ↔ CLI parity: the same engine call — `undone --json` prints spec_complete_task {undo}'s result.
  const pa = mk("par-a"), pb = mk("par-b");
  [pa, pb].forEach((p) => run(["done", "login", "1", "--run", "--project", p]));
  const cj = runJ(["undone", "login", "1", "--reason", "r", "--json", "--project", pa]);
  const ej = SU.completeTask(pb, "login", 1, undefined, { undo: true, reason: "r" });
  const cjErr = runJ(["undone", "login", "9", "--json", "--project", pa]);
  ok(cj.code === 0 && cj.j && js(cj.j) === js(ej) && cjErr.code === 1 && cjErr.j && cjErr.j.ok === false && js(cjErr.j) === js(SU.completeTask(pb, "login", 9, undefined, { undo: true })),
    "1.16 U1: `undone --json` prints exactly spec_complete_task {undo, reason}'s result — a refusal too ({ok: false, error}, exit 1) (got " + js([cj.j, ej]) + ")");
  // PT output.
  const pp = mk("pt", "pt");
  run(["done", "login", "1", "--run", "--project", pp]);
  const up = run(["undone", "login", "1", "--project", pp]);
  ok(up.code === 0 && /^Tarefa 1 desmarcada\. 0\/2  próxima → #1 first\n  ⚠ A tarefa 1 voltou a ficar aberta \(desmarcada\)\./.test(up.out),
    "1.16 U1: `undone` speaks the feature's language (PT) (got " + js(up.out) + ")");

  // U2 / U3 — approve --revoke [--reason] · approve --force --reason "…" --expires 30d.
  const r1 = run(["approve", "login", "requirements", "--force", "--reason", "demo day", "--expires", "30d", "--project", pe]);
  const r2 = run(["approve", "login", "design", "--reason", "x", "--project", pe]);
  const r3 = run(["approve", "login", "design", "--force", "--expires", "yesterday", "--project", pe]);
  const r4 = run(["approve", "login", "requirements", "--revoke", "--reason", "scope changed", "--project", pe]);
  const r5 = run(["approve", "login", "requirements", "--revoke", "--project", pe]);
  const r6 = run(["approve", "login", "requirements", "--revok", "--project", pe]);
  const r7 = run(["approve", "login", "requirements", "--revoke", "--force", "--project", pe]);
  const hist = stOf(pe).approvalHistory;
  all("1.16 U2/U3: `approve --force --reason --expires` records the waiver; `--reason` without --force, a bad --expires, `--revoke` of an unapproved phase or with --force exit 1; `--revoke --reason` revokes (history: revoked + reason); `--revok` suggests --revoke (got " +
    js([r1.out.trim(), r4.out.trim(), r6.out.trim()]) + ")", [
    () => r1.code === 0, () => /Waiver recorded: demo day \(expires \d{4}-\d{2}-\d{2}\)\./.test(r1.out), () => r2.code === 1,
    () => /go with force/.test(r2.out), () => r3.code === 1, () => /expires must be an ISO date/.test(r3.out), () => r4.code === 0,
    () => /^Revoked the approval of 'requirements' for login — the phase is pending again/.test(r4.out), () => r5.code === 1,
    () => /nothing to revoke/.test(r5.out), () => r6.code === 1, () => /did you mean --revoke\?/.test(r6.out), () => r7.code === 1,
    () => /revoke takes no force/.test(r7.out), () => hist[hist.length - 1].revoked === true, () => hist[hist.length - 1].reason === "scope changed",
    () => hist[hist.length - 2].waiver, () => hist[hist.length - 2].waiver.reason === "demo day",
  ]);
  const qa = mk("rev-a"), qb = mk("rev-b");
  [qa, qb].forEach((p) => run(["approve", "login", "classification", "--force", "--project", p]));
  const cr = runJ(["approve", "login", "classification", "--revoke", "--reason", "oops", "--by", "ana", "--json", "--project", qa]);
  const er = SU.approvePhase(qb, "login", "classification", "ana", { revoke: true, reason: "oops" });
  const cw = runJ(["approve", "login", "classification", "--force", "--reason", "demo", "--expires", "5d", "--json", "--project", qa]);
  const ew = SU.approvePhase(qb, "login", "classification", undefined, { force: true, reason: "demo", expires: "5d" });
  ok(cr.code === 0 && cr.j && js(omit(cr.j, "approvals")) === js(omit(er, "approvals")) && js(Object.keys(cr.j.approvals)) === js(Object.keys(er.approvals)) &&
    cw.code === 0 && cw.j && js(cw.j.waiver) === js(ew.waiver) && cw.j.note === ew.note && js(cw.j.failing) === js(ew.failing),
    "1.16 U2/U3: `approve --revoke --json` and `approve --force --reason --expires --json` print spec_approve {revoke} / {force, reason, expires}'s results (MCP ↔ CLI parity) (got " +
    js([cr.j && cr.j.message, cw.j && cw.j.waiver]) + ")");
  // ES wording of a CLI refusal; the help and the command table document the new command and flags.
  const ps = mk("es", "es");
  const rs = run(["approve", "login", "design", "--force", "--expires", "pronto", "--project", ps]);
  const help = run(["help"]).out;
  const doc = require(path.join(path.dirname(CLI), "commands.js")).helpText();
  ok(rs.code === 1 && /expires debe ser una fecha ISO/.test(rs.out) &&
    [/undone <feature> <n> \[--reason "…"\]/, /approve <feature> <phase> --revoke \[--reason "…"\]/, /--expires YYYY-MM-DD\|30d/].every((re) => re.test(help) && re.test(doc)) &&
    SU.CLI_SWITCHES.has("revoke") && !SU.CLI_SWITCHES.has("reason") && !SU.CLI_SWITCHES.has("expires"),
    "1.16 U: an ES refusal is Spanish; help and the command table document undone / --revoke / --reason / --expires; --revoke is in spec.CLI_SWITCHES, --reason / --expires take a value (got " + js(rs.out.trim()) + ")");

  // The approval guard (deny): an agent's `approve … --revoke` is refused, and the command handed to the human revokes as is.
  const pd = path.join(tmp, "p16u-deny");
  run(["init", "core", "--approval-guard", "deny", "--project", pd]);
  run(["create", "Checkout", "core", "--project", pd]);
  run(["approve", "checkout", "classification", "--force", "--project", pd]); // the human's own CLI run is never gated
  const hook = spawnSync(process.execPath, [path.join(__dirname, "..", "hooks", "approval-hook.js")], { encoding: "utf8",
    input: JSON.stringify({ hook_event_name: "PreToolUse", cwd: pd, tool_name: "Bash", tool_input: { command: 'node "' + CLI + '" approve checkout classification --revoke --reason "wrong one"' } }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: "", SPEC_PROJECT_DIR: "" } });
  let h = {};
  try { h = JSON.parse(hook.stdout); } catch { /* checked below */ }
  const suggested = ((h.systemMessage || "").match(/: (! node .*)$/) || [])[1] || "";
  const human = spawnSync(suggested.replace(/^! node /, JSON.stringify(process.execPath) + " "), { shell: true, encoding: "utf8", cwd: pd, env: { ...process.env, SPEC_PROJECT_DIR: pd, CLAUDE_PROJECT_DIR: "" } });
  const std = JSON.parse(fs.readFileSync(path.join(pd, ".specs", "checkout", ".state.json"), "utf8"));
  ok(hook.status === 0 && (h.hookSpecificOutput || {}).permissionDecision === "deny" && /revoke the approval of the classification phase of 'checkout'/.test((h.hookSpecificOutput || {}).permissionDecisionReason || "") &&
    /approve checkout classification --revoke --reason "wrong one"$/.test(suggested) && human.status === 0 && !std.approvals.classification &&
    std.approvalHistory[std.approvalHistory.length - 1].reason === "wrong one",
    "1.16 U2: the approval hook (deny) refuses an agent's `dev-spec approve … --revoke` and hands the human an `approve … --revoke --reason` line that revokes as is (got " +
    js([suggested, (human.stdout + human.stderr).trim().slice(0, 160)]) + ")");

  // U4 — `log <f> - --max N`: the piped log with its window, = spec_log {gitLog, max}.
  const pl = mk("log");
  const log = ["commit aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "Author: Ana <a@x.io>", "Date:   2026-09-20T10:00:00+00:00", "", "    feat(login): first", "", "    Part of .specs/login/ task #1.", "", "src/a.js", "",
    "commit bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "Author: Ana <a@x.io>", "Date:   2026-09-19T10:00:00+00:00", "", "    chore: tooling", "", "package.json", ""].join("\n");
  const l1 = runJ(["log", "login", "-", "--max", "2", "--json", "--project", pl], log);
  const l2 = runJ(["log", "login", "-", "--json", "--project", pl], log);
  const l3 = run(["log", "login", "-", "--max", "0", "--project", pl]);
  ok(l1.code === 0 && l1.j && l1.j.truncated === true && js(l1.j) === js(SU.taskCommits(pl, "login", log, { max: 2 })) && l2.j && l2.j.truncated === false &&
    js(l2.j) === js(SU.taskCommits(pl, "login", log, {})) && l1.j.tasks[0].commits.length === 1 && l3.code === 1,
    "1.16 U4: `log <f> - --max N` passes the window of the piped log (a log that long reads truncated) — the same result as spec_log {gitLog, max}; --max 0 is refused (got " +
    js([l1.j && l1.j.truncated, l2.j && l2.j.truncated]) + ")");

  // 1.16 U review 5 — `undone` refuses done's evidence flags (it silently ignored them); --run=false is no run.
  const pv = mk("review-flags", "pt");
  run(["done", "login", "1", "--run", "--project", pv]);
  const tv = fs.readFileSync(path.join(pv, ".specs", "login", "tasks.md"), "utf8");
  const vf = [["--evidence", "ok"], ["--exit", "0"], ["--cmd", RUN], ["--run"], ["--run", "--shell", "bash"]].map((fl) => run(["undone", "login", "1", ...fl, "--project", pv]));
  const vj = runJ(["undone", "login", "1", "--cmd", RUN, "--exit", "0", "--json", "--project", pv]);
  const vUnchanged = fs.readFileSync(path.join(pv, ".specs", "login", "tasks.md"), "utf8") === tv && !stOf(pv).unticks;
  const vOff = run(["undone", "login", "1", "--run=false", "--project", pv]);
  ok(vf.every((r) => r.code === 1 && /undo não aceita evidência/.test(r.out)) && vj.code === 1 && vj.j && vj.j.ok === false && /undo não aceita evidência/.test(vj.j.error) &&
    vUnchanged && vOff.code === 0 && /^Tarefa 1 desmarcada\./.test(vOff.out),
    "1.16 U review 5: `undone` with --evidence / --exit / --cmd / --run exits 1 with the localized refusal (PT; --json: the refusal as spec_complete_task {undo, evidence} returns it) and changes nothing; --run=false is no run (got " +
    js([vf.map((r) => r.code + " " + r.out.trim().slice(0, 60)), vOff.out.trim().slice(0, 40)]) + ")");
  // 1.16 U review 2 — two ticked tasks share the number: `undone` exits 1 (duplicateTicked), nothing changed.
  const pw = mk("review-dup");
  fs.writeFileSync(path.join(pw, ".specs", "login", "tasks.md"), "- [ ] 1. Alpha\n  - _Verify: " + RUN + "_\n- [ ] 1. Beta\n- [ ] 2. second\n");
  run(["done", "login", "1", "--run", "--project", pw]);
  run(["done", "login", "1", "--project", pw]);
  const tw = fs.readFileSync(path.join(pw, ".specs", "login", "tasks.md"), "utf8");
  const dw = runJ(["undone", "login", "1", "--json", "--project", pw]);
  const dh = run(["undone", "login", "1", "--project", pw]);
  ok(dw.code === 1 && dw.j && dw.j.duplicateTicked === true && js(dw.j.tasks.map((t) => t.line)) === "[1,3]" && dh.code === 1 &&
    /Several ticked tasks share number 1 \(line 1: "Alpha", line 3: "Beta"\)/.test(dh.out) && fs.readFileSync(path.join(pw, ".specs", "login", "tasks.md"), "utf8") === tw,
    "1.16 U review 2: `undone` of a number two ticked tasks share exits 1 (--json: duplicateTicked + tasks with their lines) — tasks.md unchanged (got " + js([dw.j, dh.out.trim()]) + ")");
  // 1.16 U review 1 — an _Expect: fail_ task undone after its red run: the note says the red run is kept, and `done --run` (a pass
  // now) re-ticks it as the fix going green.
  const px = mk("review-red");
  fs.writeFileSync(path.join(px, ".specs", "login", "tasks.md"), "- [ ] 1. Write the test and watch it fail\n  - _Verify: " + RUN + "_\n  - _Expect: fail_\n- [ ] 2. second\n");
  const xr = run(["done", "login", "1", "--cmd", RUN, "--exit", "1", "--evidence", "not ok 1 - login", "--project", px]);
  const xu = run(["undone", "login", "1", "--project", px]);
  const xd = runJ(["done", "login", "1", "--run", "--json", "--project", px]);
  ok(xr.code === 0 && xu.code === 0 && /Its red run of \d{4}-\d\d-\d\d \(the _Expect: fail_ proof\) is kept/.test(xu.out) && !/no longer counts/.test(xu.out) &&
    xd.code === 0 && xd.j && xd.j.ok && xd.j.verified === true && xd.j.expected === "fail" && xd.j.observed === "cli",
    "1.16 U review 1: `undone` of an _Expect: fail_ task keeps its red run (the note says so), and `done --run` — whose run passes now — re-ticks it verified (got " +
    js([xu.out.trim(), xd.j]) + ")");
};
