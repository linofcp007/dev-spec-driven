"use strict";
// dev-guardian's gate as the project check `guardian` (1.29): init {guardian}, the launcher, finish's verdict, the offer, the budget.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = async ({ ok, all, rpc, payload, S, tmp, require, __dirname }) => {
  const E = require("./lib/engine/index.js");
  const js = (v) => JSON.stringify(v);
  const call = async (tool, args) => payload(await rpc("tools/call", { name: tool, arguments: args }));
  const write = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  const CMD = "node .specs/guardian.cjs scan --project . --fail-on high --format json";
  const fold = (p) => (process.platform === "win32" ? path.resolve(p).toLowerCase() : path.resolve(p));
  // the env a launcher run gets: no DEV_GUARDIAN_CLI of the test process, Claude Code's config folder as given
  const launch = (dir, args, env) => {
    const e = { ...process.env, ...env };
    for (const k of Object.keys(e)) if (e[k] === null) delete e[k];
    const r = spawnSync(process.execPath, [path.join(dir, ".specs", "guardian.cjs"), ...args], { cwd: dir, encoding: "utf8", env: e, timeout: 30000 });
    let out = null;
    try { out = JSON.parse(r.stdout); } catch { /* not the fake's line */ }
    return { code: r.status, out, stderr: r.stderr || "" };
  };
  // a fake dev-guardian: prints which file ran and its arguments, exits FAKE_EXIT
  const FAKE = "process.stdout.write(JSON.stringify({ argv1: process.argv[1], args: process.argv.slice(2) }) + \"\\n\");\nprocess.exitCode = Number(process.env.FAKE_EXIT || 0);\n";
  const install = (home, market, version, withCli = true) => {
    const dir = path.join(home, "plugins", "cache", market, "dev-guardian", version, "cli");
    fs.mkdirSync(dir, { recursive: true });
    if (withCli) fs.writeFileSync(path.join(dir, "dev-guardian.mjs"), FAKE);
    return path.join(dir, "dev-guardian.mjs");
  };

  // init {guardian: true} stores the check and writes the launcher; false removes both; the meta.checks rules hold (merged with
  // the other checks, validated); over MCP and on the engine alike.
  {
    const p = path.join(tmp, "g-init");
    const on = await call("spec_init", { projectDir: p, checks: { test: "npm test" }, guardian: true });
    const rm = JSON.parse(fs.readFileSync(path.join(p, ".specs", "roadmap.json"), "utf8"));
    const launcher = fs.readFileSync(path.join(p, ".specs", "guardian.cjs"), "utf8");
    const again = S.initProject(p, [], undefined, {});
    const edited = (fs.writeFileSync(path.join(p, ".specs", "guardian.cjs"), "// edited\n"), S.initProject(p, [], undefined, { guardian: true }));
    const restored = fs.readFileSync(path.join(p, ".specs", "guardian.cjs"), "utf8") === launcher;
    const off = await call("spec_init", { projectDir: p, guardian: false });
    const rm2 = JSON.parse(fs.readFileSync(path.join(p, ".specs", "roadmap.json"), "utf8"));
    const badType = await rpc("tools/call", { name: "spec_init", arguments: { projectDir: p, guardian: "yes" } });
    // a launcher that is not the generated one is never removed by off
    write(p, ".specs/guardian.cjs", "// the user's own file\n");
    S.initProject(p, [], undefined, { guardian: false });
    const kept = fs.existsSync(path.join(p, ".specs", "guardian.cjs"));
    all("1.29 init {guardian: true}: meta.checks.guardian = the launcher's command (merged with the other checks), .specs/guardian.cjs written (rewritten when edited), `guardian: true` and a note in the result; {guardian: false} removes the check and the generated launcher (never another file); every init reports `guardian`; a non-boolean is refused by the schema (got " +
      js([on.checks, on.guardian, on.guardianNote, off.checks, off.guardian, rm2.meta]) + ")", {
      stored: rm.meta.checks.guardian === CMD && rm.meta.checks.test === "npm test" && on.checks.guardian === CMD && on.guardian === true,
      note: /dev-guardian's gate is the project check 'guardian' \(node \.specs\/guardian\.cjs scan/.test(on.guardianNote) && /dev-guardian baseline update/.test(on.guardianNote),
      launcher: /^#!\/usr\/bin\/env node\n/.test(launcher) && launcher.includes(CMD) && launcher.includes("DEV_GUARDIAN_CLI") && launcher.includes("CLAUDE_CONFIG_DIR") && !launcher.includes(String.fromCharCode(92)),
      reported: again.guardian === true && !again.guardianNote && !again.guardianOffer,
      rewritten: edited.guardian === true && restored,
      off: off.guardian === false && !("guardian" in off.checks) && off.checks.test === "npm test" && rm2.meta.checks.test === "npm test" && !("guardian" in rm2.meta.checks) && /is off/.test(off.guardianNote),
      notTheUsers: kept,
      schema: badType.result.isError === true,
    });
  }

  // the launcher: DEV_GUARDIAN_CLI first, else the newest <version> (numeric parts) holding cli/dev-guardian.mjs under
  // <CLAUDE_CONFIG_DIR>/plugins/cache/<marketplace>/dev-guardian/ — the engine's guardianCli picks the same file; none → exit 3.
  {
    const p = path.join(tmp, "g-launch");
    S.initProject(p, [], "en", { guardian: true });
    const home = path.join(tmp, "g-home");
    install(home, "dev-guardian", "3.1.0");
    install(home, "dev-guardian", "3.9.2");
    const newest = install(home, "dev-guardian", "3.10.0");
    install(home, "other-market", "3.2.0");
    install(home, "other-market", "4.0.0", false); // a half-removed copy: no CLI
    const r = launch(p, ["scan", "--project", ".", "--format", "json"], { CLAUDE_CONFIG_DIR: home, DEV_GUARDIAN_CLI: null, FAKE_EXIT: "1" });
    const own = install(path.join(tmp, "g-own"), "m", "0.0.1");
    const viaEnv = launch(p, ["scan"], { CLAUDE_CONFIG_DIR: home, DEV_GUARDIAN_CLI: own, FAKE_EXIT: "2" });
    const none = launch(p, ["scan"], { CLAUDE_CONFIG_DIR: path.join(tmp, "g-nothing"), DEV_GUARDIAN_CLI: null });
    const missing = launch(p, ["scan"], { CLAUDE_CONFIG_DIR: home, DEV_GUARDIAN_CLI: path.join(tmp, "nope.mjs") });
    write(tmp, "g-bad/dev-guardian.mjs", "this is not javascript (\n");
    const broken = launch(p, ["scan"], { CLAUDE_CONFIG_DIR: home, DEV_GUARDIAN_CLI: path.join(tmp, "g-bad", "dev-guardian.mjs") });
    all("1.29 the launcher runs the newest installed dev-guardian (3.10.0 over 3.9.2 / 3.2.0 — numeric parts; a version folder without cli/dev-guardian.mjs skipped) with the arguments after its name and passes its exit code; DEV_GUARDIAN_CLI wins; nothing found, a DEV_GUARDIAN_CLI naming no file or a CLI that does not load → exit 3 with a message; the engine's guardianCli picks the same file (got " +
      js([r, viaEnv.code, none, missing.code, broken.code]) + ")", {
      newest: r.code === 1 && !!r.out && fold(r.out.argv1) === fold(newest) && js(r.out.args) === js(["scan", "--project", ".", "--format", "json"]),
      engineAgrees: fold(E.guardianCli({ CLAUDE_CONFIG_DIR: home })) === fold(newest) && fold(E.guardianCli({ CLAUDE_CONFIG_DIR: home, DEV_GUARDIAN_CLI: own })) === fold(own),
      envWins: viaEnv.code === 2 && !!viaEnv.out && fold(viaEnv.out.argv1) === fold(own),
      noneFound: none.code === 3 && /^dev-guardian not found: no dev-guardian plugin in .*plugins.cache — install it, or set DEV_GUARDIAN_CLI/.test(none.stderr) && E.guardianCli({ CLAUDE_CONFIG_DIR: path.join(tmp, "g-nothing") }) === null,
      envNoFile: missing.code === 3 && /dev-guardian not found: DEV_GUARDIAN_CLI names no file/.test(missing.stderr) && E.guardianCli({ DEV_GUARDIAN_CLI: path.join(tmp, "nope.mjs") }) === null,
      notLoaded: broken.code === 3 && /dev-guardian could not be loaded from/.test(broken.stderr),
    });
  }

  // finish reads the guardian check's run — over MCP the agent reports it (the JSON stdout as `report`): exit 0 pass · 1 blocked,
  // the top findings with the feature's own _Implements:_ files first · 2 incomplete · 3 a configuration error (its own message)
  // or no dev-guardian found; a report that doesn't parse leaves the exit code alone. EN / PT / ES.
  {
    const finding = (severity, rule, file, line) => ({ fingerprint: "f", tool: "semgrep", severity, category: "security", title: rule, rule_id: rule, file_path: file, line_start: line, fix_available: false });
    const blocking = [finding("high", "js.xss", "lib/other.js", 7), finding("critical", "gitleaks.aws-key", "lib/keys.js", 2), finding("high", "js.sqli", "src/login.js", 12)];
    const report = (code, extra) => js({ exit_code: code, coverage: code === 2 ? "partial" : "full", coverage_gaps: code === 2 ? ["semgrep: not installed"] : [],
      new_findings: (code === 1 ? blocking : []).concat([finding("low", "x.low", "src/login.js", 1)]), blocking_findings: code === 1 ? blocking : [], baseline_absent: false, ...(extra || {}) });
    const project = (name, lang) => {
      const p = path.join(tmp, name);
      S.initProject(p, [], lang, { guardian: true });
      const f = S.createFeature(p, "Login", ["core"]); // in the project's language
      write(p, "src/login.js", "module.exports = 1;\n");
      write(f.dir, "tasks.md", "- [x] 1. Build it\n  _Implements: src/login.js_\n");
      return { p, slug: f.slug };
    };
    const fin = async (x, code, rep, summary) => call("spec_finish", { projectDir: x.p, name: x.slug, evidence: [{ name: "guardian", command: CMD, exitCode: code, summary: summary || "", ...(rep != null ? { report: rep } : {}) }] });
    const suiteBlocker = (r) => (r.blockers || []).find((b) => /guardian/.test(b)) || "";
    const en = project("g-fin-en", "en");
    const noRun = S.finishFeature(en.p, en.slug);
    const pass = await fin(en, 0, report(0));
    const blocked = await fin(en, 1, report(1));
    const g1 = blocked.suiteChecks[0].guardian;
    const incomplete = await fin(en, 2, report(2));
    const config = await fin(en, 3, "", "error: --fail-on: expected one of info|low|medium|high|critical");
    const notFound = await fin(en, 3, "", "dev-guardian not found: no dev-guardian plugin in /x/plugins/cache — install it");
    const unread = await fin(en, 1, "{ not json");
    const noReport = await fin(en, 1, null);
    const st = JSON.parse(fs.readFileSync(path.join(en.p, ".specs", en.slug, ".state.json"), "utf8")).finishChecks.guardian;
    all("1.29 spec_finish reads the guardian check: no run → the blocker names the command and how to report it over MCP (report = its JSON stdout); exit 0 passes; exit 1 → 'the project check 'guardian' failed — dev-guardian: N new finding(s) at or above high', the feature's own file first, how to clear it (fix, or the user accepts it in dev-guardian — never forced); 2 → incomplete scan + install the scanner / --local-only; 3 → its own message, or not found; an unreadable report → the exit code alone; the verdict in suiteChecks[].guardian, finishChecks and recordedChecks; the report itself never stored (got " +
      js([suiteBlocker(noRun), g1, suiteBlocker(blocked).slice(0, 400), suiteBlocker(incomplete).slice(0, 300), suiteBlocker(config).slice(0, 300)]) + ")", {
      noRun: /'guardian' check runs dev-guardian's scan \(minutes\): over MCP run `node \.specs\/guardian\.cjs scan --project \. --fail-on high --format json` yourself from the project root and report it with spec_finish \{evidence: \[\{name: "guardian", command, exitCode, summary: its stderr's last lines, report: its JSON stdout\}\]\}/.test(suiteBlocker(noRun)),
      pass: pass.suiteChecks[0].status === "pass" && pass.suiteChecks[0].guardian.verdict === "pass" && pass.suiteChecks[0].guardian.newFindings === 1 && !suiteBlocker(pass) &&
        /- guardian: `node \.specs\/guardian\.cjs scan[^`]*` → exit 0 · dev-guardian: pass — no new finding at or above high \(1 new below it\)/.test(pass.mergeSummary),
      verdict: g1.verdict === "blocked" && g1.blocking === 3 && g1.own === 1 && g1.parsed === true && g1.failOn === "high" &&
        js(g1.top.map((f) => [f.file, f.line, f.own])) === js([["src/login.js", 12, true], ["lib/keys.js", 2, false], ["lib/other.js", 7, false]]),
      blocker: /^the project check 'guardian' failed — dev-guardian: 3 new finding\(s\) at or above high, 1 in this feature's files — src\/login\.js:12 js\.sqli \(high\) \[this feature\], lib\/keys\.js:2 gitleaks\.aws-key \(critical\), lib\/other\.js:7 js\.xss \(high\)\. Fix the finding\(s\) — or, only when the user accepts one, record that in dev-guardian \(dev-guardian baseline update, or a suppression\) — then run the check again: node "[^"]*dev-spec\.js" finish login --run\. Never force the finish without the user\.$/.test(suiteBlocker(blocked)),
      recorded: js(blocked.recordedChecks) === js([{ name: "guardian", exitCode: 1, guardian: "blocked" }]) && st.guardian && typeof st.guardian.verdict === "string" && !js(st).includes("exit_code"),
      incomplete: incomplete.suiteChecks[0].guardian.verdict === "incomplete" && /dev-guardian could not run every scanner \(incomplete scan: semgrep: not installed\)\. Install the missing scanner \(dev-guardian's \/guardian-init\), or — offline, when Semgrep could not fetch its rules — add --local-only to the check's command; the check stays failed until it passes or the user changes it\./.test(suiteBlocker(incomplete)),
      config: config.suiteChecks[0].guardian.verdict === "config" && /dev-guardian could not run — a configuration or usage error: error: --fail-on: expected one of info\|low\|medium\|high\|critical\. Fix that, then run the check again: node "[^"]*dev-spec\.js" finish login --run\./.test(suiteBlocker(config)),
      notFound: notFound.suiteChecks[0].guardian.verdict === "not-found" && /dev-guardian was not found — install the dev-guardian plugin, or set DEV_GUARDIAN_CLI to the path of its cli\/dev-guardian\.mjs/.test(suiteBlocker(notFound)),
      unreadable: unread.suiteChecks[0].guardian.parsed === false && unread.suiteChecks[0].guardian.verdict === "blocked" && /the gate failed — a new finding at or above high \(its JSON report could not be read\)/.test(suiteBlocker(unread)) &&
        noReport.suiteChecks[0].guardian.verdict === "blocked" && noReport.suiteChecks[0].guardian.parsed === false,
    });
    const pt = project("g-fin-pt", "pt");
    const es = project("g-fin-es", "es");
    const bPt = suiteBlocker(await fin(pt, 1, report(1)));
    const iEs = suiteBlocker(await fin(es, 2, report(2)));
    const cPt = suiteBlocker(await fin(pt, 3, "", "error: unknown flag"));
    const bEs = suiteBlocker(await fin(es, 1, report(1)));
    all("1.29 the guardian verdict and what to do about it in the feature's language — PT / ES (got " + js([bPt, iEs, cPt, bEs].map((b) => b.slice(0, 200))) + ")", {
      ptBlocked: /^a verificação do projeto 'guardian' falhou — dev-guardian: 3 finding\(s\) novo\(s\) de gravidade high ou superior, 1 nos ficheiros desta feature — src\/login\.js:12 js\.sqli \(high\) \[esta feature\]/.test(bPt) && /Nunca forces o finish sem o utilizador\./.test(bPt),
      esIncomplete: /^la verificación del proyecto 'guardian' falló — dev-guardian no pudo ejecutar todos los escáneres \(escaneo incompleto: semgrep: not installed\)\. Instala el escáner que falta/.test(iEs),
      ptConfig: /o dev-guardian não conseguiu correr — um erro de configuração ou de utilização: error: unknown flag\. Corrige isso e volta a correr a verificação/.test(cPt),
      esBlocked: /\[esta función\]/.test(bEs) && /Nunca fuerces el finish sin el usuario\./.test(bEs),
    });
  }

  // the engine's reading of a run, alone: the JSON among other lines, a BOM, an absolute path inside the project, --fail-on read
  // from the command, the launcher missing (node can't find .specs/guardian.cjs), another exit code; the check is recognized by
  // its name or a `dev-guardian … scan` command.
  {
    const p = path.join(tmp, "g-rec");
    const abs = path.join(p, "src", "a.js");
    const rep = "warning: something\n" + String.fromCharCode(0xfeff) + js({ exit_code: 1, blocking_findings: [{ severity: "medium", rule_id: "r1", file_path: abs, line_start: 3 }] }) + "\n";
    const g = E.guardianRecord(p, null, "node x.cjs scan --fail-on medium --format json", 1, rep, "");
    const nl = E.guardianRecord(p, null, CMD, 1, "", "Error: Cannot find module 'C:/p/.specs/guardian.cjs'\n  code: 'MODULE_NOT_FOUND'");
    const other = E.guardianRecord(p, null, CMD, 137, "", "");
    all("1.29 guardianRecord: the JSON report found among other lines (a BOM too), a finding's absolute path made project-relative, --fail-on read from the command, the missing launcher named (init --guardian writes it again), any other exit code reported as such; isGuardianCheck: the name `guardian` or a dev-guardian scan command (got " + js([g, nl.verdict, other]) + ")", {
      parsed: g.parsed === true && g.failOn === "medium" && g.blocking === 1 && g.top[0].file === "src/a.js" && g.top[0].line === 3,
      noLauncher: nl.verdict === "no-launcher" && /init --guardian writes it again/.test(E.guardianLines(nl, "en")[0]),
      other: other.verdict === "exit" && other.exit === 137 && E.guardianLines(other, "en")[0] === "dev-guardian exited 137",
      recognized: E.isGuardianCheck("guardian", "anything") && E.isGuardianCheck("sec", "node ~/x/dev-guardian.mjs scan --project .") &&
        E.isGuardianCheck("sec", "node \"C:/p/cli/dev-guardian.mjs\" scan") && !E.isGuardianCheck("test", "npm test") && !E.isGuardianCheck("sec", "dev-guardian status"),
    });
  }

  // offered, never set: init and spec_upgrade name `init --guardian` when dev-guardian is installed (the plugin cache under
  // CLAUDE_CONFIG_DIR, or DEV_GUARDIAN_CLI) or the project has .guardian/, and no check runs its gate; nothing otherwise.
  {
    const home = path.join(tmp, "g-offer-home");
    install(home, "dev-guardian", "3.1.0");
    const was = process.env.CLAUDE_CONFIG_DIR;
    const withHome = (fn) => { process.env.CLAUDE_CONFIG_DIR = home; try { return fn(); } finally { if (was === undefined) delete process.env.CLAUDE_CONFIG_DIR; else process.env.CLAUDE_CONFIG_DIR = was; } };
    const a = path.join(tmp, "g-offer-a");
    const installed = withHome(() => S.initProject(a, [], "en", {}));
    const setNow = withHome(() => S.initProject(a, [], "en", { guardian: true }));
    const afterSet = withHome(() => S.initProject(a, [], "en", {}));
    const b = path.join(tmp, "g-offer-b");
    S.initProject(b, [], "pt", {});
    fs.mkdirSync(path.join(b, ".guardian"));
    const folder = S.initProject(b, [], undefined, {});
    const up = S.specUpgrade(b);
    const upLines = S.upgradeLines(up).join("\n");
    const c = path.join(tmp, "g-offer-c");
    const nothing = S.initProject(c, [], "es", {});
    const upNone = S.specUpgrade(c);
    const mcp = await call("spec_init", { projectDir: b });
    all("1.29 the offer: init (and spec_upgrade, as the project's attention item) name `init --guardian` once dev-guardian is installed or the project has .guardian/ — never setting it (no meta.checks written); nothing once a check runs the gate, nothing without dev-guardian (got " +
      js([installed.guardianOffer, folder.guardianOffer, up.guardianOffer, nothing.guardianOffer]) + ")", {
      installed: /^dev-guardian is installed: node "[^"]*dev-spec\.js" init --guardian \(spec_init \{guardian: true\}\) adds its gate as the project check 'guardian' — \/spec-finish \(finish --run\) then runs dev-guardian's scan, which takes minutes and needs its scanners/.test(installed.guardianOffer || "") && !("guardian" in installed.checks),
      notAfterSet: setNow.guardian === true && !setNow.guardianOffer && !afterSet.guardianOffer,
      folderPt: /^Este projeto tem \.guardian\/ \(dev-guardian\): node "[^"]*dev-spec\.js" init --guardian/.test(folder.guardianOffer || "") && !("guardian" in folder.checks),
      upgrade: up.guardianOffer === folder.guardianOffer && upLines.includes("  ▲ " + up.guardianOffer) && !upNone.guardianOffer,
      mcp: mcp.guardianOffer === folder.guardianOffer,
      nothing: !nothing.guardianOffer && nothing.guardian === false,
    });
  }

  // the approval guard: spec_init {guardian: false} (or `init --guardian off`) removes a check — a guard-down, asked / refused with the
  // human's own command; adding the gate is none.
  {
    const meta = { checks: { guardian: CMD } };
    const C = "C:/plugins/dev-spec-driven/cli/dev-spec.js";
    const d = (tool, input, m) => S.approvalGuardDecision({ hook_event_name: "PreToolUse", tool_name: tool, tool_input: input }, "deny", { meta: m, lang: "en" });
    const offMcp = d("mcp__p__spec_init", { guardian: false }, meta);
    const onMcp = d("mcp__p__spec_init", { guardian: true }, {});
    const offCli = d("Bash", { command: "node \"" + C + "\" init --guardian off" }, meta);
    const onCli = d("Bash", { command: "node \"" + C + "\" init --guardian" }, {});
    const replace = d("Bash", { command: "node \"" + C + "\" init --guardian" }, { checks: { guardian: "npm run my-scan" } });
    all("1.29 the approval guard: removing the guardian check (spec_init {guardian: false}, init --guardian off) — or replacing another command under that name — is a guard-down whose own command is `init --guardian off` / `init --guardian`; adding it is none (got " +
      js([offMcp.decision, offMcp.command, offCli.decision, offCli.command, onMcp.decision, onCli.decision, replace.decision, replace.command]) + ")", {
      offMcp: offMcp.decision === "deny" && /init --guardian off$/.test(offMcp.command || ""),
      offCli: offCli.decision === "deny" && offCli.actions.some((a) => a.kind === "guard-down" && a.setting === "check" && a.name === "guardian") && /init --guardian off$/.test(offCli.command || ""),
      adding: onMcp.decision === "allow" && onCli.decision === "allow",
      replacing: replace.decision === "deny" && /init --guardian on$/.test(replace.command || ""),
    });
  }

  // dev-guardian's duplication budget (.guardian/budgets.yml → quality.duplication_pct): the project report shows the project's share
  // beside it; finish's duplicate warning says so only when the project is over it; a missing, broken or other-shaped file reads as none.
  {
    const p = path.join(tmp, "g-budget");
    S.initProject(p, [], "en", {});
    const body = Array.from({ length: 10 }, (_, i) => "  const value" + i + " = computeSomething(input, " + i + ", options.flagName);").join("\n");
    write(p, "src/a.js", "function a(input, options) {\n" + body + "\n}\n");
    write(p, "src/b.js", "function b(input, options) {\n" + body + "\n}\n");
    write(p, "src/c.js", "function c() {\n  return 1;\n}\n");
    const f = S.createFeature(p, "Copy", ["core"]);
    write(f.dir, "tasks.md", "- [x] 1. Copy it\n  _Implements: src/b.js_\n");
    const none = S.duplicationReport(p);
    const budgetOf = (text) => { write(p, ".guardian/budgets.yml", text); return S.duplicationReport(p).budget; };
    const block = budgetOf("# budgets\nperf:\n  lcp_ms: 2500\nquality:\n  complexity: 15\n  duplication_pct: 5   # jscpd\n");
    const finOver = S.finishFeature(p, f.slug).warnings.find((w) => /repeats existing code/.test(w)) || "";
    const flow = budgetOf("quality: { complexity: 15, duplication_pct: 95 }\n");
    const finUnder = S.finishFeature(p, f.slug).warnings.find((w) => /repeats existing code/.test(w)) || "";
    const elsewhere = budgetOf("perf:\n  duplication_pct: 1\n");
    const garbage = budgetOf("quality:\n  duplication_pct: lots\n");
    const broken = budgetOf("{{{ not yaml");
    write(p, ".guardian/budgets.yml", "quality:\n  duplication_pct: 5\n");
    const viaMcp = await call("spec_scan", { projectDir: p, duplicates: true });
    const feat = S.duplicationReport(p, { name: f.slug });
    all("1.29 the duplication budget: the project report's `budget` {limit, measured (the project's duplicated share, %), over, note} from .guardian/budgets.yml quality.duplication_pct (block or flow mapping, comments) — the note says dev-spec's windows and jscpd's measure are close, not identical; finish's warning mentions it only when over; another section's key, a non-number, broken YAML or no file → none; a feature's report has none (got " +
      js([block, flow && flow.over, finOver.slice(-200), elsewhere, garbage, broken]) + ")", {
      none: !none.budget,
      block: !!block && block.limit === 5 && block.measured > 5 && block.over === true && block.file === ".guardian/budgets.yml" && block.key === "quality.duplication_pct" &&
        /^Duplicated code: \d+(\.\d)?% of the code lines read — dev-guardian's budget \(\.guardian\/budgets\.yml quality\.duplication_pct\) is 5%: OVER the budget\. \(dev-spec counts windows of 6 code lines; dev-guardian measures with jscpd — close, not identical\.\)$/.test(block.note),
      finishOver: /; the project as a whole is over dev-guardian's duplication budget — \d+(\.\d)?% of its code lines repeat \(budget 5%, \.guardian\/budgets\.yml; dev-spec's measure, close to jscpd's but not identical\)$/.test(finOver),
      flowUnder: !!flow && flow.limit === 95 && flow.over === false && /within it/.test(flow.note) && !!finUnder && !/duplication budget/.test(finUnder),
      ignored: elsewhere === undefined && garbage === undefined && broken === undefined,
      mcp: !!viaMcp.budget && viaMcp.budget.limit === 5 && viaMcp.budget.over === true && js(viaMcp.budget) === js(S.duplicationReport(p).budget),
      feature: !feat.budget,
    });
  }
};
