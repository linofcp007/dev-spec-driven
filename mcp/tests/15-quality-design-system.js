"use strict";
// The design-system registry (1.35) — .specs/steering/design-system.md: its reader, doctor's ui-design-system (a gate at size m / l),
// the task brief's part, spec_scan {designSystem} against the code, the seeded stub, raw values, finish's warning and registration.

const fs = require("fs");
const path = require("path");

exports.run = async ({ all, rpc, payload, S, tmp, approveBefore, require, __dirname }) => {
  const js = (v) => JSON.stringify(v);
  const call = (name, args) => rpc("tools/call", { name, arguments: args });
  const E = require(path.join(__dirname, "lib", "engine", "index.js"));
  const i18n = require(path.join(__dirname, "lib", "i18n.js"));
  const write = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  const rd = (dir, rel) => fs.readFileSync(path.join(dir, rel), "utf8");
  const REG = ".specs/steering/design-system.md";
  // a registry as a team keeps it: tokens, token files, a declared library, four components
  const REGISTRY = "# Design System\n\n## Tokens\n_Token sources: src/styles/_tokens.scss, tokens.json_\n\n| Token | Value | Use |\n|---|---|---|\n" +
    "| --color-action-primary | #1d4ed8 | primary buttons |\n| --space-4 | 16px | gaps |\n\n## Components\n_Libraries: @mui/material_\n\n" +
    "| Component | Path | Variants | Notes |\n|---|---|---|---|\n| Button | `src/components/Button.tsx` | primary, ghost | every action |\n" +
    "| `<DatePicker />` | src/components/date-picker.tsx |  |  |\n| Card | `src/components/Card/index.tsx` | compact |  |\n| DataTable | `src/components/DataTable.tsx` |  |  |\n";
  const project = (tag, lang, registry) => {
    const p = path.join(tmp, "proj-ds-" + tag);
    S.initProject(p, ["ui"], lang || "en");
    if (registry != null) write(p, REG, registry);
    return p;
  };

  // --- the registry reader -----------------------------------------------------------------------------------------------------
  {
    const p = project("reader", "en", REGISTRY);
    const reg = E.designSystemRegistry(path.join(p, ".specs"));
    // the stub of every language: its slot rows are no entry, its markers name nothing
    const stubs = ["en", "pt", "es", "pt-BR"].map((l) => {
      const sp = project("stub-" + l, "en", i18n.steeringStub("design-system.md", l));
      const r = E.designSystemRegistry(path.join(sp, ".specs"));
      return [r.components.length, r.tokens.length, r.sources.length, r.libraries.length];
    });
    // localized headers, a second component table, a duplicate, a slot row, a commented-out row, a fenced one, front matter
    const odd = project("reader-odd", "en", "---\ninclusion: manual\n---\n# DS\n\n| Componente | Caminho | Variantes | Notas |\n|---|---|---|---|\n| Botão | `src/ui/Botao.vue` | primário | ações |\n" +
      "| [Button] | [src/ui/Button.tsx] | [primary] | [when] |\n| botao | elsewhere |  |  |\n<!-- | Hidden | x | | | -->\n\n```\n| Componente | Caminho |\n|---|---|\n| Fenced | x |\n```\n\n" +
      "Some prose.\n\n| Componente | Ruta |\n|---|---|\n| Tarjeta | src/ui/Tarjeta.tsx |\n\n| Other | Thing |\n|---|---|\n| NotAComponent | x |\n\n_Libraries: none_\n_Token sources: [tokens.json]_\n");
    const oddReg = E.designSystemRegistry(path.join(odd, ".specs"));
    const big = project("reader-big", "en", "| Component | Path |\n|---|---|\n" + Array.from({ length: 520 }, (_, i) => "| C" + i + " | src/c" + i + ".tsx |").join("\n") + "\n");
    const bigReg = E.designSystemRegistry(path.join(big, ".specs"));
    all("1.35 registry: design-system.md's component and token tables are read by their first header cell (EN / PT / ES), every table of the file, a name once; a slot row, a commented or fenced row and another table are no entry; `_Token sources:_` (a path with an underscore) and `_Libraries:_` are read, `none` and the stub's slot name nothing; past 500 components the rest is `truncated`; no file → null (got " +
      js({ reg: reg && [reg.components.map((c) => c.name + "@" + c.path + "#" + c.variants + "!" + c.notes), reg.tokens, reg.sources, reg.libraries], stubs, odd: oddReg && [oddReg.components.map((c) => c.name + "@" + c.path), oddReg.sources, oddReg.libraries], big: [bigReg.components.length, bigReg.total.components, bigReg.truncated] }) + ")", {
      components: () => js(reg.components.map((c) => c.name + "@" + c.path + "#" + c.variants + "!" + c.notes)) === js(["Button@src/components/Button.tsx#primary, ghost!every action",
        "DatePicker@src/components/date-picker.tsx#!", "Card@src/components/Card/index.tsx#compact!", "DataTable@src/components/DataTable.tsx#!"]),
      tokens: () => js(reg.tokens) === js([{ name: "--color-action-primary", value: "#1d4ed8", use: "primary buttons" }, { name: "--space-4", value: "16px", use: "gaps" }]),
      markers: () => js(reg.sources) === js(["src/styles/_tokens.scss", "tokens.json"]) && js(reg.libraries) === js(["@mui/material"]),
      totals: () => reg.total.components === 4 && reg.total.tokens === 2 && reg.truncated === false && reg.file === path.join(p, ".specs", "steering", "design-system.md"),
      stubs: () => stubs.every((s) => js(s) === js([0, 0, 0, 0])),
      odd: () => js(oddReg.components.map((c) => c.name + "@" + c.path)) === js(["Botão@src/ui/Botao.vue", "Tarjeta@src/ui/Tarjeta.tsx"]) && !oddReg.sources.length && !oddReg.libraries.length,
      truncated: () => bigReg.components.length === 500 && bigReg.total.components === 520 && bigReg.truncated === true,
      none: () => E.designSystemRegistry(path.join(project("reader-none", "en"), ".specs")) === null,
    });
  }

  // --- a feature's usage rows, and what they say against the registry --------------------------------------------------------------
  {
    const p = project("usage", "en", REGISTRY);
    const reg = E.designSystemRegistry(path.join(p, ".specs"));
    const sec = (rows, head) => "# Design: X\n\n## [UI] Design System Usage\nBuilt from the system.\n\n" + (head || "| Kind | Component | Why / notes |\n|---|---|---|\n") + rows.join("\n") + "\n\n## [UI] UI States\nx\n";
    const usage = (rows, head) => E.designSystemUsage(sec(rows, head));
    const u = usage(["| Reuse | Button, `<DatePicker />` | the pay action |", "| Extend | Card | a `compact` variant |", "| New | PriceTag | no listed one shows a currency |",
      "| Reuse | TextField (@mui/material) | the address form |", "| Reuse | [component the registry lists] | [what it does in this view] |", "| Someday | Chart | later |", "| Reuse |  | nothing |"]);
    const langs = [usage(["| Reutilizar | Button | x |", "| Estender | Card | y |", "| Novo | PriceTag | z |"], "| Tipo | Componente | Porquê / notas |\n|---|---|---|\n"),
      usage(["| Reutilizar | Button | x |", "| Extender | Card | y |", "| Nuevo | PriceTag | z |"], "| Tipo | Componente | Por qué / notas |\n|---|---|---|\n"),
      usage(["| Existing | Button | x |", "| Variant | Card | y |", "| Created | PriceTag | z |"]),
      usage(["| Reuse | Button | src/components/Button.tsx | x |"], "| Kind | Component | Where | Why |\n|---|---|---|---|\n")];
    const find = (rows) => E.designSystemFindings(usage(rows), reg).problems.map((x) => x.code + ":" + x.name + (x.near ? ">" + x.near : ""));
    const problems = find(["| Reuse | Btn | x |", "| Extend | Modal | y |", "| New | Card | a card |", "| New | ButtonV2 | bigger |", "| New | NewButton | a new look |", "| New | DataTables | many |",
      "| New | PriceTag |  |", "| New | CustomCard | Card has no price slot |", "| Reuse | TextField (@mui/material) | form |", "| Reuse | data-table | rows |"]);
    all("1.35 usage rows: [UI] Design System Usage's table rows are read by their kind word (Reuse / Extend / New — EN / PT / ES, a few synonyms), several components in one cell are a row each, a slot row, an unknown kind and an empty cell are none, the cells after the component are the reason; against the registry — unknown (with a did-you-mean), listed, near (a fork's affix, an edit away; never when the notes name the listed one), no-why; a declared library's component and another spelling of a listed name pass (got " +
      js({ rows: u.rows.map((r) => r.kind + ":" + r.name + "|" + r.why), langs: langs.map((x) => x.rows.map((r) => r.kind + ":" + r.name).join()), problems }) + ")", {
      rows: () => js(u.rows.map((r) => r.kind + ":" + r.name + "|" + r.why)) === js(["reuse:Button|the pay action", "reuse:DatePicker|the pay action", "extend:Card|a `compact` variant",
        "new:PriceTag|no listed one shows a currency", "reuse:TextField|the address form"]),
      library: () => u.rows[4].cell === "TextField (@mui/material)",
      langs: () => langs.slice(0, 3).every((x) => x.rows.map((r) => r.kind + ":" + r.name).join() === "reuse:Button,extend:Card,new:PriceTag") && langs[3].rows[0].why === "src/components/Button.tsx · x",
      problems: () => js(problems) === js(["unknown:Btn", "unknown:Modal", "listed:Card>Card", "near:ButtonV2>Button", "near:NewButton>Button", "near:DataTables>DataTable", "no-why:PriceTag"]),
      noSection: () => E.designSystemUsage("# Design: X\n\n## Overview\nx\n") === null,
    });
  }

  // --- doctor's ui-design-system and the design gate ----------------------------------------------------------------------------------
  const REQ = "# Feature: Checkout\n\n## Summary\nPay for a cart.\n\n## User Stories\n### US-1 (P1): Pay\nAs a buyer I want to pay.\n**Independent Test:** pay one cart.\n\n" +
    "#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN the buyer opens the checkout page THE SYSTEM SHALL show the cart total.\n" +
    "2. **US-1.AC-2** — IF the payment fails THEN THE SYSTEM SHALL show an error message with a Retry action.\n\n## Success Criteria\n- **SC-001** — 95% of payments complete in under 2 s.\n\n" +
    "## Edge Cases & Error Handling\n- **EC-1** — WHEN the cart is empty THE SYSTEM SHALL show the empty state.\n\n## Non-Functional Requirements\n- **NFR-1** — p95 < 2 s.\n\n## Out of Scope\n- Refunds.\n";
  const TABLE = { en: "| Kind | Component | Why / notes |\n|---|---|---|\n", pt: "| Tipo | Componente | Porquê / notas |\n|---|---|---|\n", es: "| Tipo | Componente | Por qué / notas |\n|---|---|---|\n" };
  const UI_NAMES = { en: ["Design System Usage", "UI States", "Accessibility", "Responsiveness & i18n", "UI Performance Budget"],
    pt: ["Uso do Design System", "Estados da Interface", "Acessibilidade", "Design Responsivo e i18n", "Orçamento de Desempenho da Interface"],
    es: ["Uso del Design System", "Estados de la Interfaz", "Accesibilidad", "Diseño Adaptable e i18n", "Presupuesto de Rendimiento de la Interfaz"] };
  // a complete design: the core sections and the five [UI] ones; `usage` is the body of Design System Usage (null: no such section)
  const design = (usage, lang) => {
    const n = UI_NAMES[lang || "en"];
    return "# Design: Checkout\n\n## Overview\nOne page.\n\n## Architecture\n```mermaid\ngraph TD\n  P[Page] --> A[API]\n```\n\n" +
      "## Reuse & Integration\n| Kind | What | Where (path) | Why / notes |\n|---|---|---|---|\n| Reuse | the cart store | `src/cart/store.ts` | it holds the cart |\n\n" +
      "## Alternatives & Trade-offs\n| Decision | Option | Pros | Cons | Cost if wrong | Chosen |\n|---|---|---|---|---|---|\n| Layout | One page | Simple | Long | A redesign | ✓ |\n| Layout | Steps | Short | More clicks | Drop-off | ✗ |\n\n" +
      "## Data Models\nCart {id, total}.\n\n## Error Handling\nSee the IF…THEN criteria.\n\n## Testing Strategy\nComponent tests.\n\n## Risks\n- A slow gateway — medium — a timeout and a Retry.\n\n" +
      "## Constitution Check\n- [x] Small components — complies.\n\n## Complexity Tracking\nNone.\n\n" +
      (usage == null ? "" : "## [UI] " + n[0] + "\n" + usage + "\n\n") +
      "## [UI] " + n[1] + "\nLoading: a skeleton. Error: a message with Retry. Reference: design/checkout.png.\n\n## [UI] " + n[2] + "\nWCAG 2.2 AA; axe in the component tests.\n\n" +
      "## [UI] " + n[3] + "\nBreakpoints 360 / 768 / 1280.\n\n## [UI] " + n[4] + "\nLCP under 2.5 s.\n";
  };
  const rows = (list, lang) => "The page is built from the system.\n\n" + TABLE[lang || "en"] + list.join("\n");
  const mk = (tag, size, registry, lang) => {
    const p = project("gate-" + tag, lang || "en", registry);
    const f = S.createFeature(p, { name: "Checkout", tracks: ["ui"], summary: "x", ...(size ? { size } : {}) });
    fs.writeFileSync(path.join(f.dir, "requirements.md"), REQ);
    approveBefore(p, f.slug, "design");
    return { p, slug: f.slug, dir: f.dir };
  };
  const dsCheck = (g) => (S.specDoctor(g.p, g.slug).checks || []).find((c) => c.id === "ui-design-system") || null;
  const setDesign = (g, usage, lang) => fs.writeFileSync(path.join(g.dir, "design.md"), design(usage, lang));
  const OK_ROWS = ["| Reuse | Button | the pay action |", "| Extend | Card | a `summary` variant |", "| Reuse | TextField (@mui/material) | the address form |",
    "| New | PriceTag | no listed component shows a price with its currency |"];
  const BAD_ROWS = ["| Reuse | Buton | the pay action |", "| New | ButtonV2 | bigger |", "| New | PriceTag |  |", "| New | Card | a card |"];
  {
    // the states, on an unsized feature (a warn) — and what a size m design is refused on
    const u = mk("states", null, REGISTRY);
    const state = (usage) => { setDesign(u, usage); const c = dsCheck(u); return c && [c.status, c.detail]; };
    const st = {
      ok: state(rows(OK_ROWS)), mismatch: state(rows(BAD_ROWS)), noRows: state("The page uses Button and a new PriceTag."), na: state("n/a — this feature renders only a plain text email"),
      naShort: state("n/a — none"), scaffold: state("> **TODO** — replace with real values (remove this line when done).\n- " + i18n.msg("en").quality.dsNoRows), noSection: state(null),
      nearExplained: state(rows(["| New | CustomCard | Card has no slot for a price |"])),
    };
    const noReg = mk("noreg", null);
    setDesign(noReg, rows(OK_ROWS));
    const noRegCheck = dsCheck(noReg);
    const stub = mk("stubreg", null, i18n.steeringStub("design-system.md", "en"));
    setDesign(stub, rows(OK_ROWS));
    const stubCheck = dsCheck(stub);
    all("1.35 doctor ui-design-system: a +ui feature's usage rows against the registry — pass when they agree, a WARN (unsized) naming each disagreeing row, a section with no row, a missing registry (how to create it) or one that lists nothing; n/a — <reason> and a New whose notes name the listed component it is close to pass; a section still the scaffold or absent is another check's (got " +
      js({ st, noReg: noRegCheck, stub: stubCheck }) + ")", {
      ok: () => st.ok[0] === "pass" && /agrees with the registry \(Reuse: 2 · Extend: 1 · New: 1\)/.test(st.ok[1]),
      mismatch: () => st.mismatch[0] === "warn" && /disagree in 4 rows — 'Buton' is not in the registry \(did you mean Button\?\).*New 'ButtonV2' is close to Button.*New 'PriceTag' doesn't say why.*'Card' is marked New but the registry already lists Card/.test(st.mismatch[1]) && !/size/.test(st.mismatch[1]),
      noRows: () => st.noRows[0] === "warn" && /names no component row/.test(st.noRows[1]),
      na: () => st.na[0] === "pass" && /n\/a/.test(st.na[1]) && st.naShort[0] === "warn",
      scaffold: () => st.scaffold[0] === "pass" && /not written yet/.test(st.scaffold[1]),
      noSection: () => st.noSection[0] === "pass" && /no Design System Usage section/.test(st.noSection[1]),
      nearExplained: () => st.nearExplained[0] === "pass",
      noRegistry: () => noRegCheck.status === "warn" && /no design-system registry yet.*steering_scaffold \{file: "design-system\.md"\}.* steering design-system\.md$/.test(noRegCheck.detail),
      emptyRegistry: () => stubCheck.status === "warn" && /lists no component yet/.test(stubCheck.detail),
    });
  }
  {
    const res = {};
    for (const size of ["m", "l"]) {
      const g = mk(size, size, REGISTRY);
      setDesign(g, rows(BAD_ROWS));
      const doc = dsCheck(g);
      const refused = S.approvePhase(g.p, g.slug, "design", "t");
      setDesign(g, "The page uses Button.");
      const prose = S.approvePhase(g.p, g.slug, "design", "t");
      setDesign(g, rows(OK_ROWS));
      const passed = S.approvePhase(g.p, g.slug, "design", "t");
      const st = JSON.parse(rd(g.dir, ".state.json"));
      res[size] = { doc: [doc.status, doc.detail.slice(-60)], refused: [refused.ok, refused.failing, ((refused.checks || []).find((c) => c.id === "ui-design-system") || {}).detail],
        prose: [prose.ok, prose.failing], passed: passed.ok, stamp: st.approvals.design.designSystem, record: st.approvalHistory.filter((h) => h.phase === "design").pop().designSystem, after: dsCheck(g).status };
    }
    // forced: recorded among the failing checks, and doctor keeps failing it
    const fg = mk("forced", "m", REGISTRY);
    setDesign(fg, rows(BAD_ROWS));
    const forced = S.approvePhase(fg.p, fg.slug, "design", "t", { force: true, reason: "the user accepted it" });
    const forcedDoc = dsCheck(fg);
    // size s and unsized: never a refusal on it; no registry at size m: a warn, the approval goes through
    const sg = mk("s", "s", REGISTRY), ug = mk("unsized", null, REGISTRY), ng = mk("m-noreg", "m");
    for (const g of [sg, ug, ng]) setDesign(g, rows(BAD_ROWS));
    const sAp = S.approvePhase(sg.p, sg.slug, "design", "t"), uAp = S.approvePhase(ug.p, ug.slug, "design", "t"), nAp = S.approvePhase(ng.p, ng.slug, "design", "t");
    // over MCP the refusal names the check too
    const mg = mk("mcp", "m", REGISTRY);
    setDesign(mg, rows(BAD_ROWS));
    const mcpRef = payload(await call("spec_approve", { projectDir: mg.p, name: mg.slug, phase: "design" }));
    // a design approved before 1.35 (no `designSystem` stamp): never flagged — a pass with a note, at any size
    const lg = mk("legacy", "m", REGISTRY);
    setDesign(lg, rows(OK_ROWS));
    S.approvePhase(lg.p, lg.slug, "design", "t");
    const lsp = path.join(lg.dir, ".state.json"), lst = JSON.parse(fs.readFileSync(lsp, "utf8"));
    delete lst.approvals.design.designSystem;
    fs.writeFileSync(lsp, JSON.stringify(lst, null, 2));
    write(lg.p, REG, "# Design System\n\n| Component | Path |\n|---|---|\n| Other | src/Other.tsx |\n"); // the registry changed under it
    const legacy = dsCheck(lg);
    all("1.35 gate: at size m / l the design-system check is an approval check — doctor FAILS ui-design-system on rows that disagree with the registry or a section with no row, the design approval refuses it (MCP too), passes once the rows agree and stamps `designSystem` (approval + history); forced, it is recorded among the failing checks and doctor still fails it; size s, an unsized feature and a project without a registry only warn; a design approved before 1.35 passes with a note (got " +
      js({ res, forced: [forced.ok, forced.approvals && forced.approvals.design.failing, forcedDoc.status], s: [sAp.ok, sAp.failing], unsized: [uAp.ok, uAp.failing], noreg: [nAp.ok, nAp.failing, dsCheck(ng).status], mcp: mcpRef.failing, legacy }) + ")", {
      ...Object.fromEntries(["m", "l"].map((size) => [size, () => res[size].doc[0] === "fail" && new RegExp("— a size " + size + " design needs it before its approval$").test(res[size].doc[1]) &&
        res[size].refused[0] === false && js(res[size].refused[1]) === js(["ui-design-system"]) && /disagree in 4 rows/.test(res[size].refused[2]) &&
        res[size].prose[0] === false && js(res[size].prose[1]) === js(["ui-design-system"]) && res[size].passed === true && res[size].stamp === true && res[size].record === true && res[size].after === "pass"])),
      forced: () => forced.ok === true && js(forced.approvals.design.failing) === js(["ui-design-system"]) && forcedDoc.status === "fail",
      small: () => sAp.ok === true && !(sAp.failing || []).length && dsCheck(sg).status === "warn",
      unsized: () => uAp.ok === true && !(uAp.failing || []).length && dsCheck(ug).status === "warn",
      noRegistry: () => nAp.ok === true && !(nAp.failing || []).length && dsCheck(ng).status === "warn",
      mcp: () => mcpRef.ok === false && js(mcpRef.failing) === js(["ui-design-system"]),
      legacy: () => legacy.status === "pass" && /^design approved before 1\.35 — asked only from its next approval \(/.test(legacy.detail),
    });
  }
  {
    // who is never asked: a feature without +ui, a bugfix, a design that is still a later phase's template; the scaffold holds the table
    const core = path.join(tmp, "proj-ds-core");
    S.initProject(core, ["core"], "en");
    write(core, REG, REGISTRY);
    const cf = S.createFeature(core, { name: "Report", tracks: ["core"], summary: "x" });
    fs.writeFileSync(path.join(cf.dir, "requirements.md"), REQ);
    fs.writeFileSync(path.join(cf.dir, "design.md"), design(rows(BAD_ROWS)));
    const coreIds = S.specDoctor(core, cf.slug).checks.map((c) => c.id);
    const fresh = project("fresh", "en", REGISTRY);
    const ff = S.createFeature(fresh, { name: "Settings", tracks: ["ui"], summary: "x" });
    const freshIds = S.specDoctor(fresh, ff.slug).checks.map((c) => c.id);
    const bug = S.createFeature(fresh, { name: "Broken Button", kind: "bugfix", tracks: ["ui"], summary: "x" });
    const bugIds = S.specDoctor(fresh, bug.slug).checks.map((c) => c.id);
    const blocks = Object.fromEntries(["en", "pt", "es"].map((l) => {
      const lp = project("scaffold-" + l, l, REGISTRY);
      const lf = S.createFeature(lp, { name: "Perfil", tracks: ["ui"], summary: "x", lang: l });
      const text = rd(lf.dir, "design.md");
      const st = E.trackSectionReport(text, ["core", "ui"], { lang: l })[0][2][0].status;
      return [l, [text.includes("## [UI] " + UI_NAMES[l][0]), text.includes(TABLE[l].split("\n")[0]), st, (E.designSystemUsage(text) || { rows: [0] }).rows.length]];
    }));
    const sized = project("scaffold-s", "en", REGISTRY);
    const sf = S.createFeature(sized, { name: "Small", tracks: ["ui"], summary: "x", size: "s" });
    // an untouched 1.34 block (one guidance line) still reads as the template's text
    const old = "## [UI] Design System Usage\n- The design-system components used and the tokens (colour, spacing, type) · each new component: why the existing ones don't fit and how it enters the system (documented, reviewed, in the component library) · no one-off styles or hard-coded colours.\n";
    const oldState = E.sectionState("# Design: X\n\n" + old, E.trackSectionTable("ui").slice(0, 1), "[UI]", { lang: "en" })[0].status;
    all("1.35 doctor: ui-design-system is never run for a feature without +ui, a bugfix, or a design still a later phase's template; a fresh +ui design holds the Kind | Component | Why table in its language (its slot rows no usage row, the section `unfilled`), a size s one leaves the section out, and a 1.34 one-line block still reads as the template (got " +
      js({ core: coreIds.includes("ui-design-system"), fresh: freshIds.includes("ui-design-system"), bug: bugIds.includes("ui-design-system"), blocks, small: rd(sf.dir, "design.md").includes("## [UI] Design System Usage"), oldState }) + ")", {
      core: () => !coreIds.includes("ui-design-system"), fresh: () => !freshIds.includes("ui-design-system"), bugfix: () => !bugIds.includes("ui-design-system"),
      blocks: () => ["en", "pt", "es"].every((l) => js(blocks[l]) === js([true, true, "unfilled", 0])),
      small: () => !rd(sf.dir, "design.md").includes("## [UI] Design System Usage") && rd(sf.dir, "design.md").includes("## [UI] UI States"),
      old: () => oldState === "template",
    });
    // the design.md save check (the PostToolUse hook's): the disagreeing rows as a ▲ note — never "no registry", never for another track
    const sv = mk("save", null, REGISTRY);
    setDesign(sv, rows(BAD_ROWS));
    const saveBad = S.designSaveCheck(sv.p, sv.slug);
    setDesign(sv, rows(OK_ROWS));
    const saveOk = S.designSaveCheck(sv.p, sv.slug);
    const svNone = mk("save-noreg", null);
    setDesign(svNone, rows(BAD_ROWS));
    const saveNoReg = S.designSaveCheck(svNone.p, svNone.slug);
    const saveCore = S.designSaveCheck(core, cf.slug);
    all("1.35 design.md save check: a +ui design whose rows disagree with the registry gets a ▲ note naming them (`designSystem: mismatch`, still `clean` — a note); agreeing rows and a project without a registry add none; a feature without +ui carries no `designSystem` (got " +
      js({ bad: [saveBad.designSystem, saveBad.clean, saveBad.text.split("\n").filter((l) => /registry/.test(l))], ok: [saveOk.designSystem, /registry/.test(saveOk.text)], noReg: [saveNoReg.designSystem, /registry/.test(saveNoReg.text)], core: "designSystem" in saveCore }) + ")", {
      bad: () => saveBad.designSystem === "mismatch" && saveBad.clean === true && saveBad.text.split("\n").some((l) => /^ {2}▲ Design System Usage and the registry .* disagree in 4 rows/.test(l)),
      ok: () => saveOk.designSystem === "ok" && !/registry/.test(saveOk.text),
      noRegistry: () => saveNoReg.designSystem === "no-registry" && !/registry/.test(saveNoReg.text),
      core: () => !("designSystem" in saveCore),
    });
    // PT / ES: the rows in their language pass, the detail is localized
    const loc = {};
    for (const [l, kinds] of [["pt", ["Reutilizar", "Estender", "Novo"]], ["es", ["Reutilizar", "Extender", "Nuevo"]], ["pt-BR", ["Reutilizar", "Estender", "Novo"]]]) {
      const g = mk("lang-" + l, "m", REGISTRY, l);
      const base = l === "pt-BR" ? "pt" : l;
      setDesign(g, rows(["| " + kinds[0] + " | Button | x |", "| " + kinds[1] + " | Card | y |", "| " + kinds[2] + " | PriceTag | porque sim |"], base), base);
      const good = dsCheck(g);
      setDesign(g, rows(["| " + kinds[0] + " | Buton | x |"], base), base);
      loc[l] = [good.status, good.detail, dsCheck(g).detail];
    }
    all("1.35 doctor: PT / ES / pt-BR usage rows (Tipo | Componente — Reutilizar · Estender / Extender · Novo / Nuevo) are read, and the details are in the feature's language (got " + js(loc) + ")", {
      pt: () => loc.pt[0] === "pass" && /coincide com o registo \(Reutilizar: 1 · Estender: 1 · Novo: 1\)/.test(loc.pt[1]) && /'Buton' não está no registo \(seria Button\?\).*um design de tamanho m precisa disto antes da aprovação$/.test(loc.pt[2]),
      es: () => loc.es[0] === "pass" && /coincide con el registro \(Reutilizar: 1 · Extender: 1 · Nuevo: 1\)/.test(loc.es[1]) && /'Buton' no está en el registro \(¿será Button\?\)/.test(loc.es[2]),
      ptBR: () => loc["pt-BR"][0] === "pass" && /coincide com o registro/.test(loc["pt-BR"][1]) && /não está no registro/.test(loc["pt-BR"][2]),
    });
  }

  // --- the task brief's Design system part ------------------------------------------------------------------------------------------
  {
    const g = mk("brief", null, REGISTRY);
    setDesign(g, rows(OK_ROWS.concat("| Reuse | Tooltip | hints |")));
    fs.writeFileSync(path.join(g.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Build the checkout page\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/checkout/Checkout.tsx_\n  - _Verify: npm test_\n" +
      "- [ ] 2. [US1] Store the order\n  - _Requirements: US-1.AC-2_\n  - _Implements: src/orders/store.ts_\n  - _Verify: npm test_\n");
    const b1 = S.taskBrief(g.p, g.slug, 1), b2 = S.taskBrief(g.p, g.slug, 2), bw = S.taskBrief(g.p, g.slug, 1, { write: true });
    const part = b1.brief.slice(b1.brief.indexOf("## Design system"), b1.brief.indexOf("## Verification"));
    const mcpBrief = payload(await call("spec_task_brief", { projectDir: g.p, name: g.slug, number: 1 }));
    const none = mk("brief-none", null);
    setDesign(none, rows(OK_ROWS));
    fs.writeFileSync(path.join(none.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Build the page\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/checkout/Checkout.tsx_\n");
    const bn = S.taskBrief(none.p, none.slug, 1);
    const pt = mk("brief-pt", null, REGISTRY, "pt");
    setDesign(pt, "A página usa o sistema.", "pt");
    fs.writeFileSync(path.join(pt.dir, "tasks.md"), "# Tarefas\n\n- [ ] 1. [US1] Construir a página\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/checkout/Checkout.vue_\n");
    const bp = S.taskBrief(pt.p, pt.slug, 1);
    all("1.35 brief: a task that builds a view (a view file in _Implements:_) reads the registry's entry of each component the design names — its kind, path, variants, notes and the row's reason —, the names the registry doesn't list, where the tokens live and the libraries; the result carries `designSystem` (identifiers; write: true keeps the names in refs); a task with no view file, and a project without a registry, get no such part; PT (got " +
      js({ part, ds: b1.designSystem, other: [b2.designSystem, b2.brief.includes("## Design system")], write: [bw.designSystem, bw.refs && bw.refs.designSystem], mcp: mcpBrief.designSystem && mcpBrief.designSystem.components.length,
        none: [bn.designSystem, bn.brief.includes("## Design system")], pt: bp.brief.slice(bp.brief.indexOf("## Design system"), bp.brief.indexOf("## Design system") + 700) }) + ")", {
      heading: () => part.startsWith("## Design system — build from these\nEvery view is built from the design system's components and tokens (`.specs/steering/design-system.md`)."),
      reuse: () => part.includes("- **Button** (reuse) — `src/components/Button.tsx` · variants: primary, ghost · every action · the pay action"),
      extend: () => part.includes("- **Card** (extend — a new variant) — `src/components/Card/index.tsx` · variants: compact · a `summary` variant"),
      library: () => part.includes("- **TextField (@mui/material)** (reuse) · the address form"),
      fresh: () => part.includes("- **PriceTag** (NEW — build it through the system: tokens only, every state, keyboard and screen-reader support) · no listed component shows a price with its currency"),
      unknown: () => part.includes("Not in the registry — ask before building them (NEEDS_CONTEXT): Tooltip"),
      tokens: () => part.includes("Tokens: 2 in the registry — defined in `src/styles/_tokens.scss`, `tokens.json`.") && part.includes("Component libraries the project builds on: @mui/material."),
      result: () => b1.designSystem.file === REG && js(b1.designSystem.components[0]) === js({ kind: "reuse", name: "Button", path: "src/components/Button.tsx" }) && js(b1.designSystem.unknown) === js(["Tooltip"]) && b1.designSystem.tokens === 2,
      otherTask: () => b2.designSystem === undefined && !b2.brief.includes("## Design system"),
      written: () => bw.designSystem === undefined && js(bw.refs.designSystem) === js(["Button", "Card", "TextField (@mui/material)", "PriceTag", "Tooltip"]),
      mcp: () => mcpBrief.designSystem.components.length === 5,
      noRegistry: () => bn.designSystem === undefined && !bn.brief.includes("## Design system"),
      pt: () => /## Design system — construir a partir disto\nTodas as vistas são construídas/.test(bp.brief) && bp.brief.includes("O design não tem nenhuma linha de componente — o que `.specs/steering/design-system.md` lista é para reutilizar antes de criar algo novo."),
    });
  }

  // --- the code: spec_scan {designSystem: true}, the seeded stub -----------------------------------------------------------------------
  const codebase = (p) => {
    write(p, "package.json", js({ name: "shop", dependencies: { "@mui/material": "^5", react: "^18", "@radix-ui/react-dialog": "^1" }, devDependencies: { tailwindcss: "^3" } }));
    write(p, "src/components/Button.tsx", "export const Button = () => null;\n");
    write(p, "src/components/Button.test.tsx", "test('x', () => {});\n");
    write(p, "src/components/Button.stories.tsx", "export default {};\n");
    write(p, "src/components/date-picker.tsx", "export const DatePicker = () => null;\n");
    write(p, "src/components/Card/index.tsx", "export const Card = () => null;\n");
    write(p, "src/components/Card/Card.tsx", "export const Card = () => null;\n");
    write(p, "src/components/useToggle.tsx", "export const useToggle = () => 1;\n");
    write(p, "src/components/utils.tsx", "export const cx = () => '';\n");
    write(p, "src/ui/dialog.vue", "<template><div/></template>\n");
    write(p, "src/app/widgets/user-menu.component.ts", "export class UserMenuComponent {}\n");
    write(p, "src/pages/Home.tsx", "export default () => null;\n");
    write(p, "src/lib/format.ts", "export const f = 1;\n");
    write(p, "node_modules/lib/components/Hidden.tsx", "export const Hidden = 1;\n");
    write(p, "generated/components/Gen.tsx", "export const Gen = 1;\n");
    write(p, ".gitignore", "generated/\n");
    write(p, "src/styles/tokens.css", ":root {\n  --color-action-primary: #1d4ed8; /* the brand */\n  --space-4: 16px;\n}\n");
    write(p, "src/styles/_variables.scss", "// spacing\n$radius-md: 8px;\n$font-size-sm: 0.875rem !default;\n");
    write(p, "design/colors.tokens.json", js({ color: { text: { $value: "#111827", $type: "color" }, surface: { value: "#ffffff" } }, size: { gap: 8 } }));
    write(p, "src/app/globals.css", ":root{--bg:#fff;--fg:#000;--muted:#666;--ring:#00f;--card:#fafafa}\n");
    write(p, "src/app/index.css", "body { margin: 0; }\n");
    write(p, "tailwind.config.ts", "export default {};\n");
    write(p, "src/theme/tokens.ts", "export const tokens = {};\n"); // a plain tokens.ts under a theme folder: a token file
    write(p, "src/auth/tokens.ts", "export const refresh = () => 1;\n"); // …and one that holds access tokens: none
    write(p, "src/auth/tokens.json", "{\"issuer\":\"x\"}\n");
  };
  {
    const p = project("scan", "en");
    codebase(p);
    const before = S.designSystemReport(p);
    const seeded = payload(await call("steering_scaffold", { projectDir: p, file: "design-system.md" }));
    const text = rd(p, REG);
    const reg = E.designSystemRegistry(path.join(p, ".specs"));
    const again = S.scaffoldSteeringFile(p, "design-system.md");
    const synced = S.designSystemReport(p);
    // the code moves on: a new component, a removed one, a new token file, a library the registry doesn't name
    write(p, "src/components/Badge.tsx", "export const Badge = () => null;\n");
    fs.rmSync(path.join(p, "src", "ui", "dialog.vue"));
    write(p, "src/styles/theme.css", ":root { --shadow-1: 0 1px 2px #0003; }\n");
    write(p, "package.json", js({ name: "shop", dependencies: { "@mui/material": "^5", antd: "^5" } }));
    const drift = S.designSystemReport(p);
    const viaMcp = payload(await call("spec_scan", { projectDir: p, designSystem: true }));
    const bad = [await call("spec_scan", { projectDir: p, designSystem: true, minLines: 5 }), await call("spec_scan", { projectDir: p, designSystem: true, duplicates: true }),
      await call("spec_scan", { projectDir: p, designSystem: true, name: "nope" })];
    all("1.35 spec_scan {designSystem: true}: ONE walk finds the components (a view file under a component folder — its file's name, a kebab-case one, a folder's index, a Vue file, an Angular *.component.ts; never a test, a story, a hook, a helper, a page, node_modules or a git-ignored folder), the tokens (custom properties, Sass variables, a JSON token file's leaves, a global stylesheet's — a plain tokens.ts / tokens.json only under a styles / theme folder, never src/auth's) and the UI libraries of package.json; steering_scaffold design-system.md writes the registry SEEDED from them (`seeded`), never over an existing one; then the report says what the registry lacks (missing, newSources, newLibraries) and which rows' path is gone (stale) (got " +
      js({ before: [before.registry, before.found, before.inSync], seeded: [seeded.created, seeded.seeded], comps: reg.components.map((c) => c.name + "@" + c.path), tokens: reg.tokens.map((t) => t.name + "=" + t.value), sources: reg.sources,
        libraries: reg.libraries, again: [again.created, again.seeded], synced: [synced.inSync, synced.missingTotal, synced.staleTotal], drift: [drift.missing, drift.stale, drift.newSources, drift.newLibraries, drift.inSync],
        bad: bad.map((b) => { try { return payload(b).code || payload(b).error; } catch { return b.result.content[0].text.slice(0, 80); } }) }) + ")", {
      before: () => before.ok && before.registry.exists === false && before.registry.file === REG && before.found.components === 5 && before.inSync === false && before.missingTotal === 5,
      seeded: () => seeded.ok && seeded.created === true && js(seeded.seeded) === js({ components: 5, tokens: 12 }),
      components: () => js(reg.components.map((c) => c.name + "@" + c.path)) === js(["Button@src/components/Button.tsx", "Card@src/components/Card/Card.tsx", "DatePicker@src/components/date-picker.tsx",
        "Dialog@src/ui/dialog.vue", "UserMenu@src/app/widgets/user-menu.component.ts"]),
      tokens: () => js(reg.tokens.map((t) => t.name + "=" + t.value)) === js(["color.text=#111827", "color.surface=#ffffff", "size.gap=8", "$radius-md=8px", "$font-size-sm=0.875rem", "--color-action-primary=#1d4ed8",
        "--space-4=16px", "--bg=#fff", "--fg=#000", "--muted=#666", "--ring=#00f", "--card=#fafafa"]),
      sources: () => js(reg.sources) === js(["design/colors.tokens.json", "src/styles/_variables.scss", "src/styles/tokens.css", "src/theme/tokens.ts", "tailwind.config.ts", "src/app/globals.css"]),
      libraries: () => js(reg.libraries) === js(["@mui/material", "@radix-ui"]),
      text: () => text.startsWith("# Design System\n\n<!-- The ONE inventory") && text.includes("| Button | `src/components/Button.tsx` |  |  |") && !text.includes("[Button]") && !text.includes("[--color-action-primary]"),
      notAStub: () => E.isSteeringStub("design-system.md", text) === false,
      idempotent: () => again.ok && again.created === false && again.seeded === undefined && rd(p, REG) === text,
      synced: () => synced.inSync === true && synced.missingTotal === 0 && synced.staleTotal === 0 && synced.registry.components === 5 && synced.registry.tokens === 12,
      drift: () => js(drift.missing) === js([{ name: "Badge", path: "src/components/Badge.tsx" }]) && js(drift.stale) === js([{ name: "Dialog", path: "src/ui/dialog.vue" }]) &&
        js(drift.newSources) === js(["src/styles/theme.css"]) && js(drift.newLibraries) === js(["antd"]) && drift.inSync === false,
      mcp: () => js(viaMcp) === js(drift),
      refusals: () => bad[0].result.isError === true && bad[1].result.isError === true && payload(bad[2]).ok === false,
    });
    // nothing in the code: the plain stub; a project template wins; a PT project: its headings
    const empty = project("seed-empty", "en");
    const se = S.scaffoldSteeringFile(empty, "design-system.md");
    const tpl = project("seed-template", "en");
    codebase(tpl);
    write(tpl, ".specs/templates/steering/design-system.md", "# Our system — {{name}}\n\n| Component | Path |\n|---|---|\n| Logo | src/Logo.tsx |\n");
    const st = S.scaffoldSteeringFile(tpl, "design-system.md");
    const ptp = project("seed-pt", "pt");
    codebase(ptp);
    const sp = S.scaffoldSteeringFile(ptp, "design-system.md");
    all("1.35 seed: with no component or token in the code the stub is written as it is (no `seeded`); a project template for steering/design-system.md is used instead of the seed; a Portuguese project gets its own headings with the code's rows (got " +
      js({ empty: [se.created, se.seeded, E.isSteeringStub("design-system.md", rd(empty, REG))], tpl: [st.created, st.seeded, st.template, rd(tpl, REG).slice(0, 40)], pt: [sp.seeded, rd(ptp, REG).includes("| Componente | Caminho | Variantes | Notas |\n|---|---|---|---|\n| Button |")] }) + ")", {
      empty: () => se.created === true && se.seeded === undefined && E.isSteeringStub("design-system.md", rd(empty, REG)) === true,
      template: () => st.created === true && st.seeded === undefined && st.template === ".specs/templates/steering/design-system.md" && rd(tpl, REG).startsWith("# Our system — proj-ds-seed-template"),
      pt: () => js(sp.seeded) === js({ components: 5, tokens: 12 }) && rd(ptp, REG).includes("| Componente | Caminho | Variantes | Notas |\n|---|---|---|---|\n| Button |") && rd(ptp, REG).includes("## Componentes\n_Libraries: @mui/material, @radix-ui_"),
    });
  }

  // --- a feature against the registry: raw values, finish ---------------------------------------------------------------------------
  {
    const g = mk("raw", null, REGISTRY);
    setDesign(g, rows(OK_ROWS.concat("| New | Button2 |  |")));
    write(g.p, "src/checkout/Checkout.tsx", ["export const Checkout = () => (",
      "  <div style={{ color: \"#1D4ED8\", background: \"#fff\" }} className=\"p-[13px] md:text-[15px] text-[#ff0000] rounded-lg\">",
      "    <a href=\"#abcdef\">skip</a> <span id=\"#fab\">&#1234;</span>",
      "    {/* a comment: #123456 and rgb(1, 2, 3) */}",
      "    <i style={{ color: \"rgb(var(--x))\", boxShadow: \"0 0 0 1px rgba(0, 0, 0, 0.5)\" }} data-x=\"#1234567\" />",
      "  </div>", ");", ""].join("\n"));
    write(g.p, "src/checkout/checkout.css", [".checkout { color: #abc; margin: 13px; border: 1px solid var(--line); padding: var(--space-4); }", "#fab, .x {", "  font-size: 0.9rem; gap: 1px; margin-top: 0;",
      "  /* color: #999999; */", "  padding-inline-start: calc(4px + 1rem); border-radius: 10px;", "}", ""].join("\n"));
    write(g.p, "src/styles/_tokens.scss", "$brand: #1d4ed8;\n.x { color: #123123; margin: 99px; }\n");
    write(g.p, "src/checkout/Checkout.test.tsx", "const c = \"#aabbcc\";\n");
    write(g.p, "src/other/Other.tsx", "export const c = \"#aabbcc\";\n");
    write(g.p, "src/components/PriceTag.tsx", "export const PriceTag = () => null;\n");
    fs.writeFileSync(path.join(g.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Build the checkout page\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n" +
      "  - _Implements: src/checkout/, src/styles/_tokens.scss, src/components/PriceTag.tsx_\n  - _Verify: npm test_\n");
    const r = S.designSystemReport(g.p, { name: g.slug });
    const viaMcp = payload(await call("spec_scan", { projectDir: g.p, designSystem: true, name: g.slug }));
    const fin = S.finishFeature(g.p, g.slug, { write: true });
    const regAfter = rd(g.p, REG);
    all("1.35 raw values: a feature's view and style files (its _Implements:_ — token files and tests aside) are read for hard-coded colours (a hex literal, a functional colour with literal arguments — with the registry token of the same value) and sizes (a stylesheet's margin / padding / gap / font-size / radius in px / rem / em, a Tailwind arbitrary value); never an anchor, an entity, a comment, a selector, rgb(var(--x)), a 1px hairline, a value built from a variable or calc(); spec_finish warns (never a blocker) and a finish that is not ready registers nothing (got " +
      js({ raw: r.raw.map((x) => x.file.replace("src/checkout/", "") + ":" + x.line + " " + x.value + (x.token ? " → " + x.token : "")), counts: r.counts, total: r.total, viewFiles: r.viewFiles, usage: r.usage, problems: r.problems.map((x) => x.code + ":" + x.name),
        news: r.newComponents, fin: [fin.readyToFinish, fin.designSystem, (fin.warnings || []).filter((w) => /design system/.test(w))] }) + ")", {
      raw: () => js(r.raw.map((x) => x.file.replace("src/checkout/", "") + ":" + x.line + " " + x.value + (x.token ? " → " + x.token : ""))) === js(["Checkout.tsx:2 #1D4ED8 → --color-action-primary", "Checkout.tsx:2 #fff",
        "Checkout.tsx:2 #ff0000", "Checkout.tsx:2 p-[13px]", "Checkout.tsx:2 md:text-[15px]", "Checkout.tsx:5 rgba(0, 0, 0, 0.5)", "checkout.css:1 #abc", "checkout.css:1 margin: 13px", "checkout.css:3 font-size: 0.9rem",
        "checkout.css:5 border-radius: 10px"]),
      counts: () => js(r.counts) === js({ color: 5, size: 5 }) && r.total === 10 && r.viewFiles === 3,
      usage: () => js(r.usage) === js({ reuse: 2, extend: 1, new: 2 }) && js(r.problems.map((x) => x.code + ":" + x.name)) === js(["near:Button2"]) && /close to Button/.test(r.problems[0].text),
      newComponents: () => js(r.newComponents) === js([{ name: "PriceTag", path: "src/components/PriceTag.tsx", registered: false }, { name: "Button2", path: null, registered: false }]),
      mcp: () => js(viaMcp) === js(r),
      finishWarning: () => fin.ok && fin.readyToFinish === false && (fin.warnings || []).some((w) => /^the feature's view files hold 10 raw values where the design system has tokens — src\/checkout\/Checkout\.tsx:2 #1D4ED8; src\/checkout\/Checkout\.tsx:2 #fff; src\/checkout\/Checkout\.tsx:2 #ff0000; …: use the token/.test(w)),
      finishResult: () => fin.designSystem.raw.total === 10 && js(fin.designSystem.registered) === js([]) && js(fin.designSystem.unregistered) === js(["PriceTag", "Button2"]) && fin.designSystem.note === undefined,
      untouched: () => regAfter === REGISTRY,
    });
  }
  {
    // registration: a READY written finish adds the design's New components to the registry — into the table it ends in
    const p = project("register", "en", REGISTRY);
    const f = S.createFeature(p, { name: "Price Tag", tracks: ["ui"], summary: "Show a price", size: "s" });
    fs.writeFileSync(path.join(f.dir, "requirements.md"), REQ.replace("# Feature: Checkout", "# Feature: Price Tag"));
    fs.writeFileSync(path.join(f.dir, "design.md"), "# Design: Price Tag\n\n## Overview\nA price with its currency.\n\n## Architecture\n```mermaid\ngraph TD\n  P[PriceTag] --> F[format]\n```\n\n" +
      "## Decisions, reuse & risks\nReuses the money formatter (`src/lib/money.ts`); one component rather than a helper, so the markup is shared; no material risk: it only renders.\n\n" +
      "## Error Handling\nSee the IF…THEN criteria.\n\n## Constitution Check\n- [x] Small components — complies.\n\n## Complexity Tracking\nNone.\n\n" +
      "## [UI] Design System Usage\n" + rows(["| Reuse | Button | the retry action |", "| New | PriceTag | no listed component shows a price with its currency |", "| New | Sale Badge | marks a discount |", "| New | Bad<!--Name | x y z |"]) + "\n\n" +
      "## [UI] UI States\nLoading: a skeleton. Error: a message with Retry. Reference: design/price.png.\n\n## [UI] Accessibility\nWCAG 2.2 AA; axe in the component tests.\n");
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Build the price tag\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n  - _Implements: src/components/PriceTag.tsx_\n  - _Verify: npm test_\n");
    write(p, "src/components/PriceTag.tsx", "export const PriceTag = () => null;\n");
    const approvals = ["requirements", "design", "tasks"].map((ph) => { const a = S.approvePhase(p, f.slug, ph, "t"); return a.ok ? true : (a.failing || a.error); });
    S.completeTask(p, f.slug, 1, { command: "npm test", exitCode: 0, summary: "42/42 passing" });
    const dry = S.finishFeature(p, f.slug);
    const before = rd(p, REG);
    const fin = payload(await call("spec_finish", { projectDir: p, name: f.slug, write: true }));
    const after = rd(p, REG);
    const again = S.finishFeature(p, f.slug, { write: true });
    const reg = E.designSystemRegistry(path.join(p, ".specs"));
    // a registry that ends in prose (CRLF): a new table is appended, its line ends kept; a project in Portuguese: its note
    const crlf = project("register-crlf", "pt", REGISTRY.replace(/\n/g, "\r\n") + "\r\nNotas finais.\r\n");
    const names = E.designSystemFinish; // (reached through the engine: the lazy entry spec_finish calls)
    const cf = S.createFeature(crlf, { name: "Etiqueta", tracks: ["ui"], summary: "x", size: "s", lang: "pt" });
    fs.writeFileSync(path.join(cf.dir, "design.md"), "# Design: Etiqueta\n\n## [UI] Uso do Design System\n" + rows(["| Novo | Etiqueta | nenhum componente listado mostra um preço |"], "pt") + "\n");
    const cr = names(crlf, cf.slug, { write: true, ready: true });
    const crText = rd(crlf, REG);
    all("1.35 finish: a READY written finish adds the design's New components to the registry — a row each in the component table the file ends in (its path found among the feature's files, the feature in the notes), once (a second finish adds nothing), never a name that is not a plain component name; a finish without write registers nothing; a registry ending in prose gets a new table, its line ends kept, the note in the project's language (got " +
      js({ approvals, dry: [dry.readyToFinish, dry.designSystem], fin: [fin.readyToFinish, fin.blockers, fin.designSystem], added: after.slice(before.length), again: again.designSystem, total: reg.total.components, cr, crTail: crText.slice(-170) }) + ")", {
      approved: () => approvals.every((a) => a === true),
      dry: () => dry.readyToFinish === true && js(dry.designSystem.registered) === js([]) && js(dry.designSystem.unregistered) === js(["PriceTag", "Sale Badge", "Bad<!--Name"]) && before === REGISTRY,
      registered: () => fin.readyToFinish === true && js(fin.designSystem.registered) === js(["PriceTag", "Sale Badge"]) && js(fin.designSystem.unregistered) === js(["Bad<!--Name"]) &&
        fin.designSystem.note === "added to the design-system registry (.specs/steering/design-system.md): PriceTag, Sale Badge",
      rows: () => after === before + "| PriceTag | `src/components/PriceTag.tsx` |  | added by price-tag |\n| Sale Badge | — |  | added by price-tag |\n",
      once: () => again.designSystem && js(again.designSystem.registered) === js([]) && rd(p, REG) === after && reg.total.components === 6,
      known: () => (S.specDoctor(p, f.slug).checks.find((c) => c.id === "ui-design-system") || {}).status !== undefined,
      crlf: () => js(cr.registered) === js(["Etiqueta"]) && crText.endsWith("Notas finais.\r\n\r\n| Componente | Caminho | Variantes | Notas |\r\n|---|---|---|---|\r\n| Etiqueta | — |  | acrescentado por etiqueta |\r\n") &&
        E.designSystemRegistry(path.join(crlf, ".specs")).components.some((c) => c.name === "Etiqueta"),
    });
  }
};
