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
    // (1.38: the operation opts into the project's UI checks — the engine's default runs none, CRIT_X D4)
    json: () => asJson.code === 0 && js(jsonOf(asJson)) === js(SR.designSystemReport(p, { uiPass: true })),
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
    // a token file by its name, with a real token: read — its other value, under a key no credential list holds, is not
    write(lp, "scripts/deploy.tokens.json", js({ github: "xhp_FAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKE1234", color: { brand: "#1d4ed8" } }));
    const seed = runIn(["steering", "design-system.md", "--project", lp]);
    const rep = runIn(["design-system", "--project", lp]);
    const asJson = jsonOf(runIn(["design-system", "--project", lp, "--json"]));
    const P = MSG("pt").cliOutput;
    all("1.35 review 3 / 4 (CLI): with more than 20 token files the report says only the first 20 are read (the project's language) and never that the registry and the code agree; a root token.json of an OAuth client is no token file, and of a `deploy.tokens.json` that IS one only the design value is seeded — its 40-character `github` value reaches neither the registry nor the report (got " +
      js([seed.code, rep.code, rep.out, asJson.limits, asJson.inSync, asJson.found.sources.slice(0, 2)]) + ")", {
      limit: () => rep.code === 0 && rep.out.includes(P.dsLimit["token-files"](20)) && !rep.out.includes(P.dsInSync),
      json: () => js(asJson.limits) === js([{ code: "token-files", read: 20 }]) && asJson.truncated === true && asJson.inSync === false,
      noSecret: () => seed.code === 0 && !/FAKE/.test(rd(lp, REG) + rep.out + js(asJson)) && !asJson.found.sources.includes("token.json"),
      valueOnly: () => asJson.found.sources[0] === "scripts/deploy.tokens.json" && rd(lp, REG).includes("| color.brand | #1d4ed8 |  |") && !/github/.test(rd(lp, REG)),
    });
  }

  // --- review 6: a row to paste keeps its table — a `|` in a name or a path is escaped; the file-size line names its file ------------
  {
    const ep = path.join(tmp, "p135-ds-escape");
    SR.initProject(ep, ["ui"], "en");
    write(ep, "src/components/Button.tsx", "export const Button = () => null;\n");
    runIn(["steering", "design-system.md", "--project", ep]);
    write(ep, "src/x.tokens.json", js({ "a|b": "#1d4ed8" }));
    const body = ":root { --big: 4px; }\n";
    write(ep, "src/styles/tokens.big.css", body + "/*" + "x".repeat(262145 - body.length - 4) + "*/");
    let piped = false; // (a `|` in a folder's name: Linux / macOS only)
    try { write(ep, "src/components/a|b/Card.tsx", "export const Card = () => null;\n"); piped = true; } catch { /* no such name here */ }
    const rep = runIn(["design-system", "--project", ep]);
    const BS = String.fromCharCode(92);
    all("1.35 review 6 (CLI): a token whose name holds a `|` is printed as a row that still has its three cells (the `|` escaped), a component's path too; the file-size line names the token file that is longer than a file's read, and the report never says the registry and the code agree beside it (got " +
      js([rep.code, rep.out, piped]) + ")", {
      token: () => rep.code === 0 && rep.out.includes("    | a" + BS + "|b | #1d4ed8 |  |"),
      path: () => !piped || rep.out.includes("    | Card | `src/components/a" + BS + "|b/Card.tsx` |  |  |"),
      fileSize: () => rep.out.includes(T.dsLimit["file-size"](262144, "src/styles/tokens.big.css")) && rep.out.includes("src/styles/tokens.big.css") && !rep.out.includes(T.dsInSync),
    });
  }

  // --- 1.37: doctor's ui-deprecated — a Reuse row naming a component the registry marks `_Deprecated: use X_` ----------------------------
  {
    const dep = {};
    for (const lang of ["en", "pt"]) {
      const dp = path.join(tmp, "p137-ds-deprecated-" + lang);
      SR.initProject(dp, ["ui"], lang);
      write(dp, REG, "# Design System\n\n| Component | Path | Variants | Notes |\n|---|---|---|---|\n| Table | src/components/Table.tsx |  | _Deprecated: use DataGrid_ |\n| DataGrid | src/components/DataGrid.tsx |  |  |\n");
      const f = SR.createFeature(dp, { name: "Orders", tracks: ["ui"], summary: "x", lang });
      const usage = lang === "pt" ? "## [UI] Uso do Design System\nA página usa o sistema.\n\n| Tipo | Componente | Porquê / notas |\n|---|---|---|\n| Reutilizar | Table | a lista |\n"
        : "## [UI] Design System Usage\nThe page uses the system.\n\n| Kind | Component | Why / notes |\n|---|---|---|\n| Reuse | Table | the list |\n";
      fs.writeFileSync(path.join(f.dir, "design.md"), "# Design: Orders\n\n" + usage);
      const human = runIn(["doctor", f.slug, "--project", dp]);
      const asJson = jsonOf(runIn(["doctor", f.slug, "--project", dp, "--json"]));
      const Qd = MSG(lang).quality;
      dep[lang] = { code: human.code, line: human.out.split("\n").find((l) => / ui-deprecated /.test(l)), want: () => "  ▲ ui-deprecated — " + Qd.dsDeprecated(1, Qd.dsDeprecatedItem("Table", "DataGrid")), // (lazy: the parent has no such key)
        json: (asJson.checks || []).find((c) => c.id === "ui-deprecated") };
    }
    all("1.37 doctor (CLI): a +ui feature reusing a component the registry marks deprecated prints the ▲ ui-deprecated line naming its replacement, in the feature's language; --json carries {id, status, detail} (got " + js(dep) + ")", {
      en: () => dep.en.line === dep.en.want() && js(dep.en.json) === js({ id: "ui-deprecated", status: "warn", detail: dep.en.want().slice("  ▲ ui-deprecated — ".length) }),
      pt: () => dep.pt.line === dep.pt.want() && dep.pt.json.status === "warn",
    });
  }

  // --- 1.38: doctor's ui-states — [UI] UI States' matrix leaves a state neither designed nor n/a ---------------------------------------
  {
    const sp = path.join(tmp, "p138-ui-states");
    SR.initProject(sp, ["ui"], "en");
    const f = SR.createFeature(sp, { name: "Orders", tracks: ["ui"], summary: "x", size: "m" });
    const Qs = MSG("en").quality;
    const rows = Object.values(Qs.uiStateLabels || {}).map((l) => "| " + l + " | " + (l === "Stale" ? "" : "what the list shows") + " | |");
    fs.writeFileSync(path.join(f.dir, "design.md"), "# Design: Orders\n\n## [UI] UI States\nThe orders list, state by state.\n\n| State | Orders list | Announced · focus |\n|---|---|---|\n" + rows.join("\n") + "\n");
    const human = runIn(["doctor", f.slug, "--project", sp]);
    const asJson = jsonOf(runIn(["doctor", f.slug, "--project", sp, "--json"]));
    const want = () => Qs.usOpen(1, Qs.usView("Orders list", "Stale")); // (lazy: the parent has no such key)
    const line = human.out.split("\n").find((l) => / ui-states /.test(l));
    all("1.38 doctor (CLI): a +ui feature whose state matrix leaves a cell open prints the ▲ ui-states line; --json carries {id, status, detail} (got " + js({ line, json: (asJson.checks || []).find((c) => c.id === "ui-states") }) + ")", {
      line: () => line === "  ▲ ui-states — " + want(),
      json: () => js((asJson.checks || []).find((c) => c.id === "ui-states")) === js({ id: "ui-states", status: "warn", detail: want() }),
    });
  }

  // --- review 8: "in sync" is never printed beside a component an unfinished feature is building --------------------------------------
  {
    const sp = path.join(tmp, "p135-ds-pending");
    SR.initProject(sp, ["ui"], "en");
    write(sp, "src/components/Button.tsx", "export const Button = () => null;\n");
    runIn(["steering", "design-system.md", "--project", sp]);
    const clean = runIn(["design-system", "--project", sp]);
    const f = SR.createFeature(sp, { name: "Chips", tracks: ["ui"], summary: "x" });
    fs.writeFileSync(path.join(f.dir, "design.md"), "# Design: Chips\n\n## [UI] Design System Usage\nThe page uses the system.\n\n| Kind | Component | Why / notes |\n|---|---|---|\n| New | Chip | no listed one is a small label |\n");
    write(sp, "src/components/Chip.tsx", "export const Chip = () => null;\n");
    const out = runIn(["design-system", "--project", sp]);
    const asJson = jsonOf(runIn(["design-system", "--project", sp, "--json"]));
    all("1.35 review 8 (CLI): the in-sync line says the registry lists every component the scan found — so it is printed for a registry that does, and never beside a component an unfinished feature is building (the JSON's `inSync` stays true: that component is the feature's to add) (got " +
      js([clean.out, out.out, asJson.inSync, asJson.pendingTotal]) + ")", {
      clean: () => clean.code === 0 && clean.out.includes(T.dsInSync),
      pending: () => out.out.includes(T.dsPending("Chip (chips)")) && !out.out.includes(T.dsInSync) && asJson.inSync === true && asJson.pendingTotal === 1,
    });
  }

  // --- 1.38 R: the breakpoints — the project's after its counts, a feature's after its UI checks; each source, the unread, the bounds -------
  {
    const UI = ".specs/steering/ui.md";
    const bp = (tag, lang, css, uiLine) => {
      const d = path.join(tmp, "p138-bp-" + tag);
      SR.initProject(d, ["ui"], lang);
      if (css != null) write(d, "src/app.css", css);
      if (uiLine != null) fs.writeFileSync(path.join(d, UI), fs.readFileSync(path.join(d, UI), "utf8").replace(/^- Breakpoints: .*$/m, uiLine));
      return d;
    };
    const uiAt = (d) => UI + ":" + (fs.readFileSync(path.join(d, UI), "utf8").split("\n").findIndex((l) => l.startsWith("- Breakpoints:")) + 1);
    const at = (out, line) => out.split("\n").indexOf(line);
    // partial: an @theme that only adds (shadcn v4's 3xl / 4xl) — its widths, then the default set where room is left (1.39, BS-2:
    // 768 · 1024 · 1440; 390 had no room, and a default width is never said)
    const partial = bp("partial", "en", "@import \"tailwindcss\";\n@theme inline {\n  --breakpoint-3xl: 1600px;\n  --breakpoint-4xl: 2000px;\n}\n");
    const pOut = runIn(["design-system", "--project", partial]);
    const pJson = jsonOf(runIn(["design-system", "--project", partial, "--json"]));
    // code alone (a reset), with six unread values: five listed, the sixth counted
    const code = bp("code", "en", "@theme {\n  --breakpoint-*: initial;\n  --breakpoint-x: calc(40rem + 1px);\n  --breakpoint-md: 50rem;\n" +
      ["var(--w)", "auto", "40vw", "250rem", "1e3px"].map((v, i) => "  --breakpoint-u" + i + ": " + v + ";\n").join("") + "}\n");
    const cOut = runIn(["design-system", "--project", code]);
    // ui.md's line, too long: it decides, and its bound is said
    const line = bp("line", "en", null, "- Breakpoints: 600 / 1200 px " + "x".repeat(220));
    const lOut = runIn(["design-system", "--project", line]);
    // nothing declared: the default set; a feature's report prints it after its UI checks
    const none = bp("none", "en", null, null);
    const f = SR.createFeature(none, { name: "Grid", tracks: ["ui"], summary: "x" });
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Build it\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/grid/Grid.tsx_\n");
    write(none, "src/grid/Grid.tsx", "export const Grid = () => <div className=\"grid\" />;\n");
    const nOut = runIn(["design-system", "--project", none]), fOut = runIn(["design-system", f.slug, "--project", none]);
    const fJson = jsonOf(runIn(["design-system", f.slug, "--project", none, "--json"]));
    const pt = bp("pt", "pt", null, null), ptOut = runIn(["design-system", "--project", pt]);
    const P = MSG("pt").cliOutput;
    const DEF = "320 · 390 · 768 · 1024 · 1440";
    all("1.38 design-system (CLI): the breakpoints line — the widths and where they come from (ui.md's line, the code's @theme, partial: the default set and what the code adds, none: the default set), the unread ones, its own bounds (the 7th width, ui.md's 200 characters); right after the project's counts, after a feature's UI checks; PT; --json is the engine's, both shapes (got " +
      js([pOut.out, cOut.out, lOut.out, nOut.out, fOut.out, ptOut.out]) + ")", {
      partial: () => pOut.code === 0 && at(pOut.out, T.bpHead("320 · 768 · 1024 · 1440 · 1600 · 2000", T.bpFrom.partial("src/app.css:3"))) === at(pOut.out, T.dsFound(0, 0, 0)) + 1 &&
        !pOut.out.includes(T.bpLimit["breakpoint-widths"](6, 1, 1600)) && !pOut.out.includes(T.bpLimit["breakpoint-widths"](6, 1, 390)),
      json: () => js(pJson.breakpoints) === js(SR.designSystemReport(partial).breakpoints) && pJson.breakpoints.partial === true && pJson.breakpoints.limits.length === 0,
      code: () => cOut.out.includes(T.bpHead("320 · 800", T.bpFrom.code("src/app.css:4"))) &&
        cOut.out.includes(T.bpUnread(6, "--breakpoint-x calc(40rem + 1px) (src/app.css:3), --breakpoint-u0 var(--w) (src/app.css:5), --breakpoint-u1 auto (src/app.css:6), --breakpoint-u2 40vw (src/app.css:7), --breakpoint-u3 250rem (src/app.css:8) … +1")),
      line: () => lOut.out.includes(T.bpHead("320 · 600 · 1200", T.bpFrom["ui.md"](uiAt(line)))) && lOut.out.includes(T.bpLimit["breakpoint-line"](200, undefined, undefined, uiAt(line))),
      none: () => nOut.out.includes(T.bpHead(DEF, T.bpFrom.default())) && !nOut.out.includes("⚠"),
      feature: () => fOut.code === 0 && at(fOut.out, T.bpHead(DEF, T.bpFrom.default())) > at(fOut.out, T.uiNone(1)) && at(fOut.out, T.uiNone(1)) > 0 &&
        js(fJson.breakpoints) === js(SR.designSystemReport(none, { name: f.slug }).breakpoints),
      pt: () => ptOut.out.includes(P.bpHead(DEF, P.bpFrom.default())),
    });

    // 1.38.0 review 1 (BS-1): the widths as the CLI prints them, pasted over the stub's slot as its message says, are read whole —
    // EN / PT / ES (the stub's ` · text expansion …` still ends the value)
    const pasted = ["en", "pt", "es"].map((lang) => {
      const d = bp("paste-" + lang, lang, null, null), X = MSG(lang).cliOutput;
      const first = runIn(["design-system", "--project", d]).out, printed = (/^ {2}breakpoints: (.+?) px — /m.exec(first) || ["", "?"])[1];
      fs.writeFileSync(path.join(d, UI), fs.readFileSync(path.join(d, UI), "utf8").replace("[360 / 768 / 1280 px]", printed + " px"));
      const again = runIn(["design-system", "--project", d]);
      return { lang, printed, line: (fs.readFileSync(path.join(d, UI), "utf8").match(/^- Breakpoints: .*$/m) || [""])[0], ok: again.out.includes(X.bpHead(DEF, X.bpFrom["ui.md"](uiAt(d)))) };
    });
    all("1.38.0 review 1 design-system (CLI): the default widths as printed (`320 · 390 · 768 · 1024 · 1440`), pasted into ui.md's Breakpoints line, read back whole from the line — EN / PT / ES (got " + js(pasted) + ")", {
      printed: () => pasted.every((x) => x.printed === DEF),
      read: () => pasted.every((x) => x.ok),
    });
  }

  // --- 1.38: a raw value against the scale, the repeated values, the units table; the registry's values against the code ----------
  {
    // (the PT registry's units table holds 60 rows more: past the 50 read)
    const more = (lang) => (lang === "pt" ? Array.from({ length: 60 }, (_, i) => "| p" + "abcdefghijklmnopqrstuvwxyz"[i % 26] + "abc"[Math.floor(i / 26)] + " | px |\n").join("") : "");
    const mk = (lang) => {
      const dir = path.join(tmp, "p138-ds-" + lang);
      SR.initProject(dir, ["ui"], lang);
      write(dir, REG, "# Design System\n\n_Token sources: src/styles/tokens.css, src/styles/gone.css_\n\n| Token | Value | Use |\n|---|---|---|\n| --primary | oklch(0.205 0 0) | x |\n| --duration-normal | 150ms | x |\n" +
        "| --ease-out | cubic-bezier(0.22, 1, 0.36, 1) | x |\n\n| Property | Units |\n|---|---|\n| font-size | rem |\n| spacing | small |\n" + more(lang));
      write(dir, "src/styles/tokens.css", ":root {\n  --primary: oklch(0.205 0 0);\n  --duration-normal: .2s;\n  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);\n}\n");
      const f = SR.createFeature(dir, { name: "Checkout", tracks: ["ui"], summary: "x", lang });
      fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Build the page\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/checkout/_\n");
      write(dir, "src/checkout/c.css", ".a { color: #171717; background: #18181b; font-size: 14px; transition: opacity 150ms; }\n.b { color: #171717; }\n");
      return { dir, slug: f.slug };
    };
    const en = mk("en"), pt = mk("pt");
    const fr = runIn(["design-system", en.slug, "--project", en.dir]), frJson = runIn(["design-system", en.slug, "--project", en.dir, "--json"]);
    const pr = runIn(["design-system", "--project", en.dir]), prJson = runIn(["design-system", "--project", en.dir, "--json"]);
    const ptOut = runIn(["design-system", pt.slug, "--project", pt.dir]), ptProject = runIn(["design-system", "--project", pt.dir]);
    const help = runIn(["design-system", "--help"]);
    const P = MSG("pt").cliOutput;
    all("1.38 design-system (CLI): a raw colour of the scale names its token (→), one close to a token says so (≈ … not the same colour), a motion value of the scale its token; the repeated values (×n in n files); the lengths off the units table with what the table allows; the project report prints a drifted token as the row the code has, the registry's value and the file, the token files gone and the units rows not read; --json is the engine's; PT (got " +
      js([fr.out, pr.out, ptOut.out]) + ")", {
      raw: () => fr.code === 0 && fr.out.includes("    src/checkout/c.css:1  #171717  → --primary") && fr.out.includes("    src/checkout/c.css:1  #18181b  " + T.dsRawNear("--primary")) &&
        fr.out.includes("    src/checkout/c.css:1  transition: opacity 150ms  → --duration-normal"),
      groups: () => fr.out.includes(T.dsRawGroupsHead) && fr.out.includes(T.dsRawGroup("#171717", 2, 1) + "  → --primary"),
      units: () => fr.out.includes(T.dsUnitsHead(1)) && fr.out.includes("    src/checkout/c.css:1  font-size: 14px  " + T.dsUnitsLine("px", "rem")),
      drift: () => pr.code === 0 && pr.out.includes(T.dsDriftHead(1)) && pr.out.includes("    | --duration-normal | .2s |  |   " + T.dsDriftWas("150ms", "src/styles/tokens.css")),
      gone: () => pr.out.includes(T.dsSourcesGone("src/styles/gone.css")) && pr.out.includes(T.dsUnitsUnread("spacing")),
      json: () => js(jsonOf(frJson)) === js(SR.designSystemReport(en.dir, { name: en.slug })) && js(jsonOf(prJson)) === js(SR.designSystemReport(en.dir, { uiPass: true })),
      pt: () => ptOut.code === 0 && ptOut.out.includes("    src/checkout/c.css:1  #18181b  " + P.dsRawNear("--primary")) && ptOut.out.includes(P.dsUnitsHead(1)) && ptOut.out.includes(P.dsRawGroupsHead),
      past: () => ptProject.out.includes(P.dsUnitsPast(12, 50)) && !pr.out.includes(T.dsUnitsPast(0, 2).slice(0, 20)),
      help: () => /the raw values and the UI checks/.test(help.out) && !/raw colours/.test(help.out),
    });
  }
};
