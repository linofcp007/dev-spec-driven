"use strict";
// The design-system registry (1.35) — review 9's findings: a library written with a bare version number is cited anywhere when
// its shorter name is a package of the project (review 8 had made every one of them a parenthesis-only alias), a usage cell is
// cut outside parentheses, a twin stylesheet is a token file for the raw-value read, a Less `@name : value`, a component rule
// that re-points one token is no theme, a parameter list broken inside a nested call, a `next.config.*`.

const fs = require("fs");
const path = require("path");

exports.run = async ({ all, S, tmp, approveBefore, require, __dirname }) => {
  const js = (v) => JSON.stringify(v);
  const E = require(path.join(__dirname, "lib", "engine", "index.js"));
  const write = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  const REG = ".specs/steering/design-system.md";
  const COMP = "export default () => null;\n";
  const CARD = "| Component | Path | Variants | Notes |\n|---|---|---|---|\n| Card | `src/ui/Card.tsx` |  |  |\n\n";
  const PROPS = (n, prefix, sel) => (sel || ":root") + " {\n" + Array.from({ length: n }, (_, i) => "  --" + (prefix || "c") + i + ": " + i + "px;").join("\n") + "\n}\n";
  const project = (tag) => { const p = path.join(tmp, "proj-ds9-" + tag); S.initProject(p, ["ui"], "en"); return p; };
  const registry = (p) => E.designSystemRegistry(path.join(p, ".specs"));
  const tokensOf = (p) => Object.fromEntries(S.designSystemReport(p).newTokens.map((t) => [t.name, t.value]));
  const REQ = "# Feature: Sign Up\n\n## Summary\nA form.\n\n## User Stories\n### US-1 (P1): Sign up\nAs a visitor I want to sign up.\n**Independent Test:** submit the form.\n\n" +
    "#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN the visitor submits the form THE SYSTEM SHALL create the account.\n" +
    "2. **US-1.AC-2** — IF the e-mail is taken THEN THE SYSTEM SHALL say so beside the field.\n\n## Success Criteria\n- **SC-001** — a visitor signs up in under a minute.\n\n" +
    "## Edge Cases & Error Handling\n- **EC-1** — WHEN the network drops THE SYSTEM SHALL keep what was typed.\n\n## Non-Functional Requirements\n- **NFR-1** — the form renders in under 100 ms.\n\n## Out of Scope\n- Social sign-in.\n";
  const design = (rows) => "# Design: Sign Up\n\n## Overview\nA form built from the system.\n\n## Architecture\n```mermaid\ngraph TD\n  F[Form] --> A[api]\n```\n\n" +
    "## Reuse & Integration\n| Kind | What | Where (path) | Why / notes |\n|---|---|---|---|\n| Reuse | the api client | `src/lib/api.ts` | it posts the form |\n\n" +
    "## Alternatives & Trade-offs\n| Decision | Option | Pros | Cons | Cost if wrong | Chosen |\n|---|---|---|---|---|---|\n| Fields | The system's | Accessible | A dependency | A rewrite | ✓ |\n| Fields | Our own | Light | States to build | Drift | ✗ |\n\n" +
    "## Data Models\nAccount {email}.\n\n## Error Handling\nSee the IF…THEN criteria.\n\n## Testing Strategy\nComponent tests.\n\n## Risks\n- A slow network — low — the button shows progress.\n\n" +
    "## Constitution Check\n- [x] Small components — complies.\n\n## Complexity Tracking\nNone.\n\n" +
    "## [UI] Design System Usage\nBuilt from the system.\n\n| Kind | Component | Why / notes |\n|---|---|---|\n" + rows.join("\n") + "\n\n## [UI] UI States\nLoading: the button spins. Error: beside the field. Reference: design/signup.png.\n\n" +
    "## [UI] Accessibility\nWCAG 2.2 AA; axe in the component tests.\n\n## [UI] Responsiveness & i18n\nOne column at 360 px.\n\n## [UI] UI Performance Budget\nNo layout shift.\n";
  // a size m feature whose design is ready for its approval → { approve(rows), usage(rows): the rows the engine reads }
  const sized = (p) => {
    const f = S.createFeature(p, { name: "Sign Up", tracks: ["ui"], summary: "x", size: "m" });
    fs.writeFileSync(path.join(f.dir, "requirements.md"), REQ);
    fs.writeFileSync(path.join(f.dir, "design.md"), design(["| Reuse | Placeholder | x |"]));
    approveBefore(p, f.slug, "design");
    const approve = (rows) => { fs.writeFileSync(path.join(f.dir, "design.md"), design(rows)); const a = S.approvePhase(p, f.slug, "design", "t"); return a.ok ? "approved" : "refused:" + (a.failing || []).join(","); };
    const usage = (rows) => { fs.writeFileSync(path.join(f.dir, "design.md"), design(rows)); const r = S.designSystemReport(p, { name: f.slug }); return r.usage; };
    return { approve, usage };
  };
  const feature = (p, name, where) => {
    const f = S.createFeature(p, { name, tracks: ["ui"], summary: "x" });
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Build it\n  - _Requirements: US-1.AC-1_\n  - _Implements: " + where + "_\n");
    return f;
  };

  // --- a library with a bare version number; how surely a shorter name cites ------------------------------------------------------------
  {
    const p = project("versions");
    write(p, "package.json", js({ dependencies: { antd: "^5.0.0", bootstrap: "^5.3.0", vuetify: "^3.0.0", "@mantine/core": "^7.0.0", "@carbon/react": "^1.0.0", "fluent-ui": "^9.0.0", react: "^19.0.0", "acme-ui": "^1.0.0", ark: "^1.0.0" } }));
    const f = sized(p);
    // [the _Libraries:_ line, a row] — with a Card row in the registry
    const cases = [["antd 5", "antd Table"], ["Bootstrap 5", "Bootstrap Modal"], ["Bootstrap 5", "Modal — Bootstrap"], ["Bootstrap 5", "Bootstrap: Modal"], ["Bootstrap 5", "Modal [Bootstrap]"],
      ["Ant Design 5", "Ant Design Table"], ["MUI 5", "MUI TextField"], ["Mantine 7", "Mantine Button"], ["Carbon 11", "Carbon Button"], ["Fluent 9", "Fluent Button"], ["Chakra UI 3", "Chakra UI Button"],
      ["@mui/material 6", "@mui/material/Button"], ["ark 2", "ark Menu"], ["Polaris 12, Polaris", "Polaris Button"], ["Bootstrap 5, bootstrap", "bootstrap Modal"], ["react, Headless UI (react)", "React Select"],
      ["Material UI (@mui/material@6)", "Button (@mui/material)"], ["Material UI (@mui/material v6)", "Button (@mui/material)"], ["Material UI (MUI v6)", "MUI Button"], ["Material UI (MUI, v6)", "MUI Button"],
      ["[`antd`](https://ant.design)", "antd Table"]];
    const yes = cases.map(([lib, row]) => { write(p, REG, "# DS\n\n" + CARD + "_Libraries: " + lib + "_\n"); return f.approve(["| Reuse | " + row + " | the list |"]); });
    // …and what must stay refused: one plain word no package backs, a version or a bare scope as a note, a name with no blank before its digit
    const no = [["Material 3", "Material Picker"], ["Element 2", "Form Element"], ["Polaris 12", "Polaris Button"], ["Ant 5", "Ant Table"], ["antd (V5)", "Buton (V5)"], ["antd (@jane)", "Buton (@jane)"], ["UI5", "UI Kit"]]
      .map(([lib, row]) => { write(p, REG, "# DS\n\n" + CARD + "_Libraries: " + lib + "_\n"); return f.approve(["| Reuse | " + row + " | the list |"]); });
    write(p, REG, "# DS\n\n_Libraries: UI5, Carbon 11, Polaris 12, Polaris_\n");
    const read = registry(p);
    // a registry with no component row: a weak alias never switches the gate on — and a dependency named with its number does
    const only = [["Vuetify 3", "Vuetify VBtn"], ["Vuetify 3", "Buton"], ["Design System (acme-ui)", "acme-ui Button"], ["Custom components (react)", "Button"], ["Material 3", "Buton"]]
      .map(([lib, row]) => { write(p, REG, "# DS\n\n_Libraries: " + lib + "_\n"); return registry(p).packaged + ":" + f.approve(["| Reuse | " + row + " | the list |"]); });
    all("1.35 review 9: a library written with a bare version number is cited by its shorter name ANYWHERE in a cell when that name is one a row would write — a dependency (`antd 5` → `antd Table`, `Bootstrap 5` → `Bootstrap Modal`, `Modal — Bootstrap`, `Bootstrap: Modal`), a package under its scope or with its prefix (`Mantine 7`, `Carbon 11`, `Fluent 9`), an acronym (`MUI 5`), two words (`Ant Design 5`, `Chakra UI 3`), a scoped package (`@mui/material 6`) —: review 8 had made every such name parenthesis-only and refused all of them; only one plain word no package backs stays so (`Material 3` never makes \"Material Picker\" the library's). An entry written on its own is never weak, whatever came before (`Polaris 12, Polaris`; `react, Headless UI (react)`), in any case (`Bootstrap 5, bootstrap`). A note is read as an entry is: its version dropped, the part before a comma (`(@mui/material@6)`, `(MUI, v6)`), a code span in a link's text too; a version or a scope no dependency lives under is a remark (`(V5)`, `(@jane)`); a name with no blank before its digit stays whole (`UI5`). And a weak alias never makes a registry with no component row a checked one: `Custom components (react)` — a framework, a remark — and `Material 3` only warn, while `Vuetify 3` and `Design System (acme-ui)` — dependencies — are checked (got " +
      js({ yes, no, libraries: read.libraries, weak: [...read.weakLibraries], only }) + ")", {
      cited: () => js(yes) === js(cases.map(() => "approved")),
      refused: () => js(no) === js(no.map(() => "refused:ui-design-system")),
      read: () => js(read.libraries) === js(["UI5", "Carbon 11", "Carbon", "Polaris 12", "Polaris"]) && js([...read.weakLibraries]) === js([]),
      only: () => js(only) === js(["true:approved", "true:refused:ui-design-system", "true:approved", "false:approved", "false:approved"]),
    });
  }

  // --- a usage cell is cut outside its parentheses -------------------------------------------------------------------------------------
  {
    const p = project("cells");
    write(p, REG, "# DS\n\n" + CARD + "_Libraries: @mui/material (MUI)_\n");
    const f = sized(p);
    const rows = ["TextField (@mui/material, outlined)", "Button (MUI, size small)", "Card (the listed one, compact)", "Card (a; b · c)"];
    const verdicts = rows.map((r) => f.approve(["| Reuse | " + r + " | the list |"]));
    const counts = [f.usage(["| New | DatePicker (range, with presets) | no listed one picks a range |"]), f.usage(["| Reuse | Button, Dialog (@mui/material) | two of the library |"]),
      f.usage(["| Reuse | Button · Dialog (MUI); Card | three |"])].map((u) => u && u.reuse + ":" + u.new);
    all("1.35 review 9: a usage cell's components are cut at `,` `;` `·` OUTSIDE parentheses — `TextField (@mui/material, outlined)` is one component of the library, `Card (the listed one, compact)` is Card, and `New | DatePicker (range, with presets)` one New component (cut anywhere, it was refused as \"outlined)\" and read as two, on every commit since the first); `Button, Dialog (@mui/material)` is still two rows, `Button · Dialog (MUI); Card` three (got " + js({ verdicts, counts }) + ")", {
      one: () => js(verdicts) === js(rows.map(() => "approved")),
      rows: () => js(counts) === js(["0:1", "2:0", "3:0"]),
    });
  }

  // --- a twin is a token file for the raw-value read; a theme overrides at least half of what it declares -------------------------------
  {
    const p = project("twins");
    const SHEET = ":root {\n  --background: oklch(1 0 0);\n  --foreground: oklch(0.145 0 0);\n  --primary: #1d4ed8;\n  --radius: 8px;\n  --gap: 4px;\n}\n";
    for (const at of ["apps/docs/app", "apps/web/app", "packages/ui/src/styles"]) write(p, at + "/globals.css", SHEET);
    write(p, "packages/ui/src/Button.tsx", COMP);
    S.scaffoldSteeringFile(p, "design-system.md");
    const rep = S.designSystemReport(p);
    const raw = S.designSystemReport(p, { name: feature(p, "Theme", "packages/ui/src/").slug });
    // a theme and a component rule, in one sheet named for the app
    const t = project("themes");
    write(t, "src/app.css", ":root {\n  --background: #fff; --foreground: #111; --primary: #1d4ed8; --radius: 8px; --bs-gradient: none;\n}\n" +
      ".dark {\n  --background: #111; --foreground: #fff; --primary: #60a5fa;\n  --sidebar: #222; --sidebar-primary: #333;\n}\n" +
      ".btn-outline-primary {\n  --bs-gradient: none;\n" + Array.from({ length: 12 }, (_, i) => "  --bs-btn-" + i + ": 1px;").join("\n") + "\n}\n" +
      ".pricing-card {\n  --radius: 12px; --pricing-accent: #f00; --pricing-pad: 2px; --pricing-shadow: none;\n}\npre { --pre-pad: 1px; --foreground: #000; }\n");
    const themed = Object.keys(tokensOf(t));
    all("1.35 review 9: of three apps' identical globals.css one is the source — and the two twins are token files all the same: a feature that edits one is never told to \"use the token\" on the line that declares it (review 8 dropped them without a trace: ten raw values on a globals.css); a block is a theme of the page when at least HALF of what it declares overrides page-wide tokens — `.dark` with three overrides and two names of its own gives the two, `pre { --pre-pad; --foreground }` its one — while a component rule that re-points ONE token beside twelve of its own (`.btn-outline-primary`, `.pricing-card`) gives none (got " +
      js({ sources: rep.found.sources, inSync: rep.inSync, raw: [raw.viewFiles, raw.total], themed }) + ")", {
      twins: () => js(rep.found.sources) === js(["apps/docs/app/globals.css"]) && rep.inSync === true,
      raw: () => raw.total === 0,
      themes: () => js(themed) === js(["--background", "--foreground", "--primary", "--radius", "--bs-gradient", "--sidebar", "--sidebar-primary", "--pre-pad"]),
    });
  }

  // --- a stylesheet's statements: Less with a blank before its colon, a nested call in a parameter list, a Sass partial -------------------
  {
    const p = project("statements");
    write(p, "src/styles/variables.less", ["@primaryColor        : #2185d0;", "@pageBackground      : #ffffff;", "@fontSize : 14px;", "@page :first", "{", "  margin: 1in;", "}", "@page:first { margin: 2in; }", "@pagination: 4px;"].join("\n") + "\n");
    write(p, "src/styles/_variables.scss", ["@mixin transition(", "  $property: all,", "  $easing: cubic-bezier(", "    0.4,", "    0,", "    0.2,", "    1", "  ),", "  $delay: 0s,", "  $duration: 150ms", ") {",
      "  transition: $property $duration $easing $delay;", "}", "$duration: 300ms;", "$delay: 100ms;", "$gap : 8px;",
      ".a { @include box($pad: 1px,", "    $shadowed: 1px); }", "$shadowed: 9px;"].join("\n") + "\n"); // (arguments that begin on the opening line: it ends in a `,`)
    for (const f of ["src/a/_base.scss", "src/b/_globals.scss", "src/c/_index.scss"]) write(p, f, PROPS(5, f.split("/")[1]));
    write(p, "src/d/_other.scss", PROPS(5, "d"));
    const rep = S.designSystemReport(p);
    const got = Object.fromEntries(rep.newTokens.map((t) => [t.name, t.value]));
    all("1.35 review 9: a .less variable written with a blank before its colon is read (`@primaryColor        : #2185d0;` — asked right after the name, such a file listed nothing), `@page :first` and `@page:first` are the at-rule, `@pagination` a variable; a parameter list broken inside a nested call keeps its parameters parameters — after `cubic-bezier(` … `1`, `$delay` and `$duration` are still inside, and the variables of those names below keep their values (the count was closed at the end of any line that did not go on); a Sass partial of a listed name is that name (`_base.scss`, `_globals.scss`, `_index.scss` — never `_other.scss`) (got " +
      js({ got, sources: rep.found.sources }) + ")", {
      less: () => got["@primaryColor"] === "#2185d0" && got["@pageBackground"] === "#ffffff" && got["@fontSize"] === "14px" && got["@pagination"] === "4px" && !("@page" in got),
      nested: () => got.$duration === "300ms" && got.$delay === "100ms" && got.$gap === "8px" && got.$shadowed === "9px" && !("$property" in got) && !("$easing" in got) && !("$pad" in got),
      partials: () => js(rep.found.sources) === js(["src/styles/_variables.scss", "src/styles/variables.less", "src/b/_globals.scss", "src/a/_base.scss", "src/c/_index.scss"]),
    });
  }

  // --- the router: a next.config.* says Next too ------------------------------------------------------------------------------------------
  {
    const names = (files) => {
      const p = project("next-" + Object.keys(files).length + "-" + Object.keys(files)[0].replace(/\W/g, ""));
      for (const [rel, text] of Object.entries(files)) write(p, rel, text == null ? COMP : text);
      S.scaffoldSteeringFile(p, "design-system.md");
      const reg = registry(p);
      return reg ? reg.components.map((c) => c.name) : [];
    };
    const app = { "app/layout.tsx": null, "app/page.tsx": null, "app/components/page.tsx": null, "app/components/error.tsx": null, "components/ui/button.tsx": null };
    const got = {
      config: names(Object.assign({ "next.config.mjs": "export default {};\n" }, app)),
      nested: names(Object.assign({ "apps/web/next.config.ts": "export default {};\n" }, Object.fromEntries(Object.keys(app).map((k) => ["apps/web/" + k, null])))),
      none: names(Object.assign({ "vite.config.ts": "export default {};\n" }, app)),
    };
    all("1.35 review 9: a Next project is one by a `next.config.*` at or above the router's root, inside the project, as by a package.json that depends on next — an Nx project folder whose dependencies are hoisted out of the scanned folder keeps its route segments (its `app/components/{page,error}.tsx` were seeded as Page and Error); without either, the same files are components (got " + js(got) + ")", {
      config: () => js(got.config) === js(["Button"]),
      nested: () => js(got.nested) === js(["Button"]),
      none: () => js(got.none) === js(["Button", "Error", "Page"]),
    });
  }
};
