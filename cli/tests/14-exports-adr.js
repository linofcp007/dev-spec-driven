"use strict";
// The ADR export on the CLI (1.25) — export [feature] --adr [--write]: the decision log as MADR files under .specs/exports/adr/.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = ({ ok, all, run, runIn, tmp, CLI, require, __dirname }) => {
  const SE = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const js = (v) => JSON.stringify(v);
  const p = path.join(tmp, "p125-adr-proj");
  // stdout and stderr apart (runIn() joins them): the documents alone are on stdout.
  const runOut = (args) => { const r = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", env: { ...process.env, SPEC_PROJECT_DIR: p } }); return { stdout: r.stdout || "", stderr: r.stderr || "", code: r.status }; };
  SE.initProject(p, ["core"], "en");
  const f = SE.createFeature(p, "Checkout", ["core"], "", undefined, "en");
  fs.writeFileSync(path.join(f.dir, "requirements.md"), "# Feature: Checkout\n\n## Summary\nPay.\n\n### US-1 (P1): Pay\n1. **US-1.AC-1** — WHEN the shopper pays THE SYSTEM SHALL charge the card\n");
  SE.decide(p, "checkout", { title: "Use PayPal", decision: "PayPal.", affects: "US-1.AC-1" });
  SE.decide(p, "checkout", { title: "PSP rate limit", decision: "10 rps.", kind: "discovery" });
  SE.decide(p, "checkout", { title: "Use Stripe", decision: "Stripe.", supersedes: "D-1" });
  const adrDir = path.join(p, ".specs", "exports", "adr", "checkout");

  // 1.25 ADR: no --write → every document on stdout under its path (an HTML comment line, invisible in markdown); --json = the
  // MCP tool's result; --write → the files, one "✎ wrote" line each and a summary; a re-run writes nothing.
  const pv = runOut(["export", "checkout", "--adr", "--project", p]);
  const eng = SE.exportSpecs(p, { name: "checkout", format: "adr" });
  const want = eng.documents.map((d, i) => (i ? "\n" : "") + "<!-- ── " + path.relative(p, d.file).split(path.sep).join("/") + " ── -->\n" + d.content).join("");
  const pj = runOut(["export", "checkout", "--adr", "--json", "--project", p]);
  let pjr = null;
  try { pjr = JSON.parse(pj.stdout); } catch { /* stays null */ }
  const w = runIn(["export", "checkout", "--adr", "--write", "--project", p]);
  const w2 = runIn(["export", "checkout", "--adr", "--write", "--project", p]);
  all("1.25 ADR (CLI): export <f> --adr prints each MADR document under its path; --json = the MCP result; --write writes them (✎ wrote …, a summary); a re-run writes nothing (got " +
    js([pv.code, pv.stdout.slice(0, 200), pv.stderr, w.out, w2.out]) + ")", [
    () => pv.code === 0, () => pv.stdout === want,
    () => pv.stdout.startsWith("<!-- ── .specs/exports/adr/checkout/0001-use-paypal.md ── -->\n---\nstatus: superseded by ADR-0003\n"),
    () => pv.stdout.includes("<!-- ── .specs/exports/adr/checkout/0003-use-stripe.md ── -->\n"),
    () => pv.stdout.includes("<!-- ── .specs/exports/adr/checkout/index.md ── -->\n"), () => pj.code === 0, () => pjr, () => js(pjr) === js(eng),
    () => w.code === 0, () => w.out.includes("✎ wrote " + path.join(adrDir, "0001-use-paypal.md")),
    () => w.out.includes("✎ wrote " + path.join(adrDir, "index.md")), () => /ADRs: 2 — 3 file\(s\) written · 0 unchanged · 0 removed/.test(w.out),
    () => fs.readFileSync(path.join(adrDir, "0003-use-stripe.md"), "utf8") === eng.documents[1].content, () => w2.code === 0,
    () => /ADRs: 2 — 0 file\(s\) written · 3 unchanged · 0 removed/.test(w2.out), () => !w2.out.includes("✎ wrote"),
  ]);

  // stale: a decision retitled by hand → the preview names the old file on stderr (stdout stays the documents), --write removes it.
  const dp = path.join(f.dir, "decisions.md");
  fs.writeFileSync(dp, fs.readFileSync(dp, "utf8").replace("## D-3 — Use Stripe", "## D-3 — Use Stripe Checkout"));
  const sp = runOut(["export", "checkout", "--adr", "--project", p]);
  const sw = runIn(["export", "checkout", "--adr", "--write", "--project", p]);
  ok(sp.code === 0 && sp.stderr.includes("stale: .specs/exports/adr/checkout/0003-use-stripe.md — --write removes it") && !sp.stdout.includes("stale:") &&
    sw.code === 0 && sw.out.includes("✗ removed " + path.join(adrDir, "0003-use-stripe.md")) && /ADRs: 2 — 3 file\(s\) written · 0 unchanged · 1 removed/.test(sw.out) &&
    !fs.existsSync(path.join(adrDir, "0003-use-stripe.md")) && fs.existsSync(path.join(adrDir, "0003-use-stripe-checkout.md")),
    "1.25 ADR (CLI): a retitled decision's old file is named stale on stderr by the preview and removed by --write (got " + js([sp.stderr, sw.out]) + ")");

  // refusals: a hand-written file at a target path → exit 1, nothing written (--json: the engine's {ok: false, skipped} result);
  // --adr with another format flag → usage error; the project export prints adr/index.md too.
  fs.writeFileSync(path.join(adrDir, "index.md"), "# Our own index\n");
  const hw = runIn(["export", "checkout", "--adr", "--write", "--project", p]);
  const hj = runOut(["export", "checkout", "--adr", "--write", "--json", "--project", p]);
  let hjr = null;
  try { hjr = JSON.parse(hj.stdout); } catch { /* stays null */ }
  fs.rmSync(path.join(adrDir, "index.md"));
  const both = runIn(["export", "checkout", "--adr", "--md", "--project", p]);
  const pr = runOut(["export", "--adr", "--project", p]);
  const ptp = path.join(tmp, "p125-adr-pt");
  SE.initProject(ptp, ["core"], "pt");
  SE.createFeature(ptp, "Pagamentos", ["core"], "", undefined, "pt");
  SE.decide(ptp, "pagamentos", { title: "Usar o Stripe", decision: "Stripe." });
  const ptw = runIn(["export", "pagamentos", "--adr", "--write", "--project", ptp]);
  ok(hw.code === 1 && /\.specs\/exports\/adr\/checkout\/index\.md exists and was not generated by dev-spec/.test(hw.out) &&
    hj.code === 1 && hjr && hjr.ok === false && hjr.skipped === true && hjr.format === "adr" &&
    both.code === 1 && /dev-spec export \[feature\] \[--md\|--csv\|--gherkin\|--adr\|--tracker jira\|linear\] \[--write\]/.test(both.out) &&
    pr.code === 0 && pr.stdout.includes("<!-- ── .specs/exports/adr/index.md ── -->\n<!-- AUTO-GENERATED by dev-spec") &&
    ptw.code === 0 && /ADR: 1 — 2 ficheiro\(s\) gerado\(s\) · 0 sem alterações · 0 removido\(s\)/.test(ptw.out) &&
    fs.readFileSync(path.join(ptp, ".specs", "exports", "adr", "pagamentos", "0001-usar-o-stripe.md"), "utf8").includes("## Resultado da Decisão"),
    "1.25 ADR (CLI): a hand-written file at a target path → exit 1 (--json: the engine's refusal); --adr with --md is a usage error; no feature → adr/index.md printed too; a PT feature's summary and headings are Portuguese (got " +
    js([hw.out, hj.code, both.out, ptw.out]) + ")");
};
