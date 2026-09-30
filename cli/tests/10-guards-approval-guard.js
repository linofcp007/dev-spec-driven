"use strict";
// The human approval guard — init --approval-guard and the approval hook on CLI commands.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = ({ ok, run, tmp, CLI, require, __dirname }) => {
  const SF = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const jsonOf = (r) => { try { return JSON.parse(r.out); } catch { return null; } };
  const meta = (p) => { try { return JSON.parse(fs.readFileSync(path.join(p, ".specs", "roadmap.json"), "utf8")).meta || {}; } catch { return {}; } };
  const pg = path.join(tmp, "ffgate-en");
  // init --approval-guard off|ask|deny = spec_init {approvalGuard}: stored, noted, always reported; anything else refused.
  const i1 = run(["init", "core", "--approval-guard", "deny", "--project", pg]);
  const i2 = jsonOf(run(["init", "--json", "--project", pg]));
  const i3 = run(["init", "--approval-guard", "maybe", "--project", pg]);
  const i4 = run(["init", "--approval-guard", "--json", "--project", pg]);
  const i5 = jsonOf(run(["init", "--approval-guard=ASK", "--json", "--project", pg]));
  ok(i1.code === 0 && /Approval guard DENY — an agent's approval/.test(i1.out) && meta(pg).approvalGuard === "ask" && i2 && i2.approvalGuard === "deny" && i2.approvalGuardNote === undefined &&
    i3.code === 1 && /--approval-guard takes off, ask or deny \(got 'maybe'\)/.test(i3.out) && i4.code === 1 &&
    i5 && i5.approvalGuard === "ask" && /^Approval guard ASK/.test(i5.approvalGuardNote) && /--approval-guard off\|ask\|deny/.test(run(["help"]).out),
    "feature F2: init --approval-guard deny / =ASK stores meta.approvalGuard with a note; init --json always reports it; 'maybe' or a missing value is refused (exit 1); help documents it (got " +
    JSON.stringify([i1.code, i2 && i2.approvalGuard, i3.out.trim(), i4.code, i5 && i5.approvalGuard, meta(pg).approvalGuard]) + ")");
  const pp = path.join(tmp, "ffgate-pt");
  const p1 = run(["init", "--lang", "pt", "--approval-guard", "deny", "--project", pp]);
  const p2 = run(["init", "--approval-guard", "talvez", "--project", pp]);
  ok(p1.code === 0 && /O guarda de aprovações está em DENY/.test(p1.out) && p2.code === 1 && /--approval-guard aceita off, ask ou deny \(recebido 'talvez'\)/.test(p2.out),
    "feature F2: the init note and the bad-value error are in the project language (PT) (got " + JSON.stringify([p1.out.trim().split(/\r?\n/).pop(), p2.out.trim()]) + ")");

  // End to end: an agent's Bash `dev-spec approve … --force` in a deny project is refused by the hook; the command the reason
  // gives the human runs as is (the CLI itself is never gated — the human's own run records the approval).
  const pd = path.join(tmp, "ffgate-deny");
  run(["init", "core", "--approval-guard", "deny", "--project", pd]);
  run(["create", "Checkout", "core", "--project", pd]);
  const hook = spawnSync(process.execPath, [path.join(__dirname, "..", "hooks", "approval-hook.js")], { encoding: "utf8",
    input: JSON.stringify({ hook_event_name: "PreToolUse", cwd: pd, tool_name: "Bash", tool_input: { command: 'node "' + CLI + '" approve checkout requirements --force' } }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: "", SPEC_PROJECT_DIR: "" } });
  let h = {};
  try { h = JSON.parse(hook.stdout); } catch { /* checked below */ }
  const reason = (h.hookSpecificOutput || {}).permissionDecisionReason || "";
  const suggested = ((h.systemMessage || "").match(/: (! node .*)$/) || [])[1] || "";
  const human = spawnSync(suggested.replace(/^! node /, JSON.stringify(process.execPath) + " "), { shell: true, encoding: "utf8", cwd: pd, env: { ...process.env, SPEC_PROJECT_DIR: pd, CLAUDE_PROJECT_DIR: "" } });
  const st = JSON.parse(fs.readFileSync(path.join(pd, ".specs", "checkout", ".state.json"), "utf8"));
  ok(hook.status === 0 && (h.hookSpecificOutput || {}).permissionDecision === "deny" && /approve the requirements phase of 'checkout' — FORCED/.test(reason) &&
    /cli\/dev-spec\.js" approve checkout requirements --force$/.test(suggested) && human.status === 0 && st.approvals && st.approvals.requirements && st.approvals.requirements.forced === true,
    "feature F2: the hook denies an agent's `dev-spec approve … --force` in a deny project, and the `! node <clone>/cli/dev-spec.js approve …` line it gives the user runs as is and records the (forced) approval (got " +
    JSON.stringify([hook.status, reason.slice(0, 90), suggested, human.status, (human.stdout + human.stderr).trim().slice(0, 160)]) + ")");
  ok(SF.approvalGuardLevel(pd) === "deny" && SF.approvalGuardLevel(pp) === "deny" && SF.approvalGuardLevel(path.join(tmp, "ffgate-none")) === "off",
    "feature F2: approvalGuardLevel reads meta.approvalGuard (no roadmap.json → off)");

  // Review fixes (R10 / R1 / R3 / R9), end to end through the hook and the CLI.
  const hookRun = (cwd, tool, command) => {
    const r = spawnSync(process.execPath, [path.join(__dirname, "..", "hooks", "approval-hook.js")], { encoding: "utf8",
      input: JSON.stringify({ hook_event_name: "PreToolUse", cwd, tool_name: tool, tool_input: { command } }), env: { ...process.env, CLAUDE_PROJECT_DIR: "", SPEC_PROJECT_DIR: "" } });
    let j = {};
    try { j = JSON.parse(r.stdout); } catch { /* silent */ }
    return { status: r.status, decision: (j.hookSpecificOutput || {}).permissionDecision || (r.stdout === "" ? "silent" : "?"), note: j.systemMessage || "" };
  };
  const q = JSON.stringify(CLI);
  const pr = path.join(tmp, "ffgate-r10");
  const r0 = run(["init", "core", "--approval-guard", "deny", "--evidence", "observed", "--check", 'test=node -e "process.exit(0)"', "--roles", "design=tech", "--stop-check", "on", "--project", pr]);
  const hEv = hookRun(pr, "Bash", "node " + q + " init --evidence reported");
  const hChk = hookRun(pr, "Bash", "node " + q + " init --check test=");
  const hRoles = hookRun(pr, "PowerShell", "node " + q + " init --roles none");
  const hStop = hookRun(pr, "Bash", "node " + q + " init --stop-check off");
  const hUp = hookRun(pr, "Bash", "node " + q + " init --check lint=eslint --evidence observed --stop-check on");
  const userLine = ((hEv.note.match(/: (! node .*)$/) || [])[1] || "");
  const humanEv = spawnSync(userLine.replace(/^! node /, JSON.stringify(process.execPath) + " "), { shell: true, encoding: "utf8", cwd: pr, env: { ...process.env, SPEC_PROJECT_DIR: pr, CLAUDE_PROJECT_DIR: "" } });
  ok(r0.code === 0 && hEv.decision === "deny" && /switch the evidence mode \(meta\.evidence\) back to reported/.test(hEv.note) && hChk.decision === "deny" &&
    hRoles.decision === "deny" && hStop.decision === "deny" && hUp.decision === "silent" &&
    /init --evidence reported$/.test(userLine) && humanEv.status === 0 && SF.evidenceMode(pr) === "reported",
    "feature F2 review R10: in a deny project the hook refuses an agent's init --evidence reported / --check test= / --roles none / --stop-check off (raising or adding passes); the line it gives the user runs as is and lowers meta.evidence (got " +
    JSON.stringify([r0.code, hEv.decision, hChk.decision, hRoles.decision, hStop.decision, hUp.decision, userLine, humanEv.status, meta(pr).evidence]) + ")");
  // R3 / R9: a line-continued approve is refused; a heredoc that only WRITES the approve line into a doc is not.
  const hCont = hookRun(pr, "Bash", "node " + q + " \\\n  approve checkout requirements");
  const hDoc = hookRun(pr, "Bash", "cat > docs/approve.md <<'EOF'\nRun `node " + q + " approve checkout requirements` yourself.\nEOF");
  const hPsCont = hookRun(pr, "PowerShell", "node " + q + " `\n  ap`prove checkout requirements");
  ok(hCont.decision === "deny" && hDoc.decision === "silent" && hPsCont.decision === "deny",
    "feature F2 review R3/R9: the hook refuses a Bash \\⏎-continued and a PowerShell `-escaped approve; a quoted heredoc writing the approve line into a doc passes (got " +
    JSON.stringify([hCont.decision, hDoc.decision, hPsCont.decision]) + ")");
  // R1: `echo x >> .specs/roadmap.json` is refused while the guard is on — and a roadmap.json broken that way keeps the guard
  // (fail closed): the hook still refuses an approve; the CLI refuses to write over the broken file (the human repairs it).
  const hW = hookRun(pr, "Bash", "echo x >> .specs/roadmap.json");
  fs.appendFileSync(path.join(pr, ".specs", "roadmap.json"), "x");
  const hAfter = hookRun(pr, "Bash", "node " + q + " approve checkout requirements");
  const offTry = run(["init", "--approval-guard", "off", "--project", pr]);
  ok(hW.decision === "deny" && /Make that change yourself/.test(hW.note) && SF.approvalGuardLevel(pr) === "deny" && hAfter.decision === "deny" && hAfter.status === 0 && offTry.code === 1,
    "feature F2 review R1: a Bash write of .specs/roadmap.json is refused; after `echo x >> .specs/roadmap.json` the guard still reads deny (engine and hook) and init --approval-guard off can't write over the broken file (got " +
    JSON.stringify([hW.decision, SF.approvalGuardLevel(pr), hAfter.decision, offTry.code, offTry.out.trim().slice(0, 120)]) + ")");
};
