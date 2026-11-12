"use strict";
// The design-system registry (1.35) — review 2's findings: the origin of a row past the reader's cap, the approval gate and the
// feature report after a feature's own finish, the registry read again under the lock, `_Libraries: none yet`, tokens past the
// cap, what the scan calls a component / a token file, the raw values' misreadings (a multi-value declaration, a TSX generic,
// a key ending in "id"), a path with a blank or behind a markdown link, bounded time on a view file's hostile lines.

const fs = require("fs");
const path = require("path");

exports.run = async ({ all, S, tmp, approveBefore, remeasure, require, __dirname }) => {
  const js = (v) => JSON.stringify(v);
  const E = require(path.join(__dirname, "lib", "engine", "index.js"));
  const write = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  const rd = (dir, rel) => fs.readFileSync(path.join(dir, rel), "utf8");
  const long = (ch, n) => Array.from({ length: n + 1 }).join(ch);
  const REG = ".specs/steering/design-system.md";
  const COMPONENTS = "## Components\n\n| Component | Path | Variants | Notes |\n|---|---|---|---|\n| Button | `src/components/Button.tsx` | primary |  |\n| Card | `src/components/Card.tsx` |  |  |\n";
  const REGISTRY = "# Design System\n\n## Tokens\n_Token sources: src/styles/tokens.css_\n\n| Token | Value | Use |\n|---|---|---|\n| --color-action-primary | #1d4ed8 | primary |\n\n" + COMPONENTS;
  const REQ = "# Feature: Price Tag\n\n## Summary\nShow a price.\n\n## User Stories\n### US-1 (P1): See a price\nAs a buyer I want to see a price.\n**Independent Test:** open one product.\n\n" +
    "#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN the buyer opens a product THE SYSTEM SHALL show its price with the currency.\n" +
    "2. **US-1.AC-2** — IF the price is missing THEN THE SYSTEM SHALL show a dash.\n\n## Success Criteria\n- **SC-001** — every product page shows a price.\n\n" +
    "## Edge Cases & Error Handling\n- **EC-1** — WHEN the currency is unknown THE SYSTEM SHALL show the amount alone.\n\n## Non-Functional Requirements\n- **NFR-1** — renders in under 16 ms.\n\n## Out of Scope\n- Discounts.\n";
  const design = (rows) => "# Design: Price Tag\n\n## Overview\nA price with its currency.\n\n## Architecture\n```mermaid\ngraph TD\n  P[PriceTag] --> F[format]\n```\n\n" +
    "## Reuse & Integration\n| Kind | What | Where (path) | Why / notes |\n|---|---|---|---|\n| Reuse | the money formatter | `src/lib/money.ts` | it formats a price |\n\n" +
    "## Alternatives & Trade-offs\n| Decision | Option | Pros | Cons | Cost if wrong | Chosen |\n|---|---|---|---|---|---|\n| Shape | A component | Shared markup | One more file | A rename | ✓ |\n| Shape | A helper | Small | Markup repeated | Drift | ✗ |\n\n" +
    "## Data Models\nPrice {amount, currency}.\n\n## Error Handling\nSee the IF…THEN criteria.\n\n## Testing Strategy\nComponent tests.\n\n## Risks\n- A missing currency — low — the amount alone.\n\n" +
    "## Constitution Check\n- [x] Small components — complies.\n\n## Complexity Tracking\nNone.\n\n" +
    "## [UI] Design System Usage\nBuilt from the system.\n\n| Kind | Component | Why / notes |\n|---|---|---|\n" + rows.join("\n") + "\n\n## [UI] UI States\nLoading: a skeleton. Error: a dash. Reference: design/price.png.\n\n## [UI] Accessibility\nWCAG 2.2 AA; axe in the component tests.\n\n" +
    "## [UI] Responsiveness & i18n\nOne line at 360 px.\n\n## [UI] UI Performance Budget\nNo layout shift.\n";
  const TASKS = "# Tasks\n\n- [ ] 1. [US1] Build the price tag\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n  - _Implements: src/components/PriceTag.tsx_\n  - _Verify: npm test_\n";
  const ROWS = ["| Reuse | Button | the retry action |", "| New | PriceTag | no listed component shows a price with its currency |"];
  // a feature of the given size, approved through its tasks and its one task done: ready to finish
  const ready = (tag, size, registry, rows) => {
    const p = path.join(tmp, "proj-ds2-" + tag);
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
  const timed = (fn) => remeasure(() => { const t = Date.now(); const v = fn(); return { ms: Date.now() - t, v }; }, (s) => s.ms < 4000);

  // --- after a feature's own finish: every reader of its design knows the row is its own -----------------------------------------------
  for (const size of ["m", "l"]) {
    const g = ready("own-" + size, size, REGISTRY);
    const fin = S.finishFeature(g.p, g.slug, { write: true });
    // the design is edited after the finish (a late note): no longer settled — judged again, by the gate too
    fs.writeFileSync(path.join(g.dir, "design.md"), design(ROWS) + "\nA late note.\n");
    const edited = dsCheck(g);
    const save = S.designSaveCheck(g.p, g.slug);
    const report = S.designSystemReport(g.p, { name: g.slug });
    const again = S.approvePhase(g.p, g.slug, "design", "t");
    all("1.35 review 2: a size " + size + " feature after its own written finish, its design then edited — the approval gate, doctor, the save check and the feature report all read `New | PriceTag` against its own `_From:_` row as New: the re-approval goes through, nothing says 'already listed' (got " +
      js({ approvals: g.approvals, fin: fin.designSystem && fin.designSystem.registered, edited: [edited.status, edited.detail.slice(0, 80)], save: [save.designSystem, /already lists/.test(save.text || "")],
        report: [report.problems, report.newComponents], again: [again.ok, again.failing] }) + ")", {
      setup: () => g.approvals.every((a) => a === true) && js(fin.designSystem.registered) === js(["PriceTag"]),
      doctor: () => edited.status === "pass",
      saveCheck: () => save.designSystem === "ok" && !/already lists/.test(save.text || ""),
      report: () => js(report.problems) === js([]) && js(report.newComponents) === js([{ name: "PriceTag", path: "src/components/PriceTag.tsx", registered: true }]),
      gate: () => again.ok === true,
    });
  }
  {
    // the origin of a row PAST the reader's cap: finish appends at the end of a long registry — row 506 here
    const big = "# DS\n\n| Component | Path | Variants | Notes |\n|---|---|---|---|\n" + Array.from({ length: 505 }, (_, i) => "| C" + i + " | `src/components/C" + i + ".tsx` |  |  |").join("\n") + "\n";
    const g = ready("big-own", "m", big, ["| Reuse | C504 | the last one |", "| New | PriceTag | no listed component shows a price |"]);
    const fin = S.finishFeature(g.p, g.slug, { write: true });
    const after = dsCheck(g);
    const reg = E.designSystemRegistry(path.join(g.p, ".specs"));
    fs.writeFileSync(path.join(g.dir, "design.md"), design(["| Reuse | C504 | the last one |", "| New | PriceTag | no listed component shows a price |"]) + "\nA late note.\n");
    const again = S.approvePhase(g.p, g.slug, "design", "t");
    all("1.35 review 2: the origin of a registry row past the 500 read with their details is still known — a size m feature whose New component lands as row 506 keeps a passing ui-design-system after its finish, and its edited design is approved again (got " +
      js({ fin: fin.designSystem && fin.designSystem.registered, after: [after.status, after.detail.slice(0, 90)], rows: [reg.components.length, reg.total.components, reg.origins.get("pricetag")], again: [again.ok, again.failing] }) + ")", {
      registered: () => js(fin.designSystem.registered) === js(["PriceTag"]) && reg.components.length === 500 && reg.total.components === 506,
      origin: () => reg.origins.get("pricetag") === g.slug,
      passing: () => after.status === "pass" && again.ok === true,
    });
  }
  {
    // two features whose slugs share a prefix: a rename follows its own rows only
    const g = ready("rename", "s", REGISTRY + "| PriceBadge | `src/components/PriceBadge.tsx` |  | _From: price_ |\n| PriceRow | `src/components/PriceRow.tsx` |  | _From: price-tag-list_ |\n");
    const fin = S.finishFeature(g.p, g.slug, { write: true });
    const renamed = S.manageFeature(g.p, "rename", g.slug, "Price Label");
    const lines = rd(g.p, REG).split("\n").filter((l) => /_From:/.test(l)).map((l) => l.split("|")[1].trim() + " " + /_From: ([a-z0-9-]+)_/.exec(l)[1]);
    all("1.35 review 2: renaming a feature rewrites ITS origin rows only — `_From: price_` and `_From: price-tag-list_` beside `_From: price-tag_` are left alone (got " + js({ fin: fin.designSystem && fin.designSystem.registered, renamed: [renamed.ok, renamed.designSystemUpdated], lines }) + ")", {
      renamed: () => renamed.ok === true && renamed.designSystemUpdated === 1,
      rows: () => js(lines) === js(["PriceBadge price", "PriceRow price-tag-list", "PriceTag price-label"]),
    });
  }
  {
    // the registry is read AGAIN under the lock: a row another process wrote after this call's own first read of the file is
    // kept. (A written finish drops its whole read cache when it takes the feature's lock, so a write made before the call
    // proves nothing — review 3: this test passed without the fix. The other process writes here at the moment the call takes
    // the roadmap lock, once the call has read the registry: the window the fix closes.)
    const g = ready("cache", "s", REGISTRY);
    const regFile = path.resolve(g.p, REG);
    const real = { readFileSync: fs.readFileSync, linkSync: fs.linkSync, openSync: fs.openSync };
    let reads = 0, wroteAfter = 0;
    const same = (f) => typeof f === "string" && path.resolve(f).toLowerCase() === regFile.toLowerCase();
    const onLock = (f) => {
      if (!reads || wroteAfter || typeof f !== "string" || path.basename(f) !== ".roadmap.lock") return;
      wroteAfter = reads;
      fs.appendFileSync(regFile, "| Badge | `src/components/Badge.tsx` |  |  |\n");
    };
    fs.readFileSync = function (f) { if (same(f)) reads++; return real.readFileSync.apply(this, arguments); };
    fs.linkSync = function (a, b) { onLock(b); return real.linkSync.apply(this, arguments); }; // the lock: a hard link to its note…
    fs.openSync = function (f) { onLock(f); return real.openSync.apply(this, arguments); }; // …or an exclusive create
    let fin;
    try { fin = S.finishFeature(g.p, g.slug, { write: true }); } finally { Object.assign(fs, real); }
    const names = E.designSystemRegistry(path.join(g.p, ".specs")).components.map((c) => c.name);
    // a hostile registry through a written finish: an 80,000-blank run that is NOT at the text's end (a `\s+$` replace rescans it
    // from every blank), then 80,000 empty lines, then the table the row joins
    const h = ready("hostile-end", "s", "# Design System\n\n" + long(" ", 80000) + "x\n" + long("\n", 80000) + COMPONENTS);
    const slow = timed(() => S.finishFeature(h.p, h.slug, { write: true }));
    all("1.35 review 2: a written finish reads the registry again under the lock, past the call's read cache — a row another process writes after the call's first read of the file (here: as the call takes the roadmap lock) is kept beside the one finish adds; a registry holding an 80,000-blank run and 80,000 empty lines before its table is appended to in bounded time (got " +
      js({ wroteAfter, registered: fin.designSystem && fin.designSystem.registered, names, slow: [slow.ms, slow.v.designSystem && slow.v.designSystem.registered] }) + ")", {
      injected: () => wroteAfter > 0,
      both: () => js(fin.designSystem.registered) === js(["PriceTag"]) && js(names) === js(["Button", "Card", "Badge", "PriceTag"]),
      bounded: () => slow.ms < 4000 && js(slow.v.designSystem.registered) === js(["PriceTag"]) && E.designSystemRegistry(path.join(h.p, ".specs")).keys.has("pricetag"),
    });
  }

  // --- the registry's markers and caps ------------------------------------------------------------------------------------------------------
  {
    const p = path.join(tmp, "proj-ds2-libs");
    S.initProject(p, ["ui"], "en");
    write(p, "package.json", js({ dependencies: { "@mui/material": "^6.0.0" } }));
    write(p, "src/styles/tokens.css", ":root { --t1003: 1px; --brand-new: 2px; }\n");
    const tokens = Array.from({ length: 1005 }, (_, i) => "| --t" + i + " | " + i + "px |  |").join("\n");
    write(p, REG, "# DS\n\n_Token sources: src/styles/tokens.css_\n_Libraries: none yet_\n\n| Token | Value | Use |\n|---|---|---|\n" + tokens + "\n\n" + COMPONENTS);
    write(p, "src/components/Button.tsx", "export const Button = () => null;\n");
    write(p, "src/components/Card.tsx", "export const Card = () => null;\n");
    for (const n of ["Alpha", "Beta"]) write(p, "src/components/" + n + ".tsx", "export default () => null;\n");
    const fa = S.createFeature(p, { name: "Alpha Panel", tracks: ["ui"], summary: "x" });
    fs.writeFileSync(path.join(fa.dir, "design.md"), design(["| New | Alpha | a panel of its own |", "| New | Beta | another one |", "| Reuse | TextField (@mui/material) | the form field |"]));
    const reg = E.designSystemRegistry(path.join(p, ".specs"));
    const rep = S.designSystemReport(p);
    const fr = S.designSystemReport(p, { name: fa.slug });
    write(p, REG, rd(p, REG).replace("_Libraries: none yet_", "_Libraries: @mui/material, none (custom only)_"));
    const reg2 = E.designSystemRegistry(path.join(p, ".specs"));
    const fr2 = S.designSystemReport(p, { name: fa.slug });
    all("1.35 review 2: `_Libraries: none yet_` names no library (a library is one word) — the code's @mui/material is one the registry doesn't name and a `TextField (@mui/material)` row is unknown until it does; a token listed past the 1000 read with their values is no new token, one the file doesn't list is; `pendingTotal` counts the components unfinished features declare New (got " +
      js({ libs: [reg.libraries, reg2.libraries], tokens: [reg.tokens.length, reg.total.tokens, reg.tokenNames.size], rep: [rep.newLibraries, rep.newTokens, rep.newTokensTotal, rep.pending.length, rep.pendingTotal, rep.missing, rep.inSync],
        fr: [fr.problems.map((x) => x.code + ":" + x.name), fr2.problems.map((x) => x.code + ":" + x.name)] }) + ")", {
      noneYet: () => js(reg.libraries) === js([]) && js(reg2.libraries) === js(["@mui/material"]),
      newLibrary: () => js(rep.newLibraries) === js(["@mui/material"]),
      unknownUntilNamed: () => js(fr.problems.map((x) => x.code + ":" + x.name)) === js(["unknown:TextField"]) && js(fr2.problems) === js([]),
      tokensPastCap: () => reg.tokens.length === 1000 && reg.total.tokens === 1005 && reg.tokenNames.has("--t1003") && js(rep.newTokens) === js([{ name: "--brand-new", value: "2px" }]) && rep.newTokensTotal === 1 && rep.inSync === false,
      pending: () => js(rep.pending.map((x) => x.name)) === js(["Alpha", "Beta"]) && rep.pendingTotal === 2 && js(rep.missing) === js([]),
    });
  }

  // --- what the scan calls a component, a token file, a stale path ----------------------------------------------------------------------------
  {
    const p = path.join(tmp, "proj-ds2-scan");
    S.initProject(p, ["ui"], "en");
    const comp = "export default () => null;\n";
    write(p, "src/components/Layout.tsx", comp); // a component named as written …
    write(p, "src/components/Loading.tsx", comp);
    write(p, "src/components/layout.tsx", comp.replace("null", "0")); // … a framework's special file is not (on a case-folding disk it IS Layout.tsx)
    write(p, "src/components/Form Controls/DatePicker.tsx", comp);
    write(p, "src/components/Card.tsx", comp);
    write(p, "packages/ui/src/index.tsx", comp); // a barrel: never a component "Src"
    write(p, "src/components/icons/index.tsx", comp); // … nor "Icons"
    write(p, "src/components/Avatar/index.tsx", comp);
    write(p, "app/shop/_components/Hero.tsx", comp); // Next's private folder
    write(p, "tokens.json", js({ space: { sm: { $value: "4px" } } })); // the project's root
    write(p, "theme.json", js({ radius: { md: "6px" } }));
    write(p, "src/theme.ts", "export const theme = {};\n"); // a theme by its name, anywhere
    write(p, "src/styles/tokens.ts", "export const tokens = {};\n"); // right inside a folder that says what it holds
    write(p, "src/auth/tokens.ts", "export const refresh = 1;\n"); // access tokens
    write(p, "src/ui/auth/tokens.ts", "export const access = 1;\n"); // … below a telling folder too
    const seeded = S.scaffoldSteeringFile(p, "design-system.md");
    const reg = E.designSystemRegistry(path.join(p, ".specs"));
    const names = reg.components.map((c) => c.name);
    // paths the report must not call stale: one with a blank, one behind a markdown link, one beside a note; and two that are gone
    write(p, REG, rd(p, REG)
      .replace("| Card | `src/components/Card.tsx` |  |  |", "| Card | [Card](src/components/Card.tsx) |  |  |\n| Hero2 | `app/shop/_components/Hero.tsx` (private) |  |  |\n| Gone | [Gone](src/components/Gone.tsx) |  |  |\n| Lost | src/components/No Such/Lost.tsx |  |  |\n| Pkg | @mui/material |  |  |"));
    const rep = S.designSystemReport(p);
    all("1.35 review 2: the scan — Layout.tsx / Loading.tsx are components (a name is matched as written), a barrel's index (packages/ui/src, icons/) is none, Next's `_components/` is a component folder; tokens.json / theme.json at the root, theme.ts anywhere and tokens.ts right inside styles/ are token files, `src/auth/tokens.ts` and `src/ui/auth/tokens.ts` are not; a registry path with a blank, behind a markdown link or beside a note is not stale, one that is gone is (got " +
      js({ seeded: seeded.seeded, names, sources: reg.sources, tokens: reg.tokens.map((t) => t.name), stale: rep.stale, missing: rep.missing }) + ")", {
      components: () => js(names.filter((n) => n !== "Layout")) === js(["Avatar", "Card", "DatePicker", "Hero", "Loading"]) && names.includes("Layout") && !names.includes("Src") && !names.includes("Icons"),
      sources: () => js(reg.sources) === js(["src/styles/tokens.ts", "src/theme.ts", "theme.json", "tokens.json"]),
      tokens: () => js(reg.tokens.map((t) => t.name)) === js(["radius.md", "space.sm"]),
      seededPath: () => rd(p, REG).includes("| DatePicker | `src/components/Form Controls/DatePicker.tsx` |  |  |"),
      stale: () => js(rep.stale) === js([{ name: "Gone", path: "[Gone](src/components/Gone.tsx)" }, { name: "Lost", path: "src/components/No Such/Lost.tsx" }]) && rep.staleTotal === 2,
      missing: () => js(rep.missing) === js([]),
    });
  }

  // --- raw values: review 2's misreadings ----------------------------------------------------------------------------------------------------
  {
    const p = path.join(tmp, "proj-ds2-raw");
    S.initProject(p, ["ui"], "en");
    write(p, REG, REGISTRY);
    const f = S.createFeature(p, { name: "Shop", tracks: ["ui"], summary: "x" });
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Build it\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/shop/_\n");
    write(p, "src/shop/card.css", [".card {", "  box-shadow: 0 0 0 1px #1d4ed8,", "    0 1px 2px rgb(0 0 0 / 0.2);", "  background: linear-gradient(#111111,", "    #222222);", "}", "#fab,", ".card:hover,", "a:not(#fab),", "a:hover {", "  color: #333333;", "}", ""].join("\n"));
    write(p, "src/shop/State.tsx", ["type style = { tone: string };", "export const State = () => {", "  const [s] = useState<style>(null);", "  return (", "    <form>", "      <input accept=\"image/*\" />", "      <b className=\"text-[#00ff00]\" />", "    </form>", "  );", "};", ""].join("\n"));
    write(p, "src/shop/Tones.tsx", ["export const tones = {", "  invalid: '#dc2626',", "  solid: \"#1d4ed8\",", "  gradient: { from: \"#000000\", to: \"#ffffff\" },", "  href: \"#abcdef\",", "  id: '#aabbcc',", "};",
      "export const Link = () => <a href=\"#fedcba\" id=\"#112233\" style={{ color: \"#445566\" }} />;", "const el = document.getElementById(\"#665544\");", ""].join("\n"));
    const r = S.designSystemReport(p, { name: f.slug });
    const got = r.raw.map((x) => x.file.replace("src/shop/", "") + ":" + x.line + " " + x.value + (x.token ? " =" + x.token : ""));
    all("1.35 review 2: raw values — a declaration going on over lines (`box-shadow: …,`, `linear-gradient(#111111,`) is read by its first line while a selector list (`#fab,`, `.card:hover,`, `a:not(#fab),` — no blank after its colon) is none; a TSX generic `useState<style>` opens no <style> block (the file is still read as code); `invalid: '#dc2626'`, `solid:` and a gradient's `to:` are colours — an `href:` / `id:` key, an href / id attribute and getElementById(\"#…\") are not; a colour the registry holds names its token (got " + js(got) + ")", {
      css: () => js(got.filter((x) => x.startsWith("card"))) === js(["card.css:2 #1d4ed8 =--color-action-primary", "card.css:4 #111111", "card.css:11 #333333"]),
      generic: () => js(got.filter((x) => x.startsWith("State"))) === js(["State.tsx:7 #00ff00"]),
      keys: () => js(got.filter((x) => x.startsWith("Tones"))) === js(["Tones.tsx:2 #dc2626", "Tones.tsx:3 #1d4ed8 =--color-action-primary", "Tones.tsx:4 #000000", "Tones.tsx:4 #ffffff", "Tones.tsx:8 #445566"]),
    });
  }
  // (the patterns' bounded time — each on its own: 15-quality-design-system-review3.js)
};
