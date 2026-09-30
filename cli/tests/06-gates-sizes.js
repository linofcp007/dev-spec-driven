"use strict";
// Right-sized rigor (1.21 F5) on the CLI — create --size (= spec_create {size}), a change (--kind change / --size xs), classify's
// suggested size, status marks for a sized feature, approve --through tasks on a change, the refusals — MCP ↔ CLI parity.

const fs = require("fs");
const path = require("path");

exports.run = ({ ok, run, tmp, require, __dirname }) => {
  const S = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const p = path.join(tmp, "p121-sizes");
  S.initProject(p, ["core"], "en");
  const rd = (slug, f) => fs.readFileSync(path.join(p, ".specs", slug, f), "utf8");
  const has = (slug, f) => fs.existsSync(path.join(p, ".specs", slug, f));

  // create --size s: the same scaffold spec_create {size: "s"} writes (engine), --json carries size
  const cli = run(["create", "Cli small", "tdd", "sec", "--size", "S", "--json", "--project", p]);
  const eng = S.createFeature(p, "Engine small", ["core", "tdd", "sec"], undefined, undefined, undefined, undefined, { size: "s" });
  const j = JSON.parse(cli.out);
  const same = ["requirements.md", "design.md", "tasks.md", "test-plan.md", "checklist.md"].every((f) => rd("cli-small", f).replace(/Cli small|cli-small/g, "X") === rd(eng.slug, f).replace(/Engine small|engine-small/g, "X"));
  ok(cli.code === 0 && j.ok && j.size === "s" && same && !has("cli-small", "classification.md") && JSON.parse(rd("cli-small", ".state.json")).size === "s",
    "1.21 F5 (CLI): create --size S (case-folded) scaffolds exactly what spec_create {size: 's'} does — no classification.md, size s in .state.json, --json carries size (got " +
    JSON.stringify({ code: cli.code, size: j.size, same }) + ")");

  // a change: --size xs (and --kind change) → ONE change.md; the plan approved with --through tasks; the refusals exit 1
  const ch = run(["create", "Footer typo", "--size", "xs", "--summary", "fix a typo in the footer", "--project", p]);
  const kindCh = run(["create", "Header typo", "--kind", "change", "--json", "--project", p]);
  const txt = "# Change: footer\n\n## Summary\nFix the footer string.\n\n## Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN any page renders THE SYSTEM SHALL show \"Copyright 2026 Acme\".\n\n" +
    "## Approach\nOne string in footer.html.\n\n## Tasks\n- [ ] 1. [US1] Fix the footer string\n  - _Requirements: US-1.AC-1_\n  - _Verify: node -e \"process.exit(0)\"_\n";
  fs.writeFileSync(path.join(p, ".specs", "footer-typo", "change.md"), txt);
  const ap = run(["approve", "footer-typo", "--through", "tasks", "--project", p]);
  const reqAp = run(["approve", "footer-typo", "requirements", "--project", p]);
  const done = run(["done", "footer-typo", "1", "--run", "--project", p]);
  const fin = run(["finish", "footer-typo", "--project", p]);
  const bad = run(["create", "Bad", "--size", "xl", "--project", p]);
  const tracked = run(["create", "Tracked", "sec", "--kind", "change", "--project", p]);
  ok(ch.code === 0 && /is a change \(size xs\): ONE file/.test(ch.out) && fs.readdirSync(path.join(p, ".specs", "footer-typo")).filter((n) => n.endsWith(".md")).join() === "change.md" &&
    JSON.parse(kindCh.out).kind === "change" && ap.code === 0 && reqAp.code === 1 && /there is no requirements phase/.test(reqAp.out) && done.code === 0 &&
    /^- \[x\] 1\. /m.test(rd("footer-typo", "change.md")) && fin.code === 0 && bad.code === 1 && /size must be one of: xs, s, m, l/.test(bad.out) && tracked.code === 1 && /\+sec/.test(tracked.out),
    "1.21 F5 (CLI): create --size xs / --kind change → ONE change.md; approve --through tasks approves its plan, a requirements approval is refused (exit 1); done --run ticks the task IN change.md; finish is ready; --size xl and a change with a track exit 1 (got " +
    JSON.stringify({ ch: ch.code, ap: ap.code, req: reqAp.code, done: [done.code, done.out.slice(0, 200)], fin: fin.code, bad: bad.code, tracked: tracked.code }) + ")");

  // classify prints the suggested size (the same sizeNote spec_classify returns); status marks an optional section ○ at size s
  const cls = run(["classify", "add a CSV export button to the orders page", "--project", p]);
  const clsJ = JSON.parse(run(["classify", "add a CSV export button to the orders page", "--json", "--project", p]).out);
  const st = run(["status", "cli-small", "--project", p]);
  ok(cls.code === 0 && /^Suggested size s — one unit of work/m.test(cls.out) && clsJ.suggestedSize === "s" && clsJ.sizeReason === "single-unit" &&
    st.code === 0 && /○ Security Requirements \(optional at this size\)/.test(st.out) && /◐ Threat Model \(unfilled\)/.test(st.out),
    "1.21 F5 (CLI): classify prints the suggested size (--json: suggestedSize / sizeReason, as spec_classify); status marks a size s feature's optional extended section ○ and its core one ◐ while unfilled (got " +
    JSON.stringify({ cls: cls.out.split("\n").filter((l) => /size/i.test(l)), st: st.out.split("\n").filter((l) => /SEC|Threat|Security/.test(l)) }) + ")");
};
