"use strict";
// The design-system registry (1.35) — review 10's findings: a note that names the library surely clears a weak shorter name,
// a framework's name or a package that merely begins with the word backs no library name (and the library's package FOR a
// framework does), a version range, a usage cell whose parentheses nest or do not close, a Less parameter list separated by
// `;` over lines — and the rules a mutation showed no fixture for (where a weak alias cites, a `&` rule's list, a theme's
// half, the parenthesis count at the margin, under a tab, after a stray `(`).

const fs = require("fs");
const path = require("path");

exports.run = async ({ all, S, tmp, approveBefore, require, __dirname }) => {
  const js = (v) => JSON.stringify(v);
  const E = require(path.join(__dirname, "lib", "engine", "index.js"));
  const write = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  const REG = ".specs/steering/design-system.md";
  const CARD = "| Component | Path | Variants | Notes |\n|---|---|---|---|\n| Card | `src/ui/Card.tsx` |  |  |\n\n";
  const project = (tag) => { const p = path.join(tmp, "proj-ds10-" + tag); S.initProject(p, ["ui"], "en"); return p; };
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
  // a size m feature whose design is ready for its approval → { approve(rows), detail(rows): the doctor check's text }
  const sized = (p) => {
    const f = S.createFeature(p, { name: "Sign Up", tracks: ["ui"], summary: "x", size: "m" });
    fs.writeFileSync(path.join(f.dir, "requirements.md"), REQ);
    fs.writeFileSync(path.join(f.dir, "design.md"), design(["| Reuse | Placeholder | x |"]));
    approveBefore(p, f.slug, "design");
    const approve = (rows) => { fs.writeFileSync(path.join(f.dir, "design.md"), design(rows)); const a = S.approvePhase(p, f.slug, "design", "t"); return a.ok ? "approved" : "refused:" + (a.failing || []).join(","); };
    const detail = (rows) => { fs.writeFileSync(path.join(f.dir, "design.md"), design(rows)); const c = (S.specDoctor(p, f.slug).checks || []).find((x) => x.id === "ui-design-system"); return c ? c.detail : ""; };
    return { approve, detail };
  };
  const REFUSED = "refused:ui-design-system";

  // --- a library's shorter name: what backs it, what a note says of it ---------------------------------------------------------------------
  {
    const p = project("names");
    write(p, "package.json", js({ dependencies: {} }));
    const f = sized(p);
    // [the project's dependencies, the _Libraries:_ line, a row] — with a Card row in the registry
    const verdict = ([deps, lib, row]) => {
      write(p, "package.json", js({ dependencies: Object.fromEntries(deps.map((d) => [d, "1.0.0"])) }));
      write(p, REG, "# DS\n\n" + CARD + "_Libraries: " + lib + "_\n");
      return f.approve(["| Reuse | " + row + " | the list |"]);
    };
    const cases = [[[], "Bootstrap 5 (Bootstrap)", "Bootstrap Modal"], [[], "Material 3 (Material)", "Material Button"], [[], "Material 3, Material UI (Material)", "Material Button"],
      [["flowbite-react"], "Flowbite 2", "Flowbite Modal"], [["react-bootstrap"], "Bootstrap 5", "Bootstrap Modal"], [["primevue"], "Prime 4", "Prime DataTable"], [["@park-ui/panda-preset"], "Park 1", "Park Button"],
      [["antd"], "antd ^5.21", "antd Table"], [["antd"], "antd >= 5", "antd Table"], [["antd"], "antd ~5.2", "antd Table"], [[], "@mui/material ^6", "Button (@mui/material)"], [["bootstrap"], "Bootstrap 5+", "Bootstrap Modal"],
      [["react"], "React Aria (react)", "Select (react)"], [["vue"], "Headless UI (vue)", "Listbox (vue)"], [["react"], "React Aria (react)", "React Aria Select"]];
    const yes = cases.map(verdict);
    const refusals = [[["next", "react"], "Next 15", "Next Button"], [["react"], "React 19", "React Select"], [["vue"], "Vue 3", "Vue Select"], [["lit"], "Lit 3", "Lit Button"], [["@angular/core"], "Angular 18", "Angular Datepicker"],
      [["tailwindcss"], "Tailwind 4", "Tailwind Card"], [["base64-js"], "Base 2", "Base Button"], [["core-js"], "Core 3", "Core Layout"], [["material-icons"], "Material 3", "Material Picker"],
      [["@mui/material", "@angular/material"], "Material 3", "Material Picker"], [[], "React Aria (react)", "React Select"], [[], "React Bootstrap (React)", "React Select"], [["vue"], "Headless UI (vue)", "Vue Select"],
      [["svelte"], "Skeleton (svelte)", "Svelte Select"], [["@apple/ui"], "App 2", "App Shell"]];
    const no = refusals.map(verdict);
    // what the registry reads of a note
    write(p, "package.json", js({ dependencies: { "@radix-ui/react-dialog": "1.0.0" } }));
    write(p, REG, "# DS\n\n_Libraries: Radix (@radix), Radix UI (Radix Themes), Ark (@radix-ui), Bootstrap 5 (Bootstrap), Material 3, a) antd, b) Chakra UI, Mantine (core_\n");
    const read = registry(p);
    // a registry with no component row: a scoped package written with a version range is one all the same
    write(p, REG, "# DS\n\n_Libraries: @mui/material ^6_\n");
    const only = registry(p).packaged + ":" + f.approve(["| Reuse | Buton | the list |"]);
    all("1.35 review 10: a note that names its library SURELY clears the weakness of the entry's shorter name — `Bootstrap 5 (Bootstrap)` and `Material 3 (Material)` are what their author wrote, with no package.json at all (the note was skipped as \"a name the registry holds already\", and `Bootstrap Modal` refused wherever the root manifest does not hold the package); a one-word name is backed by a dependency of that name, a scope that begins with it (four letters: `Park` of `@park-ui/…`) or the library's package FOR a framework (`Flowbite` of flowbite-react, `Bootstrap` of react-bootstrap, `Prime` of primevue) — never by a framework's own name (`Next 15`, `React 19`, `Vue 3`, `Lit 3`, `Angular 18`: \"Next Button\" is a wizard's) nor by a package that merely begins with or contains the word (`Tailwind` / tailwindcss, `Base` / base64-js, `Core` / core-js, `Material` / material-icons, @mui/material); a note that is a framework's name is weak when it is a word of the entry as when it is a dependency (`React Aria (react)`, `React Bootstrap (React)`, `Headless UI (vue)`: never \"React Select\" — while `Select (react)` and the entry's own two words still cite); a version range is a version (`antd ^5.21`, `antd >= 5`, `antd ~5.2`, `@mui/material ^6` — a library-only registry is checked through it); a bare scope needs a dependency UNDER it (`(@radix)` is none of `@radix-ui/…`), a short name EVERY word of the entry (`(Radix Themes)` is a remark), a short word no scope backs (`App` of `@apple/ui`: three letters), and on a marker line a `)` no `(` opened cuts nothing while an unclosed `(` keeps its entry (got " +
      js({ yes, no, libraries: read.libraries, weak: [...read.weakLibraries], only }) + ")", {
      cited: () => js(yes) === js(cases.map(() => "approved")),
      refused: () => js(no) === js(refusals.map(() => REFUSED)),
      read: () => js(read.libraries) === js(["Radix", "Radix UI", "Ark", "@radix-ui", "Bootstrap 5", "Bootstrap", "Material 3", "Material", "a) antd", "b) Chakra UI", "Mantine (core"]) && js([...read.weakLibraries]) === js(["material"]),
      only: () => only === "true:" + REFUSED,
    });
  }

  // --- a usage cell: parentheses that nest or do not close; where a weak alias cites; the unknown component's hint ---------------------
  {
    const p = project("cells");
    write(p, REG, "# DS\n\n" + CARD + "_Libraries: Lightning Design System (SLDS)_\n");
    const f = sized(p);
    const rows = ["Card ( ; Card", "Card (wide (2 cols), dense)", "Card (compact", "Card (a (b (c)), d) · Card", "Button (SLDS)", "Button [SLDS]", "Button — SLDS", "SLDS: Button"];
    const yes = rows.map((r) => f.approve(["| Reuse | " + r + " | the list |"]));
    const bad = ["Card, Buton (wip", "Card (wide (2 cols), dense), Buton", "Card ( ; Buton", "Card ) ( ; Buton", "a) Card, b) Dialog", "SLDS Button", "SLDS — Button", "Button: SLDS", "SLDS:Button"];
    const no = bad.map((r) => f.approve(["| Reuse | " + r + " | the list |"]));
    const hint = f.detail(["| Reuse | CardHeader | the card's header |"]);
    all("1.35 review 10: a usage cell's name is what stands OUTSIDE its parentheses, nested ones too — `Card (wide (2 cols), dense)` is Card (the first `)` ended the note, and \"dense)\" was refused) — and a cell whose parentheses do not balance is cut at every separator, as before review 9: `Card ( ; Card` is two Cards and `Card (compact` one (the unclosed `(` swallowed every component after it), while a component that is not listed is still refused behind one (`Card, Buton (wip`, `Card ( ; Buton`, and `Card ) ( ; Buton`, whose count comes back to zero); a weak alias cites inside `(…)` / `[…]`, AFTER a dash set off by blanks and BEFORE a colon followed by a blank — never on the other side of either, nor beside the name (`SLDS — Button`, `Button: SLDS`, `SLDS:Button`, `SLDS Button`); and an unknown component's hint says what to do when the code already has it — a file's further export (`CardHeader` of card.tsx): add its row (got " +
      js({ yes, no, hint: hint.slice(0, 260) }) + ")", {
      outside: () => js(yes) === js(rows.map(() => "approved")),
      refused: () => js(no) === js(bad.map(() => REFUSED)),
      hint: () => /'CardHeader' is not in the registry/.test(hint) && /add its row to the registry when the code already has it \(a file's further export\)/.test(hint),
    });
  }

  // --- a stylesheet's statements: Less parameters separated by `;`, the count at the margin, under a tab, after a stray `(` ---------------
  {
    const p = project("statements");
    write(p, "src/styles/variables.less", [".button-variant(@color; @background; @border;", "  @hover-background: darken(@background, 7.5%);", "  @hover-border: darken(@border, 10%)) {", "  color: @color;", "}",
      "@hover-background: #0b5ed7;", "@hover-border: #0a58ca;", ".btn { .button-variant(#fff; #0d6efd;", "    @border: #0d6efd); }", "@btn-border: #0d6efd;", "@open: fade(#000;", "@after-open: 4px;"].join("\n") + "\n");
    write(p, "src/styles/_variables.scss", ["@mixin card(", "$card-pad: 1px,", "$card-gap: 2px", ") { padding: $card-pad; }", "$card-gap: 6px;",
      "@mixin m(", "  $m-a: 1px,", "  $m-x: fn(1px", "  $m-b: 2px,", "  $m-c: 3px", ") { width: $m-a; }", "$m-b: 5px;", "$m-c: 7px;",
      ".broken {", "  width: calc(100% - 2px;", "  $after-broken: 3px;", "}"].join("\n") + "\n");
    write(p, "src/styles/tokens.sass", ["=box($pad: 1px,", "\t$shadow: 2px,", "\t$third: 3px)", "\tpadding: $pad", "$shadow: 9px", "$third: 8px"].join("\n") + "\n");
    const rep = S.designSystemReport(p);
    const got = Object.fromEntries(rep.newTokens.map((t) => [t.name, t.value]));
    all("1.35 review 10: in Less a mixin's parameters are separated by `;` and go on over lines — `.button-variant(@color; @background; @border;` then its defaults: the count was undone at the end of a line that ends in neither `,` nor `(`, so `@hover-background: darken(…)` was listed as a token and shadowed the real one below; a call's `@border: #0d6efd)` on its second line is an argument — while a DECLARATION that leaves a `(` open on a line ending in `;` still goes on nowhere (`@open: fade(#000;`); in SCSS a parameter at the margin is a parameter (only an indented file's margin line is a statement of its own), under a TAB too in a .sass, and a stray `(` inside an open list is undone to the list's own count, not to none (`$m-x: fn(1px` then `$m-b: 2px,`) — and outside Less a line that ends in `;` still goes on nowhere (`width: calc(100% - 2px;`) (got " +
      js({ got, sources: rep.found.sources }) + ")", {
      less: () => got["@hover-background"] === "#0b5ed7" && got["@hover-border"] === "#0a58ca" && got["@btn-border"] === "#0d6efd" && !("@border" in got) && !("@color" in got),
      declaration: () => got["@after-open"] === "4px",
      margin: () => got["$card-gap"] === "6px" && !("$card-pad" in got),
      stray: () => got["$m-b"] === "5px" && got["$m-c"] === "7px" && !("$m-a" in got) && !("$m-x" in got),
      scss: () => got["$after-broken"] === "3px",
      tab: () => got.$shadow === "9px" && got.$third === "8px" && !("$pad" in got),
    });
  }

  // --- a page-wide block: a `&` rule's list, a child of the root, a theme's half -----------------------------------------------------------
  {
    const p = project("blocks");
    write(p, "src/app.scss", [":root {", "  --a0: 0px; --a1: 1px; --a2: 2px; --a3: 3px; --a4: 4px;", "  &.dark, & .card { --amp-list: 1px; }", "}", "html {", "  &>body { --amp-child: 1px; }", "  & > main { --amp-main: 1px; }", "  & .card { --amp-inside: 1px; }", "}",
      ".two-of-five { --a0: 2px; --a1: 2px; --own0: 1px; --own1: 1px; --own2: 1px; }",
      ".three-of-six { --a0: 3px; --a1: 3px; --a2: 3px; --half0: 1px; --half1: 1px; --half2: 1px; }"].join("\n") + "\n");
    const names = Object.keys(tokensOf(p));
    all("1.35 review 10 (rules no fixture held): a rule nested in a page-wide one declares for the page when ONE selector of its list only qualifies the parent (`&.dark, & .card`), never as its child or its descendant (`html { &>body { … } }`, with or without blanks; `& .card`); a block is a theme when at least HALF of what it declares overrides page-wide tokens — three of six is one, two of five is not (got " + js(names) + ")", {
      list: () => names.includes("--amp-list"),
      child: () => !names.includes("--amp-child") && !names.includes("--amp-main") && !names.includes("--amp-inside"),
      half: () => ["--half0", "--half1", "--half2"].every((n) => names.includes(n)) && !names.some((n) => /^--own/.test(n)),
      wide: () => ["--a0", "--a1", "--a2", "--a3", "--a4"].every((n) => names.includes(n)),
    });
  }
};
