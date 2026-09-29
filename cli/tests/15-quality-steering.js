"use strict";
// Spec quality on the CLI — steering amendments, cross-feature criteria, the glossary.

const fs = require("fs");
const path = require("path");

exports.run = ({ ok, run, tmp, CLI, require, __dirname }) => {
  const SQ = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const js = (v) => JSON.stringify(v);
  const q = path.join(tmp, "p16q-proj");
  const r = (args) => run([...args, "--project", q]);
  const reqOf = (slug, body) => fs.writeFileSync(path.join(q, ".specs", slug, "requirements.md"), "# Feature: " + slug + "\n\n### US-1 (P1): Story\n#### Acceptance Criteria (EARS)\n" + body);
  const constitution = path.join(q, ".specs", "steering", "constitution.md");
  SQ.initProject(q, ["core"], "en");
  fs.writeFileSync(constitution, "# Constitution\n\n1. Every write is idempotent.\n");
  ["Alpha", "Beta"].forEach((n) => SQ.createFeature(q, n, ["core"], "x", undefined, "en"));
  reqOf("alpha", "1. **US-1.AC-1** — WHEN a login fails 5 times THE SYSTEM SHALL lock the account for 15 minutes\n2. **US-1.AC-2** — WHEN a client pays THE SYSTEM SHALL email the receipt\n");
  reqOf("beta", "1. **US-1.AC-1** — WHEN a login fails 3 times THE SYSTEM SHALL lock the account for 15 minutes\n");
  for (const f of ["alpha", "beta"]) for (const ph of ["classification", "requirements", "design"]) r(["approve", f, ph, "--force"]);

  // Q1 — steering amendments: impact --phase steering (no feature = every active one), doctor, next-action.
  fs.writeFileSync(constitution, "# Constitution\n\n1. Every write is idempotent.\n2. No PII in logs.\n");
  const all = r(["impact", "--phase", "steering"]);
  const one = r(["impact", "beta", "--phase", "steering", "--json"]);
  let oneJ = null;
  try { oneJ = JSON.parse(one.out); } catch { /* stays null */ }
  const noName = r(["impact"]);
  const reo = r(["impact", "alpha", "--phase", "steering", "--reopen"]);
  ok(all.code === 0 && /^Steering — 2 active feature\(s\) approved under an older version of steering that changed since\n {2}alpha — requirements \(approved \d{4}-\d\d-\d\d\): constitution\.md \(changed\); design/.test(all.out) &&
    /\n {2}beta — requirements/.test(all.out) && /\n {2}→ Re-review each against the amended steering, then re-approve \(\/approve alpha requirements\)/.test(all.out) &&
    one.code === 0 && oneJ && js(oneJ) === js(SQ.impactReport(q, "beta", { phase: "steering" })) && oneJ.scope === "feature" && oneJ.features[0].approvals.length === 2 &&
    noName.code === 1 && /usage: dev-spec impact <feature> .* · dev-spec impact \[feature\] --phase steering/.test(noName.out) &&
    reo.code === 1 && /reopen doesn't apply to phase 'steering'/.test(reo.out),
    "1.16 Q1 CLI: impact --phase steering lists every active feature approved under changed steering (exit 0); <f> --json = spec_impact's result; impact without a feature is a usage error, --reopen is refused (exit 1) (got " + js(all.out.slice(0, 300)) + ")");
  const doc = r(["doctor", "alpha"]);
  const na = r(["next-action", "alpha"]);
  ok(/\n {2}▲ steering-changed-since-approval — steering changed after approval — requirements \(approved \d{4}-\d\d-\d\d\): constitution\.md \(changed\)/.test(doc.out) &&
    /Also: steering changed after the approval of requirements, design \(constitution\.md\) — re-review against it and re-approve if it still holds \(dev-spec impact alpha --phase steering\)\./.test(na.out),
    "1.16 Q1 CLI: doctor prints the steering-changed-since-approval warning; next-action adds the re-review hint (got " + js(na.out.slice(0, 400)) + ")");

  // Q2 — cross-feature criteria: catalog section, doctor warning, --json = spec_catalog.
  const cat = r(["catalog"]);
  let catJ = null;
  try { catJ = JSON.parse(r(["catalog", "--json"]).out); } catch { /* stays null */ }
  const docB = r(["doctor", "beta"]);
  ok(/\n## ⚠ Possible duplicates \/ conflicts\n/.test(cat.out) && /- ⚡ alpha\/US-1\.AC-1 ↔ beta\/US-1\.AC-1 \(possible conflict: different numbers 5\/15 ↔ 3\/15, 100% alike\)/.test(cat.out) &&
    catJ && js(catJ.crossAcs) === js(SQ.catalog(q).crossAcs) && catJ.crossAcs.pairs.length === 1 &&
    /\n {2}▲ cross-feature-acs — 1 criterion pair\(s\) read like another active feature's or may contradict them — US-1\.AC-1 ↔ alpha\/US-1\.AC-1/.test(docB.out),
    "1.16 Q2 CLI: catalog prints the 'Possible duplicates / conflicts' section; --json carries crossAcs (= spec_catalog); doctor warns cross-feature-acs from the feature's side (got " + js(docB.out.match(/cross-feature-acs.*/) || "") + ")");

  // Q3 — glossary: steering glossary.md (EN / PT), clarify's questions, the brief's section, doctor's count.
  const sg = r(["steering", "glossary.md"]);
  const gfile = path.join(q, ".specs", "steering", "glossary.md");
  const stubOk = fs.existsSync(gfile) && /^# Glossary\n/.test(fs.readFileSync(gfile, "utf8"));
  fs.writeFileSync(gfile, "# Glossary\n\n- **Customer** — a person or company with a signed contract. _Avoid: client, user_\n");
  fs.writeFileSync(path.join(q, ".specs", "alpha", "tasks.md"), "# Tasks\n\n- [ ] 1. Charge the customer\n  - _Requirements: US-1.AC-2_\n");
  const cl = r(["clarify", "alpha"]);
  const br = r(["brief", "alpha", "1"]);
  const dg = r(["doctor", "alpha"]);
  const qp = path.join(tmp, "p16q-pt");
  SQ.initProject(qp, ["core"], "pt");
  const sgPt = run(["steering", "glossary.md", "--project", qp]);
  ok(sg.code === 0 && stubOk && /\d+\. requirements\.md:6: 'client' — the glossary says Customer \(a person or company with a signed contract\)\. Use "Customer"/.test(cl.out) &&
    /\n## Glossary \(terms this task uses\)\n.*\n- \*\*Customer\*\* — a person or company with a signed contract _\(avoid: client, user\)_\n/.test(br.out) &&
    /\n {2}▲ glossary — 1 use\(s\) of words the glossary says to avoid — 'client' → Customer \(requirements\.md:6\)/.test(dg.out) &&
    sgPt.code === 0 && /^# Glossário\n/.test(fs.readFileSync(path.join(qp, ".specs", "steering", "glossary.md"), "utf8")),
    "1.16 Q3 CLI: steering glossary.md writes the stub (PT with --project in a PT project); clarify asks about the avoided word with file:line; brief quotes the entry; doctor warns glossary (got " + js([cl.out.slice(-300), dg.out.match(/glossary —.*/)]) + ")");
  const help = run(["help"]).out;
  const doc0 = fs.readFileSync(CLI, "utf8").split("*/")[0];
  ok(/impact \[feature\] --phase steering/.test(help) && /impact \[feature\] --phase steering/.test(doc0) && /glossary\.md/.test(help) && /glossary\.md/.test(doc0),
    "1.16 Q CLI: help and the docblock document `impact [feature] --phase steering` and the glossary.md steering template");
  // 1.16 Q review 6: a glossary past 300 entries says so — clarify prints the note, --json carries glossaryTruncated.
  let big = "# Glossary\n\n- **Customer** — a person or company with a signed contract. _Avoid: client, user_\n";
  for (let i = 0; i < 304; i++) big += `- **Term${i}** — definition ${i}. _Avoid: zzword${i}_\n`;
  fs.writeFileSync(gfile, big);
  const clBig = r(["clarify", "alpha"]);
  let clBigJ = null;
  try { clBigJ = JSON.parse(r(["clarify", "alpha", "--json"]).out); } catch { /* stays null */ }
  ok(/\n {2}⚠ glossary\.md holds 305 entries — only the first 300 are read/.test(clBig.out) && /'client' — the glossary says Customer/.test(clBig.out) &&
    clBigJ && js(clBigJ.glossaryTruncated) === js({ read: 300, total: 305 }),
    "1.16 Q review 6 CLI: clarify prints the glossary-truncated note (the first 300 of 305 entries read) and --json carries glossaryTruncated (got " + js(clBig.out.slice(-240)) + ")");
};
