"use strict";
// Spec quality on the behavioural eval fixtures 17-docs-evals built — no cross-feature pair, steering amendment or glossary warning; design-reuse passes.

const fs = require("fs");
const path = require("path");

// Runs after 17-docs-evals, in the same process: it reads the behavioural fixtures that file built under tmp (a3-eval-fixtures/,
// when bash is here). 1.30 (review 8, ds-maint 2): these two re-checks were 15-quality.js's, which 17-docs-evals then had to run
// before — the two files made the MCP suite's critical path (~60 s in one process); 15-quality runs on its own now.
exports.deps = ["17-docs-evals"];
exports.run = async ({ ok, S, tmp }) => {
  const js = (v) => JSON.stringify(v);
  const fxRoot = path.join(tmp, "a3-eval-fixtures");
  const built = () => (fs.existsSync(fxRoot) ? fs.readdirSync(fxRoot) : []).map((c) => [c, path.join(fxRoot, c)]).filter(([, d]) => fs.existsSync(path.join(d, ".specs")));

  // 1.16 Q2 / Q1 / Q3 — no false positive on the built fixtures (15-quality.js checks the shipped examples and evals/fixtures copies).
  {
    const QIDS = ["glossary", "cross-feature-acs", "steering-changed-since-approval"];
    const qChecks = (dir, slug) => (S.specDoctor(dir, slug).checks || []).filter((c) => QIDS.includes(c.id));
    const fpBad = [];
    let fxSeen = 0;
    for (const [c, d] of built()) {
      fxSeen++;
      if (S.catalog(d).crossAcs.pairs.length) fpBad.push(c + ": catalog pairs");
      for (const f of S.listFeatures(d).features || []) for (const q of qChecks(d, f.name)) if (q.status !== "pass") fpBad.push(c + "/" + f.name + ": " + q.id);
    }
    ok(!fpBad.length, "1.16 Q2 / Q1 / Q3: no new warning on the " + fxSeen + " built behavioural fixture(s) with a .specs/ — no cross-feature pair, no steering amendment, no glossary (got " + js(fpBad) + ")");
  }

  // 1.19 R1 — the built fixtures' approved designs pass design-reuse on their own merits (they name what they reuse).
  {
    const chk = (d, id) => (d.checks || []).find((c) => c.id === id) || {};
    const fxBad = [];
    let fxSeen = 0;
    for (const [c, d] of built()) {
      for (const f of S.listFeatures(d).features || []) {
        const st = S.readState(d, f.name);
        if (!st.approvals || !st.approvals.design) continue;
        fxSeen++;
        if ((chk(S.specDoctor(d, f.name), "design-reuse").status || "-") !== "pass") fxBad.push(c + "/" + f.name);
      }
    }
    ok(!fxBad.length, "1.19 R1: the " + fxSeen + " approved design(s) of the built behavioural fixtures pass design-reuse (got " + js(fxBad) + ")");
  }
};
