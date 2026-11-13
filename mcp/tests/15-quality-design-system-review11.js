"use strict";
// The design-system registry (1.35) — review 11's findings: a `//* …` line comment opens no block comment (Bootstrap 3's
// `//** doc`: every variable below it was lost — on every commit), a Less parameter list goes on at `;` by the STATEMENT that
// opened it, a library's own package by its name (`carbon-components-svelte`, `evergreen-ui`), a name's one strength whatever
// its case and order, a range of several parts, a cell torn by one unclosed parenthesis, a citation in nested parentheses.

const fs = require("fs");
const path = require("path");

exports.run = async ({ all, S, tmp, approveBefore, require, __dirname }) => {
  const js = (v) => JSON.stringify(v);
  const E = require(path.join(__dirname, "lib", "engine", "index.js"));
  const write = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  const REG = ".specs/steering/design-system.md";
  const CARD = "| Component | Path | Variants | Notes |\n|---|---|---|---|\n| Card | `src/ui/Card.tsx` |  |  |\n\n";
  const project = (tag) => { const p = path.join(tmp, "proj-ds11-" + tag); S.initProject(p, ["ui"], "en"); return p; };
  const registry = (p) => E.designSystemRegistry(path.join(p, ".specs"));
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
  // a size m feature whose design is ready for its approval → approve(rows): "approved" | "refused:<failing checks>"
  const sized = (p) => {
    const f = S.createFeature(p, { name: "Sign Up", tracks: ["ui"], summary: "x", size: "m" });
    fs.writeFileSync(path.join(f.dir, "requirements.md"), REQ);
    fs.writeFileSync(path.join(f.dir, "design.md"), design(["| Reuse | Placeholder | x |"]));
    approveBefore(p, f.slug, "design");
    return (rows) => { fs.writeFileSync(path.join(f.dir, "design.md"), design(rows)); const a = S.approvePhase(p, f.slug, "design", "t"); return a.ok ? "approved" : "refused:" + (a.failing || []).join(","); };
  };
  const REFUSED = "refused:ui-design-system";
  const tokens = (p) => Object.fromEntries(S.designSystemReport(p).newTokens.map((t) => [t.name, t.value]));

  // --- a `//* …` line comment; a Less parameter list by the statement that opened it ------------------------------------------------------
  {
    const p = project("comments");
    // Bootstrap 3's own shape: `//** doc` above each variable, `//== Section`, `//##` — and a banner of stars
    const doc = (v) => ["//== Colors", "//", "//## Gray and brand colors for use across Bootstrap.", "", v + "gray-base:              #000;", "//** Background color for `<body>`.", v + "body-bg:               #fff;",
      "//** Global text color on `<body>`.", v + "text-color:            #333;", "//*********************************", v + "after-banner:          4px;", v + "trailing: 1px; //* a note (with a parenthesis;", v + "last: 2px;"].join("\n") + "\n";
    write(p, "src/less/variables.less", doc("@"));
    write(p, "src/scss/_variables.scss", doc("$"));
    // a plain .css has no line comment: there `//*` DOES open a block comment
    write(p, "src/css/tokens.css", ":root {\n  --a: 1px;\n  //* not a line comment in CSS\n  --hidden: 2px;\n  */\n  --b: 3px;\n}\n");
    const got = tokens(p);
    const q = project("less");
    write(q, "src/styles/variables.less", [".btn { @pad: 1px; .button-variant(#fff; #0d6efd;", "    @border: #0d6efd); }", "@border: #cccccc;",
      ".broken {", "  width: calc(100% - 2px;", "  @in-broken: 2px;", "}", ".reset();// no blank (before;", "@after-comment: 7px;",
      "#ns > .mixin(@a; @b;", "  @c: 3px;", "  @d: 4px) { color: @a; }", "@c: 9px;",
      ".one-line { width: calc(100% - 4px;", "  @in-one-line: 5px;", "}", ".mixin2(@p; darken(@q, 5%);", "  @r: 1px;", "  @s: 2px) { color: @p; }", "@r: 6px;"].join("\n") + "\n");
    // (the same unclosed call in SCSS, where `;` separates no parameter, goes on nowhere)
    write(q, "src/styles/_variables.scss", [".sprite(url(a.png;", "$after-sprite: 1px;"].join("\n") + "\n");
    const less = tokens(q);
    all("1.35 review 11: in a .less / .scss file a `//` comment whose text begins with a `*` is a line comment — Bootstrap 3's `//** Background color …` above each variable, a `//*****` banner, a trailing `//* note` —, never a block comment's opening: read as `/*`, the comment never closed and every variable below the first such line was lost, the report in sync (2 of 42 on a real variables.less, on every commit since the first); a plain .css has no line comment and `//*` opens one there. And in Less a parameter list goes on at `;` when the STATEMENT that opened the parenthesis is a mixin's — it begins with `.` or `#` —, wherever it stands on its line: a call after a declaration (`.btn { @pad: 1px; .button-variant(#fff; #0d6efd;` then `@border: #0d6efd); }`) keeps its argument an argument, and a call nested in the list changes nothing (`.mixin2(@p; darken(@q, 5%);`), while a value's stray `(` (`width: calc(100% - 2px;`, on its own line or after its rule's `{`), a `(` in a comment written without a blank and anything in a .scss go on nowhere (review 10 asked it of the LINE — \"it holds no declaration\" — and those swallowed down to the next brace) (got " +
      js({ got, less }) + ")", {
      less: () => got["@gray-base"] === "#000" && got["@body-bg"] === "#fff" && got["@text-color"] === "#333" && got["@after-banner"] === "4px" && got["@trailing"] === "1px" && got["@last"] === "2px",
      scss: () => got["$gray-base"] === "#000" && got["$body-bg"] === "#fff" && got["$text-color"] === "#333" && got["$after-banner"] === "4px" && got.$trailing === "1px" && got.$last === "2px",
      css: () => got["--a"] === "1px" && got["--b"] === "3px" && !("--hidden" in got),
      call: () => less["@pad"] === "1px" && less["@border"] === "#cccccc",
      stray: () => less["@in-broken"] === "2px" && less["@after-comment"] === "7px" && less["@in-one-line"] === "5px",
      mixin: () => less["@c"] === "9px" && !("@a" in less),
      nested: () => less["@r"] === "6px" && !("@s" in less),
      scssCall: () => less["$after-sprite"] === "1px",
    });
  }

  // --- a library's own package, a name's one strength, a version of several parts ---------------------------------------------------------
  {
    const p = project("names");
    write(p, "package.json", js({ dependencies: {} }));
    const approve = sized(p);
    // [the project's dependencies, the _Libraries:_ line, a row] — with a Card row in the registry
    const verdict = ([deps, lib, row]) => {
      write(p, "package.json", js({ dependencies: Object.fromEntries(deps.map((d) => [d, "1.0.0"])) }));
      write(p, REG, "# DS\n\n" + CARD + "_Libraries: " + lib + "_\n");
      return approve(["| Reuse | " + row + " | the list |"]);
    };
    const cases = [[["carbon-components-svelte", "svelte"], "Carbon 11", "Carbon Button"], [["evergreen-ui"], "Evergreen 7", "Evergreen Button"], [["tdesign-vue-next", "vue"], "TDesign 1", "TDesign Button"],
      [["radix-ui"], "Radix 1", "Radix Dialog"], [["react-native-paper"], "Paper 5", "Paper Button"], [["daisyui"], "Daisy 5", "Daisy Button"], [["wind-ui"], "Wind 2", "Wind Button"],
      [[], "vuetify, Vuetify 3", "Vuetify VBtn"], [[], "BOOTSTRAP, Bootstrap 5", "Bootstrap Modal"], [[], "Lightning Design System (SLDS), SLDS 2", "SLDS Button"], [["react"], "react, Headless UI (React)", "React Select"],
      [["antd"], "antd >=5 <6", "antd Table"], [["antd"], "antd ^5 || ^6", "antd Table"], [["antd"], "antd < 6", "antd Table"], [["antd"], "Ant Design (antd 5)", "antd Table"], [[], "Material UI (MUI 6)", "MUI Button"]];
    const yes = cases.map(verdict);
    const refusals = [[["tailwindcss", "@tailwindcss/vite"], "Tailwind 4", "Tailwind Card"], [["solid-js", "@solidjs/router"], "Solid 1", "Solid Button"], [["material-icons-react"], "Material 3", "Material Picker"],
      [["ant-react"], "Ant 5", "Ant Table"], [["antd-mobile"], "Antd 5", "Antd Table"], [["react"], "React 19 (React)", "React Select"], [["react"], "React 19 (REACT)", "React Select"], [["react"], "Headless UI (react), React 19", "React Select"], [["vue"], "Vue 3 (VUE)", "Vue Select"],
      [["antd"], "antd 5 (>= 5)", "Buton (>= 5 columns)"], [[], "Bootstrap 5 (^5)", "Buton ^5"]];
    const no = refusals.map(verdict);
    write(p, "package.json", js({ dependencies: { antd: "1.0.0" } }));
    write(p, REG, "# DS\n\n_Libraries: antd >=5.0.0 <6.0.0, Ant Design (antd 5), antd 5 (>= 5), carbon, Carbon 11_\n");
    const read = registry(p);
    all("1.35 review 11: a one-word name is backed by the library's OWN package — the word joined to what says \"its UI package\": a framework's name, `ui`, `components` (`Carbon` of carbon-components-svelte, `Evergreen` of evergreen-ui, `TDesign` of tdesign-vue-next, `Radix` of radix-ui, `Paper` of react-native-paper; review 10's \"joined to ONE framework's\" had lost them) — every part of what is joined, never some (`material-icons-react`), never to a short word (`Ant` / ant-react) nor to anything else (`antd-mobile`); a framework's STEM is a framework's (`Tailwind` beside @tailwindcss/vite, `Solid` beside @solidjs/router — a word merely INSIDE one is not: `Wind` of wind-ui). A name has ONE strength whatever its case and its place on the line: an entry written before its numbered form stays sure (`vuetify, Vuetify 3`, `BOOTSTRAP, Bootstrap 5` — compared with its case, the derived name weakened it), a numbered acronym makes an earlier weak note sure (`Lightning Design System (SLDS), SLDS 2`), a weak note leaves an entry in another case alone (`react, Headless UI (React)`) and never clears a weakness (`React 19 (React)`); a framework's name in capitals is a framework's (`React 19 (REACT)`). A range of several parts is a version (`antd >=5 <6`, `antd ^5 || ^6`, `antd < 6`), a note's bare number is dropped (`Ant Design (antd 5)`, `Material UI (MUI 6)`), and a note with no letter names nothing (`antd 5 (>= 5)` made \">= 5\" a library) (got " +
      js({ yes, no, libraries: read.libraries, weak: [...read.weakLibraries] }) + ")", {
      cited: () => js(yes) === js(cases.map(() => "approved")),
      refused: () => js(no) === js(refusals.map(() => REFUSED)),
      read: () => js(read.libraries) === js(["antd", "Ant Design", "antd 5", "carbon", "Carbon 11"]) && js([...read.weakLibraries]) === js([]),
    });
  }

  // --- a usage cell: one unclosed parenthesis, a long cell, a citation in nested parentheses ----------------------------------------------
  {
    const p = project("cells");
    write(p, REG, "# DS\n\n" + CARD + "_Libraries: @mui/material, Lightning Design System (SLDS), Bootstrap 5_\n");
    const approve = sized(p);
    const many = Array.from({ length: 12 }, (_, i) => "Field" + i + " (@mui/material, outlined)").join(", "); // 408 characters: the old bound fell inside the last parenthesis
    const rows = ["TextField (@mui/material, outlined), Card (wip", "TextField (@mui/material, outlined), Card :)", many, "Modal (Bootstrap, large (lg))", "Modal (large (lg), Bootstrap)", "Button (SLDS, size (2 cols))",
      "Button [SLDS (v2)]", "Card (wip · Card", "Card, Card (wip"];
    const yes = rows.map((r) => approve(["| Reuse | " + r + " | the list |"]));
    const long = Array.from({ length: 40 }, (_, i) => "Card (use " + i + ")").join(", ") + ", Buton"; // 595 characters: the unlisted one comes last
    const bad = ["Card ) Buton", long, "TextField (@mui/material, outlined), Buton (wip", "Card (wip, Buton", "Card (wip · Buton", "Dialog (@mui/material) :), Buton", "Button (SLDS", "Modal (large (lg)), Bootstrap"];
    const no = bad.map((r) => approve(["| Reuse | " + r + " | the list |"]));
    all("1.35 review 11: a usage cell is cut outside its parentheses, and only from the part a `(` is never closed in at every separator — `TextField (@mui/material, outlined), Card (wip` keeps its first entry whole (review 10 asked the balance of the whole cell, and one unclosed parenthesis — or a `:)` — refused it as \"outlined)\"); a `)` nothing opened hides nothing after it (`Card ) Buton`); a cell is read past its 400th character — twelve components of a library in one cell pass, and an unlisted component at the end of a long one is refused (it was never read); a weak alias is cited inside nested parentheses and brackets as the name is read outside them (`Modal (Bootstrap, large (lg))`, `Button [SLDS (v2)]`) — never from a parenthesis that does not close, nor outside one (got " +
      js({ yes, no, lengths: [many.length, long.length] }) + ")", {
      whole: () => js(yes) === js(rows.map(() => "approved")),
      refused: () => js(no) === js(bad.map(() => REFUSED)),
      bounds: () => many.length > 400 && long.length > 400,
    });
  }
};
