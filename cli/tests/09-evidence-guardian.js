"use strict";
// dev-guardian's gate on the CLI (1.29) — init --guardian, finish --run reading its exit code and JSON report, the launcher check, the offer, the budget.

const fs = require("fs");
const path = require("path");
const MSG = require(path.join(__dirname, "..", "..", "mcp", "lib", "i18n.js")).msg; // a message checked against its i18n entry, not a pinned sentence (1.30)
const { spawnSync } = require("child_process");

exports.run = async ({ ok, all, runIn, spawnIn, spawnAsync, tmp, CLI, require, __dirname }) => {
  const S = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const js = (v) => JSON.stringify(v);
  const json = (s) => { try { return JSON.parse(s); } catch { return null; } };
  const write = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  const CMD = "node .specs/guardian.cjs scan --project . --fail-on high --format json";
  const LAUNCHER_129 = fs.readFileSync(path.join(__dirname, "..", "mcp", "tests", "fixtures", "guardian-launcher-1.29.cjs"), "utf8");
  const cli = (proj, args, env) => runIn([...args, "--project", proj], { env: { ...process.env, ...(env || {}) } });
  // finish --run runs the check: in-process, awaited (1.30 — spawnAsync: the CLI's own process start saved; the check is still a process)
  const finishRun = async (proj, slug, env, extra) => {
    const r = await spawnAsync(["finish", slug, "--run", "--project", proj, ...(extra || [])], { env: { ...process.env, ...env } });
    return { out: (r.stdout || "") + (r.stderr || ""), stdout: r.stdout || "", code: r.status };
  };
  // a fake dev-guardian: the JSON report of a gate (FAKE_EXIT 0 · 1 · 2) in 3.3.0's shape (tool_version, baseline_status) — FAKE_SHAPE=old:
  // 3.2.1's (neither) —, or a usage error on stderr (3; FAKE_NOISE: 30 lines after it). FAKE_MISMATCH: the report says exit 1, the process
  // exits 0. FAKE_MARK: a file it writes when it runs. FAKE_REPORTS: it writes .guardian/reports/<n>.json in the project, as dev-guardian does.
  // FAKE_V34 (1.30.2 — dev-guardian 3.4.0's keys, each scan step repeating its line): "accepted" (a per-file timeout accepted in
  // .guardian/scan.yml, an unused acceptance, a taint note and the dropped-baseline note) · "timeout" (a Semgrep timeout not accepted) ·
  // "gout" (a tracked file in .guardian/'s output: kind other, dev-guardian's remedy) · "acceptedDetails" (3.4.0's accepted_gap_details beside
  // lines of a wording the line reader can't parse, and two unused acceptances) · "acceptedOwn" (the accepted file is the feature's own,
  // src/login.js) · "changed" (review 12 — dev-guardian 3.4.0's final entry for a listed file that changed since: cause
  // accepted_file_changed, its own remedy) · "changedWording" (the same case in a pre-release build: no cause, the wording alone, a gap
  // line of ~420 characters, the "list it there" remedy).
  const CHANGED = { tool: "semgrep", kind: "file_timeout", detail: "security_scan_full: semgrep ran with reduced coverage (partial) — not accepted: Timeout on src/huge.js, listed in .guardian/scan.yml semgrep.accept_timeouts, but changed since BASE: …",
    remedy: "The file is listed in .guardian/scan.yml semgrep.accept_timeouts, but it changed since that acceptance was reviewed (…): review the change as if no SAST ran on it, then raise semgrep.timeout … — or, after review, commit .guardian/scan.yml again … to accept the file as it is now.",
    gating: true, cause: "accepted_file_changed" };
  const fake = path.join(tmp, "dg-fake", "dev-guardian.mjs");
  write(tmp, "dg-fake/dev-guardian.mjs", [
    "const CHANGED = " + JSON.stringify(CHANGED) + ";",
    "import fs from \"node:fs\";",
    "const code = Number(process.env.FAKE_EXIT || 0);",
    "const steps = (l) => [\"security_scan_full: \" + l, \"map_attack_surface: \" + l];",
    "const det = (tool, kind, detail, remedy, gating) => ({ tool, kind, detail, remedy, gating });",
    "const TR = \"Raise semgrep.timeout in .guardian/scan.yml, or after review list the file under semgrep.accept_timeouts there and commit it.\";",
    "const ACC = steps(\"semgrep timed out on src/big.js — accepted (.guardian/scan.yml semgrep.accept_timeouts)\");",
    "const NOTES = steps(\"semgrep taint analysis incomplete (Semgrep fixpoint timeout) in 1 file(s): src/a.js — taint findings in those functions may be missing (not gating)\").concat([\"baseline: 1 entry could not be read and is no longer suppressed\"]);",
    "const TO = steps(\"semgrep ran with reduced coverage (partial: 1 file(s) only partly parsed (Timeout: src/big.js)) — not accepted: Timeout on src/big.js\");",
    "const GOUT = steps(\"semgrep ran with reduced coverage (1 file(s) git tracks in .guardian/'s generated output were not scanned: .guardian/reports/evil.js)\");",
    "const CHG = steps(\"semgrep ran with reduced coverage (partial: 1 file(s) only partly parsed — findings in the unparsed spans may be missing (Timeout: src/big.js)) — not accepted: Timeout on src/big.js, listed in .guardian/scan.yml semgrep.accept_timeouts, but changed since BASE: an acceptance covers a file only as it was at the ref — review the change as if no SAST ran on it, or raise semgrep.timeout\");",
    "const GOUT_R = \"Stop tracking the named files (`git rm --cached <file>`) and move any code they hold out of .guardian/ — dev-guardian's reports, database and dashboard are never committed, and no scan reads them.\";",
    "const v34 = ({ accepted: { coverage: \"partial\", accepted_gaps: ACC, unused_timeout_acceptances: [\"src/gone.js\"], coverage_notes: NOTES, coverage_gap_details: ACC.map((l) => det(\"semgrep\", \"file_timeout\", l, TR, false)) },",
    "  timeout: { coverage_gaps: TO, coverage_gap_details: TO.map((l) => det(\"semgrep\", \"file_timeout\", l, TR, true)) },",
    "  gout: { coverage_gaps: GOUT, coverage_gap_details: GOUT.map((l) => det(\"semgrep\", \"other\", l, GOUT_R, true)) },",
    "  acceptedDetails: { tool_version: \"3.4.0\", coverage: \"partial\", accepted_gaps: steps(\"semgrep: src/big.js not analysed (Timeout) — accepted in .guardian/scan.yml\"),",
    "    accepted_gap_details: [0, 1].map(() => ({ tool: \"semgrep\", kind: \"file_timeout\", file: \"src/big.js\", reason: \"Timeout\" })), unused_timeout_acceptances: [\"src/gone.js\", \"src/old.js\"] },",
    "  acceptedOwn: { coverage: \"partial\", accepted_gaps: steps(\"semgrep timed out on src/login.js — accepted (.guardian/scan.yml semgrep.accept_timeouts)\"),",
    "    accepted_gap_details: [0, 1].map(() => ({ tool: \"semgrep\", kind: \"file_timeout\", file: \"src/login.js\", reason: \"Timeout — accepted by .guardian/scan.yml semgrep.accept_timeouts\" })) },",
    "  changed: { coverage_gaps: [CHANGED.detail], coverage_gap_details: [CHANGED] },",
    "  changedWording: { coverage_gaps: CHG, coverage_gap_details: CHG.map((l) => det(\"semgrep\", \"file_timeout\", l, TR, true)) } })[process.env.FAKE_V34 || \"\"] || {};",
    "if (process.env.FAKE_MARK) fs.writeFileSync(process.env.FAKE_MARK, process.argv.slice(2).join(\" \"));",
    "if (process.env.FAKE_REPORTS) { fs.mkdirSync(\".guardian/reports\", { recursive: true }); fs.writeFileSync(\".guardian/reports/\" + Date.now() + \".json\", \"{}\"); }",
    "const f = (severity, rule, file, line) => ({ fingerprint: \"x\", tool: \"semgrep\", severity, category: \"security\", title: rule, rule_id: rule, file_path: file, line_start: line, fix_available: false });",
    "const blocking = code === 1 || process.env.FAKE_MISMATCH ? [f(\"high\", \"js.xss\", \"lib/other.js\", 7), f(\"high\", \"js.sqli\", \"src/login.js\", 12)] : [];",
    "const shape = process.env.FAKE_SHAPE === \"old\" ? {} : { tool_version: \"3.3.0\", baseline_status: \"present\" };",
    "if (code === 3) { console.error(\"error: Unknown flag: --bogus\"); if (process.env.FAKE_NOISE) for (let i = 0; i < 30; i++) console.error(\"  at frame \" + i); process.exitCode = 3; }",
    "else {",
    "  process.stdout.write(JSON.stringify({ exit_code: process.env.FAKE_MISMATCH ? 1 : code, coverage: code === 2 ? \"partial\" : \"full\", coverage_gaps: code === 2 ? [\"trivy: not installed\"] : [],",
    "    new_findings: blocking, blocking_findings: blocking, baseline_absent: false, ...shape, ...v34 }, null, 2) + \"\\n\");",
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
  const stateOf = (x) => json(fs.readFileSync(path.join(x.p, ".specs", x.slug, ".state.json"), "utf8"));

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
    all("1.29 init --guardian: a bare --guardian (or on) stores meta.checks.guardian = `" + CMD + "` and writes .specs/guardian.cjs (its note printed — 1.30: project-wide, no baseline yet, the .gitignore lines); off removes both; another value is refused before anything is written (exit 1); --json is spec_init's result (got " +
      js([on.out.split("\n").slice(-2), onJ && onJ.guardian, off.out.split("\n").slice(-2), bad.out.trim(), badJ]) + ")", {
      on: on.code === 0 && rm.meta.checks.guardian === CMD && launcher && on.out.includes(MSG("en").guardian.on(CMD)) &&
        /It is project-wide/.test(on.out) && /No baseline yet/.test(on.out) && /\.gitignore: \*\*\/\.guardian\/\*/.test(on.out),
      json: !!onJ && onJ.guardian === true && onJ.checks.guardian === CMD,
      off: off.code === 0 && /The project check 'guardian' is off/.test(off.out) && !fs.existsSync(path.join(x.p, ".specs", "guardian.cjs")) && !(after.meta.checks || {}).guardian,
      bad: bad.code === 1 && /--guardian expects on or off \(got 'maybe'\) — a bare --guardian is on/.test(bad.out) && !!badJ && badJ.ok === false,
    });
  }

  // finish --run runs the check like any other and reads it: 0 pass · 1 the findings, the feature's file first, how to clear them ·
  // 2 incomplete · 3 dev-guardian's own message; under bash and cmd.exe / PowerShell where they are; EN / PT / ES.
  const env = (code, extra) => ({ DEV_GUARDIAN_CLI: fake, FAKE_EXIT: String(code), ...(extra || {}) });
  {
    const en = project("dg-fin-en", "en");
    S.initProject(en.p, [], undefined, { guardian: true });
    const r0 = await finishRun(en.p, en.slug, env(0));
    const r1 = await finishRun(en.p, en.slug, env(1));
    const r2 = await finishRun(en.p, en.slug, env(2));
    const r3 = await finishRun(en.p, en.slug, env(3));
    const r1j = json((await finishRun(en.p, en.slug, env(1), ["--json"])).stdout);
    const nf = await finishRun(en.p, en.slug, { DEV_GUARDIAN_CLI: path.join(tmp, "no-such", "dev-guardian.mjs") });
    const st = stateOf(en).finishChecks.guardian;
    all("1.29 finish --run with the guardian check: its verdict printed instead of the JSON (pass; N new findings at or above high with the feature's own file first; incomplete scan; dev-guardian's own message; not found) and recorded — the report never stored; the blocker says how to clear it, never to force; --json carries suiteChecks[].guardian (got " +
      js([r0.out.split("\n").slice(0, 3), r1.out.split("\n").slice(0, 5), r2.out.split("\n")[1], r3.out.split("\n")[1], nf.out.split("\n")[1]]) + ")", {
      ran: r0.out.startsWith("$ " + CMD + "   (guardian)\n"),
      pass: /\n {2}dev-guardian: pass — no new finding at or above high \(dev-guardian from DEV_GUARDIAN_CLI=[^)]*dev-guardian\.mjs\)\n/.test(r0.out) && !/the project check 'guardian' failed/.test(r0.out) && !/update dev-guardian/.test(r0.out),
      blocked: /\n {2}dev-guardian: 2 new finding\(s\) at or above high, 1 in this feature's files[^\n]*\n {4}src\/login\.js:12 js\.sqli \(high\) \[this feature\]\n {4}lib\/other\.js:7 js\.xss \(high\)\n/.test(r1.out) &&
        /✗ the project check 'guardian' failed — dev-guardian: 2 new finding\(s\)[^\n]*Never force the finish without the user\./.test(r1.out) && r1.code === 1 && !/"exit_code"/.test(r1.out),
      incomplete: /\n {2}dev-guardian could not run every scanner \(incomplete scan: trivy: not installed\)[^\n]*\n/.test(r2.out) && /Install the missing scanner/.test(r2.out),
      config: /\n {2}dev-guardian could not run — a configuration or usage error: error: Unknown flag: --bogus/.test(r3.out),
      notFound: /\n {2}dev-guardian was not found — install the dev-guardian plugin, or set DEV_GUARDIAN_CLI/.test(nf.out),
      json: !!r1j && r1j.suiteChecks[0].guardian.verdict === "blocked" && r1j.suiteChecks[0].guardian.top[0].own === true && js(r1j.recordedChecks) === js([{ name: "guardian", exitCode: 1, guardian: "blocked" }]),
      stored: !!st && st.guardian.verdict === "not-found" && st.exitCode === 3 && !js(st).includes("blocking_findings"),
    });
    const pt = project("dg-fin-pt", "pt");
    S.initProject(pt.p, [], undefined, { guardian: true });
    const es = project("dg-fin-es", "es");
    S.initProject(es.p, [], undefined, { guardian: true });
    const p1 = await finishRun(pt.p, pt.slug, env(1));
    const e2 = await finishRun(es.p, es.slug, env(2));
    all("1.29 finish --run's guardian lines in the feature's language — PT / ES (got " + js([p1.out.split("\n").slice(1, 3), e2.out.split("\n")[1]]) + ")", {
      pt: /\n {2}dev-guardian: 2 finding\(s\) novo\(s\) de gravidade high ou superior, 1 nos ficheiros desta feature[^\n]*\n {4}src\/login\.js:12 js\.sqli \(high\) \[esta feature\]/.test(p1.out) && /✗ a verificação do projeto 'guardian' falhou/.test(p1.out),
      es: /\n {2}dev-guardian no pudo ejecutar todos los escáneres \(escaneo incompleto: trivy: not installed\)[^\n]*\n/.test(e2.out) && /✗ la verificación del proyecto 'guardian' falló/.test(e2.out),
    });
    // the stored command is shell-neutral: the same verdict under every shell finish --run can use here (POSIX: sh always —
    // an Alpine image has no bash —, and bash where it exists)
    const shells = (process.platform === "win32" ? ["cmd", "bash", "powershell", "pwsh"] : ["sh", "bash"]).filter((sh) => spawnSync(sh === "cmd" ? "cmd.exe" : sh, sh === "cmd" ? ["/c", "exit 0"] : sh === "bash" || sh === "sh" ? ["-c", "exit 0"] : ["-NoProfile", "-Command", "exit 0"], { timeout: 20000 }).status === 0);
    const bySh = [];
    for (const sh of shells) bySh.push([sh, await finishRun(en.p, en.slug, env(1), ["--shell", sh])]);
    const badSh = bySh.filter(([, r]) => !/\n {2}dev-guardian: 2 new finding\(s\) at or above high, 1 in this feature's files/.test(r.out)).map(([sh, r]) => sh + ": " + r.out.slice(0, 200));
    ok(shells.length >= 1 && !badSh.length, "1.29 the guardian check's command runs alike under " + shells.join(", ") + " (no shell syntax but its arguments) (bad: " + js(badSh) + ")");
  }

  // 1.30.2 (review 11): dev-guardian 3.4.0's keys through finish --run — a pass with an accepted per-file timeout prints how many files
  // were not analysed, the accepted line once (not once per scan step) and the notes, warns (▲, never ✗), and the merge summary counts
  // the notes; nothing of the report's own lines is stored. A Semgrep timeout's hint is the scan.yml remedy; the tracked .guardian/
  // output gets dev-guardian's remedy, once.
  {
    const x = project("dg-fin-340", "en");
    S.initProject(x.p, [], undefined, { guardian: true });
    const G = MSG("en").guardian;
    const ACC1 = G.accepted(1, 0, 0);
    const rA = await finishRun(x.p, x.slug, env(0, { FAKE_V34: "accepted" }), ["--include-body"]);
    const st = stateOf(x).finishChecks.guardian;
    const rT = await finishRun(x.p, x.slug, env(2, { FAKE_V34: "timeout" }));
    const rG = await finishRun(x.p, x.slug, env(2, { FAKE_V34: "gout" }));
    // 3.4.0's accepted_gap_details read before lines the line reader can't parse; two unused acceptances
    const rDet = await finishRun(x.p, x.slug, env(0, { FAKE_V34: "acceptedDetails" }));
    const stDet = stateOf(x).finishChecks.guardian;
    const lines = rA.out.split("\n");
    const goutRemedy = G.gap.remedy("semgrep", "Stop tracking the named files (`git rm --cached <file>`) and move any code they hold out of .guardian/");
    all("1.30.2 review 11: finish --run with dev-guardian 3.4.0's keys — an accepted timeout: the pass says '1 file(s) not analysed (accepted in .guardian/scan.yml)', prints the accepted line once and the 2 distinct notes, warns (never blocks) — and on the unused acceptance —, the merge summary counts the notes; the stored verdict keeps the counts only; a Semgrep timeout → the scan.yml remedy; the tracked .guardian/ output → dev-guardian's remedy once; 3.4.0's accepted_gap_details counted where its lines are of an unknown wording, its two stale acceptances warned (got " +
      js([lines.slice(0, 6), lines.filter((l) => /▲|✗|^- guardian/.test(l)), st && st.guardian, rT.out.split("\n").filter((l) => /✗/.test(l)), rG.out.split("\n").filter((l) => /✗/.test(l)),
        rDet.out.split("\n").filter((l) => /dev-guardian:|▲/.test(l)), stDet && stDet.guardian]) + ")", {
      head: lines.some((l) => l.startsWith("  dev-guardian: pass — no new finding at or above high (dev-guardian from DEV_GUARDIAN_CLI=") && l.endsWith("dev-guardian.mjs) · " + ACC1)),
      lines: lines.filter((l) => l.startsWith("    " + G.acceptedLine(""))).length === 1 && lines.includes("    " + G.acceptedLine("security_scan_full: semgrep timed out on src/big.js — accepted (.guardian/scan.yml semgrep.accept_timeouts)")) &&
        lines.filter((l) => l.startsWith("    " + G.noteLine(""))).length === 2 && lines.includes("    " + G.noteLine("baseline: 1 entry could not be read and is no longer suppressed")),
      warned: lines.includes("  ▲ " + G.acceptedWarn(ACC1)) && lines.includes("  ▲ " + G.staleTimeouts(1, "src/gone.js")) && !/✗ the project check 'guardian'/.test(rA.out),
      details: rDet.out.split("\n").some((l) => l.startsWith("  dev-guardian: pass — no new finding at or above high (dev-guardian from DEV_GUARDIAN_CLI=") && l.endsWith("dev-guardian.mjs) · " + ACC1)) &&
        rDet.out.includes("  ▲ " + G.staleTimeouts(2, "src/gone.js, src/old.js") + "\n") && !/✗ the project check 'guardian'/.test(rDet.out) &&
        !!stDet && stDet.guardian.tool === "3.4.0" && js(stDet.guardian.accepted) === js({ timeout: 1, parse: 0, other: 0 }) && js(stDet.guardian.staleTimeouts) === js({ count: 2, files: ["src/gone.js", "src/old.js"] }),
      summary: lines.some((l) => l.startsWith("- guardian: `" + CMD + "` → exit 0 · dev-guardian: pass") && l.includes(" · " + ACC1) && l.endsWith(" · " + G.notes(2))),
      stored: !!st && st.exitCode === 0 && js(st.guardian.accepted) === js({ timeout: 1, parse: 0, other: 0 }) && st.guardian.notes === 2 && !("acceptedLines" in st.guardian) && !("noteLines" in st.guardian),
      timeout: rT.out.includes(G.gap.timeout("semgrep")) && !/guardianignore/.test(rT.out),
      gout: rG.out.split(goutRemedy).length === 2,
    });
    // review 12: R1 — the accepted file is the feature's own (src/login.js, its _Implements:_): named in finish --run's head line and a
    // warning (▲, never ✗); R2 — a listed file that changed since: the gap line printed whole, the timeoutChanged hint, never "list it there"
    const rO = await finishRun(x.p, x.slug, env(0, { FAKE_V34: "acceptedOwn" }));
    const stO = stateOf(x).finishChecks.guardian;
    const rC = await finishRun(x.p, x.slug, env(2, { FAKE_V34: "changedWording" }));
    const rF = await finishRun(x.p, x.slug, env(2, { FAKE_V34: "changed" }));
    const stF = stateOf(x).finishChecks.guardian;
    const OWN1 = G.acceptedOwn("src/login.js", "file_timeout");
    all("1.30.2 review 12: finish --run — an accepted file of the feature's own named in the head line and warned (never blocked), stored as acceptedOwn; a listed file that changed since — dev-guardian's final entry (cause accepted_file_changed): the timeoutChanged hint + its remedy; a report without the cause (its wording): the whole gap line ('… but changed since BASE …') and the timeoutChanged hint, never the accept_timeouts one (got " +
      js([rO.out.split("\n").filter((l) => /dev-guardian:|▲|✗ the project check/.test(l)), stO && stO.guardian, rC.out.split("\n").filter((l) => /dev-guardian could not|✗ the project check/.test(l)),
        rF.out.split("\n").filter((l) => /dev-guardian could not|✗ the project check/.test(l)), stF && stF.guardian]) + ")", {
      ownHead: rO.out.split("\n").some((l) => l.startsWith("  dev-guardian: pass — no new finding at or above high (dev-guardian from DEV_GUARDIAN_CLI=") && l.endsWith("dev-guardian.mjs) · " + ACC1 + " · " + OWN1)),
      ownWarned: rO.out.includes("  ▲ src/login.js is this feature's and was not analysed (accepted timeout) — review it by hand.\n") && !/✗ the project check 'guardian'/.test(rO.out),
      ownStored: !!stO && js(stO.guardian.acceptedOwn) === js({ count: 1, files: [{ file: "src/login.js", kind: "file_timeout" }] }),
      changedWhole: /\n {2}dev-guardian could not run every scanner \(incomplete scan: [^\n]*listed in \.guardian\/scan\.yml semgrep\.accept_timeouts, but changed since BASE: an acceptance covers a file only as it was at the ref — review the change as if no SAST ran on it, or raise semgrep\.timeout;/.test(rC.out),
      changedHint: rC.out.includes(G.gap.timeoutChanged("semgrep")) && !rC.out.includes(G.gap.timeout("semgrep")) && !rC.out.includes("after review list the file"),
      cause: rF.out.includes(G.gap.timeoutChanged("semgrep") + " " + G.gap.remedy("semgrep", CHANGED.remedy) + " " + G.gap.tail) && !rF.out.includes(G.gap.timeout("semgrep")) &&
        rF.out.includes("listed in .guardian/scan.yml semgrep.accept_timeouts, but changed since BASE: …") && !!stF && stF.exitCode === 2 &&
        js(stF.guardian.gapDetails) === js([{ tool: "semgrep", kind: "file_timeout", remedy: CHANGED.remedy, changed: true }]) && !("accepted" in stF.guardian),
    });
  }

  // 1.30 (review 8): finish --run verifies the launcher BEFORE it runs anything — any other file (a stub printing a pass) refuses the
  // run, nothing runs, nothing is recorded; a missing one refuses it (no-launcher); the 1.29 launcher (genuine) is replaced first and
  // runs. dev-guardian's raw stderr reaches the verdict (its "error:" line before 30 others); 3.2.1's report says "update
  // dev-guardian"; a report contradicting the exit code is refused (report-mismatch); dev-guardian's report sets under
  // .guardian/reports/ never make a run dirty.
  {
    const x = project("dg-launcher", "en");
    S.initProject(x.p, [], undefined, { guardian: true });
    const lf = path.join(x.p, ".specs", "guardian.cjs");
    const genuine = fs.readFileSync(lf, "utf8");
    const mark = path.join(tmp, "dg-launcher-ran");
    fs.writeFileSync(lf, "process.stdout.write(JSON.stringify({ exit_code: 0, new_findings: [], blocking_findings: [], tool_version: \"3.3.0\" }));\n");
    const stub = await finishRun(x.p, x.slug, env(1, { FAKE_MARK: mark }));
    const afterStub = stateOf(x).finishChecks;
    fs.unlinkSync(lf);
    const gone = await finishRun(x.p, x.slug, env(1, { FAKE_MARK: mark }));
    const ranGone = fs.existsSync(mark);
    fs.writeFileSync(lf, LAUNCHER_129);
    const old = await finishRun(x.p, x.slug, env(0, { FAKE_MARK: mark }));
    const replaced = fs.readFileSync(lf, "utf8") === genuine;
    const noise = await finishRun(x.p, x.slug, env(3, { FAKE_NOISE: "1" }));
    const noiseSt = stateOf(x).finishChecks.guardian;
    const oldShape = await finishRun(x.p, x.slug, env(0, { FAKE_SHAPE: "old" }));
    const before = stateOf(x).finishChecks.guardian;
    const mis = await finishRun(x.p, x.slug, env(0, { FAKE_MISMATCH: "1" }));
    const afterMis = stateOf(x).finishChecks.guardian;
    all("1.30 review 8: finish --run refuses a launcher that is not the one dev-spec-driven writes (nothing runs, nothing is recorded) and a missing one (no-launcher); the 1.29 launcher is replaced, then runs; dev-guardian's own error line reaches the verdict from the raw stderr; a 3.2.1 report prints update dev-guardian; a report contradicting the exit code is refused (got " +
      js([stub.out.slice(0, 400), stub.code, afterStub, gone.out.slice(0, 300), old.out.slice(0, 300), noiseSt && noiseSt.guardian, oldShape.out.split("\n").slice(0, 4), mis.out.slice(0, 400)]) + ")", {
      stub: stub.code !== 0 && /the project check 'guardian' was not run — \.specs\/guardian\.cjs is not the launcher dev-spec-driven writes \(edited, replaced or a link\)[^\n]*Nothing was recorded\./.test(stub.out) &&
        !/dev-guardian: pass/.test(stub.out) && !(afterStub && afterStub.guardian),
      gone: gone.code !== 0 && /the project check 'guardian' was not run — the check's launcher \.specs\/guardian\.cjs is missing — node "[^"]*dev-spec\.js" init --guardian writes it again\. Nothing was recorded\./.test(gone.out) && !ranGone,
      old129: /^ {2}\.specs\/guardian\.cjs replaced by this version's launcher \(it was an earlier version's\)\.$/m.test(old.out) && replaced && fs.existsSync(mark) &&
        /\n {2}dev-guardian: pass/.test(old.out),
      stderr: !!noiseSt && noiseSt.guardian.verdict === "config" && /^error: Unknown flag: --bogus/.test(noiseSt.guardian.message) && /error: Unknown flag: --bogus/.test(noise.out),
      update: /^update dev-guardian \(Claude Code: \/plugin\) — this run named no version/m.test(oldShape.out.replace(/^ {2}/gm, "")),
      mismatch: mis.code !== 0 && /evidence\[0\]: dev-guardian's report contradicts the exit code 0 \(the report says exit 1\)/.test(mis.out) && js(afterMis) === js(before),
    });
  }

  // dev-guardian's report sets (.guardian/reports/, untracked) never make a later run "dirty" (review 8 C5) — git read-only, optional
  {
    const cfg = path.join(tmp, "dg-gitconfig");
    fs.writeFileSync(cfg, "");
    const genv = { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: cfg, HOME: tmp, XDG_CONFIG_HOME: tmp,
      GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com" };
    const git = (cwd, ...args) => spawnSync("git", args, { cwd, encoding: "utf8", env: genv });
    const hasGit = (() => { const g = git(tmp, "--version"); return !g.error && g.status === 0; })();
    if (hasGit) {
      const x = project("dg-git", "en");
      S.initProject(x.p, [], undefined, { guardian: true });
      git(x.p, "init", "-q");
      git(x.p, "add", "-A");
      git(x.p, "commit", "-q", "-m", "init");
      const r1 = await finishRun(x.p, x.slug, { ...genv, ...env(0, { FAKE_REPORTS: "1" }) });
      const r2 = await finishRun(x.p, x.slug, { ...genv, ...env(0, { FAKE_REPORTS: "1" }) });
      const st = stateOf(x).finishChecks.guardian;
      const untracked = (git(x.p, "status", "--porcelain").stdout || "").trim();
      fs.appendFileSync(path.join(x.p, "src", "login.js"), "// edited\n");
      await finishRun(x.p, x.slug, { ...genv, ...env(0) });
      const st3 = stateOf(x).finishChecks.guardian;
      ok(st.exitCode === 0 && /\.guardian\//.test(untracked) && st.dirty === false && st3.dirty === true,
        "1.30 review 8 (C5): dev-guardian's untracked report sets under .guardian/reports/ never make a finish --run dirty — a code edit still does (got " + js([untracked, st.dirty, st3.dirty]) + ")");
    } else ok(true, "1.30 review 8 (C5): .guardian/reports/ and the dirty flag — skipped (git is not available)");
  }

  // 1.33: finish --run hands the launcher the feature's base in DEV_SPEC_DIFF_BASE — the branch it was created from (create --branch's
  // record, as refs/heads/<base>; its start commit when that branch already contains HEAD), else, without a record, the default branch
  // while HEAD is on another one — never skipped when it is HEAD's commit (review 6: dev-guardian reads the working tree, so the
  // uncommitted work is the change). A dev-guardian ≥ 3.8.0 (its plugin.json) gets
  // `--diff-base <ref>` (its test-integrity check) and the verdict says so; 3.7.1 runs exactly as before; on the default branch nothing is
  // passed and a value inherited from the shell is cleared; the same under every shell the stored command runs in. git only.
  {
    const cfg = path.join(tmp, "dg-db-gitconfig");
    fs.writeFileSync(cfg, "");
    const genv = { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: cfg, HOME: tmp, XDG_CONFIG_HOME: tmp,
      GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com" };
    const git = (cwd, ...args) => spawnSync("git", args, { cwd, encoding: "utf8", env: genv });
    const hasGit = (() => { const g = git(tmp, "--version"); return !g.error && g.status === 0; })();
    if (hasGit) {
      // the fake dev-guardian above, installed as version `ver` (its .claude-plugin/plugin.json — what the launcher reads)
      const fakeAt = (ver) => {
        const dir = path.join(tmp, "dg-fake-" + ver);
        write(dir, "cli/dev-guardian.mjs", fs.readFileSync(fake, "utf8"));
        write(dir, ".claude-plugin/plugin.json", js({ name: "dev-guardian", version: ver }));
        return path.join(dir, "cli", "dev-guardian.mjs");
      };
      const f380 = fakeAt("3.8.0"), f371 = fakeAt("3.7.1");
      // dev-guardian 3.8.0's test-integrity check in miniature: with --diff-base <ref>, the files changed from <ref> to the WORKING
      // TREE (`git diff`, untracked files too — what dev-guardian reads); a test file holding test.only( is a high finding → exit 1
      const fTi = path.join(tmp, "dg-fake-ti", "cli", "dev-guardian.mjs");
      write(path.join(tmp, "dg-fake-ti"), ".claude-plugin/plugin.json", js({ name: "dev-guardian", version: "3.8.0" }));
      write(path.join(tmp, "dg-fake-ti"), "cli/dev-guardian.mjs", [
        "import fs from \"node:fs\";",
        "import { spawnSync } from \"node:child_process\";",
        "const a = process.argv.slice(2), i = a.indexOf(\"--diff-base\");",
        "if (process.env.FAKE_MARK) fs.writeFileSync(process.env.FAKE_MARK, a.join(\" \"));",
        "const lines = (...x) => (spawnSync(\"git\", x, { encoding: \"utf8\" }).stdout || \"\").split(\"\\n\").map((l) => l.trim()).filter(Boolean);",
        "const files = i < 0 ? [] : lines(\"diff\", \"--name-only\", a[i + 1]).concat(lines(\"ls-files\", \"--others\", \"--exclude-standard\"));",
        "const only = files.filter((f) => f.endsWith(\".test.js\") && fs.existsSync(f) && fs.readFileSync(f, \"utf8\").includes(\"test.only(\"));",
        "const blocking = only.map((f) => ({ fingerprint: f, tool: \"guardian-test-integrity\", severity: \"high\", category: \"quality\", title: \"focused test\", rule_id: \"test-only\", file_path: f, line_start: 1, fix_available: false }));",
        "process.stdout.write(JSON.stringify({ exit_code: blocking.length ? 1 : 0, coverage: \"full\", coverage_gaps: [], new_findings: blocking, blocking_findings: blocking, baseline_absent: false, tool_version: \"3.8.0\", baseline_status: \"present\" }) + \"\\n\");",
        "process.exitCode = blocking.length ? 1 : 0;",
        ""].join("\n"));
      const x = project("dg-diffbase", "en");
      S.initProject(x.p, [], undefined, { guardian: true });
      git(x.p, "-c", "init.defaultBranch=main", "init", "-q");
      git(x.p, "add", "-A");
      git(x.p, "commit", "-q", "-m", "init");
      const sha = (git(x.p, "rev-parse", "HEAD").stdout || "").trim();
      git(x.p, "switch", "-q", "-c", "feature/login");
      write(x.p, "src/extra.js", "module.exports = 1;\n"); // the feature's own commit: HEAD is past main
      git(x.p, "add", "src/extra.js");
      git(x.p, "commit", "-q", "-m", "feature work");
      const stf = path.join(x.p, ".specs", x.slug, ".state.json");
      const setRecord = (on) => { const st = json(fs.readFileSync(stf, "utf8")); if (on) st.branch = { name: "feature/login", base: "main", commit: sha, at: st.createdAt }; else delete st.branch; fs.writeFileSync(stf, JSON.stringify(st, null, 2)); };
      const mark = path.join(tmp, "dg-db-mark");
      const runWith = async (cliPath, extraEnv, extra) => {
        try { fs.rmSync(mark); } catch { /* none yet */ }
        const r = await finishRun(x.p, x.slug, { ...genv, DEV_GUARDIAN_CLI: cliPath, FAKE_EXIT: "0", FAKE_MARK: mark, ...(extraEnv || {}) }, extra);
        return { ...r, args: fs.existsSync(mark) ? fs.readFileSync(mark, "utf8") : null };
      };
      const LINE = MSG("en").guardian.diffBase("main");
      setRecord(true);
      const r38 = await runWith(f380), r37 = await runWith(f371, { DEV_SPEC_DIFF_BASE: "main" });
      const shells = (process.platform === "win32" ? ["cmd", "bash", "powershell", "pwsh"] : ["sh", "bash"]).filter((sh) => spawnSync(sh === "cmd" ? "cmd.exe" : sh, sh === "cmd" ? ["/c", "exit 0"] : sh === "bash" || sh === "sh" ? ["-c", "exit 0"] : ["-NoProfile", "-Command", "exit 0"], { timeout: 20000 }).status === 0);
      const bySh = [];
      for (const sh of shells) { const r = await runWith(f380, {}, ["--shell", sh]); bySh.push([sh, r.args]); }
      // review 5: a TAG named main at HEAD (rev-parse prefers refs/tags) is never the base — refs/heads/main is
      git(x.p, "tag", "main");
      const rTag = await runWith(f380);
      git(x.p, "tag", "-d", "main");
      // … and a base that already contains HEAD would hide the feature's commits: the start commit instead — main moved to HEAD
      // (`git branch -f main HEAD`) …
      git(x.p, "branch", "-f", "main", "HEAD");
      const rMoved = await runWith(f380);
      git(x.p, "branch", "-f", "main", sha);
      // … or the feature merged into main locally with --no-ff (main ≠ HEAD, but contains it)
      git(x.p, "switch", "-q", "main");
      git(x.p, "merge", "--no-ff", "-q", "-m", "merge feature/login", "feature/login");
      git(x.p, "switch", "-q", "feature/login");
      const rNoFf = await runWith(f380);
      git(x.p, "branch", "-f", "main", sha);
      // review 6: create --branch from main, the work left uncommitted, a test turned into test.only — base and start are HEAD's
      // commit, yet the base is passed: dev-guardian reads the uncommitted change, and the .only blocks
      git(x.p, "switch", "-q", "-c", "feature/dirty", "main");
      write(x.p, "tests/login.test.js", "test.only(\"logs in\", () => {});\n");
      const rDirty = await runWith(fTi);
      const dirtyCheck = stateOf(x).finishChecks.guardian;
      fs.rmSync(path.join(x.p, "tests"), { recursive: true, force: true });
      git(x.p, "switch", "-q", "feature/login");
      setRecord(false);
      const rDef = await runWith(f380);
      // a remote default renamed (origin/HEAD → a missing origin/master): the local main, never the dangling name
      git(x.p, "symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/master");
      const rDangling = await runWith(f380);
      git(x.p, "symbolic-ref", "--delete", "refs/remotes/origin/HEAD");
      // a fresh branch still at main's commit, no record: main is passed all the same (its uncommitted work is the change)
      git(x.p, "switch", "-q", "-c", "feature/fresh", "main");
      const rFresh = await runWith(f380);
      const freshCheck = stateOf(x).finishChecks.guardian;
      git(x.p, "switch", "-q", "main");
      const rMain = await runWith(f380, { DEV_SPEC_DIFF_BASE: "evil" });
      const PLAIN = "scan --project . --fail-on high --format json";
      const ends = (a, ref) => typeof a === "string" && a.endsWith("--format json --diff-base " + ref);
      const UNC = MSG("en").guardian.diffBaseUncommitted("main"); // (review 7: the base passed still contains HEAD — only the uncommitted work read)
      const wip = (r, chk) => r.out.includes(UNC) && !r.out.includes(LINE) && !!chk && !!chk.guardian && chk.guardian.diffBaseUncommitted === true;
      all("1.33 finish --run: the feature's recorded base reaches dev-guardian 3.8.0 as --diff-base refs/heads/main — the verdict says 'since main' — under " + shells.join(", ") + "; a tag named main never counts; main moved to HEAD or a --no-ff local merge of the feature → the start commit; base and start at HEAD with a test.only left uncommitted → the base is passed, the .only blocks and the verdict says only the uncommitted work was checked (stored); 3.7.1 gets the arguments as before (its value ignored); without a record the default branch while HEAD is elsewhere (the local one when origin/HEAD dangles), also at main's commit (uncommitted, said); on main nothing, an inherited DEV_SPEC_DIFF_BASE cleared (got " +
        js({ r38: [r38.args, r38.out.split("\n")[1]], r37: r37.args, bySh, rTag: rTag.args, rMoved: rMoved.args, rNoFf: rNoFf.args, rDirty: [rDirty.args, dirtyCheck && dirtyCheck.exitCode, rDirty.out.split("\n")[1]], rDef: rDef.args, rDangling: rDangling.args, rFresh: [rFresh.args, rFresh.out.split("\n")[1], freshCheck && freshCheck.guardian], rMain: rMain.args }) + ")", {
        recorded: ends(r38.args, "refs/heads/main") && r38.out.includes(LINE) && !r38.out.includes(UNC), // (finish itself refuses: the fixture's spec is still a template)
        older: r37.args === PLAIN && !r37.out.includes(LINE),
        shells: shells.length >= 1 && bySh.every(([, a]) => ends(a, "refs/heads/main")),
        tag: ends(rTag.args, "refs/heads/main"),
        moved: ends(rMoved.args, sha) && rMoved.out.includes(MSG("en").guardian.diffBase(sha)),
        noFf: ends(rNoFf.args, sha),
        dirtyOnlyBlocks: ends(rDirty.args, "refs/heads/main") && !!dirtyCheck && dirtyCheck.exitCode === 1 && wip(rDirty, dirtyCheck),
        byDefault: ends(rDef.args, "refs/heads/main"), dangling: ends(rDangling.args, "refs/heads/main"),
        fresh: ends(rFresh.args, "refs/heads/main") && wip(rFresh, freshCheck),
        onDefault: rMain.args === PLAIN && !rMain.out.includes("weakened"),
      });
    } else ok(true, "1.33 finish --run's diff base — skipped (git is not available)");
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
