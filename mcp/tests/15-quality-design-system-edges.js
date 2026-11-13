"use strict";
// The design-system registry (1.35) — review 1's findings: a feature after its own finish (the `_From:_` origin, a settled design
// only warns, a rename follows), the code scan's misreadings (hooks, pages, .js components, token files, <style> blocks, strings
// that look like comments or colours), the registry's caps, bounded time on hostile input, the mode's argument rules.

const fs = require("fs");
const path = require("path");

exports.run = async ({ all, rpc, payload, S, tmp, approveBefore, remeasure, require, __dirname }) => {
  const js = (v) => JSON.stringify(v);
  const call = (name, args) => rpc("tools/call", { name, arguments: args });
  const E = require(path.join(__dirname, "lib", "engine", "index.js"));
  const write = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  const rd = (dir, rel) => fs.readFileSync(path.join(dir, rel), "utf8");
  const REG = ".specs/steering/design-system.md";
  const REGISTRY = "# Design System\n\n## Tokens\n_Token sources: src/styles/tokens.css_\n\n| Token | Value | Use |\n|---|---|---|\n| --color-action-primary | #1d4ed8 | primary |\n\n" +
    "## Components\n\n| Component | Path | Variants | Notes |\n|---|---|---|---|\n| Button | `src/components/Button.tsx` | primary |  |\n| Card | `src/components/Card.tsx` |  |  |\n";
  const REQ = "# Feature: Price Tag\n\n## Summary\nShow a price.\n\n## User Stories\n### US-1 (P1): See a price\nAs a buyer I want to see a price.\n**Independent Test:** open one product.\n\n" +
    "#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN the buyer opens a product THE SYSTEM SHALL show its price with the currency.\n" +
    "2. **US-1.AC-2** — IF the price is missing THEN THE SYSTEM SHALL show a dash.\n\n## Success Criteria\n- **SC-001** — every product page shows a price.\n\n" +
    "## Edge Cases & Error Handling\n- **EC-1** — WHEN the currency is unknown THE SYSTEM SHALL show the amount alone.\n\n## Non-Functional Requirements\n- **NFR-1** — renders in under 16 ms.\n\n## Out of Scope\n- Discounts.\n";
  const usage = (rows) => "Built from the system.\n\n| Kind | Component | Why / notes |\n|---|---|---|\n" + rows.join("\n");
  const design = (rows) => "# Design: Price Tag\n\n## Overview\nA price with its currency.\n\n## Architecture\n```mermaid\ngraph TD\n  P[PriceTag] --> F[format]\n```\n\n" +
    "## Reuse & Integration\n| Kind | What | Where (path) | Why / notes |\n|---|---|---|---|\n| Reuse | the money formatter | `src/lib/money.ts` | it formats a price |\n\n" +
    "## Alternatives & Trade-offs\n| Decision | Option | Pros | Cons | Cost if wrong | Chosen |\n|---|---|---|---|---|---|\n| Shape | A component | Shared markup | One more file | A rename | ✓ |\n| Shape | A helper | Small | Markup repeated | Drift | ✗ |\n\n" +
    "## Data Models\nPrice {amount, currency}.\n\n## Error Handling\nSee the IF…THEN criteria.\n\n## Testing Strategy\nComponent tests.\n\n## Risks\n- A missing currency — low — the amount alone.\n\n" +
    "## Constitution Check\n- [x] Small components — complies.\n\n## Complexity Tracking\nNone.\n\n" +
    "## [UI] Design System Usage\n" + usage(rows) + "\n\n## [UI] UI States\nLoading: a skeleton. Error: a dash. Reference: design/price.png.\n\n## [UI] Accessibility\nWCAG 2.2 AA; axe in the component tests.\n\n" +
    "## [UI] Responsiveness & i18n\nOne line at 360 px.\n\n## [UI] UI Performance Budget\nNo layout shift.\n";
  const TASKS = "# Tasks\n\n- [ ] 1. [US1] Build the price tag\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n  - _Implements: src/components/PriceTag.tsx_\n  - _Verify: npm test_\n";
  const ROWS = ["| Reuse | Button | the retry action |", "| New | PriceTag | no listed component shows a price with its currency |"];
  // a feature of the given size, approved through its tasks and its one task done: ready to finish
  const ready = (tag, size, registry, rows) => {
    const p = path.join(tmp, "proj-dse-" + tag);
    S.initProject(p, ["ui"], "en");
    if (registry != null) write(p, REG, registry);
    const f = S.createFeature(p, { name: "Price Tag", tracks: ["ui"], summary: "Show a price", ...(size ? { size } : {}) });
    fs.writeFileSync(path.join(f.dir, "requirements.md"), REQ);
    fs.writeFileSync(path.join(f.dir, "design.md"), design(rows || ROWS));
    fs.writeFileSync(path.join(f.dir, "tasks.md"), TASKS);
    write(p, "src/components/PriceTag.tsx", "export const PriceTag = () => null;\n");
    approveBefore(p, f.slug, "requirements");
    const approvals = ["requirements", "design", "tasks"].map((ph) => { const a = S.approvePhase(p, f.slug, ph, "t"); return a.ok ? true : (a.failing || a.error); });
    S.completeTask(p, f.slug, 1, { command: "npm test", exitCode: 0, summary: "42/42 passing" });
    return { p, slug: f.slug, dir: f.dir, approvals };
  };
  const dsCheck = (g, slug) => (S.specDoctor(g.p, slug || g.slug).checks || []).find((c) => c.id === "ui-design-system") || null;

  // --- review 1 (HIGH): a feature's own finish must not turn its approved design into a failing one ---------------------------------
  {
    const g = ready("own-m", "m", REGISTRY);
    const before = dsCheck(g);
    const fin = S.finishFeature(g.p, g.slug, { write: true });
    const after = dsCheck(g);
    const doc = S.specDoctor(g.p, g.slug);
    const again = S.finishFeature(g.p, g.slug, { write: true });
    const exec = S.approvePhase(g.p, g.slug, "execution", "t");
    // another feature declaring the same New component is told it is listed; the owner renamed: its rows follow
    const other = S.createFeature(g.p, { name: "Sale Banner", tracks: ["ui"], summary: "x" });
    fs.writeFileSync(path.join(other.dir, "requirements.md"), REQ.replace("Price Tag", "Sale Banner"));
    fs.writeFileSync(path.join(other.dir, "design.md"), design(["| New | PriceTag | a price again |"]));
    approveBefore(g.p, other.slug, "design");
    const otherCheck = dsCheck(g, other.slug);
    const renamed = S.manageFeature(g.p, "rename", g.slug, "Price Label");
    const afterRename = (S.specDoctor(g.p, "price-label").checks || []).find((c) => c.id === "ui-design-system");
    all("1.35 review 1: a size m feature's own finish — its design says `New | PriceTag`, the READY written finish registers PriceTag with `_From: <feature>_` — leaves ui-design-system passing: doctor is still clean, a second finish is ready, the execution sign-off goes through; another feature's `New | PriceTag` is 'already listed'; renaming the owner rewrites the origin (got " +
      js({ approvals: g.approvals, before: before.status, fin: [fin.readyToFinish, fin.designSystem && fin.designSystem.registered], after: [after.status, after.detail], verdict: doc.verdict, again: again.readyToFinish, exec: [exec.ok, exec.failing],
        other: [otherCheck.status, otherCheck.detail.slice(0, 120)], renamed: [renamed.ok, renamed.designSystemUpdated], row: rd(g.p, REG).split("\n").filter((l) => /PriceTag/.test(l)), afterRename: afterRename && afterRename.status }) + ")", {
      setup: () => g.approvals.every((a) => a === true) && before.status === "pass",
      registered: () => fin.readyToFinish === true && js(fin.designSystem.registered) === js(["PriceTag"]),
      stillPassing: () => after.status === "pass" && /agrees with the registry \(Reuse: 1 · Extend: 0 · New: 1\)/.test(after.detail) && !doc.checks.some((c) => c.status === "fail"),
      secondFinish: () => again.readyToFinish === true && js(again.designSystem ? again.designSystem.registered : []) === js([]),
      execution: () => exec.ok === true,
      otherFeature: () => otherCheck.status === "warn" && /'PriceTag' is marked New but the registry already lists PriceTag/.test(otherCheck.detail),
      rename: () => renamed.ok === true && renamed.designSystemUpdated === 1 && rd(g.p, REG).includes("| PriceTag | `src/components/PriceTag.tsx` |  | _From: price-label_ |") && afterRename.status === "pass",
    });
  }
  {
    // a design approved cleanly and unchanged is never FAILED by the registry moving on — a row renamed, a registry created later;
    // once the design is edited it is judged again (fail), and the approval gate was strict all along
    const g = ready("settled", "m", REGISTRY);
    write(g.p, REG, REGISTRY.replace("| Button |", "| ActionButton |"));
    const renamedRow = dsCheck(g);
    const fin = S.finishFeature(g.p, g.slug);
    fs.writeFileSync(path.join(g.dir, "design.md"), design(ROWS) + "\nA late note.\n");
    const edited = dsCheck(g);
    const reapprove = S.approvePhase(g.p, g.slug, "design", "t");
    const late = ready("late-registry", "m", null);
    const noReg = dsCheck(late);
    write(late.p, REG, REGISTRY.replace("| Button |", "| ActionButton |"));
    const created = dsCheck(late);
    const lateFin = S.finishFeature(late.p, late.slug);
    // a forced approval is no clean one: doctor keeps failing it
    const forced = ready("forced", "m", REGISTRY, ["| Reuse | Buton | x |"]);
    all("1.35 review 1: a design approved cleanly under the check and unchanged since only WARNS when the registry moves on (a row renamed; a registry created after the approval) — the finish stays ready; an edited design is judged again (doctor fails, the re-approval is refused); a forced approval keeps failing (got " +
      js({ renamedRow: [renamedRow.status, renamedRow.detail.slice(0, 90)], fin: [fin.readyToFinish, fin.blockers], edited: edited.status, reapprove: [reapprove.ok, reapprove.failing], noReg: noReg.status, created: created.status, lateFin: lateFin.readyToFinish,
        forced: [forced.approvals, dsCheck(forced) && dsCheck(forced).status] }) + ")", {
      renamedRow: () => renamedRow.status === "warn" && /'Button' is not in the registry/.test(renamedRow.detail) && !/a size m design needs it/.test(renamedRow.detail),
      finishStands: () => fin.readyToFinish === true,
      edited: () => edited.status === "fail" && reapprove.ok === false && js(reapprove.failing) === js(["ui-design-system"]),
      lateRegistry: () => noReg.status === "warn" && created.status === "warn" && lateFin.readyToFinish === true,
      forced: () => js(forced.approvals[1]) === js(["ui-design-system"]),
    });
    const fg = path.join(tmp, "proj-dse-forced2");
    S.initProject(fg, ["ui"], "en");
    write(fg, REG, REGISTRY);
    const ff = S.createFeature(fg, { name: "Price Tag", tracks: ["ui"], summary: "x", size: "m" });
    fs.writeFileSync(path.join(ff.dir, "requirements.md"), REQ);
    fs.writeFileSync(path.join(ff.dir, "design.md"), design(["| Reuse | Buton | x |"]));
    approveBefore(fg, ff.slug, "design");
    const forcedAp = S.approvePhase(fg, ff.slug, "design", "t", { force: true, reason: "accepted" });
    const forcedDoc = (S.specDoctor(fg, ff.slug).checks || []).find((c) => c.id === "ui-design-system");
    all("1.35 review 1: a FORCED design approval is no clean one — doctor keeps failing ui-design-system (got " + js([forcedAp.ok, forcedAp.approvals && forcedAp.approvals.design.failing, forcedDoc.status]) + ")", {
      forced: () => forcedAp.ok === true && js(forcedAp.approvals.design.failing) === js(["ui-design-system"]) && forcedDoc.status === "fail",
    });
  }

  // --- review 1: the registry append ------------------------------------------------------------------------------------------------------
  {
    // a registry past the reader's cap: the name is still known — three finishes add ONE row; a usage row naming row 510 is no "unknown"
    const big = "# DS\n\n| Component | Path | Variants | Notes |\n|---|---|---|---|\n" + Array.from({ length: 505 }, (_, i) => "| C" + i + " | `src/components/C" + i + ".tsx` |  |  |").join("\n") + "\n";
    const g = ready("big", "s", big, ["| Reuse | C504 | the last one |", "| New | PriceTag | no listed component shows a price |"]);
    const check = dsCheck(g);
    const fins = [1, 2, 3].map(() => S.finishFeature(g.p, g.slug, { write: true }).designSystem);
    const rowsAdded = rd(g.p, REG).split("\n").filter((l) => /^\| PriceTag /.test(l)).length;
    // a table whose LAST column is the path has no column for the origin: a new table takes the row, the path is never overwritten
    const odd = ready("path-last", "s", "# DS\n\n| Component | Variants | Path |\n|---|---|---|\n| Button | primary | `src/components/Button.tsx` |\n");
    const oddFin = S.finishFeature(odd.p, odd.slug, { write: true });
    const oddText = rd(odd.p, REG);
    const oddReg = E.designSystemRegistry(path.join(odd.p, ".specs"));
    all("1.35 review 1: past 500 components every name is still known — a Reuse of row 505 passes, doctor says the rest is read without details, and three written finishes add the New component ONCE; a registry whose table has no column for the origin (Component | Variants | Path) gets a new table — its path column is never overwritten (got " +
      js({ check: [check.status, check.detail], fins: fins.map((d) => d && d.registered), rowsAdded, odd: [oddFin.designSystem && oddFin.designSystem.registered, oddText.slice(-170)], oddReg: oddReg.components.map((c) => c.name + "@" + c.path + (c.from ? " from " + c.from : "")) }) + ")", {
      known: () => check.status === "pass" && /the registry holds 505 components — only the first 500 are read with their details/.test(check.detail),
      once: () => js(fins.map((d) => (d ? d.registered : null))) === js([["PriceTag"], null, null]) && rowsAdded === 1, // (nothing to say: no `designSystem`)
      pathLast: () => js(oddFin.designSystem.registered) === js(["PriceTag"]) && oddText.endsWith("| Button | primary | `src/components/Button.tsx` |\n\n| Component | Path | Variants | Notes |\n|---|---|---|---|\n| PriceTag | `src/components/PriceTag.tsx` |  | _From: price-tag_ |\n"),
      readBack: () => js(oddReg.components.map((c) => c.name + "@" + c.path + (c.from ? " from " + c.from : ""))) === js(["Button@src/components/Button.tsx", "PriceTag@src/components/PriceTag.tsx from price-tag"]),
    });
    // a components-only registry (no token, no token file named): nothing to replace a raw value with — no warning, the count stays
    const nt = ready("no-tokens", "s", "# DS\n\n| Component | Path | Variants | Notes |\n|---|---|---|---|\n| Button | `src/components/Button.tsx` |  |  |\n");
    write(nt.p, "src/components/PriceTag.tsx", "export const PriceTag = () => <b style={{ color: \"#123456\" }} />;\n");
    const ntFin = S.finishFeature(nt.p, nt.slug);
    const wt = ready("with-tokens", "s", REGISTRY);
    write(wt.p, "src/components/PriceTag.tsx", "export const PriceTag = () => <b style={{ color: \"#123456\" }} />;\n");
    const wtFin = S.finishFeature(wt.p, wt.slug);
    all("1.35 review 1: spec_finish warns about raw values only when the registry holds tokens or names token files — a components-only registry keeps the count in `designSystem.raw` without the warning (got " +
      js([ntFin.designSystem && ntFin.designSystem.raw.total, (ntFin.warnings || []).filter((w) => /raw value/.test(w)).length, (wtFin.warnings || []).filter((w) => /raw value/.test(w)).length, Object.keys(wtFin.designSystem || {})]) + ")", {
      noTokens: () => ntFin.designSystem.raw.total === 1 && !(ntFin.warnings || []).some((w) => /raw value/.test(w)),
      withTokens: () => (wtFin.warnings || []).some((w) => /^the feature's view files hold 1 raw value where the design system has tokens — src\/components\/PriceTag\.tsx:1 #123456: use the token.*\(the list: spec_scan/.test(w)),
      shape: () => js(Object.keys(wtFin.designSystem)) === js(["raw", "registered", "unregistered"]),
    });
  }

  // --- review 1: what the code scan reads -----------------------------------------------------------------------------------------------
  {
    const p = path.join(tmp, "proj-dse-scan");
    S.initProject(p, ["ui"], "en");
    write(p, "src/components/Button.tsx", "export const Button = () => null;\n");
    write(p, "src/components/ui/use-mobile.tsx", "export const useMobile = () => true;\n"); // a kebab-case hook
    write(p, "src/components/useToggle.tsx", "export const useToggle = () => 1;\n");
    write(p, "src/components/user-menu.tsx", "export const UserMenu = () => null;\n"); // "user-…" is no hook
    write(p, "src/components/pages/HomePage.tsx", "export default () => null;\n"); // a page folder below a component folder
    write(p, "src/pages/checkout/components/Summary.tsx", "export const Summary = () => null;\n"); // a component folder below a page
    write(p, "src/components/Legacy.js", "export const Legacy = () => null;\n"); // an older React component
    write(p, "src/components/format-date.js", "export const f = 1;\n"); // a helper
    write(p, "src/components/Avatar/index.js", "export const Avatar = () => null;\n");
    write(p, "src/auth/token-form.css", ".token-form { color: #123456; }\n"); // no token file
    write(p, "src/styles/tokens.dark.css", ":root { --bg: #000; --fg: #fff; }\n");
    write(p, "src/styles/long.tokens.json", js({ a: { $value: "1px" } }));
    write(p, "src/styles/has space/tokens.css", ":root { --gap: 4px; }\n");
    write(p, "docs/tokens-" + Array.from({ length: 60 }, () => "a").join("-") + ".md", "x\n"); // an exponential match before the fix
    const t0 = Date.now();
    const seeded = S.scaffoldSteeringFile(p, "design-system.md");
    const seedMs = Date.now() - t0;
    const reg = E.designSystemRegistry(path.join(p, ".specs"));
    const sync = S.designSystemReport(p);
    // tokens are compared, a path cell that is no project path is no stale row, a feature's New component still being built is pending
    write(p, REG, rd(p, REG).replace("| --bg | #000 |  |\n", "").replace("| Button | `src/components/Button.tsx` |  |  |", "| Button | `src/components/Button.tsx:12` |  |  |\n| DataGrid | @mui/x-data-grid |  |  |\n| Icon | n/a |  |  |\n| Gone | `src/components/Gone.tsx` |  |  |"));
    write(p, "src/components/PriceTag.tsx", "export const PriceTag = () => null;\n");
    write(p, "src/components/Orphan.tsx", "export const Orphan = () => null;\n");
    const f = S.createFeature(p, { name: "Price Tag", tracks: ["ui"], summary: "x" });
    fs.writeFileSync(path.join(f.dir, "design.md"), design(ROWS));
    const drift = S.designSystemReport(p);
    all("1.35 review 1: the scan — a kebab-case hook (use-mobile) and a file under a page folder below a component folder are no component, a component folder below a page folder is, an older React codebase's PascalCase .js (and a folder's index.js) is, a lower-case .js helper is not; `src/auth/token-form.css` is no token file, tokens.dark.css and *.tokens.json are; a token path with a blank is read back; a file name of 60 hyphenated parts costs nothing; the report compares tokens, never calls a package / n/a / a `:12` anchor stale, and lists a component an unfinished feature declares New as pending (got " +
      js({ seeded: seeded.seeded, seedMs, comps: reg.components.map((c) => c.name), sources: reg.sources, tokens: reg.tokens.map((t) => t.name), sync: [sync.inSync, sync.newSources],
        drift: [drift.missing, drift.pending, drift.stale, drift.newTokens, drift.newTokensTotal, drift.inSync] }) + ")", {
      components: () => js(reg.components.map((c) => c.name)) === js(["Avatar", "Button", "Legacy", "Summary", "UserMenu"]),
      sources: () => js(reg.sources) === js(["src/styles/has space/tokens.css", "src/styles/long.tokens.json", "src/styles/tokens.dark.css"]),
      tokens: () => js(reg.tokens.map((t) => t.name)) === js(["--gap", "a", "--bg", "--fg"]),
      fast: () => seedMs < 5000,
      synced: () => sync.inSync === true && !sync.newSources.length && sync.newTokensTotal === 0,
      newTokens: () => js(drift.newTokens) === js([{ name: "--bg", value: "#000" }]) && drift.newTokensTotal === 1 && drift.inSync === false,
      stale: () => js(drift.stale) === js([{ name: "Gone", path: "src/components/Gone.tsx" }]),
      pending: () => js(drift.pending) === js([{ name: "PriceTag", path: "src/components/PriceTag.tsx", feature: "price-tag" }]) && js(drift.missing) === js([{ name: "Orphan", path: "src/components/Orphan.tsx" }]),
    });
  }
  {
    // raw values: what is a colour, what is not
    const p = path.join(tmp, "proj-dse-raw");
    S.initProject(p, ["ui"], "en");
    write(p, REG, REGISTRY);
    const f = S.createFeature(p, { name: "Shop", tracks: ["ui"], summary: "x" });
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Build it\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/shop/_\n");
    write(p, "src/shop/Upload.tsx", ["export const Upload = () => (", "  <form>", "    <input accept=\"image/*\" /> <Route path=\"/app/*\" />", "    <p>Ticket #204518 — see issue #123456</p>",
      "    <b ref={() => document.querySelector(\"#add\")} className=\"text-[#00ff00] p-[13px]\" />", "    <i style={{ color: \"#abc\" }} />", "  </form>", ");", ""].join("\n"));
    write(p, "src/shop/Card.vue", ["<template><div class=\"card\">Order #445566</div></template>", "<style scoped>", ".card:hover #fab { color: #fff; }", ".card { margin: 13px; padding: 1px 16px; }", "#bad,", ".x { gap: 2rem }", "</style>", ""].join("\n"));
    write(p, "src/shop/styled.tsx", ["const Box = styled.div`", "  color: #654321;", "  margin: 9px;", "  border: 1px solid #ccc;", "`;", "const x: string = \"y\";", ""].join("\n"));
    const r = S.designSystemReport(p, { name: f.slug });
    const got = r.raw.map((x) => x.file.replace("src/shop/", "") + ":" + x.line + " " + x.value);
    all("1.35 review 1: raw values — `accept=\"image/*\"` and `path=\"/app/*\"` open no comment (the rest of the file is still read); \"Ticket #204518\" and querySelector(\"#add\") are no colour; a <style> block is read as a stylesheet (a selector with a pseudo-class and an id is none; `padding: 1px 16px` counts by its second literal); a declaration-shaped line of a CSS-in-JS template is one (got " + js(got) + ")", {
      tsx: () => js(got.filter((x) => x.startsWith("Upload"))) === js(["Upload.tsx:5 #00ff00", "Upload.tsx:5 p-[13px]", "Upload.tsx:6 #abc"]),
      vue: () => js(got.filter((x) => x.startsWith("Card"))) === js(["Card.vue:3 #fff", "Card.vue:4 margin: 13px", "Card.vue:4 padding: 1px 16px", "Card.vue:6 gap: 2rem"]),
      styled: () => js(got.filter((x) => x.startsWith("styled"))) === js(["styled.tsx:2 #654321", "styled.tsx:3 margin: 9px", "styled.tsx:4 #ccc"]),
    });
  }

  // --- review 1: bounded time on hostile input -------------------------------------------------------------------------------------------
  {
    const p = path.join(tmp, "proj-dse-hostile");
    S.initProject(p, ["ui"], "en");
    const long = (ch, n) => Array.from({ length: n + 1 }).join(ch);
    write(p, REG, "# DS\n\n| Component | Path | Variants | Notes |\n|---|---|---|---|\n| Button | `src/components/Button.tsx` | " + long(">", 80000) + "x |  |\n" + long(" ", 80000) + "\n| Card | x |  |  |\n");
    write(p, "src/styles/tokens.css", ":root { --x: a" + long(" ", 200000) + "b; }\n");
    const f = S.createFeature(p, { name: "Price Tag", tracks: ["ui"], summary: "x" });
    fs.writeFileSync(path.join(f.dir, "requirements.md"), REQ);
    fs.writeFileSync(path.join(f.dir, "design.md"), design(["| Reuse | " + long("(", 80000) + " | x |", "| Reuse | Button | y |"]));
    approveBefore(p, f.slug, "design");
    const timed = (fn) => remeasure(() => { const t = Date.now(); const v = fn(); return { ms: Date.now() - t, v }; }, (s) => s.ms < 4000);
    const doc = timed(() => (S.specDoctor(p, f.slug).checks || []).find((c) => c.id === "ui-design-system"));
    const rep = timed(() => S.designSystemReport(p));
    // 100 unknown rows against 500 forty-character names: only the first rows pay a name comparison
    const names = Array.from({ length: 500 }, (_, i) => "Component" + String(i).padStart(4, "0") + long("x", 27));
    write(p, REG, "# DS\n\n| Component | Path |\n|---|---|\n" + names.map((n) => "| " + n + " | x |").join("\n") + "\n");
    fs.writeFileSync(path.join(f.dir, "design.md"), design(Array.from({ length: 100 }, (_, i) => "| Reuse | Komponent" + String(i).padStart(4, "0") + long("x", 27) + " | y |")));
    const many = timed(() => (S.specDoctor(p, f.slug).checks || []).find((c) => c.id === "ui-design-system"));
    all("1.35 review 1: bounded time — a registry cell of 80,000 `>`, an 80,000-blank line in the registry, a usage cell of 80,000 `(`, a 200,000-blank token value and 100 unknown rows against 500 long names are each read in well under 4 s (they took 5 to 39 s) (got " +
      js({ doc: [doc.ms, doc.v && doc.v.status], rep: [rep.ms, rep.v.ok], many: [many.ms, many.v && many.v.status, many.v && (many.v.detail.match(/did you mean/g) || []).length] }) + ")", {
      doctor: () => doc.ms < 4000 && doc.v.status === "pass",
      report: () => rep.ms < 4000 && rep.v.ok === true,
      many: () => many.ms < 4000 && many.v.status === "warn" && /disagree in 100 rows/.test(many.v.detail),
    });
  }

  // --- review 1: the third mode key's argument rules, the report's caps, the brief's bound -------------------------------------------------
  {
    const p = path.join(tmp, "proj-dse-args");
    S.initProject(p, ["ui"], "en");
    for (let i = 0; i < 55; i++) write(p, "src/components/Comp" + String(i).padStart(2, "0") + ".tsx", "export default () => null;\n");
    write(p, REG, "# DS\n\n| Component | Path |\n|---|---|\n| Other | x |\n");
    const f = S.createFeature(p, { name: "Wall", tracks: ["ui"], summary: "x" });
    fs.writeFileSync(path.join(f.dir, "requirements.md"), REQ);
    fs.writeFileSync(path.join(f.dir, "design.md"), design(Array.from({ length: 15 }, (_, i) => "| New | Tile" + i + " | a tile of its own kind, number " + i + " |")));
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Build the wall\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/wall/Wall.tsx_\n");
    write(p, "src/wall/Wall.tsx", Array.from({ length: 60 }, (_, i) => "const c" + i + " = \"#" + String(100000 + i) + "\";").join("\n") + "\n");
    const rep = S.designSystemReport(p);
    const fr = S.designSystemReport(p, { name: f.slug });
    const brief = S.taskBrief(p, f.slug, 1);
    const code = async (args) => { const r = await call("spec_scan", { projectDir: p, ...args }); let b = null; try { b = payload(r); } catch { /* a plain refusal */ } return [r.result.isError === true, b && b.code, b && (b.inapplicable || (b.args && b.args.inapplicable)), b && b.ok]; };
    const bad = { minLines: await code({ designSystem: true, minLines: 5 }), cap: await code({ designSystem: true, cap: 10 }), coverage: await code({ designSystem: true, coverage: true }),
      dupes: await code({ designSystem: true, duplicates: true }), off: await code({ designSystem: false }), typed: await code({ designSystem: "true" }) };
    const OPS = require(path.join(__dirname, "lib", "operations.js"));
    // a Brazilian feature's fresh scaffold: its own table header, the section unfilled, its slot rows no usage row
    const bp = path.join(tmp, "proj-dse-ptbr");
    S.initProject(bp, ["ui"], "pt-BR");
    const bf = S.createFeature(bp, { name: "Perfil", tracks: ["ui"], summary: "x", lang: "pt-BR" });
    const bText = rd(bf.dir, "design.md");
    const ptBr = [bText.includes("| Tipo | Componente | Por quê / notas |"), E.trackSectionReport(bText, ["core", "ui"], { lang: "pt-BR" })[0][2][0].status, E.designSystemUsage(bText).rows.length,
      bText.includes("verificada contra o registro (.specs/steering/design-system.md")];
    all("1.35 review 1: spec_scan {designSystem: true} refuses another mode's argument by its code (inapplicable-arguments: minLines, cap, coverage; beside duplicates: true the first mode runs and designSystem is the inapplicable one), `designSystem: false` runs the inventory, a string is invalid; the reports list the first 50 and count them all; the brief quotes at most 12 components and says how many it left out; a pt-BR feature's fresh scaffold holds its own table, unfilled (got " +
      js({ ptBr, bad, pick: OPS.forTool("spec_scan", { designSystem: true }).id, rep: [rep.missing.length, rep.missingTotal], raw: [fr.raw.length, fr.total], brief: [brief.designSystem.components.length, /3 more component\(s\)/.test(brief.brief)] }) + ")", {
      minLines: () => bad.minLines[0] && bad.minLines[1] === "inapplicable-arguments" && js(bad.minLines[2]) === js(["minLines"]),
      cap: () => bad.cap[0] && bad.cap[1] === "inapplicable-arguments" && js(bad.cap[2]) === js(["cap"]),
      coverage: () => bad.coverage[0] && bad.coverage[1] === "inapplicable-arguments" && js(bad.coverage[2]) === js(["coverage"]),
      dupes: () => bad.dupes[0] && bad.dupes[1] === "inapplicable-arguments" && js(bad.dupes[2]) === js(["designSystem"]),
      off: () => bad.off[0] === false && bad.off[3] === true,
      typed: () => bad.typed[0] === true && bad.typed[1] === "invalid-arguments",
      pick: () => OPS.forTool("spec_scan", { designSystem: true }).id === "design-system" && OPS.forTool("spec_scan", { designSystem: false }).id === "scan",
      caps: () => rep.missing.length === 50 && rep.missingTotal === 55 && fr.raw.length === 50 && fr.total === 60,
      brief: () => brief.designSystem.components.length === 12 && brief.brief.includes("3 more component(s) — read them in design.md ([UI] Design System Usage)."),
      ptBr: () => js(ptBr) === js([true, "unfilled", 0, true]),
    });
  }
};
