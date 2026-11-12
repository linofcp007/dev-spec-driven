"use strict";
// The design-system registry on the CLI (1.35) — `design-system [feature]`: the human report, --json; `steering design-system.md`
// seeded from the code; `finish --write` registering a feature's New components.

const fs = require("fs");
const path = require("path");
const MSG = require(path.join(__dirname, "..", "..", "mcp", "lib", "i18n.js")).msg; // a message checked against its i18n entry, not a pinned sentence (1.30)

exports.run = ({ all, runIn, tmp, require, __dirname }) => {
  const SR = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const js = (v) => JSON.stringify(v);
  const jsonOf = (r) => { try { return JSON.parse(r.out); } catch { return {}; } };
  const write = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  const rd = (dir, rel) => fs.readFileSync(path.join(dir, rel), "utf8");
  const REG = ".specs/steering/design-system.md";
  const project = (lang) => {
    const p = path.join(tmp, "p135-ds-" + lang);
    SR.initProject(p, ["ui"], lang);
    write(p, "package.json", js({ name: "shop", dependencies: { "@mui/material": "^5" } }));
    write(p, "src/components/Button.tsx", "export const Button = () => null;\n");
    write(p, "src/components/date-picker.tsx", "export const DatePicker = () => null;\n");
    write(p, "src/styles/tokens.css", ":root {\n  --color-action-primary: #1d4ed8;\n  --space-4: 16px;\n}\n");
    return p;
  };

  // --- no registry → the seed → in sync → the code moves on --------------------------------------------------------------------------
  const p = project("en");
  const none = runIn(["design-system", "--project", p]);
  const seeded = runIn(["steering", "design-system.md", "--project", p]);
  const again = runIn(["steering", "design-system.md", "--project", p]);
  const synced = runIn(["design-system", "--project", p]);
  write(p, "src/components/Badge.tsx", "export const Badge = () => null;\n");
  fs.rmSync(path.join(p, "src", "components", "date-picker.tsx"));
  write(p, "src/styles/theme.css", ":root { --radius: 8px; }\n");
  write(p, "package.json", js({ name: "shop", dependencies: { "@mui/material": "^5", antd: "^5" } }));
  const drift = runIn(["design-system", "--project", p]);
  const asJson = runIn(["design-system", "--project", p, "--json"]);
  const T = MSG("en").cliOutput;
  all("1.35 design-system (CLI): no registry — its path and how to create it; `steering design-system.md` writes it seeded from the code (the counts, once); then the report: in sync; a new component as a row to paste, a row whose path is gone, a token file and a UI library the registry doesn't name; --json IS spec_scan {designSystem: true}'s result; exit 0 (got " +
    js([none.code, none.out, seeded.out, again.out, synced.out, drift.out]) + ")", {
    none: () => none.code === 0 && none.out.split("\n")[0] === T.dsHeadNone(REG) && none.out.includes(T.dsCreate) && none.out.includes(T.dsFound(2, 2, 1)) && !none.out.includes(T.dsInSync),
    seeded: () => seeded.code === 0 && /^Created .*design-system\.md$/m.test(seeded.out) && seeded.out.includes(T.steeringSeeded(2, 2)),
    once: () => again.code === 0 && /^Exists \(left untouched\)/.test(again.out) && !again.out.includes("filled from the code"),
    synced: () => synced.code === 0 && synced.out.split("\n")[0] === T.dsHead(REG, 2, 2) && synced.out.includes(T.dsInSync),
    missing: () => drift.out.includes(T.dsMissingHead(1)) && drift.out.includes("    | Badge | `src/components/Badge.tsx` |  |  |"),
    stale: () => drift.out.includes(T.dsStaleHead(1)) && drift.out.includes("    DatePicker — src/components/date-picker.tsx"),
    lists: () => drift.out.includes(T.dsSourcesNew("src/styles/theme.css")) && drift.out.includes(T.dsLibrariesNew("antd")) && !drift.out.includes(T.dsInSync) && drift.code === 0,
    tokens: () => drift.out.includes(T.dsTokensNew(1)) && drift.out.includes("    | --radius | 8px |  |"),
    json: () => asJson.code === 0 && js(jsonOf(asJson)) === js(SR.designSystemReport(p)),
  });

  // --- a feature against the registry: its rows, its raw values; an unknown feature; PT; help ----------------------------------------
  const feature = (dir, lang) => {
    const f = SR.createFeature(dir, { name: "Checkout", tracks: ["ui"], summary: "x", lang });
    const head = lang === "pt" ? "## [UI] Uso do Design System\nA página usa o sistema.\n\n| Tipo | Componente | Porquê / notas |\n|---|---|---|\n| Reutilizar | Button | a ação de pagar |\n| Reutilizar | Buton | outra |\n| Novo | PriceTag | nenhum listado mostra um preço |\n"
      : "## [UI] Design System Usage\nThe page uses the system.\n\n| Kind | Component | Why / notes |\n|---|---|---|\n| Reuse | Button | the pay action |\n| Reuse | Buton | another |\n| New | PriceTag | no listed one shows a price |\n";
    fs.writeFileSync(path.join(f.dir, "design.md"), "# Design: Checkout\n\n" + head);
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Build the page\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/checkout/Checkout.tsx, src/checkout/plain.ts_\n");
    write(dir, "src/checkout/Checkout.tsx", "export const Checkout = () => <div style={{ color: \"#1D4ED8\" }} className=\"p-[13px]\" />;\n");
    write(dir, "src/checkout/plain.ts", "export const c = \"#aabbcc\";\n");
    return f.slug;
  };
  const slug = feature(p, "en");
  const fr = runIn(["design-system", slug, "--project", p]);
  const frJson = runIn(["design-system", slug, "--project", p, "--json"]);
  const frEngine = SR.designSystemReport(p, { name: slug }); // (now: the project gains a file below)
  const nope = runIn(["design-system", "nope", "--project", p]);
  const extra = runIn(["design-system", slug, "more", "--project", p]);
  const flag = runIn(["design-system", "--min-lines", "5", "--project", p]);
  const clean = SR.createFeature(p, { name: "Clean", tracks: ["ui"], summary: "x" });
  fs.writeFileSync(path.join(clean.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Build it\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/components/Button.tsx_\n");
  const cleanOut = runIn(["design-system", "clean", "--project", p]);
  const pp = project("pt");
  runIn(["steering", "design-system.md", "--project", pp]);
  const pslug = feature(pp, "pt");
  const pt = runIn(["design-system", pslug, "--project", pp]);
  const ptProject = runIn(["design-system", "--project", pp]);
  const help = runIn(["design-system", "--help"]);
  // a feature of a project with no registry: said, with how to create one; a component an unfinished feature declares New: pending
  const np = path.join(tmp, "p135-ds-noreg");
  SR.initProject(np, ["ui"], "en");
  const nslug = feature(np, "en");
  const noReg = runIn(["design-system", nslug, "--project", np]);
  write(p, "src/components/PriceTag.tsx", "export const PriceTag = () => null;\n");
  const pendingOut = runIn(["design-system", "--project", p]);
  const P = MSG("pt").cliOutput, Q = MSG("en").quality;
  all("1.35 design-system <feature> (CLI): the feature's rows by kind, each disagreement with the registry (⚠), the raw values of its view files as file:line value (→ the token of that value), a file that is no view file unread; a feature with nothing raw says so; an unknown feature, an extra word and another command's flag exit 1; the feature's language (PT); help shows the command (got " +
    js([fr.code, fr.out, cleanOut.out, nope.code, extra.code, flag.code, pt.out, ptProject.out.split("\n")[0], help.out.split("\n").slice(0, 2)]) + ")", {
    head: () => fr.code === 0 && fr.out.split("\n")[0] === T.dsFeatureHead("checkout", 2, 0, 1),
    problem: () => fr.out.includes("  ⚠ " + Q.dsProblem.unknown("Buton", "Button")),
    raw: () => fr.out.includes(T.dsRawHead(2, 1)) && fr.out.includes("    src/checkout/Checkout.tsx:1  #1D4ED8  → --color-action-primary") && fr.out.includes("    src/checkout/Checkout.tsx:1  p-[13px]") && !fr.out.includes("plain.ts"),
    json: () => frJson.code === 0 && js(jsonOf(frJson)) === js(frEngine),
    clean: () => cleanOut.code === 0 && cleanOut.out.includes(T.dsFeatureNoRows) && cleanOut.out.includes(T.dsRawNone(1)),
    refusals: () => nope.code === 1 && extra.code === 1 && flag.code === 1,
    pt: () => pt.code === 0 && pt.out.split("\n")[0] === P.dsFeatureHead("checkout", 2, 0, 1) && pt.out.includes("'Buton' não está no registo (será Button?)") && pt.out.includes(P.dsRawHead(2, 1)),
    ptProject: () => ptProject.out.split("\n")[0] === P.dsHead(REG, 2, 2),
    noRegistry: () => noReg.code === 0 && noReg.out.includes("  " + T.dsHeadNone(REG)) && noReg.out.includes(T.dsCreate) && noReg.out.includes(T.dsRawHead(2, 1)),
    pending: () => pendingOut.out.includes(T.dsPending("PriceTag (checkout)")) && !pendingOut.out.includes("| PriceTag |"),
    help: () => help.code === 0 && /^ {2}design-system \[feature\] {9}The design-system registry/m.test(help.out),
  });

  // --- finish --write on a READY feature adds its New components to the registry ------------------------------------------------------
  {
    const fp = project("finish");
    runIn(["steering", "design-system.md", "--project", fp]);
    const f = SR.createFeature(fp, { name: "Price Tag", tracks: ["ui"], summary: "Show a price", size: "s" });
    fs.writeFileSync(path.join(f.dir, "requirements.md"), "# Feature: Price Tag\n\n## Summary\nShow a price.\n\n## User Stories\n### US-1 (P1): See a price\nAs a buyer I want to see a price.\n**Independent Test:** open one product.\n\n" +
      "#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN the buyer opens a product THE SYSTEM SHALL show its price with the currency.\n" +
      "2. **US-1.AC-2** — IF the price is missing THEN THE SYSTEM SHALL show a dash.\n\n## Success Criteria\n- **SC-001** — every product page shows a price.\n\n" +
      "## Edge Cases & Error Handling\n- **EC-1** — WHEN the currency is unknown THE SYSTEM SHALL show the amount alone.\n\n## Non-Functional Requirements\n- **NFR-1** — renders in under 16 ms.\n\n## Out of Scope\n- Discounts.\n");
    fs.writeFileSync(path.join(f.dir, "design.md"), "# Design: Price Tag\n\n## Overview\nA price with its currency.\n\n## Architecture\n```mermaid\ngraph TD\n  P[PriceTag] --> F[format]\n```\n\n" +
      "## Decisions, reuse & risks\nReuses the money formatter (`src/lib/money.ts`); one component rather than a helper, so the markup is shared; no material risk: it only renders.\n\n" +
      "## Error Handling\nSee the IF…THEN criteria.\n\n## Constitution Check\n- [x] Small components — complies.\n\n## Complexity Tracking\nNone.\n\n" +
      "## [UI] Design System Usage\nBuilt from the system.\n\n| Kind | Component | Why / notes |\n|---|---|---|\n| Reuse | Button | the retry action |\n| New | PriceTag | no listed component shows a price with its currency |\n| New | Bad<!--Name | not a name a row can hold |\n\n" +
      "## [UI] UI States\nLoading: a skeleton. Error: a dash. Reference: design/price.png.\n\n## [UI] Accessibility\nWCAG 2.2 AA; axe in the component tests.\n");
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Build the price tag\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n  - _Implements: src/components/PriceTag.tsx_\n  - _Verify: npm test_\n");
    write(fp, "src/components/PriceTag.tsx", "export const PriceTag = () => <b style={{ color: \"#123456\" }} />;\n");
    const approvals = ["requirements", "design", "tasks"].map((ph) => runIn(["approve", f.slug, ph, "--project", fp]).code);
    const done = runIn(["done", f.slug, "1", "--evidence", "42/42 passing", "--exit", "0", "--cmd", "npm test", "--project", fp]);
    const before = rd(fp, REG);
    const fin = runIn(["finish", f.slug, "--write", "--project", fp]);
    const after = rd(fp, REG);
    const finJson = jsonOf(runIn(["finish", f.slug, "--write", "--project", fp, "--json"]));
    const doctor = runIn(["doctor", f.slug, "--project", fp, "--json"]);
    all("1.35 finish --write (CLI): a READY feature's New components are added to the registry (✓ the line, the row with its path and `_From: <feature>_`), a name no row can hold is said (▲ not added), its raw values are a ▲ warning — never a blocker (exit 0); a second finish adds nothing and stays ready; doctor still passes ui-design-system (got " +
      js([approvals, done.code, fin.code, fin.out, after.slice(before.length), finJson.designSystem, finJson.readyToFinish]) + ")", {
      ready: () => approvals.every((c) => c === 0) && done.code === 0 && fin.code === 0,
      line: () => fin.out.includes(T.dsRegistered("PriceTag")) && fin.out.includes(T.dsUnregistered("Bad<!--Name")),
      warning: () => /^ {2}▲ the feature's view files hold 1 raw value where the design system has tokens — src\/components\/PriceTag\.tsx:1 #123456: use the token/m.test(fin.out),
      row: () => after === before + "| PriceTag | `src/components/PriceTag.tsx` |  | _From: price-tag_ |\n",
      once: () => finJson.readyToFinish === true && js(finJson.designSystem.registered) === js([]) && js(finJson.designSystem.unregistered) === js(["Bad<!--Name"]) && rd(fp, REG) === after,
      doctor: () => ((jsonOf(doctor).checks || []).find((c) => c.id === "ui-design-system") || {}).status === "pass",
    });
  }

  // --- review 3: a bound the scan reached is said, and "the registry and the code agree" never beside it; credentials stay unread -----
  {
    const lp = path.join(tmp, "p135-ds-limits");
    SR.initProject(lp, ["ui"], "pt");
    write(lp, "src/components/Button.tsx", "export const Button = () => null;\n");
    for (let i = 0; i < 22; i++) write(lp, "src/styles/tokens.f" + String(i).padStart(2, "0") + ".css", ":root { --f" + i + ": 1px; }\n");
    write(lp, "token.json", js({ token: "ya29.FAKE-ACCESS-0000", refresh_token: "1//FAKE-REFRESH-1111", client_secret: "GOCSPX-FAKE-2222" }));
    const seed = runIn(["steering", "design-system.md", "--project", lp]);
    const rep = runIn(["design-system", "--project", lp]);
    const asJson = jsonOf(runIn(["design-system", "--project", lp, "--json"]));
    const P = MSG("pt").cliOutput;
    all("1.35 review 3 (CLI): with 22 token files the report says only the first 20 are read (the project's language) and never that the registry and the code agree; a root token.json of an OAuth client reaches neither the seeded registry nor the report (got " +
      js([seed.code, rep.code, rep.out, asJson.limits, asJson.inSync]) + ")", {
      limit: () => rep.code === 0 && rep.out.includes(P.dsLimit["token-files"](20)) && !rep.out.includes(P.dsInSync),
      json: () => js(asJson.limits) === js([{ code: "token-files", read: 20 }]) && asJson.truncated === true && asJson.inSync === false,
      noSecret: () => seed.code === 0 && !/FAKE/.test(rd(lp, REG) + rep.out + js(asJson)) && !asJson.found.sources.includes("token.json"),
    });
  }
};
