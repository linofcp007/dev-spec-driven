"use strict";
// The traceability matrix on the CLI — trace --matrix / --csv, export --csv.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = ({ ok, run, runIn, tmp, CLI, require, __dirname }) => {
  const SF5 = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const f5 = path.join(tmp, "ffrtm-proj");
  // stdout alone (runIn() joins stderr): the CSV must be exactly the engine's text.
  const runOut = (args) => { const r = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", env: { ...process.env, SPEC_PROJECT_DIR: f5 } }); return { stdout: r.stdout || "", stderr: r.stderr || "", code: r.status }; };
  SF5.initProject(f5, ["tdd"], "en");
  const cf = SF5.createFeature(f5, "Checkout", ["tdd"], "", undefined, "en");
  fs.writeFileSync(path.join(cf.dir, "requirements.md"), "# Feature: Checkout\n\n### US-1 (P1): Pay\n#### Acceptance Criteria (EARS)\n" +
    '1. **US-1.AC-1** — WHEN the shopper pays THE SYSTEM SHALL charge "the total", in cents\n2. **US-1.AC-2** — IF the card is declined THEN THE SYSTEM SHALL keep the cart\n' +
    "3. **US-1.AC-3** — =cmd|' /C calc'!A0 THE SYSTEM SHALL log it\n");
  fs.writeFileSync(path.join(cf.dir, "test-plan.md"), "# Test Plan\n\n| Test ID | Layer | Kind | Description | Covers (AC IDs) | File |\n|---|---|---|---|---|---|\n" +
    "| T-01 | unit | example | charge | US-1.AC-1 | `test/charge.test.js` |\n| T-02 | unit | example | decline | US-1.AC-2 | `test/decline.test.js` |\n| T-03 | unit | example | log | US-1.AC-3 | `test/log.test.js` |\n");
  fs.writeFileSync(path.join(cf.dir, "tasks.md"), '# Tasks\n\n- [ ] 1. [US1] Charge\n  - _Requirements: US-1.AC-1_\n  - _Makes green: T-01_\n  - _Verify: node -e "process.exit(0)"_\n' +
    "- [ ] 2. [US1] Decline\n  - _Requirements: US-1.AC-2_\n");
  fs.mkdirSync(path.join(f5, "test"), { recursive: true });
  fs.writeFileSync(path.join(f5, "test", "charge.test.js"), "test('T-01 charges', () => {});\n");
  SF5.completeTask(f5, "checkout", 1, { command: 'node -e "process.exit(0)"', exitCode: 0, summary: "1 passing" });
  SF5.decide(f5, "checkout", { title: "Stripe", decision: "Use Stripe.", affects: ["US-1.AC-1"] });

  const tm = runIn(["trace", "checkout", "--matrix", "--project", f5]);
  ok(tm.code === 1 && /^Traceability matrix — checkout \(core \+tdd\): 3 requirement\(s\) · 1 verified · 0 implemented · 1 planned · 1 untraced\n {2}requirements not approved yet\n/.test(tm.out) &&
    /\n {2}ID +Status +Tasks +Tests +Decisions +Requirement\n/.test(tm.out) && /\n {2}US-1\.AC-1 +verified +#1✓ +T-01 +D-1 +WHEN the shopper pays THE SYSTEM SHALL charge "the total", in cents\n/.test(tm.out) &&
    /\n {2}US-1\.AC-2 +planned +#2○ +T-02 +— +IF the card is declined/.test(tm.out) && /\n {2}US-1\.AC-3 +untraced +— +T-03 +— +\[no task cites it\] =cmd/.test(tm.out) &&
    /\n {2}tasks: ✓ verified · ▲ done, not verified · ○ open\nTrace: checkout {2}verdict=gaps-found/.test(tm.out),
    "feature F5: trace --matrix prints the matrix (localized headers, one row per requirement: status, tasks ✓/▲/○, tests, decisions, gaps before the text), then the usual trace lines; the exit code stays the trace verdict's (got " + JSON.stringify(tm.out.slice(0, 700)) + ")");
  const tc = runOut(["trace", "checkout", "--csv", "--project", f5]);
  const engineCsv = SF5.matrixCsv([SF5.traceMatrix(f5, "checkout")], "en");
  ok(tc.code === 1 && tc.stdout === engineCsv && tc.stdout.charCodeAt(0) !== 0xfeff && /^Feature,ID,Kind,Requirement,Status,/.test(tc.stdout) && !/AUTO-GENERATED/.test(tc.stdout) &&
    tc.stdout.includes("\r\ncheckout,US-1.AC-1,AC,\"WHEN the shopper pays THE SYSTEM SHALL charge \"\"the total\"\", in cents\",verified,") &&
    tc.stdout.includes("\r\ncheckout,US-1.AC-3,AC,'=cmd|' /C calc'!A0 THE SYSTEM SHALL log it,untraced,no task cites it,"),
    "feature F5: trace --csv prints the engine's CSV on stdout alone — RFC 4180, CRLF, a quoted field's quotes doubled, a leading '=' neutralized ('=cmd|… stays text); no BOM and no marker record (data for scripts); exit code = the trace verdict (got " + JSON.stringify(tc.stdout.slice(0, 300)) + ")");
  const tcc = runOut(["trace", "checkout", "--csv", "--code", "--project", f5]);
  let tj = null;
  try { tj = JSON.parse(runIn(["trace", "checkout", "--matrix", "--json", "--project", f5]).out); } catch { /* invalid JSON */ }
  const tcsvJson = runIn(["trace", "checkout", "--csv", "--json", "--project", f5]);
  ok(/,Test files,/.test(tcc.stdout.split("\r\n")[0]) && tcc.stdout.includes(",T-01,T-01: test/charge.test.js,") && tcc.stdout.includes(",T-02,T-02: in no test file,") &&
    tj && tj.matrix && JSON.stringify(tj.matrix.rows) === JSON.stringify(SF5.traceCheck(f5, "checkout", { matrix: true }).matrix.rows) && tj.matrix.counts.untraced === 1 &&
    /"matrix": \{/.test(tcsvJson.out) && !/^Feature,/.test(tcsvJson.out),
    "feature F5: trace --csv --code adds the Test files column; --json prints trace_check {matrix: true}'s result (= MCP), --json wins over --csv");
  const off = runIn(["trace", "checkout", "--matrix=false", "--csv=false", "--project", f5]);
  const typo = runIn(["trace", "checkout", "--matrx", "--project", f5]);
  ok(off.code === 1 && /^Trace: checkout/.test(off.out) && !/Traceability matrix/.test(off.out) && typo.code === 1 && /--matrx/.test(typo.out) && /--matrix/.test(typo.out) &&
    /usage: dev-spec trace <feature> \[--code\] \[--matrix\] \[--csv\]/.test(runIn(["trace", "--project", f5]).out),
    "feature F5: --matrix / --csv are boolean switches (=false turns them off), an unknown --matrx is refused with a did-you-mean, the usage names both");

  // export --csv: the document (BOM + the marker record); --write → .specs/exports/<slug>.rtm.csv, never over a hand-written file.
  const ec = runOut(["export", "checkout", "--csv", "--project", f5]);
  const ew = runIn(["export", "checkout", "--csv", "--write", "--project", f5]);
  const ewFile = path.join(f5, ".specs", "exports", "checkout.rtm.csv");
  const ewText = fs.existsSync(ewFile) ? fs.readFileSync(ewFile, "utf8") : "";
  const ep = runIn(["export", "--csv", "--write", "--project", f5]);
  ok(ec.code === 0 && ec.stdout === SF5.exportSpecs(f5, { name: "checkout", format: "csv" }).content && ec.stdout.charCodeAt(0) === 0xfeff && ec.stdout.slice(1).startsWith(engineCsv) &&
    /\r\n# AUTO-GENERATED by dev-spec — do not edit by hand\. Regenerate: dev-spec export --csv \(spec_export format csv\)\.,{16}\r\n$/.test(ec.stdout) &&
    ew.code === 0 && ew.out.includes("✎ wrote " + ewFile) && ewText === ec.stdout && ep.code === 0 && fs.existsSync(path.join(f5, ".specs", "exports", "project.rtm.csv")),
    "feature F5: export <f> --csv prints the CSV document (UTF-8 BOM, the AUTO-GENERATED marker as the last record); --write → .specs/exports/checkout.rtm.csv; no feature → project.rtm.csv (got " + JSON.stringify(ec.stdout.slice(-200)) + ")");
  fs.writeFileSync(ewFile, "ID,Owner\r\n");
  const eh = runIn(["export", "checkout", "--csv", "--write", "--project", f5]);
  const both = runIn(["export", "checkout", "--csv", "--md", "--project", f5]);
  ok(eh.code === 1 && /\.specs\/exports\/checkout\.rtm\.csv exists and was not generated by dev-spec/.test(eh.out) && fs.readFileSync(ewFile, "utf8") === "ID,Owner\r\n" &&
    both.code === 1 && /usage: dev-spec export \[feature\] \[--md\|--csv\|--gherkin\|--adr\|--tracker jira\|linear\] \[--write\]/.test(both.out), // 1.25: + --adr
    "feature F5: export --csv --write never overwrites a hand-written .rtm.csv (exit 1, file unchanged); --csv with --md is a usage error");

  // Localized (PT feature), and the docs.
  const pf5 = SF5.createFeature(f5, "Pagamento", ["core"], "Pagar.", undefined, "pt");
  fs.writeFileSync(path.join(pf5.dir, "requirements.md"), "# Feature: Pagamento\n\n### US-1 (P1): Pagar\n1. **US-1.AC-1** — QUANDO o cliente paga O SISTEMA DEVE cobrar o total\n");
  fs.writeFileSync(path.join(pf5.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Cobrar\n  - _Requirements: US-1.AC-1_\n");
  const ptm = runIn(["trace", "pagamento", "--matrix", "--project", f5]);
  const ptc = runOut(["trace", "pagamento", "--csv", "--project", f5]);
  const doc = require(path.join(path.dirname(CLI), "commands.js")).helpText();
  const help = runIn(["help"]).out;
  ok(/^Matriz de rastreabilidade — pagamento \(core\): 1 requisito\(s\) · 0 verificado\(s\) · 0 implementado\(s\) · 1 planeado\(s\) · 0 sem rastreio\n {2}requisitos ainda não aprovados\n/.test(ptm.out) &&
    /\n {2}ID +Estado +Tasks +Testes +Decisões +Requisito\n {2}US-1\.AC-1 +planeado +#1○ /.test(ptm.out) && /tasks: ✓ verificada · ▲ feita, não verificada · ○ por fazer/.test(ptm.out) &&
    /^Feature,ID,Tipo,Requisito,Estado,Lacunas,/.test(ptc.stdout) && ptc.stdout.includes("\r\npagamento,US-1.AC-1,AC,QUANDO o cliente paga O SISTEMA DEVE cobrar o total,planeado,,,,#1 por fazer,") &&
    /trace <feature> \[--code\]/.test(doc) && /--matrix: \+ the requirements traceability matrix/.test(help) &&
    /--csv: the matrix as RFC 4180 CSV on stdout/.test(help) && /\.rtm\.csv/.test(help),
    "feature F5: a PT feature's matrix and CSV speak Portuguese (headers, statuses, task words; IDs English); the command table and help document --matrix / --csv and the .rtm.csv export");
};
