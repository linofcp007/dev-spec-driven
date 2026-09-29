"use strict";
// Harness-observed evidence — the observe hook, init --evidence, done --run stamped "cli".

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = ({ ok, run, tmp, CLI, require, __dirname }) => {
  const Sob = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const HOOK = path.join(__dirname, "..", "hooks", "observe-hook.js");
  const jsonOb = (s) => { try { return JSON.parse(s); } catch { return null; } };
  const rob = (proj, args) => {
    const r = spawnSync(process.execPath, [CLI, ...args, "--project", proj], { encoding: "utf8", env: { ...process.env, SPEC_PROJECT_DIR: "", CLAUDE_PROJECT_DIR: "" } });
    return { out: (r.stdout || "") + (r.stderr || ""), stdout: r.stdout || "", code: r.status };
  };
  const stOb = (f) => JSON.parse(fs.readFileSync(path.join(f.dir, ".state.json"), "utf8"));
  const metaOb = (p) => JSON.parse(fs.readFileSync(path.join(p, ".specs", "roadmap.json"), "utf8")).meta || {};
  const PASS = 'node -e "process.exit(0)"';
  const po = path.join(tmp, "ffobs-cli");
  Sob.initProject(po, ["core"], "en", { checks: { test: PASS } });
  const fo = Sob.createFeature(po, "Obs", ["core"], "", undefined, "en");
  fs.writeFileSync(path.join(fo.dir, "tasks.md"), "- [ ] 1. [US1] One\n  - _Verify: " + PASS + "_\n- [ ] 2. [US1] Two\n  - _Verify: node two.js_\n- [ ] 3. [US1] Three\n  - _Verify: node three.js_\n");

  // init --evidence reported|observed (= spec_init {evidence}); a bad value exits 1, localized.
  const i1 = rob(po, ["init", "--evidence", "observed"]);
  const m1 = metaOb(po).evidence;
  const i2 = rob(po, ["init", "--evidence=REPORTED", "--json"]);
  const i3 = rob(po, ["init", "--evidence", "maybe"]);
  const i4 = rob(path.join(tmp, "ffobs-cli-pt"), ["init", "--lang", "pt", "--evidence", "talvez"]);
  const i5 = rob(po, ["init", "--json"]);
  ok(i1.code === 0 && /Evidence mode OBSERVED/.test(i1.out) && m1 === "observed" && i2.code === 0 && (jsonOb(i2.stdout) || {}).evidence === "reported" && metaOb(po).evidence === "reported" &&
    i3.code === 1 && /--evidence takes reported or observed \(got 'maybe'\)/.test(i3.out) && i4.code === 1 && /--evidence aceita reported ou observed \(recebido 'talvez'\)/.test(i4.out) &&
    (jsonOb(i5.stdout) || {}).evidence === "reported" && !/Evidence mode/.test(i5.out),
    "feature F1: init --evidence observed|reported sets roadmap.json meta.evidence (case-folded; --json reports it, a note when set); a bad value exits 1, localized (PT) (got " +
    JSON.stringify([i1.code, m1, i3.out.trim().slice(0, 120), i4.out.trim().slice(0, 120)]) + ")");

  // meta.evidence observed: done --run is observed by the CLI itself ("cli"); a reported run nobody saw ticks but stays unverified
  // (unobserved + the note); once the hook saw the command run, the same report verifies.
  rob(po, ["init", "--evidence", "observed"]);
  const d1 = rob(po, ["done", fo.slug, "1", "--run", "--json"]);
  const d1j = jsonOb(d1.stdout) || {};
  const d2 = rob(po, ["done", fo.slug, "2", "--cmd", "node two.js", "--exit", "0"]);
  const d2j = jsonOb(rob(po, ["done", fo.slug, "2", "--cmd", "node two.js", "--exit", "0", "--json"]).stdout) || {};
  const hk = spawnSync(process.execPath, [HOOK], { encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: po, SPEC_PROJECT_DIR: "" },
    input: JSON.stringify({ session_id: "c1", cwd: po, hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: { command: "node three.js" }, tool_response: { stdout: "ok", stderr: "", exit_code: 0 } }) });
  const d3j = jsonOb(rob(po, ["done", fo.slug, "3", "--cmd", "node three.js", "--exit", "0", "--json"]).stdout) || {};
  ok(d1.code === 0 && d1j.verified === true && d1j.observed === "cli" && stOb(fo).evidence["1"].observed === "cli" &&
    d2.code === 0 && /^Task 2 done\. /m.test(d2.out) && !/\(verified\)/.test(d2.out) && /⚠ Task 2: the run was recorded, but the harness never saw it .*dev-spec done obs 2 --run/.test(d2.out) &&
    d2j.unverifiedReason === "unobserved" && d2j.observed === false && hk.status === 0 && hk.stdout === "" && d3j.verified === true && d3j.observed === true,
    "feature F1: with meta.evidence observed, done --run records observed: \"cli\" (verified); done --cmd/--exit of a run nobody saw ticks it unverified (unobserved, the note names --run); after the hook logged the run, the same report verifies (got " +
    JSON.stringify([d1j.observed, d2.out.trim().slice(0, 200), d2j.unverifiedReason, d3j.observed]) + ")");

  // The one verdict: doctor and stop-check name the unobserved task; finish --run records its checks as observed "cli".
  const doc = rob(po, ["doctor", fo.slug]);
  const stop = rob(po, ["stop-check", "--message", "Done — all tasks are complete and verified."]);
  const fin = rob(po, ["finish", fo.slug, "--run", "--json"]);
  const finj = jsonOb(fin.stdout) || {};
  const tst = (finj.suiteChecks || []).find((c) => c.name === "test") || {};
  ok(/#2 \(run not observed by the harness\)/.test(doc.out) && stop.code === 1 && /#2 \(run not observed by the harness\)/.test(stop.out) &&
    tst.status === "pass" && tst.observed === "cli" && stOb(fo).finishChecks.test.observed === "cli" && (finj.blockers || []).some((b) => /#2 \(run not observed by the harness\)/.test(b)),
    "feature F1: doctor and stop-check list the unobserved task; finish --run stamps its project-check runs observed: \"cli\" (pass) while the unobserved task still blocks (got " +
    JSON.stringify([stop.code, tst, finj.blockers]).slice(0, 400) + ")");

  // Back to reported: the same records verify (today's rule); help and the header docblock document --evidence.
  rob(po, ["init", "--evidence", "reported"]);
  const docR = rob(po, ["doctor", fo.slug]);
  const help = run(["--help"]).out;
  const docblock = fs.readFileSync(CLI, "utf8").slice(0, 12000);
  ok(!/not observed by the harness/.test(docR.out) && help.includes("--evidence reported|observed") && docblock.includes("--evidence reported|observed"),
    "feature F1: back to meta.evidence reported the unobserved run verifies again; --help and the header docblock document init --evidence reported|observed");
};
