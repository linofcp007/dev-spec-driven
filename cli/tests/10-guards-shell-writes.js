"use strict";
// The guards on the shell (1.25.1 review 7) — init / doctor warn on observed evidence without the approval guard; the hooks on CLI-made projects: fed scripts, globbed writes, shell code edits.

const path = require("path");
const { spawnSync } = require("child_process");

exports.run = ({ ok, run, tmp, CLI, __dirname }) => {
  const jsonOf = (r) => { try { return JSON.parse(r.out); } catch { return null; } };
  const hook = (name, payload, env) => {
    const r = spawnSync(process.execPath, [path.join(__dirname, "..", "hooks", name + ".js")], { encoding: "utf8", input: JSON.stringify(payload),
      env: { ...process.env, CLAUDE_PROJECT_DIR: "", SPEC_PROJECT_DIR: "", ...(env || {}) } });
    try { return JSON.parse(r.stdout).hookSpecificOutput.permissionDecision; } catch { return r.stdout ? "?" : "silent"; }
  };
  const pre = (cwd, tool, command) => ({ hook_event_name: "PreToolUse", session_id: "c7", cwd, tool_name: tool, tool_input: { command } });

  // init --evidence observed with the approval guard off: the warning (human output and --json); the doctor's observed-unguarded warn;
  // with --approval-guard ask neither.
  {
    const p = path.join(tmp, "r7-obs");
    const i1 = run(["init", "core", "--evidence", "observed", "--project", p]);
    run(["create", "Obs", "core", "--project", p]);
    const d1 = jsonOf(run(["doctor", "obs", "--json", "--project", p]));
    const i2 = jsonOf(run(["init", "--approval-guard", "ask", "--json", "--project", p]));
    const d2 = jsonOf(run(["doctor", "obs", "--json", "--project", p]));
    const chk = (d) => d && (d.checks || []).find((c) => c.id === "observed-unguarded");
    ok(i1.code === 0 && /only as strong as the approval guard/.test(i1.out) && /PowerShell tool alone/.test(i1.out) && chk(d1) && chk(d1).status === "warn" &&
      i2 && i2.observedWarning === undefined && !chk(d2),
      "1.25.1 r7: init --evidence observed with the approval guard off prints the warning (and the PowerShell-only note); doctor warns observed-unguarded; after --approval-guard ask neither (got " +
      JSON.stringify([i1.code, i1.out.slice(-200), chk(d1), i2 && i2.observedWarning, chk(d2)]) + ")");
  }

  // The approval hook on a CLI-made deny project: an approval piped into bash, a brace-expanded subcommand, a globbed copy onto roadmap.json,
  // a link to .specs/ — refused or asked; a status piped into bash and reading the roadmap stay silent.
  {
    const p = path.join(tmp, "r7-deny");
    run(["init", "core", "--approval-guard", "deny", "--project", p]);
    run(["create", "Checkout", "core", "--project", p]);
    const cli = "node \"" + CLI.split(path.sep).join("/") + "\"";
    const got = [hook("approval-hook", pre(p, "Bash", "echo '" + cli + " approve checkout requirements --force' | bash"), { CLAUDE_PROJECT_DIR: p }),
      hook("approval-hook", pre(p, "Bash", cli + " {approve,} checkout requirements"), { CLAUDE_PROJECT_DIR: p }),
      hook("approval-hook", pre(p, "Bash", "cp t.json .specs/roadmap.jso[n]"), { CLAUDE_PROJECT_DIR: p }),
      hook("approval-hook", pre(p, "PowerShell", "New-Item -ItemType Junction -Path sx -Target .specs"), { CLAUDE_PROJECT_DIR: p }),
      hook("approval-hook", pre(p, "Bash", "echo '" + cli + " status' | bash"), { CLAUDE_PROJECT_DIR: p }),
      hook("approval-hook", pre(p, "Bash", "jq . .specs/roadmap.json"), { CLAUDE_PROJECT_DIR: p })];
    ok(JSON.stringify(got) === JSON.stringify(["deny", "ask", "deny", "deny", "silent", "silent"]),
      "1.25.1 r7: on a CLI-made deny project the approval hook refuses an approval piped into bash, a glob onto roadmap.json and a junction to .specs/, asks for a brace-expanded subcommand; a status piped into bash and jq on roadmap.json stay silent (got " +
      JSON.stringify(got) + ")");
  }

  // The edit guard on the shell: a CLI-made guarded project — a code file written by sed -i / a redirect asks, a test run stays silent.
  {
    const p = path.join(tmp, "r7-guard");
    run(["init", "core", "--guard", "on", "--project", p]);
    run(["create", "Billing", "core", "--project", p]);
    const got = [hook("guard-hook", pre(p, "Bash", "sed -i s/a/b/ src/app.ts"), { CLAUDE_PROJECT_DIR: p }), hook("guard-hook", pre(p, "PowerShell", "'x' | Out-File src\\app.py"), { CLAUDE_PROJECT_DIR: p }),
      hook("guard-hook", pre(p, "Bash", "npm test 2>&1 | tee test.log"), { CLAUDE_PROJECT_DIR: p })];
    ok(JSON.stringify(got) === JSON.stringify(["ask", "ask", "silent"]),
      "1.25.1 r7: the edit guard asks for a code file a Bash / PowerShell command writes (sed -i, Out-File) without approved tasks; a test run teeing a log stays silent (got " + JSON.stringify(got) + ")");
  }
};
