"use strict";
// dev-guardian's gate on the CLI (1.29) — init --guardian, finish --run reading its exit code and JSON report, the offer, the budget.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = ({ ok, all, runIn, spawnIn, tmp, CLI, require, __dirname }) => {
  const S = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const js = (v) => JSON.stringify(v);
  const json = (s) => { try { return JSON.parse(s); } catch { return null; } };
  const write = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  const CMD = "node .specs/guardian.cjs scan --project . --fail-on high --format json";
  const cli = (proj, args, env) => runIn([...args, "--project", proj], { env: { ...process.env, ...(env || {}) } });
  // finish --run runs the check: a real process (it waits for it)
  const finishRun = (proj, slug, env, extra) => {
    const r = spawnSync(process.execPath, [CLI, "finish", slug, "--run", "--project", proj, ...(extra || [])], { encoding: "utf8", env: { ...process.env, ...env }, timeout: 60000 });
    return { out: (r.stdout || "") + (r.stderr || ""), stdout: r.stdout || "", code: r.status };
  };
  // a fake dev-guardian: the JSON report of a gate (FAKE_EXIT 0 · 1 · 2), or a usage error on stderr (3)
  const fake = path.join(tmp, "dg-fake", "dev-guardian.mjs");
  write(tmp, "dg-fake/dev-guardian.mjs", [
    "const code = Number(process.env.FAKE_EXIT || 0);",
    "const f = (severity, rule, file, line) => ({ fingerprint: \"x\", tool: \"semgrep\", severity, category: \"security\", title: rule, rule_id: rule, file_path: file, line_start: line, fix_available: false });",
    "const blocking = code === 1 ? [f(\"high\", \"js.xss\", \"lib/other.js\", 7), f(\"high\", \"js.sqli\", \"src/login.js\", 12)] : [];",
    "if (code === 3) { console.error(\"error: Unknown flag: --bogus\"); process.exitCode = 3; }",
    "else {",
    "  process.stdout.write(JSON.stringify({ exit_code: code, coverage: code === 2 ? \"partial\" : \"full\", coverage_gaps: code === 2 ? [\"trivy: not installed\"] : [],",
    "    new_findings: blocking, blocking_findings: blocking, baseline_absent: false }, null, 2) + \"\\n\");",
    "  process.exitCode = code;",
    "}",
    ""].join("\n"));
  const project = (name, lang) => {
    const p = path.join(tmp, name);
    S.initProject(p, ["core"], lang, {});
    const f = S.createFeature(p, "Login", ["core"]);
    write(p, "src/login.js", "module.exports = 1;\n");
    write(f.dir, "tasks.md", "- [x] 1. Build it\n  _Implements: src/login.js_\n");
    return { p, slug: f.slug };
  };

  // init --guardian (bare = on), --guardian off, a bad value; --json reports `guardian`; the approval-free, offered-never-set rule
  {
    const x = project("dg-init", "en");
    const on = cli(x.p, ["init", "--guardian"]);
    const rm = json(fs.readFileSync(path.join(x.p, ".specs", "roadmap.json"), "utf8"));
    const launcher = fs.existsSync(path.join(x.p, ".specs", "guardian.cjs"));
    const onJ = json(cli(x.p, ["init", "--guardian", "on", "--json"]).out);
    const off = cli(x.p, ["init", "--guardian", "off"]);
    const bad = cli(x.p, ["init", "--guardian", "maybe"]);
    const badJ = json(spawnIn(["init", "--guardian=maybe", "--json", "--project", x.p], { env: process.env }).stdout);
    const after = json(fs.readFileSync(path.join(x.p, ".specs", "roadmap.json"), "utf8"));
    all("1.29 init --guardian: a bare --guardian (or on) stores meta.checks.guardian = `" + CMD + "` and writes .specs/guardian.cjs (its note printed); off removes both; another value is refused before anything is written (exit 1); --json is spec_init's result (got " +
      js([on.out.split("\n").slice(-2), onJ && onJ.guardian, off.out.split("\n").slice(-2), bad.out.trim(), badJ]) + ")", {
      on: on.code === 0 && rm.meta.checks.guardian === CMD && launcher && /dev-guardian's gate is the project check 'guardian'/.test(on.out),
      json: !!onJ && onJ.guardian === true && onJ.checks.guardian === CMD,
      off: off.code === 0 && /The project check 'guardian' is off/.test(off.out) && !fs.existsSync(path.join(x.p, ".specs", "guardian.cjs")) && !(after.meta.checks || {}).guardian,
      bad: bad.code === 1 && /--guardian expects on or off \(got 'maybe'\) — a bare --guardian is on/.test(bad.out) && !!badJ && badJ.ok === false,
    });
  }

  // finish --run runs the check like any other and reads it: 0 pass · 1 the findings, the feature's file first, how to clear them ·
  // 2 incomplete · 3 dev-guardian's own message; under bash and cmd.exe / PowerShell where they are; EN / PT / ES.
  {
    const en = project("dg-fin-en", "en");
    S.initProject(en.p, [], undefined, { guardian: true });
    const env = (code) => ({ DEV_GUARDIAN_CLI: fake, FAKE_EXIT: String(code) });
    const r0 = finishRun(en.p, en.slug, env(0));
    const r1 = finishRun(en.p, en.slug, env(1));
    const r2 = finishRun(en.p, en.slug, env(2));
    const r3 = finishRun(en.p, en.slug, env(3));
    const r1j = json(finishRun(en.p, en.slug, env(1), ["--json"]).stdout);
    const nf = finishRun(en.p, en.slug, { DEV_GUARDIAN_CLI: path.join(tmp, "no-such.mjs") });
    const st = json(fs.readFileSync(path.join(en.p, ".specs", en.slug, ".state.json"), "utf8")).finishChecks.guardian;
    all("1.29 finish --run with the guardian check: its verdict printed instead of the JSON (pass; N new findings at or above high with the feature's own file first; incomplete scan; dev-guardian's own message; not found) and recorded — the report never stored; the blocker says how to clear it, never to force; --json carries suiteChecks[].guardian (got " +
      js([r0.out.split("\n").slice(0, 3), r1.out.split("\n").slice(0, 5), r2.out.split("\n")[1], r3.out.split("\n")[1], nf.out.split("\n")[1]]) + ")", {
      ran: r0.out.startsWith("$ " + CMD + "   (guardian)\n"),
      pass: /\n {2}dev-guardian: pass — no new finding at or above high\n/.test(r0.out) && !/the project check 'guardian' failed/.test(r0.out),
      blocked: /\n {2}dev-guardian: 2 new finding\(s\) at or above high, 1 in this feature's files\n {4}src\/login\.js:12 js\.sqli \(high\) \[this feature\]\n {4}lib\/other\.js:7 js\.xss \(high\)\n/.test(r1.out) &&
        /✗ the project check 'guardian' failed — dev-guardian: 2 new finding\(s\)[^\n]*Never force the finish without the user\./.test(r1.out) && r1.code === 1 && !/"exit_code"/.test(r1.out),
      incomplete: /\n {2}dev-guardian could not run every scanner \(incomplete scan: trivy: not installed\)\n/.test(r2.out) && /Install the missing scanner/.test(r2.out),
      config: /\n {2}dev-guardian could not run — a configuration or usage error: error: Unknown flag: --bogus\n/.test(r3.out),
      notFound: /\n {2}dev-guardian was not found — install the dev-guardian plugin, or set DEV_GUARDIAN_CLI/.test(nf.out),
      json: !!r1j && r1j.suiteChecks[0].guardian.verdict === "blocked" && r1j.suiteChecks[0].guardian.top[0].own === true && js(r1j.recordedChecks) === js([{ name: "guardian", exitCode: 1, guardian: "blocked" }]),
      stored: !!st && st.guardian.verdict === "not-found" && st.exitCode === 3 && !js(st).includes("blocking_findings"),
    });
    const pt = project("dg-fin-pt", "pt");
    S.initProject(pt.p, [], undefined, { guardian: true });
    const es = project("dg-fin-es", "es");
    S.initProject(es.p, [], undefined, { guardian: true });
    const p1 = finishRun(pt.p, pt.slug, env(1));
    const e2 = finishRun(es.p, es.slug, env(2));
    all("1.29 finish --run's guardian lines in the feature's language — PT / ES (got " + js([p1.out.split("\n").slice(1, 3), e2.out.split("\n")[1]]) + ")", {
      pt: /\n {2}dev-guardian: 2 finding\(s\) novo\(s\) de gravidade high ou superior, 1 nos ficheiros desta feature\n {4}src\/login\.js:12 js\.sqli \(high\) \[esta feature\]/.test(p1.out) && /✗ a verificação do projeto 'guardian' falhou/.test(p1.out),
      es: /\n {2}dev-guardian no pudo ejecutar todos los escáneres \(escaneo incompleto: trivy: not installed\)\n/.test(e2.out) && /✗ la verificación del proyecto 'guardian' falló/.test(e2.out),
    });
    // the stored command is shell-neutral: the same verdict under every shell finish --run can use here (POSIX: sh always —
    // an Alpine image has no bash —, and bash where it exists)
    const shells = (process.platform === "win32" ? ["cmd", "bash", "powershell", "pwsh"] : ["sh", "bash"]).filter((sh) => spawnSync(sh === "cmd" ? "cmd.exe" : sh, sh === "cmd" ? ["/c", "exit 0"] : sh === "bash" || sh === "sh" ? ["-c", "exit 0"] : ["-NoProfile", "-Command", "exit 0"], { timeout: 20000 }).status === 0);
    const bySh = shells.map((sh) => [sh, finishRun(en.p, en.slug, env(1), ["--shell", sh])]);
    const badSh = bySh.filter(([, r]) => !/\n {2}dev-guardian: 2 new finding\(s\) at or above high, 1 in this feature's files\n/.test(r.out)).map(([sh, r]) => sh + ": " + r.out.slice(0, 200));
    ok(shells.length >= 1 && !badSh.length, "1.29 the guardian check's command runs alike under " + shells.join(", ") + " (no shell syntax but its arguments) (bad: " + js(badSh) + ")");
  }

  // the offer (init, upgrade) and the duplication budget line (dupes) on the CLI
  {
    const home = path.join(tmp, "dg-home");
    write(home, "plugins/cache/dev-guardian/dev-guardian/3.1.0/cli/dev-guardian.mjs", "process.exitCode = 0;\n");
    const p = path.join(tmp, "dg-offer");
    const offered = cli(p, ["init"], { CLAUDE_CONFIG_DIR: home });
    const plain = cli(path.join(tmp, "dg-offer-none"), ["init"]);
    const up = cli(p, ["upgrade"], { CLAUDE_CONFIG_DIR: home });
    const body = Array.from({ length: 10 }, (_, i) => "  const value" + i + " = computeSomething(input, " + i + ", options.flagName);").join("\n");
    write(p, "src/a.js", "function a(input, options) {\n" + body + "\n}\n");
    write(p, "src/b.js", "function b(input, options) {\n" + body + "\n}\n");
    write(p, ".guardian/budgets.yml", "quality:\n  duplication_pct: 5\n");
    const dupes = cli(p, ["dupes"]);
    const dupesJ = json(cli(p, ["dupes", "--json"]).out);
    all("1.29 the CLI: init and upgrade offer `init --guardian` when dev-guardian is installed (never set it); without it nothing; dupes prints the project's duplicated share beside dev-guardian's budget, flagged when over (got " +
      js([offered.out.split("\n").pop(), up.out.split("\n").filter((l) => /dev-guardian/.test(l)), dupes.out.split("\n").pop()]) + ")", {
      init: /\n {2}dev-guardian is installed: node "[^"]*dev-spec\.js" init --guardian \(spec_init \{guardian: true\}\)/.test(offered.out) && !fs.existsSync(path.join(p, ".specs", "guardian.cjs")),
      none: plain.code === 0 && !/dev-guardian/.test(plain.out),
      upgrade: up.out.split("\n").some((l) => /^ {2}▲ dev-guardian is installed: /.test(l)),
      dupes: /\n {2}⚠ Duplicated code: \d+(\.\d)?% of the code lines read — dev-guardian's budget \(\.guardian\/budgets\.yml quality\.duplication_pct\) is 5%: OVER the budget\./.test(dupes.out) &&
        !!dupesJ && dupesJ.budget && dupesJ.budget.over === true,
    });
  }
};
